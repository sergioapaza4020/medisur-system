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
  username: string;
  email: string;
  roles: string[];
  permissions: string[];
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginTokens {
  accessToken: string;
  refreshToken: string;
  userSession: { idSession: number; expiresAt: string };
}
