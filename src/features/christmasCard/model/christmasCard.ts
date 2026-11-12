export interface ChristmasCard {
  id: number;
  created_at: string;
  nickname: string;
  content: string;
  event_type: "christmas" | "newyear";
  user_id: string;
}

export const CHRISTMAS_CARD_PAGE_SIZE = 6;

export interface ChristmasCardPage {
  cards: ChristmasCard[];
  totalCount: number;
}
