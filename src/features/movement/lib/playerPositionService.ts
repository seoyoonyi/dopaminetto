import { VillageId } from "@/entities/village";
import { Position } from "@/features/movement/model/types";
import { supabase } from "@/shared/config/supabase.client";

export interface SavedPlayerPosition {
  village_id: string;
  x: number;
  y: number;
}

/**
 * user_position 테이블에서 해당 유저의 마지막 저장 위치를 조회한다.
 * 저장된 위치가 없으면 null을 반환한다.
 */
export const fetchPlayerPosition = async (userId: string): Promise<SavedPlayerPosition | null> => {
  const { data, error } = await supabase
    .from("user_position")
    .select("village_id, x, y")
    .eq("user_id", userId)
    .single();

  if (error) {
    // PGRST116: 행이 없는 경우 (신규 유저)
    if (error.code === "PGRST116") return null;
    throw error;
  }

  return data;
};

/**
 * user_position 테이블에 현재 위치를 upsert한다.
 * 유저당 1행을 유지하며, 중복 시 덮어쓴다(last write wins).
 */
export const savePlayerPosition = async (
  userId: string,
  villageId: VillageId,
  position: Position,
) => {
  const { error } = await supabase.from("user_position").upsert(
    {
      user_id: userId,
      village_id: villageId,
      x: Math.round(position.x),
      y: Math.round(position.y),
    },
    { onConflict: "user_id" },
  );

  if (error) throw error;
};
