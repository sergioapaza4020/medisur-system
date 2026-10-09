export const mockSessionService = {
  createSession: jest.fn(),
  getUserSessions: jest.fn(),
  findActiveSessionByUser: jest.fn(),
  validateRefreshToken: jest.fn(),
  validateAccessSession: jest.fn(),
  updateLastSessionUsed: jest.fn(),
  revokeSession: jest.fn(),
  revokeSessionById: jest.fn(),
  revokeAllSessions: jest.fn(),
};
