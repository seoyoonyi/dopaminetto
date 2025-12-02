import { useSupabase } from "@/app/providers/SupabaseProvider";
import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchMessages } from "../api/fetchMessages";

export function useMessagesQuery(roomId: string) {
  const supabase = useSupabase();

  return useInfiniteQuery({
    queryKey: ["messages", roomId],
    queryFn: ({ pageParam }) => fetchMessages(supabase, roomId, pageParam),
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: !!supabase,
  });
}
