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

  it("문자열 길이 150은 허용하고 151은 거부한다", () => {
    expect(validateChristmasCardMessage("가".repeat(150)).isValid).toBe(true);
    expect(validateChristmasCardMessage("가".repeat(151)).isValid).toBe(false);
  });

  it("이모지는 JavaScript 문자열 길이 기준으로 계산한다", () => {
    expect(validateChristmasCardMessage("🎄".repeat(75)).isValid).toBe(true);
    expect(validateChristmasCardMessage("🎄".repeat(76)).isValid).toBe(false);
  });
});
