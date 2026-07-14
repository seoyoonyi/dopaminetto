import { VillageId } from "@/entities/village";

/**
 * 환경음(Ambient Sound)이 재생될 좌표를 나타내는 소스 정의
 * 모닥불 등 특정 위치에 고정된 반복 재생 사운드에 사용됨. 좌표는 Tiled Effects 레이어의
 * 실제 오브젝트 좌표를 그대로 사용한다(resolveCampfireSources 참고).
 * villageId: 이 사운드가 속한 마을. 플레이어가 이 마을에 있을 때만 가청 대상이 되어
 * 마을 경계 바로 바깥(예: lobby)까지 소리가 새어나가는 것을 막는다.
 * 가청 반경(INNER_RADIUS/OUTER_RADIUS)은 모든 소스가 CAMPFIRE_SOUND_CONFIG의 값을 공유한다.
 */
export interface AmbientSoundSource {
  id: string;
  villageId: VillageId;
  x: number;
  y: number;
}
