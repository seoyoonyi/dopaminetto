import { CHARACTER_CONFIGS } from "@/shared/constants";

import Image from "next/image";

interface MobileAccessBlockedNoticeProps {
  className?: string;
  showCharacterVisual?: boolean;
}

const blockedNoticeCharacter = CHARACTER_CONFIGS["p-girl"];

export function MobileAccessBlockedNotice({
  className,
  showCharacterVisual = true,
}: MobileAccessBlockedNoticeProps) {
  return (
    <section aria-labelledby="mobile-access-blocked-title" className={className}>
      <div className="space-y-4 text-center">
        <h2 id="mobile-access-blocked-title" className="text-xl font-semibold text-gray-900">
          모바일 환경은 아직 지원하지 않습니다
        </h2>
        <p className="text-sm leading-6 text-gray-600">
          현재 도파민또는 PC 브라우저에서 안정적으로 이용할 수 있습니다.
        </p>
        {showCharacterVisual ? (
          <div className="pt-6">
            <MobileAccessBlockedCharacterVisual />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function MobileAccessBlockedCharacterVisual() {
  return (
    <div aria-hidden="true" className="flex justify-center">
      <div className="relative flex h-28 w-32 items-end justify-center px-4 py-2">
        <Image
          src={blockedNoticeCharacter.previewAssetUrl}
          alt=""
          width={blockedNoticeCharacter.previewImageWidth}
          height={blockedNoticeCharacter.previewImageHeight}
          className="h-24 w-auto object-contain opacity-35 grayscale [image-rendering:pixelated]"
          unoptimized
        />
      </div>
    </div>
  );
}
