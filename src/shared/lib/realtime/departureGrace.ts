import { RECONNECT_BACKOFF_MS } from "./reconnectBackoff";

/**
 * presence leave 후 실제로 이탈을 확정하기까지의 유예 시간이다.
 * 채널 재연결의 첫 시도는 즉시 실행되므로(townChannelManager.ts), 2회 실패 후 3번째
 * 시도가 시작되는 시점까지의 누적 대기에 subscribe/track 왕복 여유 시간을 더해서 정한다.
 * 재시도가 4회 이상 필요한 심각한 네트워크 불안정은 커버하지 못하는 알려진 한계다.
 */
const RECONNECT_ATTEMPTS_COVERED_BEFORE_MARGIN = [RECONNECT_BACKOFF_MS[1], RECONNECT_BACKOFF_MS[2]];
const ROUND_TRIP_MARGIN_MS = 6_000;
export const DEPARTURE_GRACE_MS =
  RECONNECT_ATTEMPTS_COVERED_BEFORE_MARGIN.reduce((sum, ms) => sum + ms, 0) + ROUND_TRIP_MARGIN_MS;

export interface DepartureGraceCallbacks {
  graceMs: number;
  /** 지금 이 판단과 관련된 채널이 재연결 중인지 (여러 채널을 볼 수 있으면 그중 하나라도) */
  isChannelReconnecting: () => boolean;
  /** 최신 presence 스냅샷에 해당 id가 실제로 존재하는지 */
  isPresentInSnapshot: (id: string) => boolean;
  /** 이탈이 최종 확정됐을 때 호출된다 */
  onConfirmed: (id: string) => void;
}

export interface DepartureGraceController {
  /** leave 감지 시 grace 카운트다운을 시작한다. 이미 대기 중이면 무시한다. */
  schedule: (id: string) => void;
  /** 재입장 등으로 생존이 확인되면 grace/보류 상태를 모두 취소한다. */
  cancel: (id: string) => void;
  /**
   * 신선한 presence 스냅샷이 도착했을 때 호출한다. grace 만료 시점에 채널이 재연결
   * 중이라 확정을 보류했던 id들만 재검증한다 — 아직 grace 타이머가 도는 id는 건드리지 않는다.
   * isChannelReconnecting()이 여전히 true면(예: 여러 채널 중 하나만 복구됨) 아무 것도 하지 않고
   * 다음 호출을 기다린다.
   */
  reconcile: () => void;
  /** grace 타이머와 보류 상태를 모두 정리한다 (unmount/reset 시 사용). */
  cancelAll: () => void;
  /** grace 카운트다운 중이거나 재연결 확인을 기다리는 모든 id를 반환한다. */
  getPendingIds: () => Set<string>;
}

export function createDepartureGraceController({
  graceMs,
  isChannelReconnecting,
  isPresentInSnapshot,
  onConfirmed,
}: DepartureGraceCallbacks): DepartureGraceController {
  const pendingGraceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const awaitingReconnectVerification = new Set<string>();

  const schedule = (id: string) => {
    if (pendingGraceTimers.has(id) || awaitingReconnectVerification.has(id)) return;

    const timer = setTimeout(() => {
      pendingGraceTimers.delete(id);

      if (isChannelReconnecting()) {
        awaitingReconnectVerification.add(id);
        return;
      }

      if (isPresentInSnapshot(id)) return;

      onConfirmed(id);
    }, graceMs);

    pendingGraceTimers.set(id, timer);
  };

  const cancel = (id: string) => {
    const timer = pendingGraceTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      pendingGraceTimers.delete(id);
    }

    awaitingReconnectVerification.delete(id);
  };

  const reconcile = () => {
    if (isChannelReconnecting()) return;
    if (awaitingReconnectVerification.size === 0) return;

    const ids = Array.from(awaitingReconnectVerification);
    awaitingReconnectVerification.clear();

    ids.forEach((id) => {
      if (isPresentInSnapshot(id)) return;
      onConfirmed(id);
    });
  };

  const cancelAll = () => {
    pendingGraceTimers.forEach((timer) => clearTimeout(timer));
    pendingGraceTimers.clear();
    awaitingReconnectVerification.clear();
  };

  const getPendingIds = () =>
    new Set([...pendingGraceTimers.keys(), ...awaitingReconnectVerification]);

  return { schedule, cancel, reconcile, cancelAll, getPendingIds };
}
