export const NICKNAME_MAX_LENGTH = 12;

export function isValidNickname(nickname: string): boolean {
  return nickname.trim().length > 0 && nickname.length <= NICKNAME_MAX_LENGTH;
}
