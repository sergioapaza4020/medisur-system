export const mockSessionService = {
  createSession: jest.fn(),
  getUserSessions: jest.fn(),
  findActiveSessionByUser: jest.fn(),
  validateRefreshToken: jest.fn(),
  updateLastSesssionUsed: jest.fn(),
  revokeSession: jest.fn(),
  revokeSessionById: jest.fn(),
  revokeAllSessions: jest.fn(),
};
