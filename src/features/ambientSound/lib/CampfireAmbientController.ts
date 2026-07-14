import type { VillageId } from "@/entities/village";
import { AMBIENT_AUDIO_KEYS, CAMPFIRE_SOUND_CONFIG } from "@/features/ambientSound/model/config";
import { AmbientSoundSource } from "@/features/ambientSound/model/types";
import * as Phaser from "phaser";

interface CampfireInstance {
  source: AmbientSoundSource;
  sound: Phaser.Sound.WebAudioSound;
  isAudible: boolean; // 재생 중 여부. play()/stop() 중복 호출 방지에 사용
}

/**
 * 모닥불 환경음의 거리 기반 재생, 볼륨 감쇠, 정지를 담당하는 컨트롤러
 * 모닥불마다 사운드 인스턴스를 1개씩만 생성해 재사용하며, 매 프레임에는
 * 재생 상태(가청 범위 진입/이탈)가 바뀔 때만 play()/stop()을 호출해 성능을 보호한다.
 * TownScene 생명주기(create/update/shutdown)에 맞춰 호출되는 것을 전제로 함
 */
export class CampfireAmbientController {
  private readonly campfires: CampfireInstance[];
  private readonly soundManager: Phaser.Sound.WebAudioSoundManager;
  private readonly handleVisibilityChange: () => void;
  private readonly handleUserInteraction: () => void;

  constructor(scene: Phaser.Scene, sources: AmbientSoundSource[]) {
    // 기본 사운드 매니저(WebAudioSoundManager)를 사용한다고 가정하고 볼륨 제어를 위해 캐스팅
    this.soundManager = scene.sound as Phaser.Sound.WebAudioSoundManager;

    // 탭 전환/창 포커스 아웃 시 Phaser가 모닥불 사운드를 자동 정지시키지 않도록 비활성화.
    // 기본값(true)이면 onBlur에서 AudioContext.suspend()가 호출되어 루프 재생이 끊긴다
    this.soundManager.pauseOnBlur = false;

    this.campfires = sources.map((source) => ({
      source,
      sound: scene.sound.add(AMBIENT_AUDIO_KEYS.CAMPFIRE, {
        loop: true,
      }) as Phaser.Sound.WebAudioSound,
      isAudible: false,
    }));

    // pauseOnBlur를 껐어도 브라우저가 백그라운드 탭의 AudioContext를 자체적으로
    // suspended 상태로 전환하는 경우가 있어, 탭 복귀/사용자 상호작용 시점에 명시적으로 resume한다
    this.handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        this.resumeAudioContextIfSuspended();
      }
    };
    this.handleUserInteraction = () => {
      this.resumeAudioContextIfSuspended();
    };

    document.addEventListener("visibilitychange", this.handleVisibilityChange);
    document.addEventListener("pointerdown", this.handleUserInteraction);
    document.addEventListener("keydown", this.handleUserInteraction);
  }

  private resumeAudioContextIfSuspended() {
    const context = this.soundManager.context;
    if (context && context.state === "suspended") {
      void context.resume();
    }
  }

  /**
   * 플레이어 좌표와 현재 마을을 기준으로 모닥불별 목표 볼륨을 계산해 재생 상태를 갱신한다.
   * 가청 범위(소스별 outerRadius) 진입 시 1회 play(), 이탈 시 1회 stop()만 호출하고,
   * 범위 내에서는 볼륨만 매 프레임 갱신해 자연스러운 페이드를 구현한다.
   * 플레이어의 현재 villageId가 모닥불의 villageId와 다르면(예: lobby) 거리와 무관하게
   * 무음 처리한다. outerRadius는 마을 전체를 커버하도록 넉넉히 잡혀 있어 거리만으로는
   * 마을 경계 바로 바깥까지 소리가 새어나갈 수 있기 때문
   */
  update(playerPosition: { x: number; y: number }, playerVillageId: VillageId) {
    const { INNER_RADIUS, MAX_VOLUME } = CAMPFIRE_SOUND_CONFIG;

    this.campfires.forEach((campfire) => {
      const isInSameVillage = campfire.source.villageId === playerVillageId;
      const outerRadius = campfire.source.outerRadius;
      const distance = Phaser.Math.Distance.Between(
        playerPosition.x,
        playerPosition.y,
        campfire.source.x,
        campfire.source.y,
      );

      if (!isInSameVillage || distance >= outerRadius) {
        if (campfire.isAudible) {
          campfire.sound.stop();
          campfire.isAudible = false;
        }
        return;
      }

      // INNER_RADIUS 이내는 최대 볼륨, outerRadius에 가까워질수록 0으로 선형 감쇠
      const falloff = Phaser.Math.Clamp(
        1 - (distance - INNER_RADIUS) / (outerRadius - INNER_RADIUS),
        0,
        1,
      );
      const targetVolume = MAX_VOLUME * falloff;

      if (!campfire.isAudible) {
        campfire.sound.play(undefined, { loop: true, volume: targetVolume });
        campfire.isAudible = true;
      } else {
        campfire.sound.volume = targetVolume;
      }
    });
  }

  /**
   * Scene 종료 시 모든 모닥불 사운드 인스턴스와 등록한 이벤트 리스너를 정리한다.
   */
  destroy() {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    document.removeEventListener("pointerdown", this.handleUserInteraction);
    document.removeEventListener("keydown", this.handleUserInteraction);
    this.campfires.forEach((campfire) => campfire.sound.destroy());
    this.campfires.length = 0;
  }
}
