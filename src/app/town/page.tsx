"use client";

import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useTownPanelToggleStore } from "@/features/panelToggle";
import { useTownPresence } from "@/features/presence";
import { useUserInfo } from "@/shared/hooks";
import { useUserStore } from "@/shared/store/useUserStore";
import { ChatPanel } from "@/widgets/chatPanel";
import { TownToolbar } from "@/widgets/townToolbar";
import { TownVoiceSection } from "@/widgets/townVoiceSection";
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
  const { setUserNickname } = useUserStore();
  const activePanel = useTownPanelToggleStore((state) => state.activePanel);
  const resetMovement = useMovementStore((state) => state.reset);
  useTownPresence();

  /** 페이지 이탈 시 타운 이동 상태를 초기화해 이전 씬 데이터를 남기지 않는다. */
  useEffect(() => {
    return () => {
      resetMovement();
    };
  }, [resetMovement]);

  /** 인증 사용자 닉네임을 클라이언트 store에 동기화한다. */
  useEffect(() => {
    if (userNickname) {
      setUserNickname(userNickname);
    }
  }, [setUserNickname, userNickname]);

  useEffect(() => {
    if (!isLoading && !userNickname) {
      router.push("/");
    }
  }, [isLoading, userNickname, router]);

  if (isLoading && !userNickname) {
    return (
      <div className="flex h-screen flex-col items-center justify-center overflow-hidden">
        <p>사용자 정보를 불러오는 중...</p>
      </div>
    );
  }

  const panelContent =
    activePanel === "users" ? (
      <UsersPanel />
    ) : userNickname ? (
      <ChatPanel />
    ) : (
      <div className="flex h-full items-center justify-center text-gray-500">
        닉네임을 설정해주세요.
      </div>
    );

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1">
        <div className="flex flex-1 items-center justify-center p-4">
          <TownEngine />
        </div>
        <div className="flex h-full w-96 flex-col">{panelContent}</div>
      </div>

      {user?.id && userNickname ? (
        <TownVoiceSection userId={user.id} userNickname={userNickname} />
      ) : null}
      <TownToolbar />
    </div>
  );
}
