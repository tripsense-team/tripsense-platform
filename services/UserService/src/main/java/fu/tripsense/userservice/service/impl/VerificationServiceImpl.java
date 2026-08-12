package fu.tripsense.userservice.service.impl;

import fu.tripsense.userservice.client.EmailClient;
import fu.tripsense.userservice.entity.EmailVerificationCode;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.enums.UserStatus;
import fu.tripsense.userservice.repository.EmailVerificationCodeRepository;
import fu.tripsense.userservice.repository.UserRepository;
import fu.tripsense.userservice.service.VerificationService;
import fu.tripsense.userservice.util.TokenHashUtils;
import fu.tripsense.userservice.validator.EmailVerificationValidator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Optional;

@Service
@RequiredArgsConstructor
@Slf4j
public class VerificationServiceImpl implements VerificationService {

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    private final UserRepository userRepository;
    private final EmailVerificationCodeRepository emailVerificationCodeRepository;
    private final EmailVerificationValidator emailVerificationValidator;
    private final EmailClient emailClient;

    @Override
    @Transactional
    public void createAndSendVerificationCode(User user) {
        log.info("Generating verification code for user email: {}", user.getEmail());

        LocalDateTime now = LocalDateTime.now();

        // Invalidate previous unverified code if active
        emailVerificationCodeRepository
                .findTopByUserEmailAndVerifiedAtIsNullOrderByCreatedAtDesc(user.getEmail())
                .ifPresent(existingCode -> {
                    if (existingCode.getExpiresAt().isAfter(now)) {
                        log.info("Invalidating previous unverified code for email: {}", user.getEmail());
                        existingCode.setExpiresAt(now);
                        emailVerificationCodeRepository.save(existingCode);
                    }
                });

        String rawCode = String.format("%06d", SECURE_RANDOM.nextInt(1000000));
        String codeHash = TokenHashUtils.hashToken(rawCode);

        EmailVerificationCode verificationCode = EmailVerificationCode.builder()
                .user(user)
                .codeHash(codeHash)
                .expiresAt(now.plusMinutes(10))
                .attemptCount(0)
                .build();

        emailVerificationCodeRepository.save(verificationCode);
        emailClient.sendVerificationCode(user.getEmail(), rawCode);
    }

    @Override
    @Transactional
    public User verifyEmailCode(String email, String code) {
        log.info("Processing email verification code validation for email: {}", email);

        LocalDateTime now = LocalDateTime.now();
        EmailVerificationCode codeEntity = emailVerificationValidator
                .validateCodeForVerification(email, code, now);

        codeEntity.setVerifiedAt(now);
        emailVerificationCodeRepository.save(codeEntity);

        User user = codeEntity.getUser();
        user.setStatus(UserStatus.ACTIVE);
        user = userRepository.save(user);

        log.info("Email verified successfully. Updated user [{}] status to ACTIVE", user.getId());
        return user;
    }

    @Override
    @Transactional
    public void resendVerificationCode(String email) {
        log.info("Processing resend verification code request for email: {}", email);

        Optional<User> userOpt = userRepository.findByEmail(email);
        User user = emailVerificationValidator.validateUserForResendCode(userOpt, email);

        createAndSendVerificationCode(user);
    }
}
