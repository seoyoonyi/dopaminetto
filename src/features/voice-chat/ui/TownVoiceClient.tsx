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

/** 타운 음성 방송에서 speaker 또는 listener로 연결하기 위한 props */
export type TownVoiceClientProps = {
  userId: string;
  nickname: string;
  isSpeaker: boolean;
  /**
   * 음성 연결 상태가 변경될 때 호출되는 콜백.
   * connected가 true이면 연결 완료, false이면 연결 실패 또는 언마운트를 의미한다.
   */
  onConnectionChange?: (connected: boolean) => void;
  /** 발표자의 마이크 활성 상태가 변경될 때 호출된다. */
  onAudioEnabledChange?: (enabled: boolean) => void;
  /** 사용자 패널에서 사용할 마이크 토글 제어기가 준비될 때 호출된다. */
  onAudioControllerChange?: (
    canToggleAudio: boolean,
    toggleAudio: (() => Promise<void>) | null,
  ) => void;
  /** 사용자 패널에서 사용할 청취 토글 제어기가 준비될 때 호출된다. */
  onListeningControllerChange?: (
    canToggleListening: boolean,
    toggleListening: (() => Promise<void>) | null,
  ) => void;
  /** 청취 on/off 상태가 변경될 때 호출된다. */
  onListeningEnabledChange?: (enabled: boolean) => void;
  /**
   * 마이크 토글 SDK 호출의 진행 상태가 변경될 때 호출된다.
   * true이면 토글 중, false이면 완료(또는 에러)를 의미한다.
   */
  onAudioTogglingChange?: (isToggling: boolean) => void;
};

/** 음성 채널 연결 진행 상태 */
type ConnectionStatus =
  | "idle"
  | "requesting-token"
  | "initializing"
  | "joining"
  | "connected"
  | "error";

/**
 * 음성 채널 연결이 완료된 뒤 오디오를 재생한다.
 *
 * speaker는 항상 재생하고, listener는 isListeningEnabled일 때만 재생한다.
 * RtkParticipantsAudio 렌더링을 위해 반드시 유지해야 한다.
 */
function VoicePanel({
  isSpeaker,
  isListeningEnabled,
}: {
  isSpeaker: boolean;
  isListeningEnabled: boolean;
}) {
  const { meeting } = useRealtimeKitMeeting();

  if (!meeting) return null;

  return (
    <>
      {/* 모든 역할에서 상대방 오디오를 재생한다. listener는 헤드셋 토글 상태를 따른다. */}
      {isSpeaker || isListeningEnabled ? <RtkParticipantsAudio meeting={meeting} /> : null}
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
  userId,
  nickname,
  isSpeaker,
  onConnectionChange,
  onAudioEnabledChange,
  onAudioControllerChange,
  onListeningControllerChange,
  onListeningEnabledChange,
  onAudioTogglingChange,
}: TownVoiceClientProps) {
  const [client, initMeeting] = useRealtimeKitClient();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isListeningEnabled, setIsListeningEnabled] = useState(false);

  const meetingRef = useRef<typeof client | null>(null);
  const listeningEnabledRef = useRef(true);
  /** 마이크 토글 SDK 호출이 진행 중인지 동기적으로 추적하는 ref.
   *  React 리렌더 전에 발생하는 중복 클릭을 state보다 먼저 차단한다. */
  const isAudioTogglingRef = useRef(false);

  const hasNickname = nickname.trim().length > 0;
  const canUseMic = hasNickname && isSpeaker;

  useEffect(() => {
    let isMounted = true;
    let joinedRoom = false;
    let activeMeetingCleanup: (() => void) | undefined;

    /**
     * 토큰 발급, RealtimeKit 초기화, room join, speaker 마이크 활성화까지
     * 하나의 순서로 처리한다.
     */
    async function connect() {
      try {
        setStatus("requesting-token");
        setErrorMessage(null);
        onAudioEnabledChange?.(false);
        onAudioTogglingChange?.(false);
        onAudioControllerChange?.(false, null);
        onListeningControllerChange?.(false, null);

        listeningEnabledRef.current = false;
        setIsListeningEnabled(false);
        onListeningEnabledChange?.(false);

        const tokenResponse = await requestVoiceToken({
          userId,
          nickname,
          isSpeaker,
        });

        if (!isMounted) return;

        setStatus("initializing");

        const mediaHandler = await initRTKMedia({
          audio: canUseMic,
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
          if (!activeMeeting || !canUseMic || !activeMeeting.self.roomJoined) return;

          isAudioTogglingRef.current = true;
          onAudioTogglingChange?.(true);
          try {
            if (activeMeeting.self.audioEnabled) {
              await activeMeeting.self.disableAudio();
            } else {
              await activeMeeting.self.enableAudio();
            }
          } finally {
            isAudioTogglingRef.current = false;
            onAudioTogglingChange?.(false);
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
          onListeningEnabledChange?.(next);
        };

        /**
         * 발표자가 아닌 경우 마이크를 강제로 끄도록 유지한다.
         * audioUpdate 이벤트 리스너로 등록되어 마이크 상태 변화를 감지한다.
         */
        const keepAudioDisabled = ({ audioEnabled }: { audioEnabled: boolean }) => {
          onAudioEnabledChange?.(audioEnabled);

          if (!canUseMic && audioEnabled) {
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

        console.log("self.roomJoined", initializedMeeting.self.roomJoined);
        console.log("self.audioEnabled(before)", initializedMeeting.self.audioEnabled);
        console.log("mediaPermissions(before)", initializedMeeting.self.mediaPermissions);

        if (!isMounted) return;

        if (!canUseMic && initializedMeeting.self.audioEnabled) {
          await initializedMeeting.self.disableAudio();
        }

        console.log("participants.joined", initializedMeeting.participants.joined);
        console.log(
          "participants.audioSubscribed",
          initializedMeeting.participants.audioSubscribed,
        );

        onAudioControllerChange?.(canUseMic, canUseMic ? toggleLocalAudio : null);
        onListeningControllerChange?.(!isSpeaker, !isSpeaker ? toggleLocalListening : null);

        if (canUseMic) {
          try {
            console.log("mediaPermissions(before)", initializedMeeting.self.mediaPermissions);
            await initializedMeeting.self.enableAudio();
            console.log("self.audioEnabled(after)", initializedMeeting.self.audioEnabled);
            console.log("mediaPermissions(after)", initializedMeeting.self.mediaPermissions);
          } catch (audioError) {
            console.error("enableAudio error", audioError);
            console.log("mediaPermissions(error)", initializedMeeting.self.mediaPermissions);
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
        onConnectionChange?.(true);
      } catch (error) {
        if (!isMounted) return;

        setStatus("error");
        onConnectionChange?.(false);
        onAudioEnabledChange?.(false);
        onAudioTogglingChange?.(false);
        onAudioControllerChange?.(false, null);
        onListeningControllerChange?.(false, null);
        onListeningEnabledChange?.(true);
        setErrorMessage(
          error instanceof Error ? error.message : "음성 연결 중 알 수 없는 오류가 발생했습니다.",
        );
      }
    }

    void connect();

    return () => {
      isMounted = false;
      isAudioTogglingRef.current = false;
      const activeMeeting = meetingRef.current;
      activeMeetingCleanup?.();

      if (joinedRoom && activeMeeting?.self.roomJoined) {
        void activeMeeting.leaveRoom("left");
      }

      meetingRef.current = null;
      onConnectionChange?.(false);
      onAudioEnabledChange?.(false);
      onAudioTogglingChange?.(false);
      onAudioControllerChange?.(false, null);
      onListeningControllerChange?.(false, null);
      listeningEnabledRef.current = true;
      onListeningEnabledChange?.(true);
    };
  }, [
    initMeeting,
    isSpeaker,
    nickname,
    userId,
    onConnectionChange,
    onAudioEnabledChange,
    onAudioControllerChange,
    onListeningControllerChange,
    onListeningEnabledChange,
    onAudioTogglingChange,
    canUseMic,
  ]);

  return (
    <>
      {errorMessage ? <p className="text-red-600">{errorMessage}</p> : null}
      {status === "connected" ? (
        <RealtimeKitProvider value={client}>
          <VoicePanel isSpeaker={isSpeaker} isListeningEnabled={isListeningEnabled} />
        </RealtimeKitProvider>
      ) : null}
    </>
  );
}
