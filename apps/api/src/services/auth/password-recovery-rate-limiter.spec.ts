import { createHash } from 'crypto';
import { Repository } from 'typeorm';
import { PasswordRecoveryRateLimit } from 'src/entities/auth/password-recovery.entity';
import { PasswordRecoveryRateLimiter } from './password-recovery-rate-limiter';

describe('Password recovery shared database limiter', () => {
  it('uses parameterized atomic SQL, hashed scopes and the returned counter for concurrent requests', async () => {
    let count = 0;
    const query = jest.fn((sql: string) =>
      sql.startsWith('DELETE') ? Promise.resolve([]) : Promise.resolve([{ attempts: ++count }]),
    );
    const repository = { query } as unknown as Repository<PasswordRecoveryRateLimit>;
    const firstInstance = new PasswordRecoveryRateLimiter(repository);
    const secondInstance = new PasswordRecoveryRateLimiter(repository);
    const results = await Promise.all(
      Array.from({ length: 8 }, (_, i) =>
        (i % 2 ? firstInstance : secondInstance).consume('email:ana@example.com', 3),
      ),
    );
    expect(results.filter(Boolean)).toHaveLength(3);
    const calls = query.mock.calls as unknown as [string, unknown[]][];
    const updates = calls.filter(([sql]) => sql.startsWith('INSERT'));
    expect(updates).toHaveLength(8);
    expect(updates[0][0]).toContain('ON CONFLICT');
    expect(updates[0][0]).toContain('expires_at <= now()');
    expect(updates[0][0]).toContain("interval '15 minutes'");
    expect(updates[0][1]).toEqual([
      createHash('sha256').update('email:ana@example.com').digest('hex'),
      3,
    ]);
    expect(JSON.stringify(calls)).not.toContain('ana@example.com');
  });
});
