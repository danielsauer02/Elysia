export const createRequestId = (): string =>
  `req_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
