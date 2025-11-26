export interface Message {
  id: number;
  message: string;
  user_id: string;
  room_id: string;
  created_at: string;
  nickname: string;
}

export type ChatMessage = Omit<Message, "id">;

export interface SystemMessage {
  id: string;
  type: "join" | "leave";
  nickname: string;
  created_at: string;
}
