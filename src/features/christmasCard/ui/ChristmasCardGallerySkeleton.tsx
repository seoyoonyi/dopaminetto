const SKELETON_CARD_COUNT = 6;

export function ChristmasCardGallerySkeleton() {
  return (
    <div aria-label="카드를 불러오고 있어요." role="status">
      <ul
        aria-hidden="true"
        className="grid grid-cols-1 grid-rows-[repeat(6,minmax(19rem,auto))] gap-3 sm:grid-cols-2 sm:grid-rows-[repeat(3,minmax(19rem,auto))] lg:grid-cols-3 lg:grid-rows-[repeat(2,minmax(19rem,auto))]"
      >
        {Array.from({ length: SKELETON_CARD_COUNT }, (_, index) => (
          <li
            className="flex min-h-76 animate-pulse flex-col gap-4 rounded-xl border border-gray-200 bg-gray-100 p-4 motion-reduce:animate-none"
            key={index}
          >
            <div className="flex-1 space-y-3">
              <div className="h-4 w-3/4 rounded bg-gray-300" />
              <div className="h-4 w-full rounded bg-gray-300" />
              <div className="h-4 w-2/3 rounded bg-gray-300" />
              <div className="h-4 w-1/2 rounded bg-gray-300" />
            </div>
            <div className="flex flex-col items-end gap-2">
              <div className="h-4 w-24 rounded bg-gray-300" />
              <div className="h-3 w-32 rounded bg-gray-300" />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
