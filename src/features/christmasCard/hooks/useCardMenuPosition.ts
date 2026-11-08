import { useLayoutEffect, useState } from "react";
import type { CSSProperties, RefObject } from "react";

interface UseCardMenuPositionParams {
  active: boolean;
  boundaryRef: RefObject<HTMLElement | null>;
  contentRef: RefObject<HTMLDivElement | null>;
  anchor: { x: number; y: number } | null;
}

interface CardMenuLayout {
  ready: boolean;
  style: CSSProperties;
}

export function useCardMenuPosition({
  active,
  boundaryRef,
  contentRef,
  anchor,
}: UseCardMenuPositionParams): CardMenuLayout {
  const [layout, setLayout] = useState<CardMenuLayout>({ ready: false, style: {} });

  useLayoutEffect(() => {
    if (!active) return;

    const boundary = boundaryRef.current;
    if (!boundary) return;

    let observedContent: HTMLDivElement | null = null;

    const observeContent = (content: HTMLDivElement) => {
      if (observedContent === content) return;
      if (observedContent) {
        resizeObserver.unobserve(observedContent);
      }
      observedContent = content;
      resizeObserver.observe(content);
    };

    const measure = () => {
      const content = contentRef.current;
      if (!content) return;
      observeContent(content);
      const boundaryRect = boundary.getBoundingClientRect();
      const left = Math.max(boundaryRect.left + boundary.clientLeft, 0);
      const top = Math.max(boundaryRect.top + boundary.clientTop, 0);
      const right = Math.min(left + boundary.clientWidth, window.innerWidth);
      const bottom = Math.min(top + boundary.clientHeight, window.innerHeight);
      if (right <= left || bottom <= top) {
        setLayout({ ready: false, style: {} });
        return;
      }

      const gap = Math.min(8, (right - left) / 2, (bottom - top) / 2);
      const minLeft = left + gap;
      const minTop = top + gap;
      const maxWidth = Math.max(right - left - gap * 2, 0);
      const maxHeight = Math.max(bottom - top - gap * 2, 0);
      const width = Math.min(
        content.offsetWidth || content.getBoundingClientRect().width,
        maxWidth,
      );
      const height = Math.min(
        content.offsetHeight || content.getBoundingClientRect().height,
        maxHeight,
      );
      const preferredLeft = anchor ? anchor.x - width / 2 : (left + right - width) / 2;
      const preferredTop = anchor ? anchor.y - 64 : (top + bottom - height) / 2;
      const clampedLeft = Math.min(Math.max(preferredLeft, minLeft), right - gap - width);
      const clampedTop = Math.min(Math.max(preferredTop, minTop), bottom - gap - height);

      setLayout({
        ready: true,
        style: {
          left: `${clampedLeft}px`,
          top: `${clampedTop}px`,
          maxWidth: `${maxWidth}px`,
          maxHeight: `${maxHeight}px`,
        },
      });
    };

    const resizeObserver = new ResizeObserver(measure);
    resizeObserver.observe(boundary);
    measure();

    return () => {
      resizeObserver.disconnect();
    };
  }, [active, anchor, boundaryRef, contentRef]);

  return layout;
}
