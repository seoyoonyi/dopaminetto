import { keepPreviousData, useQuery } from "@tanstack/react-query";

import type { ChristmasCardPage } from "../model/christmasCard";

export function useChristmasCardsQuery(
  loadCards: (page: number) => Promise<ChristmasCardPage>,
  page: number,
) {
  return useQuery({
    queryKey: ["christmasCards", page],
    queryFn: () => loadCards(page),
    placeholderData: keepPreviousData,
    retry: false,
  });
}
