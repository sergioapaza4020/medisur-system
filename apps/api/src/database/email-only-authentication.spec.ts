import { QueryRunner } from 'typeorm';
import { EmailOnlyAuthentication1791763200000 } from './migrations/1791763200000-EmailOnlyAuthentication';

describe('Email-only migration preflight', () => {
  const migration = new EmailOnlyAuthentication1791763200000();

  it.each([
    [{ id_user: 1, email: null }],
    [{ id_user: 1, email: '' }],
    [{ id_user: 1, email: 'invalid' }],
    [
      { id_user: 1, email: 'a@example.com' },
      { id_user: 2, email: ' A@example.com ' },
    ],
  ])('refuses unsafe data before any mutation: %j', async (...users) => {
    const query = jest.fn().mockResolvedValueOnce(undefined).mockResolvedValueOnce(users);
    await expect(migration.up({ query } as unknown as QueryRunner)).rejects.toThrow(
      'migration blocked',
    );
    expect(query).toHaveBeenCalledTimes(2);
  });

  it('normalizes validated data before dropping the old identifier and retaining email uniqueness', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce([{ id_user: 1, email: ' ANA@example.com ' }]);
    await migration.up({ query } as unknown as QueryRunner);
    expect(query).toHaveBeenNthCalledWith(
      3,
      'UPDATE "users" SET "email" = $1 WHERE "id_user" = $2',
      ['ana@example.com', 1],
    );
    expect(query).toHaveBeenCalledWith('ALTER TABLE "users" DROP COLUMN "username"');
    expect(query.mock.calls.flat().join(' ')).not.toContain('DROP CONSTRAINT');
    await expect(migration.down()).rejects.toThrow('backup');
  });
});
