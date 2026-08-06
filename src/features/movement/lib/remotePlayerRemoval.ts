interface ScheduleRemotePlayerRemovalParams {
  pendingRemovalTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  remoteUserId: string;
  graceMs: number;
  isPresent: () => boolean;
  onConfirmed: () => void;
}

interface CancelRemotePlayerRemovalParams {
  pendingRemovalTimeouts: Map<string, ReturnType<typeof setTimeout>>;
  remoteUserId: string;
}

export const scheduleRemotePlayerRemoval = ({
  pendingRemovalTimeouts,
  remoteUserId,
  graceMs,
  isPresent,
  onConfirmed,
}: ScheduleRemotePlayerRemovalParams) => {
  if (pendingRemovalTimeouts.has(remoteUserId)) return;

  const timeout = setTimeout(() => {
    pendingRemovalTimeouts.delete(remoteUserId);

    if (!isPresent()) onConfirmed();
  }, graceMs);

  pendingRemovalTimeouts.set(remoteUserId, timeout);
};

export const cancelRemotePlayerRemoval = ({
  pendingRemovalTimeouts,
  remoteUserId,
}: CancelRemotePlayerRemovalParams) => {
  const timeout = pendingRemovalTimeouts.get(remoteUserId);
  if (!timeout) return;

  clearTimeout(timeout);
  pendingRemovalTimeouts.delete(remoteUserId);
};
