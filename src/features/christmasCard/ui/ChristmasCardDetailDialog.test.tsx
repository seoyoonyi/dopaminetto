// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

import { act } from "react";
import { type Root, createRoot } from "react-dom/client";

import { ChristmasCardDetailDialog } from "./ChristmasCardDetailDialog";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
});

describe("ChristmasCardDetailDialog", () => {
  it("작성 카드와 같은 영상 카드 면에 닉네임과 읽기 전용 메시지를 표시한다", async () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    await act(async () => {
      root!.render(
        <ChristmasCardDetailDialog
          message="따뜻한 연말 보내세요!"
          nickname="눈사람"
          onOpenChange={() => {}}
          open
        />,
      );
    });

    const card = document.querySelector('[data-card-template="true"]');
    expect(card?.className).toContain("aspect-video");
    expect(card?.querySelector("video")?.getAttribute("src")).toBe(
      "/assets/media/christmas_card_A.mp4",
    );
    expect(card?.querySelector("img")?.getAttribute("alt")).toBe("");
    expect(card?.querySelector("textarea")).toBeNull();
    expect(card?.textContent).toContain("따뜻한 연말 보내세요!");
    expect(document.body.textContent).toContain("눈사람");
    expect(document.querySelector("button[aria-label='닫기']")).not.toBeNull();
  });
});
