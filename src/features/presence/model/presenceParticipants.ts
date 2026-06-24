import { PresenceParticipant } from "../types";

interface ResolvePresenceParticipantsParams {
  nextParticipants: PresenceParticipant[];
  previousParticipants: PresenceParticipant[];
  previousUserIds: Set<string>;
  pendingDepartureUserIds: Set<string>;
  hasInitialized: boolean;
  currentUserId: string;
}

interface ResolvedPresenceParticipants {
  stableParticipants: PresenceParticipant[];
  snapshotUserIdSet: Set<string>;
  recoveredPendingDepartureUserIds: string[];
  departureCandidates: PresenceParticipant[];
  displayParticipants: PresenceParticipant[];
  currentUserIdSet: Set<string>;
  initialJoinParticipant?: PresenceParticipant;
  joinToastParticipants: PresenceParticipant[];
}

export function resolvePresenceParticipants({
  nextParticipants,
  previousParticipants,
  previousUserIds,
  pendingDepartureUserIds,
  hasInitialized,
  currentUserId,
}: ResolvePresenceParticipantsParams): ResolvedPresenceParticipants {
  const previousMe = previousParticipants.find((p) => p.userId === currentUserId);
  const hasCurrentUser = nextParticipants.some((p) => p.userId === currentUserId);
  const stableParticipants =
    previousMe && !hasCurrentUser ? [...nextParticipants, previousMe] : nextParticipants;
  const snapshotUserIdSet = new Set(stableParticipants.map((p) => p.userId));
  const recoveredPendingDepartureUserIds = Array.from(pendingDepartureUserIds).filter((userId) =>
    snapshotUserIdSet.has(userId),
  );
  const activePendingDepartureUserIds = new Set(
    Array.from(pendingDepartureUserIds).filter((userId) => !snapshotUserIdSet.has(userId)),
  );

  const departureCandidates =
    !hasInitialized && previousUserIds.size > 0
      ? Array.from(previousUserIds).flatMap((userId) => {
          if (snapshotUserIdSet.has(userId) || activePendingDepartureUserIds.has(userId)) {
            return [];
          }

          const previousParticipant = previousParticipants.find((p) => p.userId === userId);
          return previousParticipant ? [previousParticipant] : [];
        })
      : [];

  const participantById = new Map(stableParticipants.map((p) => [p.userId, p]));

  const retainedDepartureUserIds = new Set([
    ...activePendingDepartureUserIds,
    ...departureCandidates.map((participant) => participant.userId),
  ]);

  retainedDepartureUserIds.forEach((userId) => {
    const previousParticipant = previousParticipants.find((p) => p.userId === userId);
    if (previousParticipant && !participantById.has(userId)) {
      participantById.set(userId, previousParticipant);
    }
  });

  const displayParticipants = Array.from(participantById.values()).sort((a, b) =>
    a.nickname.localeCompare(b.nickname, "ko"),
  );
  const currentUserIdSet = new Set(displayParticipants.map((p) => p.userId));
  const initialJoinParticipant = hasInitialized
    ? displayParticipants.find((p) => p.userId === currentUserId)
    : undefined;
  const joinToastParticipants =
    !hasInitialized && previousUserIds.size > 0
      ? Array.from(snapshotUserIdSet).flatMap((userId) => {
          if (previousUserIds.has(userId)) {
            return [];
          }

          const participant = stableParticipants.find((p) => p.userId === userId);
          return participant ? [participant] : [];
        })
      : [];

  return {
    stableParticipants,
    snapshotUserIdSet,
    recoveredPendingDepartureUserIds,
    departureCandidates,
    displayParticipants,
    currentUserIdSet,
    initialJoinParticipant,
    joinToastParticipants,
  };
}
