import { formatSpecialtyName, normalizeSpecialtyNameForComparison } from './specialty-name';

describe('specialty name helpers', () => {
  it.each([
    ['  enFERmedad Del corazon', 'Enfermedad Del Corazon'],
    ['MEDICINA INTERNA', 'Medicina Interna'],
    ['cardiología', 'Cardiología'],
    ['  cirugía   cardiovascular  ', 'Cirugía Cardiovascular'],
    ['medicina del trabajo', 'Medicina Del Trabajo'],
    ['cardiologia', 'Cardiologia'],
    ['Cardiologi\u0301a', 'Cardiología'],
  ])('formats %s preserving user accents', (input, expected) => {
    expect(formatSpecialtyName(input)).toBe(expected);
  });

  it.each(['Cardiología', ' CARDIOLOGIA ', 'cardiologi\u0301a'])(
    'normalizes %s for comparison only',
    (input) => {
      expect(normalizeSpecialtyNameForComparison(input)).toBe('cardiologia');
    },
  );
  it('collapses internal whitespace for comparison', () => {
    expect(normalizeSpecialtyNameForComparison(' MEDICINA   INTERNA ')).toBe('medicina interna');
  });
});
