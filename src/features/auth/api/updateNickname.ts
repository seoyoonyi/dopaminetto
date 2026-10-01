import { supabase } from "@/shared/config/supabase.client";

import { isValidNickname } from "../model/nickname";

export async function updateNickname(nickname: string) {
  if (!isValidNickname(nickname)) {
    throw new Error("닉네임은 공백만 입력할 수 없으며 최대 12자까지 사용할 수 있어요.");
  }

  const { data, error } = await supabase.auth.updateUser({ data: { nickname } });
  if (error) throw error;
  if (!data.user) throw new Error("저장된 사용자 정보를 확인하지 못했습니다.");
  return data.user;
}
