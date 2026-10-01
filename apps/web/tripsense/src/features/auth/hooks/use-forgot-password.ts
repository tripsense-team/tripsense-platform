import { useMutation } from "@tanstack/react-query";
import { authApi } from "../services/auth-api";
import { ForgotPasswordRequest } from "../types";

export function useForgotPassword() {
  return useMutation({
    mutationFn: (data: ForgotPasswordRequest) => authApi.forgotPassword(data),
  });
}
