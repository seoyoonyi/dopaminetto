import { SupabaseClient } from "@supabase/supabase-js";

/**
 * 기존 익명 세션을 유지하고, 세션이 없을 때만 새 익명 사용자를 생성한다.
 * 호출부가 사용 중인 SupabaseClient 인스턴스를 그대로 받아 사용한다 —
 * 내부에서 전역 singleton을 다시 import하지 않는다.
 */
export async function ensureAnonymousSession(supabase: SupabaseClient): Promise<void> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(`익명 세션 확인에 실패했습니다: ${sessionError.message}`);
  }

  if (session) return;

  const { error: signInError } = await supabase.auth.signInAnonymously();
  if (signInError) {
    throw new Error(`익명 로그인에 실패했습니다: ${signInError.message}`);
  }
}
