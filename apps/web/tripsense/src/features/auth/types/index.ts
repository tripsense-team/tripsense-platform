export enum UserRole {
  USER = "ROLE_USER",
  ADMIN = "ROLE_ADMIN",
}

export enum UserStatus {
  UNVERIFIED = "UNVERIFIED",
  ACTIVE = "ACTIVE",
  SUSPENDED = "SUSPENDED",
}

export type AuthStatus = "initializing" | "authenticated" | "unauthenticated";

export type AuthModalStep = "email" | "login-password" | "register-details" | "verify-otp";

export interface User {
  id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  name?: string;
  avatar?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
  timestamp: string;
}

export interface RegisterRequest {
  email: string;
  password?: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface ResendCodeRequest {
  email: string;
}

export interface LoginRequest {
  email: string;
  password?: string;
}

export interface LoginResponse {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  user: User;
}

export interface RefreshResponse {
  accessToken: string;
}
