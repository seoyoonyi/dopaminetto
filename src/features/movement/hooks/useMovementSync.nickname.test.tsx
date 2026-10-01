// @vitest-environment jsdom
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useUserStore } from "@/shared/store/useUserStore";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { useMovementSync } from "./useMovementSync";

const { channel, supabase } = vi.hoisted(() => ({
  supabase: {},
  channel: {
    track: vi.fn().mockResolvedValue("ok"),
    send: vi.fn().mockResolvedValue("ok"),
    untrack: vi.fn().mockResolvedValue("ok"),
    presenceState: () => ({}),
  },
}));
vi.mock("@/app/providers/SupabaseProvider", () => ({ useSupabase: () => supabase }));
vi.mock("@/shared/hooks/useUserInfo", () => ({
  useUserInfo: () => ({ data: { id: "auth-user" } }),
}));
vi.mock("@/shared/lib/realtime/townChannelManager", () => ({
  acquireTownChannel: () => () => {},
  getTownChannel: () => channel,
  getTownChannelStatus: () => "SUBSCRIBED",
  observeTownChannelBroadcast: () => () => {},
  observeTownChannelPresence: () => () => {},
  observeTownChannelStatus: () => () => {},
  reconnectTownChannel: vi.fn(),
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root;
let container: HTMLDivElement;

function MovementSync() {
  useMovementSync();
  return null;
}

beforeEach(async () => {
  vi.clearAllMocks();
  useMovementStore.getState().reset();
  useUserStore.setState({
    userId: "local-user",
    userNickname: "기존이름",
    selectedCharacterId: "p-girl",
  });
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => root.render(<MovementSync />));
});

afterEach(async () => {
  await act(async () => root.unmount());
  container.remove();
});

it("정지 상태에서 닉네임 변경 시 이름표·실시간 전송·신규 입장자용 Presence를 갱신한다", async () => {
  const position = useMovementStore.getState().position;
  await act(async () => useUserStore.getState().setUserNickname("새이름"));

  expect(useMovementStore.getState()).toMatchObject({
    userId: "local-user",
    nickname: "새이름",
    characterId: "p-girl",
    position,
  });
  expect(channel.send).toHaveBeenLastCalledWith(
    expect.objectContaining({
      payload: expect.objectContaining({ userId: "local-user", nickname: "새이름" }),
    }),
  );
  expect(channel.track).toHaveBeenLastCalledWith(
    expect.objectContaining({ userId: "local-user", nickname: "새이름", characterId: "p-girl" }),
  );
  expect(channel.send.mock.calls.some(([message]) => message.event === "sync-leave")).toBe(false);
  expect(channel.untrack).not.toHaveBeenCalled();
});
