// @vitest-environment jsdom
import type { MapLoader } from "@/entities/village";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import type { User } from "@supabase/supabase-js";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { useRestorePlayerPosition } from "./useRestorePlayerPosition";

const { fetchPlayerPosition } = vi.hoisted(() => ({ fetchPlayerPosition: vi.fn() }));
vi.mock("../lib/playerPositionService", () => ({ fetchPlayerPosition }));
vi.mock("@/shared/config/supabase.client", () => ({ supabase: {} }));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const user = {
  id: "auth-user",
  aud: "authenticated",
  app_metadata: {},
  user_metadata: { nickname: "기존이름" },
  created_at: "2026-09-28T00:00:00Z",
} satisfies User;
const mapLoader = {
  getMapBounds: () => ({ x: 0, y: 0, width: 1000, height: 1000 }),
  getCollisionRects: () => [],
  getVillageAt: () => "lobby",
  getSpawnPoint: () => ({ x: 100, y: 100 }),
} as unknown as MapLoader;

let root: Root;
let container: HTMLDivElement;
let queryClient: QueryClient;

function RestorePosition() {
  const { restoreStatus } = useRestorePlayerPosition();
  return <span>{restoreStatus}</span>;
}

const settle = async () => act(async () => new Promise((resolve) => setTimeout(resolve, 10)));

beforeEach(async () => {
  fetchPlayerPosition.mockReset().mockResolvedValue({ village_id: "lobby", x: 100, y: 100 });
  useMovementStore.getState().reset();
  useMovementStore.getState().setMapLoader(mapLoader);
  queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  queryClient.setQueryData(["userInfo"], user);
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () =>
    root.render(
      <QueryClientProvider client={queryClient}>
        <RestorePosition />
      </QueryClientProvider>,
    ),
  );
  expect(useMovementStore.getState().position).toEqual({ x: 100, y: 100 });
});

afterEach(async () => {
  await act(async () => root.unmount());
  queryClient.clear();
  container.remove();
});

describe("닉네임 변경 후 현재 위치 유지", () => {
  it("같은 사용자의 userInfo 갱신은 위치를 재조회하거나 입장 위치로 되돌리지 않는다", async () => {
    useMovementStore.getState().setPosition({ x: 400, y: 500 });
    await act(async () =>
      queryClient.setQueryData(["userInfo"], {
        ...user,
        user_metadata: { nickname: "새이름" },
      }),
    );
    await settle();

    expect(useMovementStore.getState().position).toEqual({ x: 400, y: 500 });
    expect(fetchPlayerPosition).toHaveBeenCalledTimes(1);
    expect(container.textContent).toBe("restored");
  });

  it("인증 사용자가 바뀌면 새 사용자의 위치를 복원한다", async () => {
    fetchPlayerPosition.mockResolvedValue({ village_id: "lobby", x: 600, y: 700 });
    await act(async () => queryClient.setQueryData(["userInfo"], { ...user, id: "other-user" }));
    await settle();

    expect(fetchPlayerPosition).toHaveBeenLastCalledWith("other-user");
    expect(useMovementStore.getState().position).toEqual({ x: 600, y: 700 });
  });
});
