const joinedTimeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
});

export const formatJoinedTime = (joinedAt?: string) => {
  if (!joinedAt) {
    return "입장 시각 확인 중";
  }

  const joinedDate = new Date(joinedAt);
  if (Number.isNaN(joinedDate.getTime())) {
    return "입장 시각 확인 중";
  }

  return joinedTimeFormatter.format(joinedDate);
};
