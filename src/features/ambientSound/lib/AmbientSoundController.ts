import type { VillageId } from "@/entities/village";
import type {
  AmbientSoundFalloffConfig,
  AmbientSoundSource,
} from "@/features/ambientSound/model/types";
import * as Phaser from "phaser";

interface AmbientSoundInstance {
  source: AmbientSoundSource;
  gain: GainNode;
  playback: AudioBufferSourceNode | null; // 재생 중인 native loop 노드. null이면 무음
  currentVolume: number; // 매 프레임 targetVolume 쪽으로 보간되는 실제 재생 볼륨
}

// 이 값 이하로 내려가면 무음으로 간주해 노드를 정지한다.
const SILENCE_THRESHOLD = 0.001;

/**
 * 위치 기반 환경음(모닥불 등)의 거리 기반 재생, 볼륨 감쇠, 정지를 담당하는 범용 컨트롤러.
 * 반복 재생은 Phaser Sound(프레임마다 다음 버퍼를 예약하는 구조) 대신 native
 * AudioBufferSourceNode의 loop를 사용한다. 덕분에 백그라운드 탭으로 game loop가 멈춰도
 * 재생이 끊기지 않는다. GainNode는 Phaser soundManager.destination에 연결해 전역 볼륨/음소거를
 * 그대로 따른다. Scene 생명주기(create/update/shutdown)에 맞춰 호출되는 것을 전제로 함.
 */
export class AmbientSoundController {
  private readonly scene: Phaser.Scene;
  private readonly falloffConfig: AmbientSoundFalloffConfig;
  private readonly instances: AmbientSoundInstance[];
  private readonly soundManager: Phaser.Sound.WebAudioSoundManager;
  private readonly audioBuffer: AudioBuffer;
  private readonly handleResume: () => void;

  constructor(
    scene: Phaser.Scene,
    audioKey: string,
    sources: AmbientSoundSource[],
    falloffConfig: AmbientSoundFalloffConfig,
  ) {
    this.scene = scene;
    this.falloffConfig = falloffConfig;
    this.soundManager = scene.sound as Phaser.Sound.WebAudioSoundManager;
    this.audioBuffer = scene.cache.audio.get(audioKey);

    // 탭 전환/포커스 아웃 시 Phaser가 AudioContext를 suspend하지 않도록 비활성화
    this.soundManager.pauseOnBlur = false;

    this.instances = sources.map((source) => {
      const gain = this.soundManager.context.createGain();
      gain.gain.value = 0;
      gain.connect(this.soundManager.destination);
      return { source, gain, playback: null, currentVolume: 0 };
    });

    // 브라우저가 백그라운드에서 AudioContext를 suspend한 경우의 보조 복구 장치
    this.handleResume = () => this.resumeAudioContextIfSuspended();
    document.addEventListener("visibilitychange", this.handleResume);
    document.addEventListener("pointerdown", this.handleResume);
    document.addEventListener("keydown", this.handleResume);
    window.addEventListener("focus", this.handleResume);
  }

  private resumeAudioContextIfSuspended() {
    const context = this.soundManager.context;
    if (context && context.state === "suspended") {
      context.resume().catch((error: unknown) => {
        console.warn("[ambientSound] AudioContext resume 실패", error);
      });
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
   * 플레이어 좌표와 현재 마을 기준으로 소스별 목표 볼륨을 계산하고 currentVolume을 매 프레임
   * 보간한다. 볼륨이 무음에서 벗어나면 loop 노드를 1회 생성하고, 완전히 0에 도달하면 1회 정지한다.
   * 플레이어의 villageId가 소스와 다르면(예: lobby) 거리와 무관하게 목표 볼륨을 0으로 둔다.
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
        this.stopPlayback(instance);
        return;
      }

      instance.gain.gain.value = instance.currentVolume;

      if (!instance.playback) {
        const playback = this.soundManager.context.createBufferSource();
        playback.buffer = this.audioBuffer;
        playback.loop = true;
        playback.connect(instance.gain);
        playback.start();
        instance.playback = playback;
      }
    });
  }

  private stopPlayback(instance: AmbientSoundInstance) {
    if (!instance.playback) return;
    instance.playback.stop();
    instance.playback.disconnect();
    instance.playback = null;
  }

  destroy() {
    document.removeEventListener("visibilitychange", this.handleResume);
    document.removeEventListener("pointerdown", this.handleResume);
    document.removeEventListener("keydown", this.handleResume);
    window.removeEventListener("focus", this.handleResume);
    this.instances.forEach((instance) => {
      this.stopPlayback(instance);
      instance.gain.disconnect();
    });
    this.instances.length = 0;
  }
}
