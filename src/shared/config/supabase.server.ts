import { SupabaseClient, createClient } from "@supabase/supabase-js";
import "server-only";

/**
 * 서버 요청에서 access token을 검증하기 위한 Supabase 클라이언트를 생성한다.
 *
 * 서버 간 세션을 저장하거나 자동 갱신하지 않고, 요청마다 전달된 token 검증에만 사용한다.
 * Supabase 환경변수가 없으면 클라이언트를 생성하지 않고 null을 반환한다.
 */
export const createSupabaseServerClient = (): SupabaseClient | null => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};
