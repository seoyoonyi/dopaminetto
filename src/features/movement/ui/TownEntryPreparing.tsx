/**
 * 위치 복원 또는 fallback spawn 안정화 중 표시하는 타운 입장 준비 화면
 */
export function TownEntryPreparing() {
  return (
    <section
      aria-busy="true"
      aria-live="polite"
      className="absolute inset-0 z-20 flex items-center justify-center bg-[#c8aa78] text-center text-white"
    >
      <div className="rounded-lg border border-black/15 bg-black/55 px-6 py-4 shadow-xl backdrop-blur-sm">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-white/25 border-t-white" />
        <h2 className="text-base font-semibold">입장 준비 중...</h2>
        <p className="mt-1 text-sm text-white/75">시작 위치를 확인하고 있습니다.</p>
      </div>
    </section>
  );
}
