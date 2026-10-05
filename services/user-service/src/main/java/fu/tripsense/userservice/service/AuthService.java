package fu.tripsense.userservice.service;

import fu.tripsense.userservice.dto.request.ChangePasswordRequest;
import fu.tripsense.userservice.dto.request.ForgotPasswordRequest;
import fu.tripsense.userservice.dto.request.GoogleLoginRequest;
import fu.tripsense.userservice.dto.request.LoginRequest;
import fu.tripsense.userservice.dto.request.RegisterRequest;
import fu.tripsense.userservice.dto.request.ResetPasswordRequest;
import fu.tripsense.userservice.dto.response.LoginResult;
import fu.tripsense.userservice.dto.response.RefreshResult;
import fu.tripsense.userservice.dto.response.UserDto;
import fu.tripsense.userservice.entity.User;
import org.springframework.http.ResponseCookie;

public interface AuthService {

  LoginResult login(LoginRequest request);

  LoginResult loginWithGoogle(GoogleLoginRequest request);

  UserDto register(RegisterRequest request);

  RefreshResult refreshToken(String refreshToken);

  ResponseCookie logout(String rawRefreshToken);

  ResponseCookie logoutAll(String rawRefreshToken, User currentUser);

  void changePassword(ChangePasswordRequest request, User currentUser);

  void forgotPassword(ForgotPasswordRequest request);

  void resetPassword(ResetPasswordRequest request);
}
