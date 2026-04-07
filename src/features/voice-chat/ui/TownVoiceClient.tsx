"use client";

import {
  RealtimeKitProvider,
  useRealtimeKitClient,
  useRealtimeKitMeeting,
} from "@cloudflare/realtimekit-react";
import { RtkMicToggle /*, RtkLivestreamPlayer */ } from "@cloudflare/realtimekit-react-ui";

import { useEffect, useMemo, useState } from "react";

import { requestVoiceToken } from "../api/requestVoiceToken";
import type { RequestVoiceTokenResponse } from "../model/types";

/**  타운 음성 방송에서 speaker 또는 listener로 연결하기 위한 props */
export type TownVoiceClientProps = {
  userId: string;
  nickname: string;
  isSpeaker: boolean;
};

type ConnectionStatus = "idle" | "requesting-token" | "initializing" | "connected" | "error";

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
          {/* <RtkLivestreamPlayer /> */}
        </div>
      )}
    </section>
  );
}

export function TownVoiceClient({ userId, nickname, isSpeaker }: TownVoiceClientProps) {
  const [client, initMeeting] = useRealtimeKitClient();
  const [status, setStatus] = useState<ConnectionStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [tokenResult, setTokenResult] = useState<RequestVoiceTokenResponse | null>(null);

  const roleLabel = useMemo(() => (isSpeaker ? "speaker" : "listener"), [isSpeaker]);

  useEffect(() => {
    let isMounted = true;

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

        initMeeting({
          authToken: tokenResponse.token,
        });

        if (!isMounted) return;
        // TODO: initMeeting은 초기화 호출일 뿐, 실제 연결 완료를 보장하지 않는다.
        // 추후 Realtime Kit의 연결 상태 이벤트를 감지하여 "connected"로 전환해야 한다.
        setStatus("connected");
      } catch (error) {
        if (!isMounted) return;

        setStatus("error");
        setErrorMessage(
          error instanceof Error ? error.message : "음성 연결 중 알 수 없는 오류가 발생했습니다.",
        );
      }
    }

    void connect();

    return () => {
      isMounted = false;
    };
  }, [initMeeting, isSpeaker, nickname, userId]);

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
