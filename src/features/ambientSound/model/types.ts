import { VillageId } from "@/entities/village";

/**
 * 환경음(Ambient Sound)이 재생될 좌표를 나타내는 소스 정의
 * 모닥불 등 특정 위치에 고정된 반복 재생 사운드에 사용됨
 * villageId: 이 사운드가 속한 마을. 플레이어가 이 마을에 있을 때만 가청 대상이 되어
 * 마을 경계 바로 바깥(예: lobby)까지 소리가 새어나가는 것을 막는다.
 * outerRadius: 이 소스가 들리는 최대 거리(px). 소스가 속한 마을의 크기에 맞춰
 * 동적으로 계산되어, 마을이 커지거나 작아져도 영역 전체를 커버한다.
 */
export interface AmbientSoundSource {
  id: string;
  villageId: VillageId;
  x: number;
  y: number;
  outerRadius: number;
}
