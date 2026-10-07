import { JwtStrategy } from './jwt.strategy';
import { AuthService } from 'src/services/auth/auth.service';
import { JwtPayload } from 'src/common/types/jwt-payload.type';

describe('JwtStrategy', () => {
  it('loads current capabilities instead of trusting stale token permissions', async () => {
    const previousSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'test-secret';
    try {
      const session: JwtPayload = {
        idUser: 1,
        idSession: 2,
        username: 'staff',
        email: 'staff@example.com',
        roles: ['STAFF'],
        permissions: [],
      };
      const getSession = jest.fn().mockResolvedValue(session);
      const strategy = new JwtStrategy({ getSession } as unknown as AuthService);
      await expect(
        strategy.validate({
          ...session,
          permissions: ['role.update'],
        }),
      ).resolves.toBe(session);
      expect(getSession).toHaveBeenCalledWith(1, 2);
      getSession.mockRejectedValue(new Error('User not found'));
      await expect(strategy.validate(session)).rejects.toThrow('User not found');
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET;
      else process.env.JWT_ACCESS_SECRET = previousSecret;
    }
  });
});
