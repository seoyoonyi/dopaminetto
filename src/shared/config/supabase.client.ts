import { createBrowserClient } from "@supabase/ssr";

export const CHAT_CHANNEL_NAME = "public:chat-room";
export const TOWN_MAIN_CHANNEL = "town:main";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);
