import type { VillageId } from "@/entities/village";
import { AmbientSoundFalloffConfig, AmbientSoundSource } from "@/features/ambientSound/model/types";
import * as Phaser from "phaser";

interface AmbientSoundInstance {
  source: AmbientSoundSource;
  sound: Phaser.Sound.WebAudioSound;
  isAudible: boolean; // 재생 중 여부. play()/stop() 중복 호출 방지에 사용
  currentVolume: number; // 매 프레임 targetVolume 쪽으로 서서히 보간되는 실제 재생 볼륨
}

// currentVolume과 targetVolume의 차이가 이 값 미만이면 도달한 것으로 간주해 완전히 스냅한다.
// 볼륨이 이 값 이하로 내려갔을 때만 stop()을 호출해, 재생 도중 갑자기 끊기지 않고
// 자연스럽게 페이드 아웃된 뒤 정지하도록 한다.
const SILENCE_THRESHOLD = 0.001;

/**
 * 위치 기반 환경음(모닥불, 추후 분수/새소리/폭포 등)의 거리 기반 재생, 볼륨 감쇠, 정지를
 * 담당하는 범용 컨트롤러. 사운드 종류마다 audioKey(사전 로드된 Phaser 오디오 키), sources(위치
 * 목록), falloffConfig(반경/볼륨/보간 속도)만 다르게 넘겨 인스턴스를 생성하면 동일한 로직으로
 * 재생된다 - 새 환경음을 추가할 때 이 클래스를 다시 작성할 필요는 없다.
 * 소스마다 사운드 인스턴스를 1개씩만 생성해 재사용하며, 매 프레임에는 재생 상태(가청 여부,
 * 즉 볼륨이 0에서 벗어나거나 다시 0에 도달함)가 바뀔 때만 play()/stop()을 호출해 성능을 보호한다.
 * 볼륨 자체는 매 프레임 Phaser.Math.Linear로 목표 볼륨을 향해 서서히 보간되어 급격한 볼륨
 * 변화 없이 자연스럽게 페이드 인/아웃된다.
 * Scene 생명주기(create/update/shutdown)에 맞춰 호출되는 것을 전제로 함
 */
export class AmbientSoundController {
  private readonly scene: Phaser.Scene;
  private readonly falloffConfig: AmbientSoundFalloffConfig;
  private readonly instances: AmbientSoundInstance[];
  private readonly soundManager: Phaser.Sound.WebAudioSoundManager;
  private readonly handleVisibilityChange: () => void;
  private readonly handleUserInteraction: () => void;

  constructor(
    scene: Phaser.Scene,
    audioKey: string,
    sources: AmbientSoundSource[],
    falloffConfig: AmbientSoundFalloffConfig,
  ) {
    this.scene = scene;
    this.falloffConfig = falloffConfig;

    // 기본 사운드 매니저(WebAudioSoundManager)를 사용한다고 가정하고 볼륨 제어를 위해 캐스팅
    this.soundManager = scene.sound as Phaser.Sound.WebAudioSoundManager;

    // 탭 전환/창 포커스 아웃 시 Phaser가 환경음을 자동 정지시키지 않도록 비활성화.
    // 기본값(true)이면 onBlur에서 AudioContext.suspend()가 호출되어 루프 재생이 끊긴다
    this.soundManager.pauseOnBlur = false;

    this.instances = sources.map((source) => ({
      source,
      sound: scene.sound.add(audioKey, {
        loop: true,
      }) as Phaser.Sound.WebAudioSound,
      isAudible: false,
      currentVolume: 0,
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
   * 거리(px)를 innerRadius~outerRadius 구간에서 maxVolume~0으로 선형 매핑한다.
   * innerRadius 이내는 항상 maxVolume, outerRadius 이상은 항상 0.
   */
  private calculateTargetVolume(distance: number): number {
    const { innerRadius, outerRadius, maxVolume } = this.falloffConfig;

    if (distance <= innerRadius) return maxVolume;
    if (distance >= outerRadius) return 0;

    const falloff = 1 - (distance - innerRadius) / (outerRadius - innerRadius);
    return maxVolume * falloff;
  }

  /**
   * 플레이어 좌표와 현재 마을을 기준으로 소스별 목표 볼륨을 계산하고,
   * currentVolume을 목표 볼륨 쪽으로 매 프레임 Phaser.Math.Linear로 조금씩 보간해 갱신한다.
   * play()는 볼륨이 무음 상태에서 벗어날 때, stop()은 보간 결과가 완전히 0에 도달했을 때만
   * 1회 호출되므로 재생 도중 소리가 뚝 끊기지 않는다.
   * 플레이어의 현재 villageId가 소스의 villageId와 다르면(예: lobby) 거리와 무관하게
   * 목표 볼륨을 0으로 둔다.
   * 새 객체를 생성하지 않고 거리 계산과 스칼라 보간만 수행해 매 프레임 호출에도 안전하다.
   */
  update(playerPosition: { x: number; y: number }, playerVillageId: VillageId) {
    const delta = this.scene.game.loop.delta;
    const smoothing = Phaser.Math.Clamp(delta * this.falloffConfig.volumeSmoothingRate, 0, 1);

    this.instances.forEach((instance) => {
      const isInSameVillage = instance.source.villageId === playerVillageId;
      const distance = Phaser.Math.Distance.Between(
        playerPosition.x,
        playerPosition.y,
        instance.source.x,
        instance.source.y,
      );
      const targetVolume = isInSameVillage ? this.calculateTargetVolume(distance) : 0;

      instance.currentVolume = Phaser.Math.Linear(instance.currentVolume, targetVolume, smoothing);
      if (Math.abs(instance.currentVolume - targetVolume) < SILENCE_THRESHOLD) {
        instance.currentVolume = targetVolume;
      }

      if (instance.currentVolume <= SILENCE_THRESHOLD) {
        if (instance.isAudible) {
          instance.sound.stop();
          instance.isAudible = false;
        }
        return;
      }

      if (!instance.isAudible) {
        instance.sound.play(undefined, { loop: true, volume: instance.currentVolume });
        instance.isAudible = true;
      } else {
        instance.sound.volume = instance.currentVolume;
      }
    });
  }

  /**
   * Scene 종료 시 모든 사운드 인스턴스와 등록한 이벤트 리스너를 정리한다.
   */
  destroy() {
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    document.removeEventListener("pointerdown", this.handleUserInteraction);
    document.removeEventListener("keydown", this.handleUserInteraction);
    this.instances.forEach((instance) => instance.sound.destroy());
    this.instances.length = 0;
  }
}
