import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 모닥불 등 환경음의 사용자 로컬 설정(볼륨/음소거) store.
 * - 브라우저 로컬 전용. realtime/movement/presence 등 공유 상태에 넣지 않는다.
 * - volume과 isMuted는 독립 상태다. volume=0과 isMuted=true를 서로 다른 상태로 취급한다.
 * - 실제 오디오 결합(isMuted ? 0 : volume)은 TownScene 호출부가 담당한다.
 */
interface AmbientSoundState {
  volume: number; // 0~1
  isMuted: boolean;
  /** volume만 변경한다. isMuted는 건드리지 않는다. 비정상 number는 normalizeVolume이 방어한다. */
  setVolume: (value: number) => void;
  /** isMuted만 반전한다. volume은 건드리지 않는다. */
  toggleMute: () => void;
}

const DEFAULTS = { volume: 1, isMuted: false } as const;

const STORAGE_KEY = "ambient-sound-settings";

/**
 * spec 고정 규칙. 유한 number만 0~1로 클램프하고, 그 외(문자열, null, undefined, NaN 등)는
 * 사용자가 명시적으로 설정하지 않은 것으로 보고 기본값 1로 되돌린다.
 * JSON 직렬화 시 NaN은 null로 저장되므로 null도 이 규칙으로 기본값 처리된다.
 */
function normalizeVolume(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : DEFAULTS.volume;
}

/**
 * persist된 값은 사용자가 직접 수정하거나 이전 버전이 남을 수 있어, 기본 얕은 병합 대신
 * 이 함수로 필드별 정규화한다. 유효 필드는 살리고 잘못된 필드만 기본값으로 되돌린다.
 * - raw가 객체가 아니거나 null/배열이면 전체 기본값
 * - isMuted는 정확히 true일 때만 true, 그 외는 false
 */
function sanitize(raw: unknown): { volume: number; isMuted: boolean } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ...DEFAULTS };
  }
  const record = raw as Record<string, unknown>;
  return {
    volume: normalizeVolume(record.volume),
    isMuted: record.isMuted === true,
  };
}

export const useAmbientSoundStore = create<AmbientSoundState>()(
  persist(
    (set) => ({
      volume: DEFAULTS.volume,
      isMuted: DEFAULTS.isMuted,
      setVolume: (value) => set({ volume: normalizeVolume(value) }),
      toggleMute: () => set((state) => ({ isMuted: !state.isMuted })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      // 액션은 저장하지 않고 설정 값만 저장한다.
      partialize: (state) => ({ volume: state.volume, isMuted: state.isMuted }),
      // 저장된 값이 손상/변조되었을 수 있어 기본 얕은 병합 대신 sanitize를 거친다.
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitize(persistedState),
      }),
    },
  ),
);
