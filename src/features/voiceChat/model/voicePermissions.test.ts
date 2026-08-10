import { describe, expect, it } from "vitest";

import { resolveVoicePermissions } from "./voicePermissions";

describe("resolveVoicePermissions", () => {
  it("allows microphone use only for a speaker with a nickname", () => {
    expect(resolveVoicePermissions("speaker", true)).toEqual({
      isSpeaker: true,
      canUseMic: true,
      canListen: false,
    });
  });

  it("keeps a speaker without a nickname from using the microphone", () => {
    expect(resolveVoicePermissions("speaker", false)).toEqual({
      isSpeaker: true,
      canUseMic: false,
      canListen: false,
    });
  });

  it.each(["listener", null] as const)(
    "keeps %s users from publishing and enables listening",
    (role) => {
      expect(resolveVoicePermissions(role, true)).toEqual({
        isSpeaker: false,
        canUseMic: false,
        canListen: true,
      });
    },
  );
});
