import { MAX_AUTO_RECONNECT, RECONNECT_BACKOFF_MS } from "@/shared/lib/realtime/reconnectBackoff";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { subscribeChatChannelWithReconnect } from "./chatChannelReconnect";

type StatusCallback = (status: string) => void;

interface FakeChannel {
  on: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  emitStatus: StatusCallback;
}

const createFakeChannel = (): FakeChannel => {
  const channel = {} as FakeChannel;
  let statusCallback: StatusCallback = () => {};

  channel.on = vi.fn(() => channel);
  channel.subscribe = vi.fn((callback: StatusCallback) => {
    statusCallback = callback;
    return channel;
  });
  channel.emitStatus = (status: string) => statusCallback(status);

  return channel;
};

const createFakeSupabase = () => {
  const channels: FakeChannel[] = [];
  const channel = vi.fn(() => {
    const fakeChannel = createFakeChannel();
    channels.push(fakeChannel);
    return fakeChannel;
  });
  const removeChannel = vi.fn();

  return { channel, removeChannel, channels };
};

let visibilityHandler: (() => void) | undefined;
let fakeDocument: {
  visibilityState: string;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.useFakeTimers();
  visibilityHandler = undefined;
  fakeDocument = {
    visibilityState: "visible",
    addEventListener: vi.fn((_event: string, handler: () => void) => {
      visibilityHandler = handler;
    }),
    removeEventListener: vi.fn(),
  };
  vi.stubGlobal("document", fakeDocument);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const startSubscription = () => {
  const supabase = createFakeSupabase();
  const onStatusChange = vi.fn();
  const onInsert = vi.fn();

  const cleanup = subscribeChatChannelWithReconnect({
    supabase: supabase as unknown as SupabaseClient,
    channelName: "chat:lobby",
    table: "chat",
    roomFilter: "room_id=eq.lobby",
    onInsert,
    onStatusChange,
  });

  return { supabase, onStatusChange, onInsert, cleanup };
};

describe("subscribeChatChannelWithReconnect", () => {
  it("시작 시 단일 채널을 구독한다", () => {
    const { supabase } = startSubscription();

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(supabase.channel).toHaveBeenCalledWith("chat:lobby");
  });

  it("채널이 SUBSCRIBED 상태인 동안에는 재연결을 예약하지 않는다", () => {
    const { supabase, onStatusChange } = startSubscription();

    supabase.channels[0].emitStatus("SUBSCRIBED");
    vi.advanceTimersByTime(RECONNECT_BACKOFF_MS[RECONNECT_BACKOFF_MS.length - 1] + 1000);

    expect(onStatusChange).toHaveBeenCalledWith("SUBSCRIBED");
    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("CLOSED 상태 이후 backoff가 지나면 정확히 한 번만 재구독한다", () => {
    const { supabase, onStatusChange } = startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    expect(onStatusChange).toHaveBeenCalledWith("CLOSED");

    vi.advanceTimersByTime(RECONNECT_BACKOFF_MS[0] - 1);
    expect(supabase.channel).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(supabase.removeChannel).toHaveBeenCalledWith(supabase.channels[0]);
  });

  it("재연결 시도가 SUBSCRIBED에 도달하면 재시도 카운터를 초기화한다", () => {
    const { supabase } = startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    vi.advanceTimersByTime(RECONNECT_BACKOFF_MS[0]);
    expect(supabase.channel).toHaveBeenCalledTimes(2);

    supabase.channels[1].emitStatus("SUBSCRIBED");
    supabase.channels[1].emitStatus("CLOSED");
    vi.advanceTimersByTime(RECONNECT_BACKOFF_MS[0] - 1);
    expect(supabase.channel).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(1);
    expect(supabase.channel).toHaveBeenCalledTimes(3);
  });

  it("MAX_AUTO_RECONNECT만큼 연속 실패가 쌓이면 재시도를 멈춘다", () => {
    const { supabase } = startSubscription();

    for (let attempt = 0; attempt < MAX_AUTO_RECONNECT; attempt += 1) {
      const lastChannel = supabase.channels[supabase.channels.length - 1];
      lastChannel.emitStatus("CLOSED");
      vi.runOnlyPendingTimers();
    }

    // 최초 1회 + 재시도 MAX_AUTO_RECONNECT회.
    expect(supabase.channel).toHaveBeenCalledTimes(1 + MAX_AUTO_RECONNECT);

    const finalChannel = supabase.channels[supabase.channels.length - 1];
    finalChannel.emitStatus("CLOSED");
    vi.runOnlyPendingTimers();

    expect(supabase.channel).toHaveBeenCalledTimes(1 + MAX_AUTO_RECONNECT);
  });

  it("탭 복귀 시 SUBSCRIBED 상태가 아니면 backoff를 건너뛰고 즉시 재연결한다", () => {
    const { supabase } = startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    expect(supabase.channel).toHaveBeenCalledTimes(1);

    fakeDocument.visibilityState = "visible";
    visibilityHandler?.();
    // 즉시(0ms) 재연결이므로 0ms만 진행해도 실행된다.
    vi.advanceTimersByTime(0);

    expect(supabase.channel).toHaveBeenCalledTimes(2);
    expect(supabase.removeChannel).toHaveBeenCalledWith(supabase.channels[0]);
  });

  it("이미 SUBSCRIBED 상태에서 탭 가시성이 바뀌어도 채널을 중복 생성하지 않는다", () => {
    const { supabase } = startSubscription();

    supabase.channels[0].emitStatus("SUBSCRIBED");
    visibilityHandler?.();

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("connect 시도가 아직 진행 중일 때 가시성 이벤트가 발생해도 채널을 중복 생성하지 않는다", () => {
    const { supabase } = startSubscription();

    // 최초 connect()가 아직 상태 콜백을 받기 전(in-flight)인 상황을 재현한다.
    visibilityHandler?.();

    expect(supabase.channel).toHaveBeenCalledTimes(1);
  });

  it("cleanup 시 대기 중인 재연결 타이머를 취소하고 가시성 리스너를 제거한다", () => {
    const { supabase, cleanup } = startSubscription();

    supabase.channels[0].emitStatus("CLOSED");
    cleanup();

    vi.advanceTimersByTime(RECONNECT_BACKOFF_MS[0] + 1000);

    expect(supabase.channel).toHaveBeenCalledTimes(1);
    expect(fakeDocument.removeEventListener).toHaveBeenCalledWith(
      "visibilitychange",
      visibilityHandler,
    );
  });

  it("cleanup 이후에는 insert와 상태 업데이트 전달을 중단한다", () => {
    const { supabase, cleanup, onStatusChange } = startSubscription();

    cleanup();
    onStatusChange.mockClear();

    supabase.channels[0].emitStatus("SUBSCRIBED");

    expect(onStatusChange).not.toHaveBeenCalled();
  });
});
