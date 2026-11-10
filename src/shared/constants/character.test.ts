import { CHARACTER_ACTION_CONFIGS, CHARACTER_OPTIONS } from "@/shared/constants/character";
import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";

const readAsset = (assetUrl: string) => readFileSync(path.join(process.cwd(), "public", assetUrl));

/** PNG IHDR 청크에서 실제 이미지 크기를 읽는다. */
const readPngSize = (assetUrl: string) => {
  const buffer = readAsset(assetUrl);
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
};

/** 애니메이션 WebP(VP8X) 헤더에서 캔버스 크기를 읽는다. */
const readWebpCanvasSize = (assetUrl: string) => {
  const buffer = readAsset(assetUrl);
  expect(buffer.toString("ascii", 12, 16)).toBe("VP8X");
  return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
};

describe("캐릭터 방향별 스프라이트 시트 규격", () => {
  it.each(CHARACTER_OPTIONS)(
    "$id: 실제 PNG 크기와 설정이 일치하고 40×70 프레임 12개로 나뉜다",
    (character) => {
      const { width, height } = readPngSize(character.assetUrl);

      expect({ width, height }).toEqual({
        width: character.imageWidth,
        height: character.imageHeight,
      });
      expect({ frameWidth: character.frameWidth, frameHeight: character.frameHeight }).toEqual({
        frameWidth: 40,
        frameHeight: 70,
      });
      // Phaser SpriteSheet 파서와 같은 방식(margin·spacing 0)으로 프레임 수를 계산한다.
      const frameCount =
        Math.floor(width / character.frameWidth) * Math.floor(height / character.frameHeight);
      expect(frameCount).toBe(12); // walk-up 프레임 9~11 포함
    },
  );
});

describe("캐릭터 액션 스프라이트 시트 규격", () => {
  it.each(Object.entries(CHARACTER_ACTION_CONFIGS))(
    "%s: 프레임 격자가 PNG에 딱 맞고 5열×3행 15프레임으로 나뉜다",
    (_id, actionConfig) => {
      const { width, height } = readPngSize(actionConfig.assetUrl);

      // 나머지가 남으면 프레임 경계가 어긋나 옆 칸 캐릭터가 섞이고 뒤쪽 인덱스가 사라진다.
      expect(width % actionConfig.frameWidth).toBe(0);
      expect(height % actionConfig.frameHeight).toBe(0);
      expect((width / actionConfig.frameWidth) * (height / actionConfig.frameHeight)).toBe(15);
    },
  );
});

describe("캐릭터 미리보기 이미지 규격", () => {
  it.each(CHARACTER_OPTIONS)("$id: 미리보기 설정 비율이 실제 이미지 비율과 같다", (character) => {
    const configured = character.previewImageWidth / character.previewImageHeight;
    const webp = readWebpCanvasSize(character.previewAssetUrl);
    const still = readPngSize(`/assets/images/characters/previews/${character.id}-still.png`);

    expect(webp.width / webp.height).toBeCloseTo(configured, 3);
    expect(still.width / still.height).toBeCloseTo(configured, 3);
  });
});
