import { beforeEach, describe, expect, it, vi } from "vitest";

import { fetchPlayerPosition } from "./playerPositionService";

const { fromMock, selectMock, eqMock, singleMock, maybeSingleMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  selectMock: vi.fn(),
  eqMock: vi.fn(),
  singleMock: vi.fn(),
  maybeSingleMock: vi.fn(),
}));

vi.mock("@/shared/config/supabase.client", () => ({
  supabase: { from: fromMock },
}));

describe("fetchPlayerPosition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromMock.mockReturnValue({ select: selectMock });
    selectMock.mockReturnValue({ eq: eqMock });
    eqMock.mockReturnValue({ single: singleMock, maybeSingle: maybeSingleMock });
  });

  it("저장 위치가 없으면 maybeSingle로 null을 반환하고 오류를 던지지 않는다", async () => {
    singleMock.mockResolvedValue({
      data: null,
      error: { code: "PGRST116", message: "JSON object requested, no rows returned" },
    });
    maybeSingleMock.mockResolvedValue({ data: null, error: null });

    await expect(fetchPlayerPosition("new-user")).resolves.toBeNull();

    expect(maybeSingleMock).toHaveBeenCalledOnce();
    expect(singleMock).not.toHaveBeenCalled();
  });

  it("저장 위치가 있으면 위치 데이터를 반환한다", async () => {
    const savedPosition = { village_id: "lobby", x: 495, y: 734 };
    maybeSingleMock.mockResolvedValue({ data: savedPosition, error: null });

    await expect(fetchPlayerPosition("saved-user")).resolves.toEqual(savedPosition);
  });

  it("조회 오류는 호출부로 전달한다", async () => {
    const error = new Error("permission denied");
    maybeSingleMock.mockResolvedValue({ data: null, error });

    await expect(fetchPlayerPosition("blocked-user")).rejects.toBe(error);
  });
});
