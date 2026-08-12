import { describe, expect, it } from "vitest";

import * as movementSyncState from "./movementSyncState";

type ShouldInitializeRemotePlayerFromPresence = (params: {
  currentUserId?: string;
  knownRemotePlayerIds: Set<string>;
  presenceUserId?: string;
}) => boolean;

const shouldInitializeRemotePlayerFromPresence = (
  movementSyncState as typeof movementSyncState & {
    shouldInitializeRemotePlayerFromPresence?: ShouldInitializeRemotePlayerFromPresence;
  }
).shouldInitializeRemotePlayerFromPresence;

describe("shouldInitializeRemotePlayerFromPresence", () => {
  it("initializes only a remote player not already rendered", () => {
    expect(shouldInitializeRemotePlayerFromPresence).toBeTypeOf("function");

    expect(
      shouldInitializeRemotePlayerFromPresence?.({
        currentUserId: "local-user",
        knownRemotePlayerIds: new Set(["remote-user"]),
        presenceUserId: "remote-user",
      }),
    ).toBe(false);
    expect(
      shouldInitializeRemotePlayerFromPresence?.({
        currentUserId: "local-user",
        knownRemotePlayerIds: new Set(),
        presenceUserId: "new-remote-user",
      }),
    ).toBe(true);
    expect(
      shouldInitializeRemotePlayerFromPresence?.({
        currentUserId: "local-user",
        knownRemotePlayerIds: new Set(),
        presenceUserId: "local-user",
      }),
    ).toBe(false);
  });
});
