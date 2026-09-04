// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { Root, createRoot } from "react-dom/client";

import { TownVoiceClient } from "./TownVoiceClient";

// react-dom/client의 act()가 지원되는 환경임을 React에 알린다(testing-library 없이 직접
// createRoot/act를 쓰기 때문에 필요하다) — 없으면 매 act() 호출마다 경고가 출력된다.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/**
 * RealtimeKit의 `joinRoom()`이 내부 재시도를 모두 소진한 뒤 reject하면,
 * room에 join한 적이 없으므로 `roomLeft` 이벤트가 발생하지 않는다.
 *
 * 따라서 `roomLeft` 기반 자동 재연결로는 이 실패 경로를 복구할 수 없으므로,
 * retryable한 연결 오류에 한해 기존 room-left recovery budget을 재사용해
 * backoff 후 제한적으로 재시도한다.
 *
 * See: issue #173
 */

const { requestVoiceTokenMock, initMeetingMock, initRTKMediaMock } = vi.hoisted(() => ({
  requestVoiceTokenMock: vi.fn(),
  initMeetingMock: vi.fn(),
  initRTKMediaMock: vi.fn(),
}));

vi.mock("../api/requestVoiceToken", () => ({
  requestVoiceToken: requestVoiceTokenMock,
}));

vi.mock("@cloudflare/realtimekit-react", () => ({
  RealtimeKitProvider: ({ children }: { children: React.ReactNode }) => children,
  initRTKMedia: initRTKMediaMock,
  useRealtimeKitClient: () => [undefined, initMeetingMock],
  useRealtimeKitMeeting: () => ({ meeting: undefined }),
}));

vi.mock("@cloudflare/realtimekit-react-ui", () => ({
  RtkParticipantsAudio: () => null,
}));

const flushMicrotasks = async (times = 4) => {
  for (let i = 0; i < times; i += 1) {
    await Promise.resolve();
  }
};

/** RealtimeKit이 실제로 던지는 에러처럼 `.name`을 설정한다(플레인 Error는 name이 "Error"). */
const createTransportConnectionError = (message = "Socket is not connected") => {
  const error = new Error(message);
  error.name = "TransportConnectionError";
  return error;
};

/** RealtimeKit의 ClientError(코드 기반)를 흉내낸다. */
const createClientError = (message: string, code: string) => {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
};

interface FakeMeetingSelf {
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  roomJoined: boolean;
  audioEnabled: boolean;
  enableAudio: ReturnType<typeof vi.fn>;
  disableAudio: ReturnType<typeof vi.fn>;
}

const createFakeMeeting = (joinRoom: ReturnType<typeof vi.fn>) => {
  const self: FakeMeetingSelf = {
    addListener: vi.fn(),
    removeListener: vi.fn(),
    roomJoined: false,
    audioEnabled: false,
    enableAudio: vi.fn().mockResolvedValue(undefined),
    disableAudio: vi.fn().mockResolvedValue(undefined),
  };
  return {
    self,
    joinRoom,
    leaveRoom: vi.fn().mockResolvedValue(undefined),
  };
};

const getRegisteredListener = (self: FakeMeetingSelf, event: string) => {
  const call = self.addListener.mock.calls.find(([registeredEvent]) => registeredEvent === event);
  if (!call) throw new Error(`listener for "${event}" was never registered`);
  return call[1] as (payload: { state: string }) => void;
};

describe("TownVoiceClient — 최초 join 실패 후 제한적 자동 재시도", () => {
  let container: HTMLDivElement;
  let root: Root;
  let isRootMounted = false;

  const unmountRoot = () => {
    if (!isRootMounted) return;
    act(() => {
      root.unmount();
    });
    isRootMounted = false;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    requestVoiceTokenMock.mockReset().mockResolvedValue({
      token: "test-token",
      participantId: "p1",
      role: "listener",
      presetName: "listener_preset",
    });
    initRTKMediaMock.mockReset().mockResolvedValue({});
    initMeetingMock.mockReset();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    isRootMounted = true;
  });

  afterEach(() => {
    unmountRoot();
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("네트워크성이 아닌 오류(예: 잘못된 인증 토큰)는 재시도 없이 즉시 error로 종료된다", async () => {
    const joinRoom = vi.fn().mockRejectedValue(createClientError("Invalid auth token", "0004"));
    initMeetingMock.mockResolvedValue(createFakeMeeting(joinRoom));

    const onConnectionChange = vi.fn();

    await act(async () => {
      root.render(
        <TownVoiceClient
          nickname="tester"
          voiceRole={null}
          onConnectionChange={onConnectionChange}
        />,
      );
      await flushMicrotasks();
    });

    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(onConnectionChange).not.toHaveBeenCalledWith(true);
    expect(container.textContent).toContain("Invalid auth token");

    // 시간이 아무리 지나도 재시도가 걸리지 않는다 — 재시도 의미가 없는 오류이기 때문이다.
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await flushMicrotasks();
    });

    expect(initMeetingMock).toHaveBeenCalledTimes(1);
    expect(joinRoom).toHaveBeenCalledTimes(1);
  });

  it("네트워크성 오류(TransportConnectionError)는 최초 join 실패 후 자동으로 재시도된다", async () => {
    const joinRoom = vi.fn().mockRejectedValueOnce(createTransportConnectionError());
    initMeetingMock.mockResolvedValue(createFakeMeeting(joinRoom));

    await act(async () => {
      root.render(<TownVoiceClient nickname="tester" voiceRole={null} />);
      await flushMicrotasks();
    });

    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain("Socket is not connected");

    // 첫 재시도 backoff(1000ms, RECONNECT_BACKOFF_MS[0])이 지나면 자동으로 다시 시도한다.
    await act(async () => {
      vi.advanceTimersByTime(1000);
      await flushMicrotasks();
    });

    expect(initMeetingMock).toHaveBeenCalledTimes(2);
    expect(joinRoom).toHaveBeenCalledTimes(2);
  });

  it("재시도 후 성공하면 정상적으로 connected 상태가 된다", async () => {
    const joinRoom = vi
      .fn()
      .mockRejectedValueOnce(createTransportConnectionError())
      .mockResolvedValueOnce(undefined);
    initMeetingMock.mockResolvedValue(createFakeMeeting(joinRoom));

    const onConnectionChange = vi.fn();

    await act(async () => {
      root.render(
        <TownVoiceClient
          nickname="tester"
          voiceRole={null}
          onConnectionChange={onConnectionChange}
        />,
      );
      await flushMicrotasks();
    });

    expect(onConnectionChange).not.toHaveBeenCalledWith(true);

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await flushMicrotasks();
    });

    expect(joinRoom).toHaveBeenCalledTimes(2);
    expect(onConnectionChange).toHaveBeenCalledWith(true);
  });

  it("최대 재시도 횟수(3회)를 초과하면 더 이상 재시도하지 않고 error 상태로 남는다", async () => {
    const joinRoom = vi.fn().mockRejectedValue(createTransportConnectionError());
    initMeetingMock.mockResolvedValue(createFakeMeeting(joinRoom));

    const onConnectionChange = vi.fn();

    await act(async () => {
      root.render(
        <TownVoiceClient
          nickname="tester"
          voiceRole={null}
          onConnectionChange={onConnectionChange}
        />,
      );
      await flushMicrotasks();
    });

    // 최초 시도(1) + 재시도 3회(backoff: 1000 / 2000 / 4000ms) = 총 4회 시도 후 예산 소진.
    for (const delay of [1000, 2000, 4000]) {
      await act(async () => {
        vi.advanceTimersByTime(delay);
        await flushMicrotasks();
      });
    }

    expect(joinRoom).toHaveBeenCalledTimes(4);
    expect(onConnectionChange).not.toHaveBeenCalledWith(true);

    // 예산이 소진된 뒤에는 시간이 더 지나도 추가 시도가 없다.
    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await flushMicrotasks();
    });

    expect(joinRoom).toHaveBeenCalledTimes(4);
  });

  it("연결 성공 후에는 재시도 카운터가 초기화되어, 이후의 새로운 단절도 다시 예산을 받는다", async () => {
    // 예산을 모두 소진하며(3회 재시도) 마지막 시도에서 성공한다.
    const joinRoom = vi
      .fn()
      .mockRejectedValueOnce(createTransportConnectionError())
      .mockRejectedValueOnce(createTransportConnectionError())
      .mockRejectedValueOnce(createTransportConnectionError())
      .mockResolvedValueOnce(undefined);
    const meeting = createFakeMeeting(joinRoom);
    initMeetingMock.mockResolvedValue(meeting);

    const onConnectionChange = vi.fn();

    await act(async () => {
      root.render(
        <TownVoiceClient
          nickname="tester"
          voiceRole={null}
          onConnectionChange={onConnectionChange}
        />,
      );
      await flushMicrotasks();
    });

    for (const delay of [1000, 2000, 4000]) {
      await act(async () => {
        vi.advanceTimersByTime(delay);
        await flushMicrotasks();
      });
    }

    expect(joinRoom).toHaveBeenCalledTimes(4);
    expect(onConnectionChange).toHaveBeenCalledWith(true);

    // 연결 이후 발생한 새로운 단절(roomLeft)에서 joinRoom이 다시 실패하더라도,
    // 카운터가 리셋되어 있다면 최소 한 번은 다시 재시도된다.
    const handleRoomLeft = getRegisteredListener(meeting.self, "roomLeft");
    joinRoom.mockReset();
    joinRoom
      .mockRejectedValueOnce(createTransportConnectionError())
      .mockResolvedValueOnce(undefined);
    onConnectionChange.mockClear();

    // handleRoomLeft 자체가 예산을 1 소비하므로(roomLeftRecoveryAttempts: 0 -> 1),
    // 리셋되지 않았다면(3에서 시작했다면) 여기서 바로 예산 초과로 재시도가 걸리지 않았을 것이다.
    await act(async () => {
      handleRoomLeft({ state: "disconnected" });
      await flushMicrotasks();
    });

    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(onConnectionChange).not.toHaveBeenCalledWith(true);

    // 이 시점의 재시도 backoff는 getReconnectDelayMs(1) = 2000ms(roomLeftRecoveryAttempts가
    // handleRoomLeft에서 이미 1로 증가한 상태이기 때문).
    await act(async () => {
      vi.advanceTimersByTime(2000);
      await flushMicrotasks();
    });

    expect(joinRoom).toHaveBeenCalledTimes(2);
    expect(onConnectionChange).toHaveBeenCalledWith(true);
  });

  it("unmount 후에는 예약된 재시도가 실행되지 않는다", async () => {
    const joinRoom = vi.fn().mockRejectedValue(createTransportConnectionError());
    initMeetingMock.mockResolvedValue(createFakeMeeting(joinRoom));

    await act(async () => {
      root.render(<TownVoiceClient nickname="tester" voiceRole={null} />);
      await flushMicrotasks();
    });

    expect(joinRoom).toHaveBeenCalledTimes(1);

    // 재시도가 예약된 상태(1000ms 뒤)에서 컴포넌트를 unmount한다.
    unmountRoot();

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await flushMicrotasks();
    });

    expect(initMeetingMock).toHaveBeenCalledTimes(1);
    expect(joinRoom).toHaveBeenCalledTimes(1);
  });
});

/**
 * #173: 장시간 Offline 중 토큰 fetch가 `TypeError: Failed to fetch`로 실패하면 자동 재시도 대상이
 * 아니라 "Failed to fetch" error에 고착됐다. online/visibilitychange 복구 신호에서 재연결하는지 검증한다.
 */
describe("TownVoiceClient — online/visible 복구 신호로 재연결", () => {
  let container: HTMLDivElement;
  let root: Root;
  let isRootMounted = false;

  const unmountRoot = () => {
    if (!isRootMounted) return;
    act(() => {
      root.unmount();
    });
    isRootMounted = false;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    requestVoiceTokenMock.mockReset().mockResolvedValue({
      token: "test-token",
      participantId: "p1",
      role: "listener",
      presetName: "listener_preset",
    });
    initRTKMediaMock.mockReset().mockResolvedValue({});
    initMeetingMock.mockReset();

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    isRootMounted = true;
  });

  afterEach(() => {
    unmountRoot();
    container.remove();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("Failed to fetch로 고착된 뒤 online 이벤트가 오면 재연결한다", async () => {
    requestVoiceTokenMock.mockReset();
    requestVoiceTokenMock
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValue({
        token: "test-token",
        participantId: "p1",
        role: "listener",
        presetName: "listener_preset",
      });
    const joinRoom = vi.fn().mockResolvedValue(undefined);
    initMeetingMock.mockResolvedValue(createFakeMeeting(joinRoom));

    const onConnectionChange = vi.fn();

    await act(async () => {
      root.render(
        <TownVoiceClient
          nickname="tester"
          voiceRole={null}
          onConnectionChange={onConnectionChange}
        />,
      );
      await flushMicrotasks();
    });

    // 최초 연결은 Failed to fetch로 실패하고, TypeError는 자동 재시도 대상이 아니다.
    expect(container.textContent).toContain("Failed to fetch");
    expect(initMeetingMock).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(5 * 60 * 1000);
      await flushMicrotasks();
    });
    expect(requestVoiceTokenMock).toHaveBeenCalledTimes(1);

    // 네트워크가 돌아오고 online 이벤트가 발생하면 다시 연결을 시도해 성공한다.
    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await flushMicrotasks();
    });

    expect(requestVoiceTokenMock).toHaveBeenCalledTimes(2);
    expect(joinRoom).toHaveBeenCalledTimes(1);
    expect(onConnectionChange).toHaveBeenCalledWith(true);
  });

  it("이미 연결된 상태에서는 online 이벤트가 와도 재연결하지 않는다", async () => {
    const joinRoom = vi.fn().mockResolvedValue(undefined);
    initMeetingMock.mockResolvedValue(createFakeMeeting(joinRoom));

    const onConnectionChange = vi.fn();

    await act(async () => {
      root.render(
        <TownVoiceClient
          nickname="tester"
          voiceRole={null}
          onConnectionChange={onConnectionChange}
        />,
      );
      await flushMicrotasks();
    });

    expect(onConnectionChange).toHaveBeenCalledWith(true);
    expect(initMeetingMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      window.dispatchEvent(new Event("online"));
      await flushMicrotasks();
    });

    expect(initMeetingMock).toHaveBeenCalledTimes(1);
    expect(requestVoiceTokenMock).toHaveBeenCalledTimes(1);
  });
});
