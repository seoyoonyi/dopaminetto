"use client";

import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useTownPanelToggleStore } from "@/features/panelToggle";
import { useTownPresence } from "@/features/presence";
import { useTownPresenceStore } from "@/features/presence/model/useTownPresenceStore";
import { TownVoiceClient } from "@/features/voice-chat";
import { useUserInfo } from "@/shared/hooks";
import { useUserStore } from "@/shared/store/useUserStore";
import { ChatPanel } from "@/widgets/chatPanel";
import { TownToolbar } from "@/widgets/townToolbar";
import { UsersPanel } from "@/widgets/usersPanel";

import { useEffect } from "react";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const TownEngine = dynamic(
  () => import("@/features/movement/ui/TownEngine").then((mod) => mod.TownEngine),
  {
    ssr: false,
  },
);

export default function TownPage() {
  const router = useRouter();
  const { data: user, isLoading } = useUserInfo();
  const userNickname = user?.user_metadata?.nickname;
  const isSpeaker = userNickname === process.env.NEXT_PUBLIC_SPEAKER_NICKNAME;
  const setVoiceConnected = useTownPresenceStore((state) => state.setVoiceConnected);
  const setIsSpeaker = useTownPresenceStore((state) => state.setIsSpeaker);
  const setAudioEnabled = useTownPresenceStore((state) => state.setAudioEnabled);
  const setAudioController = useTownPresenceStore((state) => state.setAudioController);
  const setListeningController = useTownPresenceStore((state) => state.setListeningController);
  const setListeningEnabled = useTownPresenceStore((state) => state.setListeningEnabled);
  const setAudioToggling = useTownPresenceStore((state) => state.setAudioToggling);
  const { setUserNickname } = useUserStore();
  const activePanel = useTownPanelToggleStore((state) => state.activePanel);
  const resetMovement = useMovementStore((state) => state.reset);
  useTownPresence();

  // 페이지 언마운트 시 무브먼트 상태 초기화
  useEffect(() => {
    return () => {
      resetMovement();
    };
  }, [resetMovement]);

  useEffect(() => {
    if (userNickname) {
      setUserNickname(userNickname);
    }
  }, [setUserNickname, userNickname]);

  useEffect(() => {
    setIsSpeaker(isSpeaker);
  }, [isSpeaker, setIsSpeaker]);

  useEffect(() => {
    if (!isLoading && !userNickname) {
      router.push("/");
    }
  }, [isLoading, userNickname, router]);

  const nicknameFallback = (
    <div className="flex h-full items-center justify-center text-gray-500">
      닉네임을 설정해주세요.
    </div>
  );

  if (isLoading && !userNickname) {
    return (
      <div className="flex h-screen flex-col items-center justify-center overflow-hidden">
        <p>사용자 정보를 불러오는 중...</p>
      </div>
    );
  }

  const renderPanel = () => {
    if (activePanel === "users") {
      return <UsersPanel />;
    }

    if (!userNickname) {
      return nicknameFallback;
    }

    return <ChatPanel />;
  };

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <div className="flex-1 flex items-center justify-center p-4">
          <TownEngine />
        </div>
        <div className="flex h-full w-96 flex-col">{renderPanel()}</div>
      </div>

      {user?.id && userNickname && (
        <TownVoiceClient
          userId={user.id}
          nickname={userNickname}
          isSpeaker={isSpeaker}
          onConnectionChange={setVoiceConnected}
          onAudioEnabledChange={setAudioEnabled}
          onAudioControllerChange={setAudioController}
          onAudioTogglingChange={setAudioToggling}
          onListeningControllerChange={setListeningController}
          onListeningEnabledChange={setListeningEnabled}
        />
      )}
      <TownToolbar />
    </div>
  );
}
