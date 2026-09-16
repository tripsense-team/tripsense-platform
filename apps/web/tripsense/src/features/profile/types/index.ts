export interface UserProfile {
  userId: string;
  email: string;
  avatarUrl?: string;
  bio?: string;
  location?: string;
  coverUrl?: string;
  socialPorts?: Record<string, string>;
}

export interface UpdateProfileRequest {
  avatarUrl?: string;
  bio?: string;
  location?: string;
  coverUrl?: string;
  socialPorts?: Record<string, string>;
}
