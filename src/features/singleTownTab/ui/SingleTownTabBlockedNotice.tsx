import { CHARACTER_CONFIGS, DEFAULT_CHARACTER_ID } from "@/shared/constants";
import { CircleQuestionMark } from "lucide-react";

import Image from "next/image";

interface SingleTownTabBlockedNoticeProps {
  className?: string;
  showCharacterVisual?: boolean;
}

const blockedNoticeCharacter = CHARACTER_CONFIGS[DEFAULT_CHARACTER_ID];

export function SingleTownTabBlockedNotice({
  className,
  showCharacterVisual = true,
}: SingleTownTabBlockedNoticeProps) {
  return (
    <section aria-labelledby="single-town-tab-blocked-title" className={className}>
      <div className="space-y-4 text-center">
        <h2 id="single-town-tab-blocked-title" className="text-xl font-semibold text-gray-900">
          이미 다른 탭에서 접속 중입니다
        </h2>
        <p className="text-sm leading-6 text-gray-600">
          같은 브라우저에서는 하나의 탭에서만 타운에 입장할 수 있습니다.
          <br />
          기존 탭을 계속 사용하거나, 기존 탭을 닫은 뒤 이 탭을 새로고침해 주세요.
        </p>
        {showCharacterVisual ? <BlockedTownTabCharacterVisual /> : null}
      </div>
    </section>
  );
}

function BlockedTownTabCharacterVisual() {
  return (
    <div aria-hidden="true" className="flex justify-center">
      <div className="relative flex h-40 w-56 items-end justify-center px-6 py-4">
        <Image
          src={blockedNoticeCharacter.previewAssetUrl}
          alt=""
          width={blockedNoticeCharacter.previewImageWidth}
          height={blockedNoticeCharacter.previewImageHeight}
          className="absolute bottom-4 left-10 h-28 w-auto object-contain [image-rendering:pixelated]"
          unoptimized
        />
        <div className="absolute bottom-4 right-10">
          <Image
            src={blockedNoticeCharacter.previewAssetUrl}
            alt=""
            width={blockedNoticeCharacter.previewImageWidth}
            height={blockedNoticeCharacter.previewImageHeight}
            className="h-28 w-auto object-contain opacity-25 grayscale [image-rendering:pixelated]"
            unoptimized
          />
          <CircleQuestionMark
            className="absolute left-1/2 top-[46%] h-6 w-6 -translate-x-1/2 -translate-y-1/2 text-gray-700"
            aria-hidden="true"
          />
        </div>
      </div>
    </div>
  );
}
