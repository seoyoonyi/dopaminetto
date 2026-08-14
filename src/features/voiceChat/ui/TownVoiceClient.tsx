"use client";

import {
  RealtimeKitProvider,
  initRTKMedia,
  useRealtimeKitClient,
  useRealtimeKitMeeting,
} from "@cloudflare/realtimekit-react";
import { RtkParticipantsAudio } from "@cloudflare/realtimekit-react-ui";

// import { RtkMicToggle /*, RtkLivestreamPlayer */ } from "@cloudflare/
// realtimekit-react-ui";
import { useEffect, useRef, useState } from "react";

import { requestVoiceToken } from "../api/requestVoiceToken";
import { TownVoiceCallbacks, useTownVoiceCallbacks } from "../hooks/useTownVoiceCallbacks";
import type { VoiceRole } from "../model/types";
import { resolveVoicePermissions } from "../model/voicePermissions";
import { shouldMuteVoicePlayback } from "../model/voicePlayback";

/** 타운 음성 방송에서 speaker 또는 listener로 연결하기 위한 props */
export interface TownVoiceClientProps extends TownVoiceCallbacks {
  nickname: string;
  voiceRole: VoiceRole | null;
}

/** 음성 채널 연결 진행 상태 */
type ConnectionStatus =
  | "idle"
  | "requesting-token"
  | "initializing"
  | "joining"
  | "connected"
  | "error";

const DEFAULT_LISTENING_ENABLED = true;

/**
 * 음성 채널 연결이 완료된 뒤 오디오 엘리먼트를 준비한다.
 *
 * RtkParticipantsAudio 연결은 유지하고,
 * 청취 상태는 프로젝트 소유 audio 엘리먼트의 muted로 제어한다.
 */
function VoicePanel({
  isSpeaker,
  isListeningEnabled,
}: {
  isSpeaker: boolean;
  isListeningEnabled: boolean;
}) {
  const { meeting } = useRealtimeKitMeeting();
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  if (!meeting) return null;

  return (
    <>
      <audio
        ref={setAudioElement}
        muted={shouldMuteVoicePlayback(isSpeaker, isListeningEnabled)}
        aria-hidden="true"
      />
      {audioElement ? (
        <RtkParticipantsAudio meeting={meeting} preloadedAudioElem={audioElement} />
      ) : null}
    </>
  );
}

/**
 * 타운 음성 채널에 접속해 현재 사용자를 speaker 또는 listener로 연결한다.
 *
 * 모든 참여자는 mic off 상태로 초기화한 뒤 room에 join하고,
 * speaker로 확정된 경우에만 join 이후 마이크를 활성화한다.
 */
export function TownVoiceClient({
  nickname,
  voiceRole,
  onConnectionChange,
  onRoleChange,
  onAudioEnabledChange,
  onAudioControllerChange,
  onListeningControllerChange,
  onListeningEnabledChange,
  onAudioTogglingChange,
}: TownVoiceClientProps) {
  const [client, initMeeting] = useRealtimeKitClient();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isListeningEnabled, setIsListeningEnabled] = useState(DEFAULT_LISTENING_ENABLED);

  const meetingRef = useRef<typeof client | null>(null);
  const listeningEnabledRef = useRef(DEFAULT_LISTENING_ENABLED);
  /** 마이크 토글 SDK 호출이 진행 중인지 동기적으로 추적하는 ref.
   *  React 리렌더 전에 발생하는 중복 클릭을 state보다 먼저 차단한다. */
  const isAudioTogglingRef = useRef(false);
  const {
    notifyConnectionChange,
    notifyRoleChange,
    notifyAudioEnabledChange,
    notifyAudioControllerChange,
    notifyListeningControllerChange,
    notifyListeningEnabledChange,
    notifyAudioTogglingChange,
  } = useTownVoiceCallbacks({
    onConnectionChange,
    onRoleChange,
    onAudioEnabledChange,
    onAudioControllerChange,
    onListeningControllerChange,
    onListeningEnabledChange,
    onAudioTogglingChange,
  });

  const hasNickname = nickname.trim().length > 0;
  const voicePermissions = resolveVoicePermissions(voiceRole, hasNickname);

  useEffect(() => {
    let isMounted = true;
    let joinedRoom = false;
    let activeMeetingCleanup: (() => void) | undefined;

    /**
     * 새로고침/탭 종료/앱 강제 종료 시 React effect cleanup(leaveRoom)이 실행되지 않을 수 있어,
     * pagehide에서 best-effort로 한 번 더 시도한다. 같은 userId로 즉시 재입장하면
     * 서버에 이전 세션이 잠시 남아있어 새 세션의 트랙 구독이 꼬일 수 있기 때문이다.
     */
    const handlePageHide = () => {
      const activeMeeting = meetingRef.current;
      if (joinedRoom && activeMeeting?.self.roomJoined) {
        void activeMeeting.leaveRoom("left");
      }
    };
    window.addEventListener("pagehide", handlePageHide);

    /**
     * bfcache 복원(pageshow, persisted) 시 서버 세션은 이미 pagehide에서 끊겼지만
     * 로컬 상태는 그대로 남아있으므로 connect()를 다시 실행해 재연결한다.
     */
    const handlePageShow = (event: PageTransitionEvent) => {
      if (!event.persisted || !isMounted) return;

      joinedRoom = false;
      activeMeetingCleanup?.();
      activeMeetingCleanup = undefined;
      meetingRef.current = null;

      void connect();
    };
    window.addEventListener("pageshow", handlePageShow);

    /**
     * 토큰 발급, RealtimeKit 초기화, room join, speaker 마이크 활성화까지
     * 하나의 순서로 처리한다.
     */
    async function connect() {
      try {
        setStatus("requesting-token");
        setErrorMessage(null);
        notifyRoleChange(null);
        notifyAudioEnabledChange(false);
        notifyAudioTogglingChange(false);
        notifyAudioControllerChange(false, null);
        notifyListeningControllerChange(false, null);

        listeningEnabledRef.current = DEFAULT_LISTENING_ENABLED;
        setIsListeningEnabled(DEFAULT_LISTENING_ENABLED);
        notifyListeningEnabledChange(DEFAULT_LISTENING_ENABLED);

        const tokenResponse = await requestVoiceToken();
        const nextPermissions = resolveVoicePermissions(tokenResponse.role, hasNickname);

        if (!isMounted) return;

        notifyRoleChange(tokenResponse.role);
        setStatus("initializing");

        const mediaHandler = await initRTKMedia({
          audio: nextPermissions.canUseMic,
          video: false,
        });

        const initializedMeeting = await initMeeting({
          authToken: tokenResponse.token,
          defaults: {
            audio: false,
            video: false,
            /**
             * initRTKMedia의 반환 타입(Pick)과 mediaHandler 기대 타입(내부 SelfMedia)이
             * 런타임에는 동일 객체이나 타입 정의가 달라 any로 연결한다.
             */
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mediaHandler: mediaHandler as any,
          },
        });

        if (!initializedMeeting) {
          throw new Error("음성 연결 클라이언트 초기화에 실패했습니다.");
        }

        meetingRef.current = initializedMeeting;

        /**
         * 발표자의 마이크를 활성화 또는 비활성화한다.
         * 현재 사용자가 발표자이고 room에 join한 상태일 때만 동작한다.
         *
         * isAudioTogglingRef로 동기 가드를 먼저 확인해 React 리렌더 전에 발생하는
         * 중복 클릭을 즉시 차단한다. onAudioTogglingChange는 버튼의 시각적
         * disabled 표시를 위해 별도로 유지한다.
         */
        const toggleLocalAudio = async () => {
          // 동기 가드: state 기반 disabled보다 먼저 실행되어 재진입을 차단한다.
          if (isAudioTogglingRef.current) return;

          const activeMeeting = meetingRef.current;
          if (!activeMeeting || !nextPermissions.canUseMic || !activeMeeting.self.roomJoined)
            return;

          isAudioTogglingRef.current = true;
          notifyAudioTogglingChange(true);
          try {
            if (activeMeeting.self.audioEnabled) {
              await activeMeeting.self.disableAudio();
            } else {
              await activeMeeting.self.enableAudio();
            }
          } finally {
            isAudioTogglingRef.current = false;
            notifyAudioTogglingChange(false);
          }
        };

        /**
         * 청취자의 청취 상태를 토글한다.
         * 로컬 상태를 업데이트하고 콜백을 통해 외부에 알린다.
         */
        const toggleLocalListening = async () => {
          const next = !listeningEnabledRef.current;
          listeningEnabledRef.current = next;
          setIsListeningEnabled(next);
          notifyListeningEnabledChange(next);
        };

        if (nextPermissions.canListen) {
          notifyListeningControllerChange(true, toggleLocalListening);
        }

        /**
         * 발표자가 아닌 경우 마이크를 강제로 끄도록 유지한다.
         * audioUpdate 이벤트 리스너로 등록되어 마이크 상태 변화를 감지한다.
         */
        const keepAudioDisabled = ({ audioEnabled }: { audioEnabled: boolean }) => {
          notifyAudioEnabledChange(audioEnabled);

          if (!nextPermissions.canUseMic && audioEnabled) {
            void initializedMeeting.self.disableAudio();
          }
        };

        initializedMeeting.self.addListener("audioUpdate", keepAudioDisabled);
        activeMeetingCleanup = () => {
          initializedMeeting.self.removeListener("audioUpdate", keepAudioDisabled);
        };

        if (!isMounted) return;

        setStatus("joining");
        await initializedMeeting.joinRoom();
        joinedRoom = true;

        if (!isMounted) return;

        if (!nextPermissions.canUseMic && initializedMeeting.self.audioEnabled) {
          await initializedMeeting.self.disableAudio();
        }

        notifyAudioControllerChange(
          nextPermissions.canUseMic,
          nextPermissions.canUseMic ? toggleLocalAudio : null,
        );
        if (nextPermissions.canUseMic) {
          notifyListeningControllerChange(false, null);
          try {
            await initializedMeeting.self.enableAudio();
            notifyAudioEnabledChange(true);
          } catch (audioError) {
            console.error("enableAudio error", audioError);
            if (isMounted) {
              setErrorMessage(
                audioError instanceof Error
                  ? `마이크를 활성화하지 못했습니다: ${audioError.message}`
                  : "마이크를 활성화하지 못했습니다.",
              );
            }
          }
        }

        if (!isMounted) return;

        setStatus("connected");
        notifyConnectionChange(true);
      } catch (error) {
        if (!isMounted) return;

        setStatus("error");
        notifyRoleChange(null);
        notifyConnectionChange(false);
        notifyAudioEnabledChange(false);
        notifyAudioTogglingChange(false);
        notifyAudioControllerChange(false, null);
        notifyListeningControllerChange(false, null);
        notifyListeningEnabledChange(true);
        setErrorMessage(
          error instanceof Error ? error.message : "음성 연결 중 알 수 없는 오류가 발생했습니다.",
        );
      }
    }

    void connect();

    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      window.removeEventListener("pageshow", handlePageShow);
      isMounted = false;
      isAudioTogglingRef.current = false;
      const activeMeeting = meetingRef.current;
      activeMeetingCleanup?.();

      if (joinedRoom && activeMeeting?.self.roomJoined) {
        void activeMeeting.leaveRoom("left");
      }

      meetingRef.current = null;
      notifyConnectionChange(false);
      notifyRoleChange(null);
      notifyAudioEnabledChange(false);
      notifyAudioTogglingChange(false);
      notifyAudioControllerChange(false, null);
      notifyListeningControllerChange(false, null);
      listeningEnabledRef.current = DEFAULT_LISTENING_ENABLED;
      notifyListeningEnabledChange(DEFAULT_LISTENING_ENABLED);
    };
  }, [
    initMeeting,
    hasNickname,
    nickname,
    notifyConnectionChange,
    notifyRoleChange,
    notifyAudioEnabledChange,
    notifyAudioControllerChange,
    notifyListeningControllerChange,
    notifyListeningEnabledChange,
    notifyAudioTogglingChange,
  ]);

  return (
    <>
      {errorMessage ? <p className="text-red-600">{errorMessage}</p> : null}
      {status === "connected" ? (
        <RealtimeKitProvider value={client}>
          <VoicePanel
            isSpeaker={voicePermissions.isSpeaker}
            isListeningEnabled={isListeningEnabled}
          />
        </RealtimeKitProvider>
      ) : null}
    </>
  );
}
