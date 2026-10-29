import type { MapBounds } from "@/entities/village";

interface SnowPoint {
  x: number;
  y: number;
}

/** 빌리지 구분 없이 Tiled 맵 범위 안의 눈 생성 좌표를 반환한다. */
export function createSnowPointGenerator(mapBounds: MapBounds): (point: SnowPoint) => void {
  return (point) => {
    point.x = mapBounds.x + Math.random() * mapBounds.width;
    point.y = mapBounds.y + Math.random() * mapBounds.height;
  };
}
