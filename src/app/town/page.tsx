"use client";

import { MobileAccessBlockedNotice, useMobileDeviceAccess } from "@/features/deviceAccess";
import { resolveCharacterId } from "@/features/movement/model/config";
import { useMovementStore } from "@/features/movement/model/useMovementStore";
import { useTownPanelToggleStore } from "@/features/panelToggle";
import { useTownPresence } from "@/features/presence";
import { SingleTownTabBlockedNotice, useSingleTownTabEntry } from "@/features/singleTownTab";
import type { VoiceRole } from "@/features/voiceChat";
import { useUserInfo } from "@/shared/hooks";
import { useUserStore } from "@/shared/store/useUserStore";
import { ChatPanel } from "@/widgets/chatPanel";
import { TownToolbar } from "@/widgets/townToolbar";
import { TownVoiceSection } from "@/widgets/townVoiceSection";
import { UsersPanel } from "@/widgets/usersPanel";
import { Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";

import { useEffect, useState } from "react";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

const NETWORK_TOAST_ID = "town-network-status";

const TownEngine = dynamic(
  () => import("@/features/movement/ui/TownEngine").then((mod) => mod.TownEngine),
  {
    ssr: false,
  },
);

export default function TownPage() {
  const mobileAccess = useMobileDeviceAccess();

  if (mobileAccess === "checking") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center overflow-hidden">
        <p>접속 환경을 확인하는 중...</p>
      </div>
    );
  }

  if (mobileAccess === "blocked") {
    return <MobileBlockedTownPage />;
  }

  return <TownSingleTabGate />;
}

function TownSingleTabGate() {
  const entryStatus = useSingleTownTabEntry();

  if (entryStatus === "checking") {
    return (
      <div className="flex h-dvh flex-col items-center justify-center overflow-hidden">
        <p>타운 입장 상태를 확인하는 중...</p>
      </div>
    );
  }

  if (entryStatus === "blocked") {
    return <BlockedTownPage />;
  }

  return <ActiveTownPage />;
}

function ActiveTownPage() {
  const router = useRouter();
  const { data: user, isLoading } = useUserInfo();
  const userNickname = user?.user_metadata?.nickname;
  const characterId = resolveCharacterId(user?.user_metadata?.characterId);
  const [voiceRole, setVoiceRole] = useState<VoiceRole | null>(null);
  const { setUserProfile } = useUserStore();
  const activePanel = useTownPanelToggleStore((state) => state.activePanel);
  const resetMovement = useMovementStore((state) => state.reset);
  useTownPresence();

  /** 페이지 이탈 시 타운 이동 상태를 초기화해 이전 씬 데이터를 남기지 않는다. */
  useEffect(() => {
    return () => {
      resetMovement();
    };
  }, [resetMovement]);

  useEffect(() => {
    const handleOffline = () => {
      toast.error("인터넷 연결이 끊겼습니다. 재연결을 시도합니다.", {
        id: NETWORK_TOAST_ID,
        icon: <WifiOff aria-hidden="true" className="size-4 text-red-500" />,
      });
    };
    const handleOnline = () => {
      toast.info("인터넷 연결이 복구되었습니다. 타운 연결을 확인하는 중입니다.", {
        id: NETWORK_TOAST_ID,
        icon: <Wifi aria-hidden="true" className="size-4 text-green-500" />,
      });
    };

    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
    };
  }, []);

  /** 인증 사용자 닉네임을 클라이언트 store에 동기화한다. */
  useEffect(() => {
    if (userNickname) {
      setUserProfile({ nickname: userNickname, characterId });
    }
  }, [characterId, setUserProfile, userNickname]);

  useEffect(() => {
    if (!isLoading && !userNickname) {
      router.push("/");
    }
  }, [isLoading, userNickname, router]);

  if (isLoading && !userNickname) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center overflow-hidden">
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
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:min-w-3xl lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-4">
          <TownEngine />
        </div>
        <div className="flex min-h-0 w-full flex-1 flex-col overflow-hidden border-t lg:h-full lg:w-96 lg:min-w-96 lg:flex-none lg:border-l lg:border-t-0">
          {panelContent}
        </div>
      </div>

      {user?.id && userNickname ? (
        <TownVoiceSection
          userNickname={userNickname}
          voiceRole={voiceRole}
          onRoleChange={setVoiceRole}
        />
      ) : null}
      <TownToolbar isSpeaker={voiceRole === "speaker"} />
    </div>
  );
}

function BlockedTownPage() {
  return (
    <div className="flex h-dvh flex-col overflow-hidden">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:min-w-3xl lg:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 items-center justify-center p-4">
          <div className="flex h-full w-full items-center justify-center rounded-lg border-4 border-gray-800 bg-black p-6 shadow-2xl">
            <SingleTownTabBlockedNotice className="rounded-lg bg-white p-6" />
          </div>
        </div>
        <aside className="flex min-h-0 w-full flex-1 items-center justify-center border-t bg-gray-50 p-6 lg:h-full lg:w-96 lg:min-w-96 lg:flex-none lg:border-l lg:border-t-0">
          <p className="text-center text-sm leading-6 text-gray-500">
            채팅은 기존 탭에서 이용 중입니다.
          </p>
        </aside>
      </div>
    </div>
  );
}

function MobileBlockedTownPage() {
  return (
    <main className="flex h-screen items-center justify-center overflow-hidden bg-gray-100 p-4">
      <div className="flex w-full max-w-sm items-center justify-center bg-white p-6">
        <MobileAccessBlockedNotice />
      </div>
    </main>
  );
}
