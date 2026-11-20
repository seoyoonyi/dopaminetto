import { describe, expect, it } from "vitest";

import { validateChristmasCardMessage } from "./christmasCardMessage";

describe("validateChristmasCardMessage", () => {
  it("앞뒤 공백은 제거하고 메시지 내부 줄바꿈은 유지한다", () => {
    expect(
      validateChristmasCardMessage("  따뜻한 하루가 되길 바라요.\n메리 크리스마스!  "),
    ).toEqual({
      normalizedMessage: "따뜻한 하루가 되길 바라요.\n메리 크리스마스!",
      isValid: true,
    });
  });

  it("공백만 있는 메시지는 유효하지 않다", () => {
    expect(validateChristmasCardMessage(" \n  ")).toEqual({
      normalizedMessage: "",
      isValid: false,
    });
  });

  it("문자열 길이 180은 허용하고 181은 거부한다", () => {
    expect(validateChristmasCardMessage("가".repeat(180)).isValid).toBe(true);
    expect(validateChristmasCardMessage("가".repeat(181)).isValid).toBe(false);
  });

  it("공백과 직접 입력한 줄바꿈만 각각 실제 문자열 길이에 포함한다", () => {
    const message = `${"a".repeat(89)}\n${"b".repeat(90)}`;

    expect(message.length).toBe(180);
    expect(validateChristmasCardMessage(message).isValid).toBe(true);
    expect(validateChristmasCardMessage(`${message}c`).isValid).toBe(false);
  });

  it("수동 줄바꿈은 7줄까지 허용하고 8줄은 거부한다", () => {
    expect(validateChristmasCardMessage(Array(7).fill("내용").join("\n")).isValid).toBe(true);
    expect(validateChristmasCardMessage(Array(8).fill("내용").join("\n")).isValid).toBe(false);
  });

  it("이모지는 JavaScript 문자열 길이 기준으로 계산한다", () => {
    expect(validateChristmasCardMessage("🎄".repeat(90)).isValid).toBe(true);
    expect(validateChristmasCardMessage("🎄".repeat(91)).isValid).toBe(false);
  });
});
