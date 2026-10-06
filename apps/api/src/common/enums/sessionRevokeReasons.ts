export enum SessionRevokeReasons {
  LOGOUT = 'Sesión cerrada por el usuario',
  LOGOUT_ALL = 'Sesión cerrada en todos los dispositivos',
  PASSWORD_CHANGED = 'Contraseña cambiada',
  SUSPICIOUS_ACTIVITY = 'Actividad sospechosa detectada',
  ADMIN_ACTION = 'Sesión cerrada por un administrador',
  EXPIRED = 'Sesión expirada',
}
