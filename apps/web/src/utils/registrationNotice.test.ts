import { beforeEach, describe, expect, it, vi } from 'vitest';

import { consumeRegistrationNotice, saveRegistrationNotice } from './registrationNotice';

const storage = new Map<string, string>();
beforeEach(() => {
  storage.clear();
  vi.stubGlobal('window', {
    sessionStorage: {
      setItem: (key: string, value: string) => storage.set(key, value),
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => storage.delete(key),
    },
  });
});

describe('One-time registration feedback', () => {
  it('stores only success and email, consumes once, and leaves storage empty', async () => {
    saveRegistrationNotice(' ana@example.com ');
    expect(JSON.parse(storage.get('medisur.registration')!)).toEqual({ success: true, email: 'ana@example.com' });
    expect(await consumeRegistrationNotice()).toBe('ana@example.com');
    expect(storage.size).toBe(0);
    expect(await consumeRegistrationNotice()).toBeNull();
  });
  it.each([
    'bad json',
    'null',
    '{"success":false,"email":"ana"}',
    '{"success":true,"email":123}',
    '{"success":true,"email":""}',
  ])('discards invalid data: %s', async (value) => {
    storage.set('medisur.registration', value);
    expect(await consumeRegistrationNotice()).toBeNull();
    expect(storage.size).toBe(0);
  });
  it('does not break registration or login when storage is blocked', async () => {
    vi.stubGlobal('window', {
      get sessionStorage() {
        throw new Error('blocked');
      },
    });
    expect(() => saveRegistrationNotice('ana')).not.toThrow();
    expect(await consumeRegistrationNotice()).toBeNull();
  });
});
