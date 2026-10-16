export interface ApiResponse<T> {
  status: boolean;
  statusCode: number;
  message?: string;
  data: T;
}

export interface AuthUser {
  idUser: number;
  idSession: number;
  name: string;
  lastname?: string;
  avatarUrl?: string | null;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface PatientRegistration extends LoginCredentials {
  name: string;
  lastname: string;
  ci: string;
}

export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
  userSession: { idSession: number; expiresAt: string };
}
