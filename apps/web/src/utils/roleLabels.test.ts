import { describe, expect, it } from 'vitest';

import { getRoleLabel } from './roleLabels';

describe('Role display labels', () => {
  it.each([
    ['SUPERADMIN', 'ADMINISTRADOR'],
    ['STAFF', 'PERSONAL'],
    ['DOCTOR', 'DOCTOR'],
    ['PATIENT', 'PACIENTE'],
  ])('displays %s as %s without changing its value', (role, label) => {
    expect(getRoleLabel(role)).toBe(label);
    expect(role).toBe(role.toUpperCase());
  });

  it('preserves custom role names', () => {
    expect(getRoleLabel('CUSTOM')).toBe('CUSTOM');
  });
});
