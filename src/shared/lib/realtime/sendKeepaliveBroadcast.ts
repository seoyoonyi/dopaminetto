interface KeepaliveBroadcastMessage {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
}

/** 문서 종료 후에도 전송을 시도할 수 있도록 공개 채널 브로드캐스트를 HTTP로 보낸다. */
export function sendKeepaliveBroadcast(message: KeepaliveBroadcastMessage): void {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return;

  void fetch(`${supabaseUrl.replace(/\/$/, "")}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages: [{ ...message, private: false }] }),
    keepalive: true,
  })
    .then((response) => {
      if (!response.ok) {
        console.warn(`[sendKeepaliveBroadcast] 퇴장 신호 전송 실패: HTTP ${response.status}`);
      }
    })
    .catch((error: unknown) => {
      console.warn("[sendKeepaliveBroadcast] 퇴장 신호 전송 실패", error);
    });
}
