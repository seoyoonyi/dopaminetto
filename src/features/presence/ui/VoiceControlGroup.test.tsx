// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { Root, createRoot } from "react-dom/client";

import { useListeningVolumeStore } from "../model/useListeningVolumeStore";
import { VoiceControlGroup } from "./VoiceControlGroup";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function ListenerControls() {
  const { listeningVolume, lastAudibleListeningVolume, setListeningVolume } =
    useListeningVolumeStore();
  return (
    <VoiceControlGroup
      isSpeaker={false}
      canToggleAudio={false}
      toggleLocalAudio={null}
      audioEnabled={false}
      isAudioToggling={false}
      listeningVolume={listeningVolume}
      lastAudibleListeningVolume={lastAudibleListeningVolume}
      setListeningVolume={setListeningVolume}
    />
  );
}

const click = async (label: string) => {
  const button = document.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`);
  expect(button).not.toBeNull();
  await act(async () => button!.click());
};

describe("VoiceControlGroup", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    useListeningVolumeStore.setState({ listeningVolume: 0.3, lastAudibleListeningVolume: 0.3 });
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

  it("청취자의 음소거 버튼·볼륨 슬라이더·퍼센트를 툴바에 바로 표시한다", async () => {
    await act(async () => root.render(<ListenerControls />));
    expect(container.querySelector('[aria-label="청취 중지"]')).toBeNull();
    expect(container.querySelector('[aria-label="청취 시작"]')).toBeNull();
    expect(container.querySelector('[aria-label="사운드 조절"]')).toBeNull();
    expect(container.querySelector('[aria-label="방송 음량"]')).not.toBeNull();
    expect(container.querySelector('[aria-label="방송 음량 끄기"]')).not.toBeNull();
    expect(container.querySelector("output")?.textContent).toBe("30%");
    expect(useListeningVolumeStore.getState().listeningVolume).toBe(0.3);
  });

  it("툴바에서 볼륨을 변경하고 음소거 후 마지막 음량을 복원한다", async () => {
    await act(async () => root.render(<ListenerControls />));
    const slider = container.querySelector<HTMLInputElement>('[aria-label="방송 음량"]')!;
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(slider, "70");
      slider.dispatchEvent(new Event("input", { bubbles: true }));
    });
    expect(useListeningVolumeStore.getState().listeningVolume).toBe(0.7);
    expect(container.querySelector("output")?.textContent).toBe("70%");
    await click("방송 음량 끄기");
    expect(useListeningVolumeStore.getState().listeningVolume).toBe(0);
    await click("방송 음량 켜기");
    expect(useListeningVolumeStore.getState().listeningVolume).toBe(0.7);
    expect(slider.value).toBe("70");
  });

  it("방송자는 마이크를 직접 조작하고 청취 볼륨을 표시하지 않는다", async () => {
    const toggleLocalAudio = vi.fn().mockResolvedValue(undefined);
    await act(async () => {
      root.render(
        <VoiceControlGroup
          isSpeaker
          canToggleAudio
          toggleLocalAudio={toggleLocalAudio}
          audioEnabled
          isAudioToggling={false}
          listeningVolume={0}
          lastAudibleListeningVolume={0.3}
          setListeningVolume={vi.fn()}
        />,
      );
    });

    await click("마이크 끄기");
    expect(toggleLocalAudio).toHaveBeenCalledTimes(1);
    expect(container.querySelector('[aria-label="방송 음량"]')).toBeNull();
  });
});
