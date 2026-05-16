"use client";

import { supabase } from "@/shared/config/supabase.client";
import { CHARACTER_OPTIONS, CharacterId, DEFAULT_CHARACTER_ID } from "@/shared/constants/character";
import { useUserStore } from "@/shared/store/useUserStore";
import { Button } from "@/shared/ui/button";
import {
  Carousel,
  CarouselApi,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/shared/ui/carousel";
import { Input } from "@/shared/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";

import Image from "next/image";
import { useRouter } from "next/navigation";

interface EnterTownParams {
  nickname: string;
  characterId: CharacterId;
}

const handleEnterTown = async ({ nickname, characterId }: EnterTownParams) => {
  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    throw new Error(`익명 로그인에 실패했습니다: ${signInError.message}`);
  }

  const { error: updateUserError } = await supabase.auth.updateUser({
    data: { nickname, characterId },
  });

  if (updateUserError) {
    throw new Error(`닉네임 업데이트에 실패했습니다: ${updateUserError.message}`);
  }
};

export function NicknameForm() {
  const [nickname, setNickname] = useState("");
  const [selectedCharacterId, setSelectedCharacterId] = useState<CharacterId>(DEFAULT_CHARACTER_ID);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { setUserProfile } = useUserStore();

  const { mutate: enterTownMutation, isPending } = useMutation({
    mutationFn: handleEnterTown,
    onSuccess: () => {
      setUserProfile({ nickname, characterId: selectedCharacterId });
      queryClient.invalidateQueries({ queryKey: ["userInfo"] });
      toast.success("닉네임이 저장되었습니다!");
      router.push("/town");
    },
    onError: (error) => {
      toast.error(`입장에 실패했습니다: ${error.message}`);
    },
  });

  const isEnterButtonDisabled = nickname.trim().length === 0 || isPending;

  const handleNicknameChange = (e: ChangeEvent<HTMLInputElement>) => {
    setNickname(e.target.value.slice(0, 12));
  };

  useEffect(() => {
    if (!carouselApi) return;

    const handleSelect = () => {
      const selectedIndex = carouselApi.selectedScrollSnap();
      const nextCharacter = CHARACTER_OPTIONS[selectedIndex] ?? CHARACTER_OPTIONS[0];
      setSelectedCharacterId(nextCharacter.id);
    };

    handleSelect();
    carouselApi.on("select", handleSelect);
    carouselApi.on("reInit", handleSelect);

    return () => {
      carouselApi.off("select", handleSelect);
      carouselApi.off("reInit", handleSelect);
    };
  }, [carouselApi]);

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (nickname.trim()) {
      enterTownMutation({ nickname, characterId: selectedCharacterId });
    }
  };

  const selectedCharacter =
    CHARACTER_OPTIONS.find((character) => character.id === selectedCharacterId) ??
    CHARACTER_OPTIONS[0];

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section aria-labelledby="character-select-heading" className="space-y-3">
        <div className="text-center">
          <h2 id="character-select-heading" className="text-sm font-semibold text-gray-900">
            캐릭터 선택
          </h2>
          <p className="text-xs text-gray-500">{selectedCharacter.name}</p>
        </div>

        <Carousel
          setApi={setCarouselApi}
          opts={{ align: "center", loop: true }}
          aria-label="캐릭터 미리보기 슬라이더"
        >
          <CarouselContent>
            {CHARACTER_OPTIONS.map((character) => (
              <CarouselItem key={character.id}>
                <div className="flex h-40 items-end justify-center rounded-lg border bg-white p-4">
                  <Image
                    src={character.previewAssetUrl}
                    alt={`${character.name} 캐릭터 미리보기`}
                    width={character.previewImageWidth}
                    height={character.previewImageHeight}
                    className="h-28 w-auto object-contain [image-rendering:pixelated]"
                    unoptimized
                    priority={character.id === DEFAULT_CHARACTER_ID}
                  />
                </div>
              </CarouselItem>
            ))}
          </CarouselContent>
          <CarouselPrevious aria-label="이전 캐릭터" />
          <CarouselNext aria-label="다음 캐릭터" />
        </Carousel>
      </section>

      <div className="space-y-2">
        <label htmlFor="nickname" className="sr-only">
          닉네임
        </label>
        <Input
          id="nickname"
          type="text"
          placeholder="닉네임을 입력하세요"
          value={nickname}
          onChange={handleNicknameChange}
        />
      </div>

      <Button type="submit" disabled={isEnterButtonDisabled} className="w-full">
        {isPending ? "입장 중..." : "타운 입장"}
      </Button>
    </form>
  );
}
