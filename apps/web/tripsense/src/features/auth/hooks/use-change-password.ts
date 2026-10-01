import { useMutation } from "@tanstack/react-query";
import { authApi } from "../services/auth-api";
import { ChangePasswordRequest } from "../types";

export function useChangePassword() {
  return useMutation({
    mutationFn: (data: ChangePasswordRequest) => authApi.changePassword(data),
  });
}
