export type ConnectionStatus = "connecting" | "connected" | "disconnected";

export const CONNECTION_STATUS_LABEL: Record<ConnectionStatus, string> = {
  connected: "연결됨",
  connecting: "연결 중",
  disconnected: "연결 안됨",
};
