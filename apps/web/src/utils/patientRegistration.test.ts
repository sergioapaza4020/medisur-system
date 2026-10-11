import { describe, expect, it } from 'vitest';

import {
  emptyPatientRegistration,
  getRegistrationPasswordFeedback,
  validatePatientRegistration,
} from './patientRegistration';

const valid = {
  name: 'Ana María',
  lastname: "Pérez O'Connor",
  email: 'ana@example.com',
  ci: '123456-1A',
  password: 'Segura123',
};

describe('Patient registration validation', () => {
  it('validates every mandatory field and accepts accented names and formatted documents', () => {
    expect(Object.keys(validatePatientRegistration(emptyPatientRegistration))).toHaveLength(5);
    expect(validatePatientRegistration(valid)).toEqual({});
  });
  it.each([
    ['name', 'Ana123'],
    ['lastname', 'a'.repeat(101)],
    ['email', 'invalid'],
    ['ci', '<script>'],
    ['password', 'short'],
    ['password', 'lowercase123'],
    ['password', 'UPPERCASE123'],
    ['password', 'NoNumbers'],
  ] as const)('rejects an invalid %s', (field, value) => {
    expect(validatePatientRegistration({ ...valid, [field]: value })[field]).toBeTruthy();
  });
  it('checks the UTF-8 byte limit without truncating passwords', () => {
    expect(validatePatientRegistration({ ...valid, password: 'Aa1' + 'x'.repeat(69) })).toEqual({});
    expect(validatePatientRegistration({ ...valid, password: 'Aa1' + 'á'.repeat(35) }).password).toBeTruthy();
  });
});

describe('Registration password feedback', () => {
  it.each([
    ['abc', [false, false, true, false, true], 'Débil'],
    ['abcdefgh', [true, false, true, false, true], 'Débil'],
    ['Abcdefgh', [true, true, true, false, true], 'Media'],
    ['Abcdefg1', [true, true, true, true, true], 'Media'],
    ['Abcdefghijk1', [true, true, true, true, true], 'Fuerte'],
  ])('reflects the real policy for %s', (password, met, strength) => {
    const feedback = getRegistrationPasswordFeedback(password as string);
    expect(feedback.requirements.map((requirement) => requirement.met)).toEqual(met);
    expect(feedback.strength).toBe(strength);
    expect(feedback.valid).toBe((met as boolean[]).every(Boolean));
  });
  it('does not require symbols and invalid length is never reported as strong', () => {
    expect(getRegistrationPasswordFeedback('Abcdefg1').valid).toBe(true);
    expect(getRegistrationPasswordFeedback('Abcdefg1!').valid).toBe(true);
    const feedback = getRegistrationPasswordFeedback('Aa1' + 'á'.repeat(35));
    expect(feedback.valid).toBe(false);
    expect(feedback.strength).toBe('Débil');
    expect(validatePatientRegistration({ ...valid, password: 'Aa1' + 'á'.repeat(35) }).password).toBe(
      'La contraseña es demasiado larga. Usa menos caracteres.',
    );
  });
});
