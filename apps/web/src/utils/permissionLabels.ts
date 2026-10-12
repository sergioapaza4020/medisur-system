// Translate display vocabulary, never define a permission catalog here.
const domains: Record<string, string> = {
  user: 'Usuarios',
  role: 'Roles',
  permission: 'Permisos',
  session: 'Sesiones',
  specialty: 'Especialidades',
  doctor: 'Médicos',
};
const actions: Record<string, string> = {
  'create-patient': 'Registrar pacientes',
  'get-all': 'Consultar listado',
  'get-one-by-id': 'Consultar por identificador',
  'get-one-by-name': 'Consultar por nombre',
  'get-one-by-email': 'Consultar por correo',
  'get-one-by-username': 'Consultar por usuario',
  create: 'Crear',
  update: 'Editar',
  delete: 'Desactivar',
  reactivate: 'Reactivar',
  'assign-roles': 'Asignar roles',
  'assign-permissions': 'Asignar permisos',
  'revoke-one': 'Revocar sesión',
  'revoke-all': 'Revocar sesiones',
};

export const getPermissionDomain = (code: string) => domains[code.split('.')[0]] ?? code.split('.')[0];
export const getPermissionLabel = (code: string) => actions[code.slice(code.indexOf('.') + 1)] ?? code;
