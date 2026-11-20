export const CHRISTMAS_CARD_NICKNAME_MAX_LENGTH = 12;
export const CHRISTMAS_CARD_MESSAGE_MAX_LENGTH = 180;
export const CHRISTMAS_CARD_MESSAGE_MAX_LINES = 7;

export function validateChristmasCardMessage(message: string) {
  const normalizedMessage = message.trim();
  const lineCount = normalizedMessage.split(/\r\n?|\n/).length;

  return {
    normalizedMessage,
    isValid:
      normalizedMessage.length > 0 &&
      normalizedMessage.length <= CHRISTMAS_CARD_MESSAGE_MAX_LENGTH &&
      lineCount <= CHRISTMAS_CARD_MESSAGE_MAX_LINES,
  };
}
