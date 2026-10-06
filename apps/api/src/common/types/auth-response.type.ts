export interface AuthResponse {
  idUser: number;
  username: string;
  email: string;
  accessToken: string;
  expiredAt: number;
}
