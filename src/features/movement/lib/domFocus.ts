function getFocusedEditableElement(): HTMLElement | null {
  const activeElement = document.activeElement;

  if (
    activeElement instanceof HTMLInputElement ||
    activeElement instanceof HTMLTextAreaElement ||
    (activeElement as HTMLElement | null)?.isContentEditable === true
  ) {
    return activeElement as HTMLElement;
  }

  return null;
}

/**
 * document.activeElement가 텍스트 입력 가능한 요소(input, textarea, contentEditable)인지 판별
 * 채팅 입력 중 WASD 캡처 방지, 맵 클릭 시 입력창 blur 처리 등에서 공통으로 사용
 */
export function isEditableElementFocused(): boolean {
  return getFocusedEditableElement() !== null;
}

/**
 * 현재 포커스된 요소가 텍스트 입력 요소이면 blur 처리
 * 맵 클릭 시 채팅 입력창에서 빠져나오는 용도로 사용
 */
export function blurActiveEditableElement(): void {
  getFocusedEditableElement()?.blur();
}
