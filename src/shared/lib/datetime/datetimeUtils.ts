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

export const toDate = (created_at: string): Date => {
  return new Date(created_at);
};

export const isSameDay = (created_at1: string, created_at2: string): boolean => {
  const date1 = toDate(created_at1);
  const date2 = toDate(created_at2);
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

export const formatTime = (created_at: string): string => {
  return timeFormatter.format(toDate(created_at));
};

export const formatDate = (created_at: string): string => {
  return dateFormatter.format(toDate(created_at));
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
