export interface Message {
  id: number;
  message: string;
  user_id: string;
  room_id: string;
  created_at: string;
  nickname: string;
}

export interface MessagesPage {
  messages: Message[];
  nextCursor: string | null;
  /**
   * 페이지가 마지막으로 접근(렌더링/로드)된 타임스탬프 (GC용)
   * - undefined인 경우 초기 로드 시점 등으로 간주
   */
  lastAccessed?: number;
}
