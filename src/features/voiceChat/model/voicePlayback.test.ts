import { describe, expect, it } from "vitest";

import { shouldMuteVoicePlayback } from "./voicePlayback";

describe("shouldMuteVoicePlayback", () => {
  it("mutes a listener after listening is stopped", () => {
    expect(shouldMuteVoicePlayback(false, false)).toBe(true);
  });

  it("keeps a listener unmuted while listening", () => {
    expect(shouldMuteVoicePlayback(false, true)).toBe(false);
  });

  it("keeps speaker playback unmuted", () => {
    expect(shouldMuteVoicePlayback(true, false)).toBe(false);
  });
});
