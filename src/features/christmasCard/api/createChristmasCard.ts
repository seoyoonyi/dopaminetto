import { ensureAnonymousSession } from "@/shared/lib/auth/ensureAnonymousSession";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  CHRISTMAS_CARD_NICKNAME_MAX_LENGTH,
  validateChristmasCardMessage,
} from "../model/christmasCardMessage";

interface ChristmasCard {
  id: number;
  created_at: string;
  nickname: string;
  content: string;
  event_type: "christmas" | "newyear";
  user_id: string;
}

export async function createChristmasCard(
  supabase: SupabaseClient,
  nickname: string,
  message: string,
): Promise<ChristmasCard> {
  const normalizedNickname = nickname.trim();
  const { normalizedMessage, isValid } = validateChristmasCardMessage(message);
  if (
    !normalizedNickname ||
    normalizedNickname.length > CHRISTMAS_CARD_NICKNAME_MAX_LENGTH ||
    !isValid
  ) {
    throw new Error("카드 작성 내용을 확인해 주세요.");
  }

  await ensureAnonymousSession(supabase);
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!auth.user) throw new Error("로그인 정보를 확인하지 못했어요.");

  const { data, error } = await supabase
    .from("seasonal_cards")
    .insert({
      nickname: normalizedNickname,
      content: normalizedMessage,
      event_type: "christmas",
      user_id: auth.user.id,
    })
    .select("id, created_at, nickname, content, event_type, user_id")
    .single<ChristmasCard>();

  if (error) throw error;
  if (!data) throw new Error("저장된 카드를 확인하지 못했어요.");
  return data;
}
