import { CampfireVisual } from "@/features/movement/lib/resolveCampfireVisuals";
import * as Phaser from "phaser";

export const CAMPFIRE_BASE_ASSET_KEY = "campfire-base";
export const CAMPFIRE_BASE_ASSET_URL = "/assets/images/campfire-base.png";
export const CAMPFIRE_FLAME_ASSET_KEY = "campfire-flame";
export const CAMPFIRE_FLAME_ASSET_URL = "/assets/images/campfire-flame.png";
// 실측(campfire-flame.png 700x175, 가로 4프레임)과 일치하는 그리드 값
export const CAMPFIRE_FLAME_FRAME_WIDTH = 175;
export const CAMPFIRE_FLAME_FRAME_HEIGHT = 165;

const CAMPFIRE_ANIMATION_KEY = "campfire-burning";
const CAMPFIRE_ANIMATION_FRAME_COUNT = 4;
const CAMPFIRE_ANIMATION_FRAME_RATE = 8;
const CAMPFIRE_SCALE = 0.4;
// 분리 전 단일 스프라이트가 쓰던 origin(0.52, 0.53)이 가리키던 "돌 바닥 기준점"을
// campfire-base.png / campfire-flame.png 각각의 크롭 좌표계로 환산한 값(분리 스크립트의
// crop 원점 기준 역산). 이 값 덕분에 두 이미지를 같은 Tiled 좌표에 겹쳐 그리면 분리 이전과
// 동일한 위치에 정렬된다. flame의 originY가 1보다 큰 것은 정상 — 불꽃 텍스처의 알파 영역
// 하단(잉걸불)이 실제 바닥 기준점보다 위에서 끝나고, 그 아래는 돌이 가리는 부분이기 때문.
const CAMPFIRE_BASE_ORIGIN = { x: 0.27, y: 0.9 } as const;
const CAMPFIRE_FLAME_ORIGIN = { x: 0.24, y: 1.07 } as const;
// 불꽃만 위치를 미세 조정하고 싶을 때 사용(돌 바닥/충돌 판정에는 영향 없음)
const FLAME_OFFSET_X = 0;
const FLAME_OFFSET_Y = 0;

/**
 * Tiled Effects 레이어의 campfire Point Object를 돌 바닥(정적 Image) + 불꽃(애니메이션
 * Sprite) 두 개의 오브젝트로 렌더링한다. 돌 바닥은 Tiled 좌표에 고정되어 움직이지 않으며
 * 충돌(MapLoader의 collisionRects)도 이 좌표를 그대로 기준으로 삼는다. 불꽃은
 * FLAME_OFFSET_X/Y만큼만 별도로 위치를 미세 조정할 수 있고, 애니메이션만 재생한다.
 * 둘 다 위치가 고정되어 있어 depth를 생성 시 1회만 계산하고, 캐릭터처럼 매 프레임
 * 재정렬하지 않는다. Physics Body는 붙이지 않는다.
 *
 * AmbientSoundController(환경음)와 동일하게, TownScene은 이 클래스를 생성만 하고
 * 별도의 참조/정리(destroy) 없이 위임한다 — 생성된 Image/Sprite는 Scene 종료 시
 * Phaser가 표시 목록을 통해 자동으로 정리한다.
 */
export class CampfireEffectsController {
  constructor(scene: Phaser.Scene, visuals: CampfireVisual[], characterDepthBase: number) {
    // 애니메이션 등록 (Scene 재생성 시에도 중복 생성되지 않도록 방어)
    if (!scene.anims.exists(CAMPFIRE_ANIMATION_KEY)) {
      scene.anims.create({
        key: CAMPFIRE_ANIMATION_KEY,
        frames: scene.anims.generateFrameNumbers(CAMPFIRE_FLAME_ASSET_KEY, {
          start: 0,
          end: CAMPFIRE_ANIMATION_FRAME_COUNT - 1,
        }),
        frameRate: CAMPFIRE_ANIMATION_FRAME_RATE,
        repeat: -1,
      });
    }

    visuals.forEach((visual) => {
      const depth = characterDepthBase + visual.y + visual.depthOffset;

      // 돌 바닥: 정적 Image, Tiled 좌표 그대로(충돌 기준과 동일한 좌표)
      const base = scene.add.image(visual.x, visual.y, CAMPFIRE_BASE_ASSET_KEY);
      base.setOrigin(CAMPFIRE_BASE_ORIGIN.x, CAMPFIRE_BASE_ORIGIN.y);
      base.setScale(CAMPFIRE_SCALE);
      base.setDepth(depth);

      // 불꽃: 애니메이션 Sprite, FLAME_OFFSET_X/Y로만 위치 미세 조정 가능
      const flame = scene.add.sprite(
        visual.x + FLAME_OFFSET_X,
        visual.y + FLAME_OFFSET_Y,
        CAMPFIRE_FLAME_ASSET_KEY,
        0,
      );
      flame.setOrigin(CAMPFIRE_FLAME_ORIGIN.x, CAMPFIRE_FLAME_ORIGIN.y);
      flame.setScale(CAMPFIRE_SCALE);
      flame.setDepth(depth);

      if (scene.anims.exists(visual.animationKey)) {
        flame.play(visual.animationKey);
      }
    });
  }
}
