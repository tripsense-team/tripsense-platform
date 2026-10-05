export interface UserProfile {
  userId: string;
  email: string;
  avatarUrl?: string;
  displayName?: string;
  onboardingRequired: boolean;
  bio?: string;
  location?: string;
  coverUrl?: string;
  socialPorts?: Record<string, string>;
}

export interface UpdateProfileRequest {
  avatarUrl?: string;
  displayName?: string;
  bio?: string;
  location?: string;
  coverUrl?: string;
  socialPorts?: Record<string, string>;
}
