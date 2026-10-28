import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 트리 캐롤의 사용자 로컬 볼륨·음소거 설정을 관리한다.
 * - 브라우저 로컬 전용. realtime/movement/presence 등 공유 상태에 넣지 않는다.
 * - 각 소리의 볼륨과 음소거는 독립 상태이며, volume=0과 isMuted=true를 서로 다르게 취급한다.
 * - 실제 오디오 결합(isMuted ? 0 : volume)은 TownScene 호출부가 담당한다.
 */
interface AmbientSoundState {
  christmasTreeVolume: number;
  isChristmasTreeMuted: boolean;
  setChristmasTreeVolume: (value: number) => void;
  toggleChristmasTreeMute: () => void;
}

export const CHRISTMAS_TREE_DEFAULT_VOLUME = 0.3;

const DEFAULTS = {
  christmasTreeVolume: CHRISTMAS_TREE_DEFAULT_VOLUME,
  isChristmasTreeMuted: false,
} as const;

const STORAGE_KEY = "ambient-sound-settings";

/**
 * spec 고정 규칙. 유한 number만 0~1로 클램프하고, 그 외(문자열, null, undefined, NaN 등)는
 * 사용자가 명시적으로 설정하지 않은 것으로 보고 기본값 1로 되돌린다.
 * JSON 직렬화 시 NaN은 null로 저장되므로 null도 이 규칙으로 기본값 처리된다.
 */
function normalizeVolume(value: unknown, fallback: number = DEFAULTS.christmasTreeVolume): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : fallback;
}

/**
 * persist된 값은 사용자가 직접 수정하거나 이전 버전이 남을 수 있어, 기본 얕은 병합 대신
 * 이 함수로 필드별 정규화한다. 유효 필드는 살리고 잘못된 필드만 기본값으로 되돌린다.
 * - raw가 객체가 아니거나 null/배열이면 전체 기본값
 * - 음소거는 정확히 true일 때만 true, 그 외는 false
 */
function sanitize(raw: unknown): {
  christmasTreeVolume: number;
  isChristmasTreeMuted: boolean;
} {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ...DEFAULTS };
  }
  const record = raw as Record<string, unknown>;
  return {
    christmasTreeVolume: normalizeVolume(record.christmasTreeVolume, DEFAULTS.christmasTreeVolume),
    isChristmasTreeMuted: record.isChristmasTreeMuted === true,
  };
}

export const useAmbientSoundStore = create<AmbientSoundState>()(
  persist(
    (set) => ({
      christmasTreeVolume: DEFAULTS.christmasTreeVolume,
      isChristmasTreeMuted: DEFAULTS.isChristmasTreeMuted,
      setChristmasTreeVolume: (value) =>
        set({
          christmasTreeVolume: normalizeVolume(value, DEFAULTS.christmasTreeVolume),
        }),
      toggleChristmasTreeMute: () =>
        set((state) => ({ isChristmasTreeMuted: !state.isChristmasTreeMuted })),
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      // 액션은 저장하지 않고 설정 값만 저장한다.
      partialize: (state) => ({
        christmasTreeVolume: state.christmasTreeVolume,
        isChristmasTreeMuted: state.isChristmasTreeMuted,
      }),
      // 저장된 값이 손상/변조되었을 수 있어 기본 얕은 병합 대신 sanitize를 거친다.
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...sanitize(persistedState),
      }),
    },
  ),
);
