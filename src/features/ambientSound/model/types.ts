import { VillageId } from "@/entities/village";

/**
 * 환경음(Ambient Sound)이 재생될 좌표를 나타내는 소스 정의
 * 모닥불, 추후 분수/새소리/폭포 등 특정 위치에 고정된 반복 재생 사운드에 공통으로 사용됨.
 * 좌표는 Tiled Effects 레이어의 실제 오브젝트 좌표를 그대로 사용한다(resolveCampfireSources 참고).
 * villageId: 이 사운드가 속한 마을. 플레이어가 이 마을에 있을 때만 가청 대상이 되어
 * 마을 경계 바로 바깥(예: lobby)까지 소리가 새어나가는 것을 막는다.
 * 가청 반경은 소스가 아닌 AmbientSoundFalloffConfig(사운드 종류별 설정)가 결정한다.
 */
export interface AmbientSoundSource {
  id: string;
  villageId: VillageId;
  x: number;
  y: number;
}

/**
 * 환경음의 거리 기반 볼륨 감쇠 파라미터. 사운드 종류(모닥불/분수/새소리/폭포 등)마다
 * 별도의 설정 객체를 만들어 AmbientSoundController에 넘기면 같은 로직으로 재생된다.
 */
export interface AmbientSoundFalloffConfig {
  innerRadius: number; // 이 거리(px) 이내는 항상 maxVolume
  outerRadius: number; // 이 거리(px) 이상은 항상 0 (무음)
  maxVolume: number;
  // 프레임마다 currentVolume을 targetVolume 쪽으로 얼마나 당길지 결정하는 ms 단위 보간 속도.
  // delta(ms) * 이 값을 Phaser.Math.Linear의 t로 사용한다.
  volumeSmoothingRate: number;
}
