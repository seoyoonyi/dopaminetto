const MESSAGE_MAX_LENGTH = 150;

export function validateChristmasCardMessage(message: string) {
  const normalizedMessage = message.trim();

  return {
    normalizedMessage,
    isValid: normalizedMessage.length > 0 && normalizedMessage.length <= MESSAGE_MAX_LENGTH,
  };
}
