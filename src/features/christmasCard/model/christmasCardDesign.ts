export const CHRISTMAS_CARD_DESIGN = {
  video: "/assets/media/christmas_card_A.mp4",
  image: "/assets/images/christmas_card_A.png",
  // 최소 지원 뷰포트 520px의 텍스트 폭(약 321px)보다 보수적으로 측정한다.
  messageReference: { contentWidth: 320, fontSize: 14, lineHeight: 20 },
} as const;
