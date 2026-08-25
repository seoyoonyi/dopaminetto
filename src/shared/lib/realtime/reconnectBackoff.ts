export const RECONNECT_BACKOFF_MS = [1000, 2000, 4000, 8000, 16000];

export const MAX_AUTO_RECONNECT = 5;

export function getReconnectDelayMs(reconnectCount: number): number {
  return (
    RECONNECT_BACKOFF_MS[reconnectCount] ?? RECONNECT_BACKOFF_MS[RECONNECT_BACKOFF_MS.length - 1]
  );
}
