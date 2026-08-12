import { afterEach, describe, expect, it, vi } from "vitest";

import { cancelRemotePlayerRemoval, scheduleRemotePlayerRemoval } from "./remotePlayerRemoval";

describe("scheduleRemotePlayerRemoval", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps the player during the grace period", () => {
    vi.useFakeTimers();
    const pendingRemovalTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    const onConfirmed = vi.fn();

    scheduleRemotePlayerRemoval({
      pendingRemovalTimeouts,
      remoteUserId: "user-1",
      graceMs: 2_500,
      isPresent: () => true,
      onConfirmed,
    });

    vi.advanceTimersByTime(2_500);

    expect(onConfirmed).not.toHaveBeenCalled();
    expect(pendingRemovalTimeouts).toHaveProperty("size", 0);
  });

  it("confirms removal after the grace period when the player is absent", () => {
    vi.useFakeTimers();
    const pendingRemovalTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    const onConfirmed = vi.fn();

    scheduleRemotePlayerRemoval({
      pendingRemovalTimeouts,
      remoteUserId: "user-1",
      graceMs: 2_500,
      isPresent: () => false,
      onConfirmed,
    });

    vi.advanceTimersByTime(2_500);

    expect(onConfirmed).toHaveBeenCalledOnce();
    expect(pendingRemovalTimeouts).toHaveProperty("size", 0);
  });

  it("does not create a duplicate timer for the same player", () => {
    vi.useFakeTimers();
    const pendingRemovalTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    const onConfirmed = vi.fn();
    const params = {
      pendingRemovalTimeouts,
      remoteUserId: "user-1",
      graceMs: 2_500,
      isPresent: () => false,
      onConfirmed,
    };

    scheduleRemotePlayerRemoval(params);
    scheduleRemotePlayerRemoval(params);
    vi.advanceTimersByTime(2_500);

    expect(onConfirmed).toHaveBeenCalledOnce();
  });

  it("cancels removal when the player reappears during the grace period", () => {
    vi.useFakeTimers();
    const pendingRemovalTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
    const onConfirmed = vi.fn();

    scheduleRemotePlayerRemoval({
      pendingRemovalTimeouts,
      remoteUserId: "user-1",
      graceMs: 2_500,
      isPresent: () => false,
      onConfirmed,
    });

    cancelRemotePlayerRemoval({
      pendingRemovalTimeouts,
      remoteUserId: "user-1",
    });

    vi.advanceTimersByTime(2_500);

    expect(onConfirmed).not.toHaveBeenCalled();
    expect(pendingRemovalTimeouts).toHaveProperty("size", 0);
  });
});
