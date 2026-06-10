/**
 * 위치 복원 또는 fallback spawn 안정화 중 표시하는 타운 입장 준비 화면
 */
export function TownEntryPreparing() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="flex h-full w-full items-center justify-center bg-black text-center text-white"
    >
      <div className="space-y-2 px-6">
        <h2 className="text-lg font-semibold">입장 준비 중...</h2>
        <p className="text-sm text-gray-300">안전한 시작 위치를 확인하고 있습니다.</p>
      </div>
    </section>
  );
}
