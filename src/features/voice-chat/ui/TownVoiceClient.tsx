"use client";

import {
  RealtimeKitProvider,
  initRTKMedia,
  useRealtimeKitClient,
  useRealtimeKitMeeting,
} from "@cloudflare/realtimekit-react";
import { RtkMicToggle, RtkParticipantsAudio } from "@cloudflare/realtimekit-react-ui";

// import { RtkMicToggle /*, RtkLivestreamPlayer */ } from "@cloudflare/
// realtimekit-react-ui";
import { useEffect, useMemo, useRef, useState } from "react";

import { requestVoiceToken } from "../api/requestVoiceToken";
import type { RequestVoiceTokenResponse } from "../model/types";

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
 * 음성 채널 연결이 완료된 뒤 speaker/listener 역할에 맞는 UI를 렌더링한다.
 *
 * speaker는 마이크 토글을 노출하고,
 * listener는 방송자의 오디오만 재생한다.
 */
function VoicePanel({ isSpeaker }: { isSpeaker: boolean }) {
  const { meeting } = useRealtimeKitMeeting();

  if (!meeting) {
    return <p>음성 연결 정보를 불러오는 중입니다.</p>;
  }

  return (
    <section className="rounded-xl border p-4">
      <div className="mb-3">
        <strong>{isSpeaker ? "방송자" : "청취자"}</strong>
      </div>

      {isSpeaker ? (
        <div className="space-y-3">
          <p>마이크를 켜고 타운 전체 방송을 시작할 수 있습니다.</p>
          <RtkMicToggle />
        </div>
      ) : (
        <div className="space-y-3">
          <p>현재 방송을 청취합니다.</p>
          {/* speaker의 오디오 스트림을 자동으로 재생한다 */}
          <RtkParticipantsAudio />
        </div>
      )}
    </section>
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
}: TownVoiceClientProps) {
  const [client, initMeeting] = useRealtimeKitClient();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tokenResult, setTokenResult] = useState<RequestVoiceTokenResponse | null>(null);
  const meetingRef = useRef<typeof client | null>(null);

  const roleLabel = useMemo(() => (isSpeaker ? "speaker" : "listener"), [isSpeaker]);

  useEffect(() => {
    let isMounted = true;
    let joinedRoom = false;

    /**
     * 토큰 발급, RealtimeKit 초기화, room join, speaker 마이크 활성화까지
     * 하나의 순서로 처리한다.
     */
    async function connect() {
      try {
        setStatus("requesting-token");
        setErrorMessage(null);

        const tokenResponse = await requestVoiceToken({
          userId,
          nickname,
          isSpeaker,
        });

        if (!isMounted) return;

        setTokenResult(tokenResponse);
        setStatus("initializing");

        const mediaHandler = await initRTKMedia({ audio: false, video: false });
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

        if (!isMounted) return;

        setStatus("joining");
        await initializedMeeting.joinRoom();
        joinedRoom = true;

        if (!isMounted) return;

        if (isSpeaker) {
          try {
            await initializedMeeting.self.enableAudio();
          } catch (audioError) {
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
        setErrorMessage(
          error instanceof Error ? error.message : "음성 연결 중 알 수 없는 오류가 발생했습니다.",
        );
      }
    }

    void connect();

    return () => {
      isMounted = false;
      const activeMeeting = meetingRef.current;

      if (joinedRoom && activeMeeting?.self.roomJoined) {
        void activeMeeting.leaveRoom("left");
      }

      meetingRef.current = null;
      onConnectionChange?.(false);
    };
  }, [initMeeting, isSpeaker, nickname, userId, onConnectionChange]);

  return (
    <div className="space-y-4 rounded-2xl border p-5">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">타운 음성 방송</h3>
        <p>현재 역할: {roleLabel}</p>
        <p>연결 상태: {status}</p>
        {tokenResult ? <p>preset: {tokenResult.presetName}</p> : null}
        {errorMessage ? <p className="text-red-600">{errorMessage}</p> : null}
      </div>

      {status === "connected" ? (
        <RealtimeKitProvider value={client}>
          <VoicePanel isSpeaker={isSpeaker} />
        </RealtimeKitProvider>
      ) : null}
    </div>
  );
}
