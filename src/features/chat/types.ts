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
}
