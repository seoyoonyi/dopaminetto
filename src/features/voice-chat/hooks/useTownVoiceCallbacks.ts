import { useCallback, useEffect, useRef } from "react";

/** TownVoiceClient가 외부 UI 상태와 제어 함수를 동기화하기 위해 호출하는 콜백 모음 */
export interface TownVoiceCallbacks {
  /**
   * 음성 연결 상태가 변경될 때 호출된다.
   * connected가 true이면 연결 완료, false이면 연결 실패 또는 언마운트를 의미한다.
   */
  onConnectionChange?: (connected: boolean) => void;
  /** 발표자의 마이크 활성 상태가 변경될 때 호출된다. */
  onAudioEnabledChange?: (enabled: boolean) => void;
  /** 툴바 음성 제어 UI에서 사용할 마이크 토글 제어기가 준비될 때 호출된다. */
  onAudioControllerChange?: (
    canToggleAudio: boolean,
    toggleAudio: (() => Promise<void>) | null,
  ) => void;
  /** 툴바 음성 제어 UI에서 사용할 청취 토글 제어기가 준비될 때 호출된다. */
  onListeningControllerChange?: (
    canToggleListening: boolean,
    toggleListening: (() => Promise<void>) | null,
  ) => void;
  /** 청취 on/off 상태가 변경될 때 호출된다. */
  onListeningEnabledChange?: (enabled: boolean) => void;
  /**
   * 마이크 토글 SDK 호출의 진행 상태가 변경될 때 호출된다.
   * true이면 토글 중, false이면 완료 또는 에러 상태를 의미한다.
   */
  onAudioTogglingChange?: (isToggling: boolean) => void;
}

/**
 * 비동기 음성 연결 흐름에서 최신 props 콜백을 안정적으로 호출하기 위한 notifier를 제공한다.
 * 반환되는 notify 함수들은 stable identity를 유지해 연결 effect가 콜백 변경만으로 재실행되지 않도록 한다.
 */
export function useTownVoiceCallbacks({
  onConnectionChange,
  onAudioEnabledChange,
  onAudioControllerChange,
  onListeningControllerChange,
  onListeningEnabledChange,
  onAudioTogglingChange,
}: TownVoiceCallbacks) {
  /**
   * 비동기 연결 흐름, SDK 이벤트 리스너, cleanup에서 최신 콜백을 읽기 위한 참조다.
   * 메인 연결 effect가 콜백 identity 변경으로 다시 실행되지 않도록 한다.
   */
  const callbacksRef = useRef({
    onConnectionChange,
    onAudioEnabledChange,
    onAudioControllerChange,
    onListeningControllerChange,
    onListeningEnabledChange,
    onAudioTogglingChange,
  });

  /** 매 커밋 후 최신 콜백으로 ref를 갱신해 stale callback을 방지한다. */
  useEffect(() => {
    callbacksRef.current = {
      onConnectionChange,
      onAudioEnabledChange,
      onAudioControllerChange,
      onListeningControllerChange,
      onListeningEnabledChange,
      onAudioTogglingChange,
    };
  });

  const notifyConnectionChange = useCallback((connected: boolean) => {
    callbacksRef.current.onConnectionChange?.(connected);
  }, []);

  const notifyAudioEnabledChange = useCallback((enabled: boolean) => {
    callbacksRef.current.onAudioEnabledChange?.(enabled);
  }, []);

  const notifyAudioControllerChange = useCallback(
    (canToggleAudio: boolean, toggleAudio: (() => Promise<void>) | null) => {
      callbacksRef.current.onAudioControllerChange?.(canToggleAudio, toggleAudio);
    },
    [],
  );

  const notifyListeningControllerChange = useCallback(
    (canToggleListening: boolean, toggleListening: (() => Promise<void>) | null) => {
      callbacksRef.current.onListeningControllerChange?.(canToggleListening, toggleListening);
    },
    [],
  );

  const notifyListeningEnabledChange = useCallback((enabled: boolean) => {
    callbacksRef.current.onListeningEnabledChange?.(enabled);
  }, []);

  const notifyAudioTogglingChange = useCallback((isToggling: boolean) => {
    callbacksRef.current.onAudioTogglingChange?.(isToggling);
  }, []);

  return {
    notifyConnectionChange,
    notifyAudioEnabledChange,
    notifyAudioControllerChange,
    notifyListeningControllerChange,
    notifyListeningEnabledChange,
    notifyAudioTogglingChange,
  };
}
