import { SupabaseClient } from "@supabase/supabase-js";

import { ensureAnonymousSession } from "../auth/ensureAnonymousSession";

/**
 * Realtime recovery(visibility 복귀, 소켓 리셋) 진입 전 auth session freshness를 보장한다.
 * 기존 세션/userId는 그대로 유지하고, session 자체가 없을 때만 ensureAnonymousSession()으로
 * 복구한다(새 로그인 방식을 만들지 않고 기존 익명 로그인 경로를 그대로 재사용).
 *
 * 실패해도 예외를 던지지 않고 null을 반환한다 — 호출부는 null을 받으면 이번 recovery
 * attempt(소켓/채널 reconnect)를 진행하지 않아야 한다. 기존 backoff/reconnectCounts는
 * 건드리지 않으므로, 다음 recovery 트리거(다음 visibilitychange, 다른 채널의 소켓 리셋 등)가
 * 새로 이 게이트를 다시 시도한다 — 이 함수 자체가 새로운 재시도 루프를 만들지는 않는다.
 */
export async function ensureFreshRealtimeAuth(supabase: SupabaseClient): Promise<string | null> {
  try {
    let {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      await ensureAnonymousSession(supabase);
      ({
        data: { session },
      } = await supabase.auth.getSession());
    }

    const accessToken = session?.access_token ?? null;
    if (!accessToken) return null;

    await supabase.realtime.setAuth(accessToken);
    return accessToken;
  } catch (err) {
    console.warn("[realtimeAuthFreshness] auth freshness 확보 실패", err);
    return null;
  }
}

/**
 * client별로 in-flight 요청을 공유해, 같은 SupabaseClient에 대해 거의 동시에 발생하는
 * 여러 recovery 트리거(예: visibilitychange와 소켓 리셋이 겹치는 경우)가 getSession()/setAuth()를
 * 중복 호출하지 않도록 한다. WeakMap으로 client 단위 스코프를 둬서, 테스트마다 새로 만드는
 * 서로 다른 fake client 인스턴스가 하나의 module-global 상태를 공유해 서로 오염시키는
 * 일을 막는다(이 앱은 supabase client가 싱글톤이라 프로덕션 동작은 동일하다).
 */
const inFlightAuthFreshness = new WeakMap<SupabaseClient, Promise<string | null>>();

export function ensureFreshRealtimeAuthOnce(supabase: SupabaseClient): Promise<string | null> {
  const existing = inFlightAuthFreshness.get(supabase);
  if (existing) return existing;

  const promise = ensureFreshRealtimeAuth(supabase).finally(() => {
    inFlightAuthFreshness.delete(supabase);
  });

  inFlightAuthFreshness.set(supabase, promise);
  return promise;
}
