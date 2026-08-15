import { describe, expect, it } from "vitest";

import { resolveVoiceAccess } from "./voiceAccess";

describe("resolveVoiceAccess", () => {
  it.each([
    {
      name: "activates speaker for an authorized speaker nickname",
      input: {
        hasSpeakerPermission: true,
        nickname: "방송자",
        speakerNickname: "방송자",
      },
      expected: { role: "speaker", speakerAccessDenied: false },
    },
    {
      name: "uses listener role for an authorized user with a regular nickname",
      input: {
        hasSpeakerPermission: true,
        nickname: "일반 사용자",
        speakerNickname: "방송자",
      },
      expected: { role: "listener", speakerAccessDenied: false },
    },
    {
      name: "denies speaker access for an unauthorized speaker nickname",
      input: {
        hasSpeakerPermission: false,
        nickname: "방송자",
        speakerNickname: "방송자",
      },
      expected: { role: "listener", speakerAccessDenied: true },
    },
    {
      name: "uses listener role for a regular user and nickname",
      input: {
        hasSpeakerPermission: false,
        nickname: "일반 사용자",
        speakerNickname: "방송자",
      },
      expected: { role: "listener", speakerAccessDenied: false },
    },
    {
      name: "trims nickname whitespace before matching",
      input: {
        hasSpeakerPermission: true,
        nickname: " 방송자 ",
        speakerNickname: "방송자",
      },
      expected: { role: "speaker", speakerAccessDenied: false },
    },
  ])("$name", ({ input, expected }) => {
    expect(resolveVoiceAccess(input)).toEqual(expected);
  });
});
