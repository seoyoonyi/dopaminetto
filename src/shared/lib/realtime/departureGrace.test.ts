import { afterEach, describe, expect, it, vi } from "vitest";

import { createDepartureGraceController } from "./departureGrace";

describe("createDepartureGraceController", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("grace 만료 전에 스냅샷에 다시 나타나면 id를 유지한다", () => {
    vi.useFakeTimers();
    const onConfirmed = vi.fn();
    let present = false;
    const controller = createDepartureGraceController({
      graceMs: 2_500,
      isChannelReconnecting: () => false,
      isPresentInSnapshot: () => present,
      onConfirmed,
    });

    controller.schedule("user-1");
    present = true;
    vi.advanceTimersByTime(2_500);

    expect(onConfirmed).not.toHaveBeenCalled();
  });

  it("id가 실제로 없고 채널이 안정적이면 grace 이후 확정한다", () => {
    vi.useFakeTimers();
    const onConfirmed = vi.fn();
    const controller = createDepartureGraceController({
      graceMs: 2_500,
      isChannelReconnecting: () => false,
      isPresentInSnapshot: () => false,
      onConfirmed,
    });

    controller.schedule("user-1");
    vi.advanceTimersByTime(2_500);

    expect(onConfirmed).toHaveBeenCalledExactlyOnceWith("user-1");
  });

  it("같은 id에 대해 중복 타이머를 예약하지 않는다", () => {
    vi.useFakeTimers();
    const onConfirmed = vi.fn();
    const controller = createDepartureGraceController({
      graceMs: 2_500,
      isChannelReconnecting: () => false,
      isPresentInSnapshot: () => false,
      onConfirmed,
    });

    controller.schedule("user-1");
    controller.schedule("user-1");
    vi.advanceTimersByTime(2_500);

    expect(onConfirmed).toHaveBeenCalledOnce();
  });

  it("cancel()은 진행 중인 grace 타이머를 제거한다", () => {
    vi.useFakeTimers();
    const onConfirmed = vi.fn();
    const controller = createDepartureGraceController({
      graceMs: 2_500,
      isChannelReconnecting: () => false,
      isPresentInSnapshot: () => false,
      onConfirmed,
    });

    controller.schedule("user-1");
    controller.cancel("user-1");
    vi.advanceTimersByTime(2_500);

    expect(onConfirmed).not.toHaveBeenCalled();
  });

  describe("재연결을 고려한 유예와 reconcile()", () => {
    it("grace 만료 시점에 채널이 재연결 중이면 조용히 삭제하지 않고 확정을 유예한다", () => {
      vi.useFakeTimers();
      const onConfirmed = vi.fn();
      let reconnecting = true;
      const controller = createDepartureGraceController({
        graceMs: 2_500,
        isChannelReconnecting: () => reconnecting,
        isPresentInSnapshot: () => false,
        onConfirmed,
      });

      controller.schedule("user-1");
      vi.advanceTimersByTime(2_500);

      expect(onConfirmed).not.toHaveBeenCalled();

      // 채널이 여전히 재연결 중이면 reconcile()을 불러도 확정하지 않는다.
      controller.reconcile();
      expect(onConfirmed).not.toHaveBeenCalled();

      reconnecting = false;
      controller.reconcile();

      expect(onConfirmed).toHaveBeenCalledExactlyOnceWith("user-1");
    });

    it("reconcile() 전에 다시 나타나면 유예된 id를 유지한다", () => {
      vi.useFakeTimers();
      const onConfirmed = vi.fn();
      let reconnecting = true;
      let present = false;
      const controller = createDepartureGraceController({
        graceMs: 2_500,
        isChannelReconnecting: () => reconnecting,
        isPresentInSnapshot: () => present,
        onConfirmed,
      });

      controller.schedule("user-1");
      vi.advanceTimersByTime(2_500);

      reconnecting = false;
      present = true;
      controller.reconcile();

      expect(onConfirmed).not.toHaveBeenCalled();
    });

    it("확인 대기 중인 것이 없으면 reconcile()은 아무 동작도 하지 않는다", () => {
      const onConfirmed = vi.fn();
      const controller = createDepartureGraceController({
        graceMs: 2_500,
        isChannelReconnecting: () => false,
        isPresentInSnapshot: () => false,
        onConfirmed,
      });

      expect(() => controller.reconcile()).not.toThrow();
      expect(onConfirmed).not.toHaveBeenCalled();
    });

    it("grace 타이머가 아직 진행 중인 id는 reconcile()이 건드리지 않는다", () => {
      vi.useFakeTimers();
      const onConfirmed = vi.fn();
      const controller = createDepartureGraceController({
        graceMs: 10_000,
        isChannelReconnecting: () => false,
        isPresentInSnapshot: () => false,
        onConfirmed,
      });

      controller.schedule("user-1");
      vi.advanceTimersByTime(2_000);

      // 아직 grace 만료 전인데 reconcile()이 자주 불려도 조기 삭제되지 않는다.
      controller.reconcile();
      controller.reconcile();
      controller.reconcile();
      expect(onConfirmed).not.toHaveBeenCalled();

      vi.advanceTimersByTime(8_000);
      expect(onConfirmed).toHaveBeenCalledExactlyOnceWith("user-1");
    });

    it("reconcile()로 유예된 id를 확정할 때 새로운 grace 기간을 다시 시작하지 않는다", () => {
      vi.useFakeTimers();
      const onConfirmed = vi.fn();
      let reconnecting = true;
      const controller = createDepartureGraceController({
        graceMs: 2_500,
        isChannelReconnecting: () => reconnecting,
        isPresentInSnapshot: () => false,
        onConfirmed,
      });

      controller.schedule("user-1");
      vi.advanceTimersByTime(2_500);
      reconnecting = false;

      // reconcile() 호출 즉시 확정돼야 한다 (새 grace 타이머를 또 기다리지 않음).
      controller.reconcile();
      expect(onConfirmed).toHaveBeenCalledExactlyOnceWith("user-1");
    });

    it("다중 채널: 감시 중인 채널 중 하나라도 재연결 중이면 유예 상태를 유지하고, 모두 안정화되면 확정한다", () => {
      vi.useFakeTimers();
      const onConfirmed = vi.fn();
      const channelStatuses = { a: "SUBSCRIBED", b: "SUBSCRIBING" };
      const controller = createDepartureGraceController({
        graceMs: 2_500,
        isChannelReconnecting: () =>
          Object.values(channelStatuses).some((status) => status !== "SUBSCRIBED"),
        isPresentInSnapshot: () => false,
        onConfirmed,
      });

      controller.schedule("user-1");
      vi.advanceTimersByTime(2_500);
      expect(onConfirmed).not.toHaveBeenCalled();

      // 채널 A의 sync로 reconcile()이 불려도 채널 B가 아직 reconnecting이면 확정하지 않는다.
      controller.reconcile();
      expect(onConfirmed).not.toHaveBeenCalled();

      // 채널 B도 안정화된 뒤에야 확정한다.
      channelStatuses.b = "SUBSCRIBED";
      controller.reconcile();
      expect(onConfirmed).toHaveBeenCalledExactlyOnceWith("user-1");
    });

    it("cancel()은 재연결 확인을 대기 중인 id도 제거한다", () => {
      vi.useFakeTimers();
      const onConfirmed = vi.fn();
      const reconnecting = { current: true };
      const controller = createDepartureGraceController({
        graceMs: 2_500,
        isChannelReconnecting: () => reconnecting.current,
        isPresentInSnapshot: () => false,
        onConfirmed,
      });

      controller.schedule("user-1");
      vi.advanceTimersByTime(2_500);

      controller.cancel("user-1");
      reconnecting.current = false;
      controller.reconcile();

      expect(onConfirmed).not.toHaveBeenCalled();
    });
  });

  describe("cancelAll()", () => {
    it("진행 중인 grace 타이머와 재연결 대기 항목을 모두 제거한다", () => {
      vi.useFakeTimers();
      const onConfirmed = vi.fn();
      let reconnecting = true;
      const controller = createDepartureGraceController({
        graceMs: 2_500,
        isChannelReconnecting: () => reconnecting,
        isPresentInSnapshot: () => false,
        onConfirmed,
      });

      controller.schedule("user-1");
      controller.schedule("user-2");
      vi.advanceTimersByTime(2_500);

      controller.cancelAll();
      reconnecting = false;
      controller.reconcile();
      vi.advanceTimersByTime(10_000);

      expect(onConfirmed).not.toHaveBeenCalled();
    });
  });
});
