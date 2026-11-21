export class AIServiceError extends Error {
  constructor(message, status = 503, code = 'AI_UNAVAILABLE') {
    super(message);
    this.name = 'AIServiceError';
    this.status = status;
    this.code = code;
  }
}
