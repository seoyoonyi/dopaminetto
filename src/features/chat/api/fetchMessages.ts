import { CHAT_TABLE_NAME } from "@/shared/config";
import { SupabaseClient } from "@supabase/supabase-js";

const PAGE_SIZE = 20;

export async function fetchMessages(supabase: SupabaseClient, roomId: string, cursor?: string) {
  let query = supabase
    .from(CHAT_TABLE_NAME)
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE);

  if (cursor) {
    query = query.lt("created_at", cursor);
  }

  const { data, error } = await query;

  if (error) throw error;

  const messages = data ?? [];
  const lastMessage = messages[messages.length - 1];

  const hasMore = messages.length === PAGE_SIZE;
  const nextCursor = hasMore && lastMessage ? lastMessage.created_at : null;

  return {
    messages,
    nextCursor,
  };
}
