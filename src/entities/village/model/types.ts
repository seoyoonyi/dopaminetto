export type VillageId = "village-a" | "village-b";

export interface Boundary {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface VillageConfig {
  id: VillageId;
  name: string;
  boundary: Boundary;
  color: string; // 테스트 시 시각적 식별을 위한 색상
}
