import type { PatientRegistration } from '@/types/auth';

export const emptyPatientRegistration: PatientRegistration = {
  name: '',
  lastname: '',
  email: '',
  ci: '',
  password: '',
};

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_BYTES = 72;

export function getRegistrationPasswordFeedback(password: string) {
  const requirements = [
    { id: 'length', label: `Al menos ${PASSWORD_MIN_LENGTH} caracteres`, met: password.length >= PASSWORD_MIN_LENGTH },
    { id: 'uppercase', label: 'Una letra mayúscula (A-Z)', met: /[A-Z]/.test(password) },
    { id: 'lowercase', label: 'Una letra minúscula (a-z)', met: /[a-z]/.test(password) },
    { id: 'number', label: 'Un número', met: /[0-9]/.test(password) },
    {
      id: 'maximum',
      label: 'Longitud máxima permitida',
      met: new TextEncoder().encode(password).length <= PASSWORD_MAX_BYTES,
    },
  ];
  const valid = requirements.every((requirement) => requirement.met);
  const completed = requirements.slice(0, 4).filter((requirement) => requirement.met).length;
  const withinLimit = requirements[4].met;
  const strength = !withinLimit || completed < 3 ? 'Débil' : valid && password.length >= 12 ? 'Fuerte' : 'Media';
  const progress = withinLimit ? completed * 20 + (valid && password.length >= 12 ? 20 : 0) : 20;
  return { requirements, valid, strength, progress };
}

export function validatePatientRegistration(
  form: PatientRegistration,
): Partial<Record<keyof PatientRegistration, string>> {
  const errors: Partial<Record<keyof PatientRegistration, string>> = {};
  for (const field of ['name', 'lastname'] as const) {
    if (!/^[\p{L}\p{M}]+(?:[ '\u2019-][\p{L}\p{M}]+)*$/u.test(form[field].trim()) || form[field].trim().length > 100)
      errors[field] = `Ingresa ${field === 'name' ? 'nombres' : 'apellidos'} válidos (máximo 100 caracteres)`;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) || form.email.trim().length > 254)
    errors.email = 'Ingresa un correo electrónico válido';
  if (!/^[A-Za-z0-9][A-Za-z0-9 .-]{2,29}$/.test(form.ci.trim()))
    errors.ci = 'Ingresa un documento válido de entre 3 y 30 caracteres';
  const passwordFeedback = getRegistrationPasswordFeedback(form.password);
  if (!passwordFeedback.valid)
    errors.password = passwordFeedback.requirements[4].met
      ? 'Usa al menos 8 caracteres, una mayúscula, una minúscula y un número'
      : 'La contraseña es demasiado larga. Usa menos caracteres.';
  return errors;
}
