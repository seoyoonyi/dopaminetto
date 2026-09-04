import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

import { STALE_CHANNEL_REMOVAL_TIMEOUT_MS } from "./realtimeRecoveryConstants";

const getRealtimeTopic = (channelName: string) => `realtime:${channelName}`;

const getRealtimeTopicChannels = (
  supabase: SupabaseClient,
  channelName: string,
): RealtimeChannel[] => {
  if (typeof supabase.getChannels !== "function") return [];

  return supabase
    .getChannels()
    .filter((channel) => channel.topic === getRealtimeTopic(channelName));
};

const removeChannelSafely = (supabase: SupabaseClient, channel: RealtimeChannel) => {
  try {
    return Promise.resolve(supabase.removeChannel(channel));
  } catch (error) {
    return Promise.reject(error);
  }
};

/**
 * 같은 topic의 잔존 채널을 제거하고, 제거가 비정상적으로 지연되면 해당 채널만 정리한다.
 * realtime-js의 channel(topic)은 기존 인스턴스를 재사용할 수 있으므로, 새 subscribe 전에
 * 이 정리를 공통으로 거쳐야 subscribe()가 조용히 무시되는 경합을 막을 수 있다.
 */
export const removeRealtimeTopic = async (
  supabase: SupabaseClient,
  channelName: string,
  { logPrefix = "realtimeTopicCleanup" }: { logPrefix?: string } = {},
): Promise<void> => {
  const lingeringChannels = getRealtimeTopicChannels(supabase, channelName);

  if (lingeringChannels.length === 0) return;

  let timeout: ReturnType<typeof setTimeout> | null = null;
  try {
    await Promise.race([
      Promise.allSettled(
        lingeringChannels.map((channel) => removeChannelSafely(supabase, channel)),
      ).then(() => undefined),
      new Promise<void>((resolve) => {
        timeout = setTimeout(resolve, STALE_CHANNEL_REMOVAL_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  const remainingChannels = getRealtimeTopicChannels(supabase, channelName);

  if (remainingChannels.length === 0) return;

  console.warn(`[${logPrefix}] 오래된 실시간 채널 제거 시간 초과`, {
    channelName,
    remainingCount: remainingChannels.length,
  });

  // removeChannel()이 전송 문제로 끝나지 않아도 해당 채널만 정리한다. 공유 소켓을 끊으면
  // 같은 소켓을 사용하는 다른 town/village/chat 채널까지 영향을 받으므로 전역 disconnect는 금지한다.
  remainingChannels.forEach((channel) => {
    if (channel.state !== "closed" && typeof channel.teardown === "function") {
      channel.teardown();
    }
  });

  // 실제 RealtimeClient에서는 channels가 topic registry 역할을 한다. 테스트/mock처럼 registry를
  // 노출하지 않는 구현에서는 위 채널 정리만 수행한다.
  const realtimeChannels = supabase.realtime?.channels;
  if (Array.isArray(realtimeChannels)) {
    const staleChannelSet = new Set(remainingChannels);
    supabase.realtime.channels = realtimeChannels.filter(
      (channel) => !staleChannelSet.has(channel),
    );
  }
};
