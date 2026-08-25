import { SupabaseClient } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * townChannelManager는 대부분 다른 feature 테스트에서 mock으로 간접 검증되지만,
 * "auth freshness 확보 실패 시 소켓 리셋을 진행하지 않는다"는 이번 수정의 핵심 보장은
 * ensureFreshRealtimeAuth 단위 테스트만으로 증명할 수 없다(destructive teardown/disconnect가
 * 실제로 호출되지 않는지는 townChannelManager 내부에서만 관찰 가능하다). 그래서 이 파일에서
 * 최소한으로 통합 테스트 하나만 추가한다.
 */

type SubscribeCallback = (status: string, err?: Error) => void;

const createFakeChannel = () => {
  let latestCallback: SubscribeCallback = () => {};
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn((callback: SubscribeCallback) => {
      latestCallback = callback;
      return channel;
    }),
    presenceState: vi.fn(() => ({})),
  };
  return { channel, getLatestCallback: () => latestCallback };
};

describe("townChannelManager: auth freshness 실패 시 소켓 리셋 중단", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("getSession/익명 세션 복구가 모두 실패하면 realtime.disconnect/connect가 호출되지 않는다", async () => {
    const disconnect = vi.fn();
    const connect = vi.fn();
    const getSession = vi.fn().mockResolvedValue({ data: { session: null }, error: null });
    const signInAnonymously = vi.fn().mockResolvedValue({ error: { message: "network down" } });

    const channelSpy = vi.fn();
    const supabase = {
      channel: channelSpy,
      removeChannel: vi.fn().mockResolvedValue(undefined),
      auth: { getSession, signInAnonymously },
      realtime: {
        disconnect,
        connect,
        isDisconnecting: vi.fn(() => false),
        accessTokenValue: null,
        setAuth: vi.fn(),
      },
    } as unknown as SupabaseClient;

    const { acquireTownChannel } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:freshness-failure", userId: "user-1" });

    // subscribe 직전 auth freshness 게이트가 매 attempt마다 걸리므로, getSession/익명 로그인이
    // 계속 실패하는 한 channel조차 만들어지지 않는다(= subscribe 자체가 나가지 않는다). 이 상태로
    // reconnectCounts가 MAX_AUTO_RECONNECT까지 쌓이면 resetRealtimeSocket()이 트리거되는데, 거기서도
    // 다시 auth freshness를 먼저 시도하고 실패하므로 disconnect/connect까지는 도달하지 않아야 한다.
    // reconnectCount 0(즉시) -> 1(1000ms 사용 안 함, freshness 실패 경로는 backoff[1]부터 소비) ->
    // 2 -> 3 -> 4 순으로 RECONNECT_BACKOFF_MS를 그대로 소비한다.
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(2000);
    await vi.advanceTimersByTimeAsync(4000);
    await vi.advanceTimersByTimeAsync(8000);
    await vi.advanceTimersByTimeAsync(16000);

    expect(channelSpy).not.toHaveBeenCalled();
    expect(getSession).toHaveBeenCalled();
    expect(signInAnonymously).toHaveBeenCalled();
    expect(disconnect).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });
});

/**
 * #173 핵심 수정: scheduleConnect()의 모든 경로(최초 연결, 실패 후 재시도, 강제 재연결)가
 * channel.subscribe() 직전에 ensureFreshRealtimeAuthOnce()를 통과하도록 강제해, 만료/stale JWT로
 * phx_join이 나가는 것을 구조적으로 막는다.
 */
describe("townChannelManager: subscribe 직전 auth freshness 게이트", () => {
  beforeEach(() => {
    vi.resetModules();
    delete (globalThis as unknown as Record<string, unknown>).__townChannelState;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const buildSupabaseMock = (overrides: {
    getSession: ReturnType<typeof vi.fn>;
    setAuth?: ReturnType<typeof vi.fn>;
  }) => {
    const disconnect = vi.fn();
    const connect = vi.fn();
    const setAuth = overrides.setAuth ?? vi.fn().mockResolvedValue(undefined);
    const channels: Record<string, ReturnType<typeof createFakeChannel>> = {};

    const channel = vi.fn((channelName: string) => {
      channels[channelName] = createFakeChannel();
      return channels[channelName].channel;
    });

    const supabase = {
      channel,
      removeChannel: vi.fn().mockResolvedValue(undefined),
      auth: { getSession: overrides.getSession, signInAnonymously: vi.fn() },
      realtime: {
        disconnect,
        connect,
        isDisconnecting: vi.fn(() => false),
        accessTokenValue: null,
        setAuth,
      },
    } as unknown as SupabaseClient;

    return { supabase, disconnect, connect, setAuth, channel, channels };
  };

  it("expired session이 refresh를 거쳐 setAuth까지 끝난 뒤에만 channel.subscribe가 나간다", async () => {
    const callOrder: string[] = [];
    let resolveGetSession: (value: {
      data: { session: { access_token: string } | null };
      error: null;
    }) => void = () => {};
    const getSession = vi.fn(() =>
      new Promise((resolve) => {
        resolveGetSession = resolve;
      }).then((value) => {
        callOrder.push("getSession");
        return value;
      }),
    );
    const setAuth = vi.fn(async (token: string) => {
      callOrder.push(`setAuth:${token}`);
    });

    const { supabase, channel, channels } = buildSupabaseMock({ getSession, setAuth });
    const { acquireTownChannel } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:expired-then-refresh", userId: "user-1" });

    // getSession(=refresh)이 아직 끝나지 않았으므로 channel 자체가 아직 만들어지면 안 된다.
    await vi.advanceTimersByTimeAsync(0);
    expect(channel).not.toHaveBeenCalled();

    resolveGetSession({ data: { session: { access_token: "fresh-token" } }, error: null });
    await vi.advanceTimersByTimeAsync(0);

    channels["test:expired-then-refresh"].getLatestCallback()("SUBSCRIBED");

    expect(callOrder).toEqual(["getSession", "setAuth:fresh-token"]);
    expect(channel).toHaveBeenCalledTimes(1);
  });

  it("동시에 여러 채널이 재연결해도 client당 auth freshness 확인은 1회로 합쳐진다(in-flight dedup)", async () => {
    // getSession을 의도적으로 pending 상태로 묶어둬, 두 채널의 attemptConnect가 모두
    // "아직 안 끝난 같은 freshness 확인"에 걸려있는 실제 경합 상황을 재현한다.
    let resolveGetSession: (value: {
      data: { session: { access_token: string } };
      error: null;
    }) => void = () => {};
    const getSession = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveGetSession = resolve;
        }),
    );
    const { supabase, channel } = buildSupabaseMock({ getSession });
    const { acquireTownChannel } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:dedup-a", userId: "user-1" });
    acquireTownChannel({ supabase, channelName: "test:dedup-b", userId: "user-1" });

    await vi.advanceTimersByTimeAsync(0);

    // 두 채널 모두 아직 subscribe 전이지만, 실제 getSession 호출은 in-flight dedup으로 1회만 나가야 한다.
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(channel).not.toHaveBeenCalled();

    resolveGetSession({ data: { session: { access_token: "fresh-token" } }, error: null });
    await vi.advanceTimersByTimeAsync(0);

    expect(channel).toHaveBeenCalledWith("test:dedup-a", expect.anything());
    expect(channel).toHaveBeenCalledWith("test:dedup-b", expect.anything());
  });

  it("auth freshness 확보 실패 시 subscribe하지 않고, flap detector 없이 기존 backoff로만 재시도한다", async () => {
    const consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const getSession = vi.fn().mockRejectedValue(new Error("network down"));
    const { supabase, channel } = buildSupabaseMock({ getSession });
    const { acquireTownChannel } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:freshness-only-backoff", userId: "user-1" });

    // 1차 시도(즉시 실행): freshness 실패, subscribe 없음.
    await vi.advanceTimersByTimeAsync(0);
    expect(getSession).toHaveBeenCalledTimes(1);
    expect(channel).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining("auth freshness 확보 실패"),
    );

    // 실제 channel.subscribe()를 시도한 적이 없으므로 flap detector가 아니라 기존
    // reconnectCounts/backoff 체계를 소비한다 — 다음 시도까지 RECONNECT_BACKOFF_MS[1](2000ms)만큼
    // 대기해야 하며, tight loop처럼 곧바로 재시도되면 안 된다.
    await vi.advanceTimersByTimeAsync(1999);
    expect(getSession).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(getSession).toHaveBeenCalledTimes(2);
    expect(channel).not.toHaveBeenCalled();
  });

  it("freshness 확인 중 구독 해제(subscribersCount -> 0)되면, 완료 후에도 subscribe하지 않는다", async () => {
    let resolveGetSession: (value: {
      data: { session: { access_token: string } };
      error: null;
    }) => void = () => {};
    const getSession = vi.fn(
      () =>
        new Promise((resolve) => {
          resolveGetSession = resolve;
        }),
    );
    const { supabase, channel } = buildSupabaseMock({ getSession });
    const { acquireTownChannel } = await import("./townChannelManager");

    const release = acquireTownChannel({
      supabase,
      channelName: "test:unsubscribe-during-await",
      userId: "user-1",
    });

    // attemptConnect가 getSession await 중 정지된 상태를 만든다.
    await vi.advanceTimersByTimeAsync(0);
    expect(getSession).toHaveBeenCalledTimes(1);

    release();

    resolveGetSession({ data: { session: { access_token: "fresh-token" } }, error: null });
    await vi.advanceTimersByTimeAsync(0);

    expect(channel).not.toHaveBeenCalled();
  });

  it("freshness 확인 중 다른 recovery가 같은 채널을 새로 스케줄하면, 먼저 시작된 continuation은 중복 subscribe하지 않는다", async () => {
    let callCount = 0;
    let resolveFirstGetSession: (value: {
      data: { session: { access_token: string } };
      error: null;
    }) => void = () => {};
    const getSession = vi.fn(() => {
      callCount += 1;
      if (callCount === 1) {
        return new Promise((resolve) => {
          resolveFirstGetSession = resolve;
        });
      }
      return Promise.resolve({ data: { session: { access_token: "fresh-token" } }, error: null });
    });
    const { supabase, channel } = buildSupabaseMock({ getSession });
    const { acquireTownChannel, reconnectTownChannel } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:stale-continuation", userId: "user-1" });

    // 첫 attemptConnect가 getSession await 중 정지된 상태를 만든다.
    await vi.advanceTimersByTimeAsync(0);
    expect(getSession).toHaveBeenCalledTimes(1);

    // 이 시점에 다른 recovery 경로(예: presence track 반복 실패)가 같은 채널을 강제로 재스케줄한다.
    reconnectTownChannel({ supabase, channelName: "test:stale-continuation", userId: "user-1" });

    // 뒤늦게 첫 freshness 확인이 끝난다 — 이 continuation은 이미 stale이어야 한다.
    resolveFirstGetSession({ data: { session: { access_token: "fresh-token" } }, error: null });
    await vi.advanceTimersByTimeAsync(0);

    // reconnectTownChannel이 새로 스케줄한 시도만 channel을 만들어 정확히 1번 subscribe해야 한다.
    expect(channel).toHaveBeenCalledTimes(1);
  });

  it("정상 fresh session에서는 기존과 동일하게 subscribe -> SUBSCRIBED 흐름이 유지된다", async () => {
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { access_token: "fresh-token" } }, error: null });
    const { supabase, channel, channels } = buildSupabaseMock({ getSession });
    const { acquireTownChannel, getTownChannelStatus } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:normal-flow", userId: "user-1" });

    await vi.advanceTimersByTimeAsync(0);
    expect(channel).toHaveBeenCalledTimes(1);

    channels["test:normal-flow"].getLatestCallback()("SUBSCRIBED");

    expect(getTownChannelStatus("test:normal-flow")).toBe("SUBSCRIBED");
  });
});

/**
 * #173: flapCount 리셋을 8초 setTimeout(scheduleFlapStabilityReset)의 실행 여부에만 맡기면,
 * 그 타이머가 sleep/suspend로 실행되지 못했을 때 SUBSCRIBED 이전의 낡은 flapCount가 남아있다가
 * wake 직후 단 1회 실패만으로 flapping 오탐이 발생할 수 있었다. recordChannelFailure가
 * lastSubscribedAt 기준 실제 경과 시간을 직접 재확인하도록 고친 부분을 검증한다.
 */
describe("townChannelManager: flapping 판정의 stale 이력 처리", () => {
  beforeEach(() => {
    // townChannelManager는 모듈 로드 시점에 getGlobals()를 딱 한 번 호출해 그 결과를
    // 모듈 스코프 const globals에 캡처해둔다. globalThis.__townChannelState를 지우는 것만으로는
    // 이미 캐시된 모듈이 들고 있는 참조가 바뀌지 않으므로, lastSocketResetAt(SOCKET_RESET_DEDUPE_MS)
    // 같은 상태가 이전 테스트에 남아 이번 resetRealtimeSocket() 호출이 디바운스에 걸려 조용히
    // 무시될 수 있다. 모듈 캐시까지 함께 리셋해 매 테스트가 완전히 새로운 globals로 시작하게 한다.
    vi.resetModules();
    delete (globalThis as unknown as Record<string, unknown>).__townChannelState;
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  const createSuccessfulSupabaseMock = () => {
    const disconnect = vi.fn();
    const connect = vi.fn();
    const getSession = vi
      .fn()
      .mockResolvedValue({ data: { session: { access_token: "fresh-token" } }, error: null });
    const setAuth = vi.fn().mockResolvedValue(undefined);

    let latestFake = createFakeChannel();
    const supabase = {
      channel: vi.fn(() => {
        latestFake = createFakeChannel();
        return latestFake.channel;
      }),
      removeChannel: vi.fn().mockResolvedValue(undefined),
      auth: { getSession, signInAnonymously: vi.fn() },
      realtime: {
        disconnect,
        connect,
        isDisconnecting: vi.fn(() => false),
        accessTokenValue: null,
        setAuth,
      },
    } as unknown as SupabaseClient;

    return { supabase, disconnect, connect, getLatestFake: () => latestFake };
  };

  it("SUBSCRIBED 이후 8초가 지난 상태(타이머 미실행)에서 신규 실패 1회는 과거 flapCount를 이어받지 않는다", async () => {
    const { supabase, disconnect, connect, getLatestFake } = createSuccessfulSupabaseMock();
    const { acquireTownChannel } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:stale-flap-history", userId: "user-1" });

    // SUBSCRIBED에 도달하기 전, 과거에 2회 연속 실패를 쌓아둔다(아직 flapping 임계치 미만).
    await vi.advanceTimersByTimeAsync(0);
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(2000);
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(4000);

    // 세 번째 재시도는 성공(SUBSCRIBED)한다. 이 시점부터 8초 stability 타이머가 예약되지만,
    // 아래에서 advanceTimersByTimeAsync 대신 setSystemTime으로 시계만 앞당겨서 타이머가
    // "실행되지 못한 채" 시간만 흐른(sleep/suspend) 상황을 재현한다.
    getLatestFake().getLatestCallback()("SUBSCRIBED");
    const subscribedAt = Date.now();

    vi.setSystemTime(subscribedAt + 9000);

    // wake 직후 socket이 끊겨 도착한 단 1회의 새 실패.
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(0);

    // 과거 2회가 그대로 이어졌다면 2+1=3으로 flapping 오탐이 났겠지만, 8초 이상 실제 경과했으므로
    // stale 이력으로 보고 1부터 다시 세야 하며 소켓 리셋은 발생하지 않아야 한다.
    expect(disconnect).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();
  });

  it("SUBSCRIBED 후 실제로 8초가 온전히 경과하면 flapCount가 0으로 리셋된다", async () => {
    const { supabase, disconnect, connect, getLatestFake } = createSuccessfulSupabaseMock();
    const { acquireTownChannel } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:real-stability-decay", userId: "user-1" });

    // SUBSCRIBED 이전에 2회 실패를 쌓아둔다.
    await vi.advanceTimersByTimeAsync(0);
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(2000);
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(4000);

    getLatestFake().getLatestCallback()("SUBSCRIBED");
    // 이번엔 실제로 8초를 다 흘려보내 stability 타이머가 정상 실행되게 한다.
    await vi.advanceTimersByTimeAsync(8000);

    // 그 뒤 SUBSCRIBED -> 즉시 실패를 두 번 반복해도(총 2회) 과거 이력이 남아있었다면
    // 2(과거) + 2(신규) = 4로 이미 flapping이었겠지만, 리셋됐다면 아직 2회뿐이라 트리거되지 않는다.
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(0);
    getLatestFake().getLatestCallback()("SUBSCRIBED");
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(0);

    expect(disconnect).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();

    // 세 번째(신규 기준) 연속 실패에서 비로소 flapping이 트리거되어야 한다.
    getLatestFake().getLatestCallback()("SUBSCRIBED");
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(0);

    expect(disconnect).toHaveBeenCalled();
    expect(connect).toHaveBeenCalled();
  });

  it("SUBSCRIBED 후 8초 이내에 반복되는 진짜 flapping은 여전히 소켓 리셋을 유발한다", async () => {
    const { supabase, disconnect, connect, getLatestFake } = createSuccessfulSupabaseMock();
    const { acquireTownChannel } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:genuine-quick-flap", userId: "user-1" });

    await vi.advanceTimersByTimeAsync(0);

    // SUBSCRIBED -> (8초 이내) 실패 -> 즉시 재연결을 3회 반복한다. 매번 실패 직전에 SUBSCRIBED가
    // 막 갱신된 상태라 stableDurationMs가 FLAP_STABILITY_MS(8000ms)를 넘지 않으므로, 새 로직에서도
    // stale 이력으로 리셋되지 않고 그대로 누적돼야 한다.
    for (let i = 0; i < 2; i += 1) {
      getLatestFake().getLatestCallback()("SUBSCRIBED");
      getLatestFake().getLatestCallback()("CHANNEL_ERROR");
      await vi.advanceTimersByTimeAsync(0);
    }

    expect(disconnect).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();

    getLatestFake().getLatestCallback()("SUBSCRIBED");
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(0);

    expect(disconnect).toHaveBeenCalled();
    expect(connect).toHaveBeenCalled();
  });

  it("reconnectTownChannel() 호출 후에는 이전 flapCount가 새 연결로 이어지지 않는다", async () => {
    const { supabase, disconnect, connect, getLatestFake } = createSuccessfulSupabaseMock();
    const { acquireTownChannel, reconnectTownChannel } = await import("./townChannelManager");

    acquireTownChannel({ supabase, channelName: "test:reconnect-isolation", userId: "user-1" });

    // SUBSCRIBED 없이 2회 연속 실패를 쌓아 flapping 임계치 직전까지 만든다.
    await vi.advanceTimersByTimeAsync(0);
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(2000);
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");

    // 여기서 (예: presence track 반복 실패 등 다른 이유로) 명시적 강제 재연결이 걸린다.
    reconnectTownChannel({ supabase, channelName: "test:reconnect-isolation", userId: "user-1" });
    await vi.advanceTimersByTimeAsync(0);

    // 강제 재연결 이후 새 연결의 실패는 과거 2회를 이어받지 않고 1부터 다시 세야 하므로,
    // 추가로 2회만 더 실패해서는 아직 리셋이 발생하지 않아야 한다.
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(2000);
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(4000);

    expect(disconnect).not.toHaveBeenCalled();
    expect(connect).not.toHaveBeenCalled();

    // 세 번째(재연결 이후 기준) 실패에서 비로소 flapping이 트리거돼야 한다.
    getLatestFake().getLatestCallback()("CHANNEL_ERROR");
    await vi.advanceTimersByTimeAsync(0);

    expect(disconnect).toHaveBeenCalled();
    expect(connect).toHaveBeenCalled();
  });
});
