package fu.tripsense.userservice.service;

import fu.tripsense.userservice.dto.request.LoginRequest;
import fu.tripsense.userservice.dto.request.RegisterRequest;
import fu.tripsense.userservice.dto.request.ResendCodeRequest;
import fu.tripsense.userservice.dto.request.VerifyEmailRequest;
import fu.tripsense.userservice.dto.response.LoginResult;
import fu.tripsense.userservice.dto.response.RefreshResult;
import fu.tripsense.userservice.dto.response.UserDto;

public interface AuthService {

    LoginResult login(LoginRequest request);

    UserDto register(RegisterRequest request);

    UserDto verifyEmail(VerifyEmailRequest request);

    void resendCode(ResendCodeRequest request);

    RefreshResult refreshToken(String refreshToken);
}
