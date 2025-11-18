const timeFormatter = new Intl.DateTimeFormat("ko-KR", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const dateFormatter = new Intl.DateTimeFormat("ko-KR", {
  year: "numeric",
  month: "long",
  day: "numeric",
  weekday: "long",
});

export const toDate = (timestamp: string): Date => {
  return new Date(timestamp);
};

export const isSameDay = (timestamp1: string, timestamp2: string): boolean => {
  const date1 = toDate(timestamp1);
  const date2 = toDate(timestamp2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const formatTime = (timestamp: string): string => {
  return timeFormatter.format(toDate(timestamp));
};

export const formatDate = (timestamp: string): string => {
  return dateFormatter.format(toDate(timestamp));
};

export const formatJoinedTime = (joinedAt?: string): string => {
  if (!joinedAt) {
    return "입장 시각 확인 중";
  }

  const date = toDate(joinedAt);
  if (Number.isNaN(date.getTime())) {
    return "입장 시각 확인 중";
  }

  return timeFormatter.format(date);
};
