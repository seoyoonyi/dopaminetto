import { createBrowserClient } from "@supabase/ssr";

export const CHAT_CHANNEL_NAME = "public:chat-room";
export const CHAT_TABLE_NAME = "chat";
export const TOWN_MAIN_CHANNEL = "town:main";

/**
 * 채팅 관련 설정값 정의
 * - GC(Garbage Collection) 설정 포함
 */
export const CHAT_GC_CONFIG = {
  // GC 기능 활성화 여부 (Feature Flag)
  ENABLED: true,
  // 최대 유지 페이지 수
  MAX_PAGES: 50,
  // GC 발생 시에도 제거하지 않고 유지할 최소 상단(최신) 페이지 수
  MIN_VISIBLE_PAGES: 20,
} as const;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
