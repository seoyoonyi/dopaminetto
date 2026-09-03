import { useSupabase } from "@/app/providers/SupabaseProvider";
import { useInfiniteQuery } from "@tanstack/react-query";

import { fetchMessages } from "../api/fetchMessages";

interface UseMessagesQueryOptions {
  /**
   * 주기적 재동기화 간격(ms). realtime 채널이 놓친 메시지를 backfill 하기 위한 안전망이다.
   * `false`면 폴링하지 않는다. 탭이 백그라운드면 react-query가 자동으로 폴링을 멈춘다.
   */
  reconcileIntervalMs?: number | false;
}

export function useMessagesQuery(roomId: string, options: UseMessagesQueryOptions = {}) {
  const supabase = useSupabase();
  const { reconcileIntervalMs = false } = options;

  return useInfiniteQuery({
    queryKey: ["messages", roomId],
    queryFn: async ({ pageParam }) => {
      const page = await fetchMessages(supabase, roomId, pageParam);
      return { ...page, lastAccessed: Date.now() };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    initialPageParam: undefined,
    enabled: !!supabase,
    refetchInterval: reconcileIntervalMs,
  });
}
