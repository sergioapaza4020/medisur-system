// Keep the resource.action convention used by the existing controllers.
export const MEDISUR_PERMISSIONS = {
  user: [
    'get-all',
    'get-one-by-email',
    'get-one-by-username',
    'get-one-by-id',
    'create',
    'update',
    'delete',
    'reactivate',
    'assign-roles',
  ],
  role: [
    'get-all',
    'get-one-by-name',
    'get-one-by-id',
    'create',
    'update',
    'delete',
    'reactivate',
    'assign-permissions',
  ],
  permission: [
    'get-all',
    'get-one-by-name',
    'get-one-by-id',
    'create',
    'update',
    'delete',
    'reactivate',
  ],
  session: ['get-all', 'revoke-one', 'revoke-all'],
};

export const MEDISUR_ROLES = [
  { name: 'SUPERADMIN', description: 'Administración de usuarios, roles y permisos' },
  { name: 'STAFF', description: 'Personal administrativo' },
  { name: 'DOCTOR', description: 'Médico' },
  { name: 'PATIENT', description: 'Paciente' },
];

export const MEDISUR_PERMISSION_NAMES = Object.entries(MEDISUR_PERMISSIONS).flatMap(
  ([resource, actions]) => actions.map((action) => `${resource}.${action}`),
);

// Explicit academic namespaces only; preserve unrelated custom access configuration.
export const LEGACY_ACADEMIC_NAMESPACES = ['career', 'course', 'subject', 'enrollment', 'academic'];
