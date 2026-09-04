import { supabase } from "@/shared/config/supabase.client";
import { ensureAnonymousSession as ensureAnonymousSessionWithClient } from "@/shared/lib/auth/ensureAnonymousSession";

/** 앱 전역 singleton supabase client로 기존 호출부(`ensureAnonymousSession()`) 호환성을 유지하는 wrapper다. */
export async function ensureAnonymousSession(): Promise<void> {
  return ensureAnonymousSessionWithClient(supabase);
}
