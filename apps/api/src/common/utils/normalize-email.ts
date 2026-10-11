export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const transformEmail = ({ value }: { value: unknown }): unknown =>
  typeof value === 'string' ? normalizeEmail(value) : value;
