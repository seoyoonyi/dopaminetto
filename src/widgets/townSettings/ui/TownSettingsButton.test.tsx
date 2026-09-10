// @vitest-environment jsdom
import { useAmbientSoundStore } from "@/features/ambientSound";
import { useSettingsDialogStore } from "@/shared/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { act } from "react";
import { Root, createRoot } from "react-dom/client";

import { TownSettingsButton } from "./TownSettingsButton";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom에 없는 API를 Radix(Dialog/Tooltip)가 참조하므로 최소 polyfill을 둔다.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {};
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false;
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {};
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {};
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

beforeEach(() => {
  useSettingsDialogStore.setState({ isOpen: false });
  useAmbientSoundStore.setState({ volume: 1, isMuted: false });
  localStorage.clear();
});

afterEach(() => {
  if (root) act(() => root!.unmount());
  container?.remove();
  root = null;
  container = null;
  useSettingsDialogStore.setState({ isOpen: false });
  useAmbientSoundStore.setState({ volume: 1, isMuted: false });
  localStorage.clear();
  vi.clearAllMocks();
});

async function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root!.render(<TownSettingsButton />);
  });
}

const triggerButton = () =>
  container!.querySelector<HTMLButtonElement>('button[aria-label="설정"]')!;
const dialog = () => document.querySelector<HTMLElement>('[role="dialog"]');

const clickTrigger = async () => {
  await act(async () => {
    triggerButton().dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
};

const pressEscape = async () => {
  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  // Radix FocusScope의 focus 복귀는 close 이후 microtask/타이머로 지연될 수 있다.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
};

// jsdom에는 PageTransitionEvent가 없다. 핸들러가 읽는 것은 event.persisted 뿐이라 최소 형태로 만든다.
async function firePageShow(persisted: boolean) {
  await act(async () => {
    window.dispatchEvent(Object.assign(new Event("pageshow"), { persisted }));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

const muteButton = () => dialog()!.querySelector<HTMLButtonElement>("button[aria-pressed]")!;
const rangeInput = () => dialog()!.querySelector<HTMLInputElement>('input[type="range"]')!;
const text = () => dialog()!.textContent ?? "";

const nativeValueSetter = Object.getOwnPropertyDescriptor(
  HTMLInputElement.prototype,
  "value",
)!.set!;

async function clickMute() {
  await act(async () => muteButton().click());
}

// 실제 <input type="range">의 change를 흉내 낸다. jsdom은 range 키보드 스텝을 구현하지 않으므로
// stash의 pressSliderKey(ArrowLeft ×N 등)는 목표 퍼센트를 직접 세팅하는 것으로 대체한다.
// store.setVolume은 직접 호출하지 않는다 — 컴포넌트의 onChange 경로를 그대로 탄다.
// React value tracker를 비워 현재 표시값과 같은 값(예: 0)으로 바꿔도 onChange가 발생하게 한다.
async function setRangePercent(percent: number) {
  await act(async () => {
    const input = rangeInput();
    const tracker = (input as unknown as { _valueTracker?: { setValue(v: string): void } })
      ._valueTracker;
    nativeValueSetter.call(input, String(percent));
    tracker?.setValue("");
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

// persisted store 상태(오디오/persist에 실제로 쓰이는 값)만 검증한다.
function expectStored(percent: number, isMuted: boolean) {
  expect(useAmbientSoundStore.getState().volume).toBeCloseTo(percent / 100, 10);
  expect(useAmbientSoundStore.getState().isMuted).toBe(isMuted);
  expect(muteButton().getAttribute("aria-pressed")).toBe(String(isMuted));
}

// UI 표시 전용 값(Slider 위치 + % 텍스트)만 검증한다. mute 중에는 stored volume과 다를 수 있다.
function expectDisplay(percent: number) {
  expect(rangeInput().value).toBe(String(percent));
  expect(text()).toContain(`${percent}%`);
}

// volume/mute 상태 안내 문구는 렌더하지 않는다. 어떤 상태에서도 없어야 한다.
function expectNoStatusText() {
  expect(text()).not.toContain("음소거되어 있습니다");
  expect(text()).not.toContain("볼륨이 0%입니다");
}

describe("TownSettingsButton - 실제 환경음 설정", () => {
  it("T1: 설정에서 볼륨과 mute를 조작하고 닫으면 shared open 상태도 해제된다", async () => {
    await render();
    expect(dialog()).toBeNull();
    expect(useSettingsDialogStore.getState().isOpen).toBe(false);
    await clickTrigger();
    expect(dialog()).not.toBeNull();
    expect(useSettingsDialogStore.getState().isOpen).toBe(true);
    for (const label of ["설정", "환경음", "모닥불", "타운 환경 설정"]) {
      expect(text()).toContain(label);
    }
    expectStored(100, false);
    expectDisplay(100);
    expect(muteButton().getAttribute("aria-label")).toBe("모닥불 소리 음소거");
    expectNoStatusText();

    await setRangePercent(70);
    expectStored(70, false);
    expectDisplay(70);

    // mute 버튼: stored volume(70)은 유지하고 Slider 표시만 0으로 내린다.
    await clickMute();
    expectStored(70, true);
    expectDisplay(0);
    expect(muteButton().getAttribute("aria-label")).toBe("모닥불 소리 음소거 해제");
    expectNoStatusText();

    // 음소거 중 Slider를 1% 이상으로 올리면 volume 저장 + 음소거 해제. 표시=소리가 일치한다.
    await setRangePercent(10);
    expectStored(10, false);
    expectDisplay(10);
    expect(muteButton().getAttribute("aria-label")).toBe("모닥불 소리 음소거");
    expectNoStatusText();

    await pressEscape();
    expect(dialog()).toBeNull();
    expect(useSettingsDialogStore.getState().isOpen).toBe(false);
  });

  it("T2: Slider를 직접 0%로 내려도 음소거 상태가 아니며, 버튼은 볼륨을 복원한다", async () => {
    await render();
    await clickTrigger();

    // 직접 0% -> volume=0 이지만 isMuted=false, 안내 문구 없음
    await setRangePercent(0);
    expectStored(0, false);
    expectDisplay(0);
    expect(muteButton().getAttribute("aria-pressed")).toBe("false");
    expect(muteButton().getAttribute("aria-label")).toBe("모닥불 소리 켜기");
    expectNoStatusText();

    // 이 상태에서 버튼 클릭 -> mute가 아니라 볼륨을 100%로 복원
    await clickMute();
    expectStored(100, false);
    expectDisplay(100);
    expect(muteButton().getAttribute("aria-label")).toBe("모닥불 소리 음소거");
    expectNoStatusText();
  });

  it("T3: 음소거 중 Slider — 1% 이상은 음소거 해제, 0%는 음소거 유지", async () => {
    await render();
    await clickTrigger();

    // mute 버튼 -> stored volume 유지, 표시만 0
    await clickMute();
    expectStored(100, true);
    expectDisplay(0);

    // 음소거 중 40%로 올림 -> volume 저장 + 음소거 해제. 표시=소리 일치.
    await setRangePercent(40);
    expectStored(40, false);
    expectDisplay(40);

    // 다시 mute -> stored 40 유지, 표시 0
    await clickMute();
    expectStored(40, true);
    expectDisplay(0);

    // 음소거 중 0%로 조작 -> volume 0 저장하되 음소거는 유지
    await setRangePercent(0);
    expectStored(0, true);
    expectDisplay(0);
    expect(muteButton().getAttribute("aria-label")).toBe("모닥불 소리 음소거 해제");

    // 음소거 중 1%로 올림 -> 음소거 해제
    await setRangePercent(1);
    expectStored(1, false);
    expectDisplay(1);
  });

  it("T4: 음소거 중 볼륨이 0이 된 상태에서 버튼은 100%로 복원하고 unmute한다", async () => {
    // 전제: 음소거 상태에서 Slider를 0까지 내리면 volume=0 & isMuted=true 가 될 수 있다.
    useAmbientSoundStore.setState({ volume: 0, isMuted: true });
    await render();
    await clickTrigger();

    expectStored(0, true);
    expectDisplay(0);
    expect(muteButton().getAttribute("aria-label")).toBe("모닥불 소리 음소거 해제");

    // 버튼 클릭 -> 0%로 unmute해서 계속 무음이 되는 대신, 100%로 복원하고 unmute.
    await clickMute();
    expectStored(100, false);
    expectDisplay(100);
    expect(muteButton().getAttribute("aria-label")).toBe("모닥불 소리 음소거");
    expectNoStatusText();
  });

  it("T5: bfcache 복원(pageshow persisted)에서만 Settings Dialog를 닫고 환경음 설정은 유지한다", async () => {
    useAmbientSoundStore.setState({ volume: 0.4, isMuted: true });
    await render();
    await clickTrigger();
    expect(useSettingsDialogStore.getState().isOpen).toBe(true);
    expect(dialog()).not.toBeNull();

    // 최초 load / 단순 탭 복귀에 해당하는 pageshow(persisted=false)는 아무것도 하지 않는다.
    await firePageShow(false);
    expect(useSettingsDialogStore.getState().isOpen).toBe(true);
    expect(dialog()).not.toBeNull();

    // 뒤로가기 bfcache 복원(persisted=true)일 때만 닫는다.
    await firePageShow(true);
    expect(useSettingsDialogStore.getState().isOpen).toBe(false);
    expect(dialog()).toBeNull();

    // 닫히는 것은 Settings.isOpen 뿐이다. 환경음 persisted 상태는 초기화하지 않는다.
    expect(useAmbientSoundStore.getState()).toMatchObject({ volume: 0.4, isMuted: true });
  });

  it("T6: 재진입(재mount)하면 직전 isOpen=true가 남아있어도 닫힌 상태로 시작한다", async () => {
    useAmbientSoundStore.setState({ volume: 0.4, isMuted: true });
    await render();
    await clickTrigger();
    expect(useSettingsDialogStore.getState().isOpen).toBe(true);

    // SPA 뒤로가기처럼 컴포넌트만 unmount/remount 된다(store 싱글턴은 그대로).
    await act(() => root!.unmount());
    root = null;
    // 이탈 정리가 없었던 최악의 경우까지 가정해 강제로 열림 상태로 되돌린다.
    useSettingsDialogStore.setState({ isOpen: true });

    await render();
    expect(useSettingsDialogStore.getState().isOpen).toBe(false);
    expect(dialog()).toBeNull();
    // 재진입해도 환경음 설정은 유지된다.
    expect(useAmbientSoundStore.getState()).toMatchObject({ volume: 0.4, isMuted: true });
  });
});
