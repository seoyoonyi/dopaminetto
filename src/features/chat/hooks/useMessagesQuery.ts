import { useSupabase } from "@/app/providers/SupabaseProvider";
import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchMessages } from "../api/fetchMessages";

export function useMessagesQuery(roomId: string) {
  const supabase = useSupabase();

  return useInfiniteQuery({
    queryKey: ["messages", roomId],
    queryFn: async ({ pageParam }) => {
      const page = await fetchMessages(supabase, roomId, pageParam);
      return { ...page, lastAccessed: Date.now() };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: !!supabase,
  });
}
