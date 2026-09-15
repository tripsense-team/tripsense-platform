import { apiClient } from "@/services/api-client";
import { UserProfile, UpdateProfileRequest } from "../types";
import type { ApiResponse } from "@/features/auth";

async function unwrap<T>(request: Promise<ApiResponse<T>>): Promise<T> {
  const response = await request;
  return response.data;
}

export const profileService = {
  getUserProfile: async (userId: string): Promise<UserProfile> => {
    return unwrap(apiClient<ApiResponse<UserProfile>>(`/api/users/profile/${userId}`));
  },

  updateProfile: async (request: UpdateProfileRequest): Promise<UserProfile> => {
    return unwrap(apiClient<ApiResponse<UserProfile>>(`/api/users/profile`, {
      method: "PUT",
      body: JSON.stringify(request)
    }));
  },
};
