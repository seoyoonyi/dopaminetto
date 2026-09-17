// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { Root, createRoot } from "react-dom/client";

import { VoiceControlGroup } from "./VoiceControlGroup";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("VoiceControlGroup", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("Listener에게 별도 청취 시작·중지 버튼을 표시하지 않는다", () => {
    act(() => {
      root.render(
        <VoiceControlGroup
          isSpeaker={false}
          voiceConnected
          canToggleAudio={false}
          toggleLocalAudio={null}
          audioEnabled={false}
          isAudioToggling={false}
          listeningVolume={0.3}
          lastAudibleListeningVolume={0.3}
          setListeningVolume={vi.fn()}
        />,
      );
    });

    const statusGroup = container.querySelector("div.min-w-max");

    expect(statusGroup?.className).toContain("min-w-max");
    expect(statusGroup?.className).toContain("shrink-0");

    expect(container.querySelector('[aria-label="청취 중지"]')).toBeNull();
    expect(container.querySelector('[aria-label="청취 시작"]')).toBeNull();
    expect(container.querySelector('[aria-label="방송 음량 끄기"]')).not.toBeNull();
  });

  it("음소거 상태에서 아이콘을 누르면 마지막 가청 음량을 복원한다", () => {
    const setListeningVolume = vi.fn();

    act(() => {
      root.render(
        <VoiceControlGroup
          isSpeaker={false}
          voiceConnected
          canToggleAudio={false}
          toggleLocalAudio={null}
          audioEnabled={false}
          isAudioToggling={false}
          listeningVolume={0}
          lastAudibleListeningVolume={0.3}
          setListeningVolume={setListeningVolume}
        />,
      );
    });

    const button = container.querySelector<HTMLButtonElement>('[aria-label="방송 음량 켜기"]');

    expect(button).not.toBeNull();

    act(() => {
      button?.click();
    });

    expect(setListeningVolume).toHaveBeenCalledWith(0.3);
  });
});
