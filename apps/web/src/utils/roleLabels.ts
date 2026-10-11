const ROLE_LABELS = {
  SUPERADMIN: 'ADMINISTRADOR',
  STAFF: 'PERSONAL',
  DOCTOR: 'DOCTOR',
  PATIENT: 'PACIENTE',
};

export function getRoleLabel(role: string): string {
  return Object.hasOwn(ROLE_LABELS, role) ? ROLE_LABELS[role as keyof typeof ROLE_LABELS] : role;
}
