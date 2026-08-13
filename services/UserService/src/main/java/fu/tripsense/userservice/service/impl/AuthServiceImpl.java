package fu.tripsense.userservice.service.impl;

import fu.tripsense.userservice.dto.request.LoginRequest;
import fu.tripsense.userservice.dto.request.RegisterRequest;
import fu.tripsense.userservice.dto.request.ResendCodeRequest;
import fu.tripsense.userservice.dto.request.VerifyEmailRequest;
import fu.tripsense.userservice.dto.response.LoginResponse;
import fu.tripsense.userservice.dto.response.LoginResult;
import fu.tripsense.userservice.dto.response.RefreshResponse;
import fu.tripsense.userservice.dto.response.RefreshResult;
import fu.tripsense.userservice.dto.response.UserDto;
import fu.tripsense.userservice.entity.EmailVerificationCode;
import fu.tripsense.userservice.entity.RefreshToken;
import fu.tripsense.userservice.entity.Session;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.enums.UserStatus;
import fu.tripsense.userservice.exception.InvalidVerificationCodeException;
import fu.tripsense.userservice.exception.UserAlreadyExistsException;
import fu.tripsense.userservice.repository.EmailVerificationCodeRepository;
import fu.tripsense.userservice.repository.RefreshTokenRepository;
import fu.tripsense.userservice.repository.SessionRepository;
import fu.tripsense.userservice.repository.UserRepository;
import fu.tripsense.userservice.service.AuthService;
import fu.tripsense.userservice.util.CookieUtils;
import fu.tripsense.userservice.util.JwtUtils;
import fu.tripsense.userservice.util.TokenHashUtils;
import fu.tripsense.userservice.validator.EmailVerificationValidator;
import fu.tripsense.userservice.validator.RefreshTokenValidator;
import fu.tripsense.userservice.validator.SessionValidator;
import fu.tripsense.userservice.validator.UserValidator;

import java.util.Optional;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseCookie;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.Date;
import java.util.UUID;

import fu.tripsense.userservice.service.VerificationService;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final SessionRepository sessionRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final AuthenticationManager authenticationManager;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final CookieUtils cookieUtils;
    private final VerificationService verificationService;
    private final RefreshTokenValidator refreshTokenValidator;
    private final SessionValidator sessionValidator;
    private final UserValidator userValidator;
    private final EmailVerificationValidator emailVerificationValidator;

    @Value("${jwt.idle-timeout-days}")
    private int idleTimeoutDays;

    @Value("${jwt.absolute-timeout-days}")
    private int absoluteTimeoutDays;

    @Override
    @Transactional
    public LoginResult login(LoginRequest request) {
        log.info("Processing login request for email: {}", request.email());

        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(
                        request.email(),
                        request.password()
                )
        );

        User user = (User) authentication.getPrincipal();

        LocalDateTime now = LocalDateTime.now();
        LocalDateTime idleExpiresAt = now.plusDays(idleTimeoutDays);
        LocalDateTime absoluteExpiresAt = now.plusDays(absoluteTimeoutDays);

        // 1. Create and save Session
        Session session = Session.builder()
                .user(user)
                .lastActivityAt(now)
                .idleExpiresAt(idleExpiresAt)
                .absoluteExpiresAt(absoluteExpiresAt)
                .build();
        session = sessionRepository.save(session);

        // 2. Save RefreshToken entity to let JPA generate UUID id
        RefreshToken refreshToken = RefreshToken.builder()
                .session(session)
                .tokenHash("PENDING_" + UUID.randomUUID())
                .expiresAt(idleExpiresAt)
                .build();
        refreshToken = refreshTokenRepository.save(refreshToken);

        // 3. Generate signed JWT Refresh Token with type=REFRESH and jti = refreshToken.getId()
        Date expiryDate = Date.from(idleExpiresAt.atZone(ZoneId.systemDefault()).toInstant());
        String rawRefreshToken = jwtUtils.generateRefreshToken(user, refreshToken.getId(), expiryDate);
        String tokenHash = TokenHashUtils.hashToken(rawRefreshToken);

        refreshToken.setTokenHash(tokenHash);
        refreshTokenRepository.save(refreshToken);

        // 3. Generate stateless JWT Access Token with type=ACCESS
        String accessToken = jwtUtils.generateAccessToken(user);

        // 4. Create HttpOnly Refresh Token Cookie
        long maxAgeSeconds = Duration.between(now, idleExpiresAt).getSeconds();
        ResponseCookie cookie = cookieUtils.createRefreshTokenCookie(rawRefreshToken, maxAgeSeconds);

        // 5. Build DTO Response
        LoginResponse response = LoginResponse.builder()
                .accessToken(accessToken)
                .tokenType("Bearer")
                .expiresIn(jwtUtils.getAccessTokenExpirationSeconds())
                .user(UserDto.builder()
                        .id(user.getId())
                        .email(user.getEmail())
                        .role(user.getRole())
                        .status(user.getStatus())
                        .build())
                .build();

        log.info("Login successful for user id: {}", user.getId());
        return new LoginResult(response, cookie);
    }

    @Override
    @Transactional
    public UserDto register(RegisterRequest request) {
        log.info("Processing registration request for email: {}", request.email());

        Optional<User> existingUserOpt = userRepository.findByEmail(request.email());
        emailVerificationValidator.validateRegistrationEmail(existingUserOpt, request.email());

        User user;
        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();
            existingUser.setPassword(passwordEncoder.encode(request.password()));
            user = userRepository.save(existingUser);
        } else {
            user = User.builder()
                    .email(request.email())
                    .password(passwordEncoder.encode(request.password()))
                    .role("ROLE_USER")
                    .status(UserStatus.UNVERIFIED)
                    .build();
            user = userRepository.save(user);
        }

        verificationService.createAndSendVerificationCode(user);

        return UserDto.builder()
                .id(user.getId())
                .email(user.getEmail())
                .role(user.getRole())
                .status(user.getStatus())
                .build();
    }



    @Override
    @Transactional
    public RefreshResult refreshToken(String rawRefreshToken) {
        log.info("Processing refresh token request with token rotation and revocation");
        LocalDateTime now = LocalDateTime.now();

        // 1. Validate old refresh token, session, and user
        RefreshToken oldToken = refreshTokenValidator.validate(rawRefreshToken, now);
        Session session = sessionValidator.validate(oldToken.getSession(), now);
        User user = userValidator.validate(session.getUser());

        // 2. Revoke old refresh token
        oldToken.setRevokedAt(now);
        refreshTokenRepository.save(oldToken);

        // 3. Extend session idle timeout
        LocalDateTime idleExpiresAt = now.plusDays(idleTimeoutDays);
        session.setLastActivityAt(now);
        session.setIdleExpiresAt(idleExpiresAt);
        sessionRepository.save(session);

        // 4. Create and save new RefreshToken entity linked to oldToken
        RefreshToken newToken = RefreshToken.builder()
                .session(session)
                .replacedToken(oldToken)
                .tokenHash("PENDING_" + UUID.randomUUID())
                .expiresAt(idleExpiresAt)
                .build();
        newToken = refreshTokenRepository.save(newToken);

        // 5. Generate signed JWT Refresh Token with type=REFRESH and jti = newToken.getId()
        Date expiryDate = Date.from(idleExpiresAt.atZone(ZoneId.systemDefault()).toInstant());
        String newRefreshToken = jwtUtils.generateRefreshToken(user, newToken.getId(), expiryDate);
        String newTokenHash = TokenHashUtils.hashToken(newRefreshToken);

        newToken.setTokenHash(newTokenHash);
        refreshTokenRepository.save(newToken);

        // 6. Generate new Access Token
        String newAccessToken = jwtUtils.generateAccessToken(user);

        // 7. Create new HttpOnly Refresh Token Cookie
        long maxAgeSeconds = Duration.between(now, idleExpiresAt).getSeconds();
        ResponseCookie cookie = cookieUtils.createRefreshTokenCookie(newRefreshToken, maxAgeSeconds);

        log.info("Access token and refresh token rotated successfully for user id: {}", user.getId());

        RefreshResponse response = RefreshResponse.builder()
                .accessToken(newAccessToken)
                .build();

        return new RefreshResult(response, cookie);
    }
}
