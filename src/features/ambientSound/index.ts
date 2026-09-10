/**
 * ambientSound feature의 기본 public API.
 *
 * 여기서 export하는 항목은 모두 SSR-safe하다(React/일반 app·widget 코드에서 자유롭게 import 가능).
 * Phaser 런타임에 의존하는 API(AmbientSoundController, campfire 소스/오디오 키 등)는
 * `@/features/ambientSound/phaser`로 분리되어 있으며, 이 파일은 그것을 re-export하지 않는다.
 */

// 사용자 환경음 설정 상태 (로컬 전용)
export { useAmbientSoundStore } from "./model/useAmbientSoundStore";

// UI 레이어
export { AmbientSoundSettings } from "./ui/AmbientSoundSettings";
