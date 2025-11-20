export interface Message {
  user: string;
  text: string;
  timestamp: string;
}

export interface SystemMessage {
  id: string;
  type: "join" | "leave";
  nickname: string;
  timestamp: string;
}
