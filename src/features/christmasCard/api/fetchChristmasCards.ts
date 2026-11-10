import type { SupabaseClient } from "@supabase/supabase-js";

import { CHRISTMAS_CARD_PAGE_SIZE } from "../model/christmasCard";
import type { ChristmasCard } from "../model/christmasCard";

export async function fetchChristmasCards(supabase: SupabaseClient, page: number) {
  const start = Math.max(0, page - 1) * CHRISTMAS_CARD_PAGE_SIZE;
  const { data, error, count } = await supabase
    .from("seasonal_cards")
    .select("id, created_at, nickname, content, event_type, user_id", { count: "exact" })
    .eq("event_type", "christmas")
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .range(start, start + CHRISTMAS_CARD_PAGE_SIZE - 1);

  if (error) throw error;
  return { cards: (data ?? []) as ChristmasCard[], totalCount: count ?? 0 };
}
