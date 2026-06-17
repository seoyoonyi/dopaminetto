interface SingleTownTabBlockedNoticeProps {
  className?: string;
}

export function SingleTownTabBlockedNotice({ className }: SingleTownTabBlockedNoticeProps) {
  return (
    <section aria-labelledby="single-town-tab-blocked-title" className={className}>
      <div className="space-y-3 text-center">
        <h2 id="single-town-tab-blocked-title" className="text-xl font-semibold text-gray-900">
          이미 다른 탭에서 접속 중입니다
        </h2>
        <p className="text-sm leading-6 text-gray-600">
          같은 브라우저에서는 하나의 탭에서만 타운에 입장할 수 있습니다.
          <br />
          기존 탭을 계속 사용하거나, 기존 탭을 닫은 뒤 이 탭을 새로고침해 주세요.
        </p>
      </div>
    </section>
  );
}
