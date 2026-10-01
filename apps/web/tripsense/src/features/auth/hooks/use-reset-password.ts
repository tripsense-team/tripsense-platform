import { useMutation } from "@tanstack/react-query";
import { authApi } from "../services/auth-api";
import { ResetPasswordRequest } from "../types";

export function useResetPassword() {
  return useMutation({
    mutationFn: (data: ResetPasswordRequest) => authApi.resetPassword(data),
  });
}
