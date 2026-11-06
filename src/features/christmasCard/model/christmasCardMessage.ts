export const CHRISTMAS_CARD_NICKNAME_MAX_LENGTH = 12;
export const CHRISTMAS_CARD_MESSAGE_MAX_LENGTH = 180;
export const CHRISTMAS_CARD_MESSAGE_MAX_LINES = 8;

export function validateChristmasCardMessage(message: string) {
  const normalizedMessage = message.trim();

  return {
    normalizedMessage,
    isValid:
      normalizedMessage.length > 0 && normalizedMessage.length <= CHRISTMAS_CARD_MESSAGE_MAX_LENGTH,
  };
}
