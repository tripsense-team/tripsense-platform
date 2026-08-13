package fu.tripsense.userservice.validator;

import fu.tripsense.userservice.entity.EmailVerificationCode;
import fu.tripsense.userservice.entity.User;
import fu.tripsense.userservice.enums.UserStatus;
import fu.tripsense.userservice.exception.InvalidVerificationCodeException;
import fu.tripsense.userservice.exception.UserAlreadyExistsException;
import fu.tripsense.userservice.repository.EmailVerificationCodeRepository;
import fu.tripsense.userservice.util.TokenHashUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.Optional;

@Component
@RequiredArgsConstructor
@Slf4j
public class EmailVerificationValidator {

    private final EmailVerificationCodeRepository emailVerificationCodeRepository;

    public void validateRegistrationEmail(Optional<User> existingUserOpt, String email) {
        if (existingUserOpt.isPresent()) {
            User existingUser = existingUserOpt.get();
            if (existingUser.getStatus() == UserStatus.ACTIVE) {
                log.warn("Registration validation failed: Email {} is already registered and active", email);
                throw new UserAlreadyExistsException("Email is already registered");
            }
        }
    }

    public EmailVerificationCode validateCodeForVerification(String email, String rawCode, LocalDateTime now) {
        EmailVerificationCode codeEntity = emailVerificationCodeRepository
                .findTopByUserEmailAndVerifiedAtIsNullOrderByCreatedAtDesc(email)
                .orElseThrow(() -> {
                    log.warn("Email verification failed: No pending code found for email {}", email);
                    return new InvalidVerificationCodeException("No pending verification code found for email");
                });

        User user = codeEntity.getUser();
        if (user.getStatus() == UserStatus.ACTIVE) {
            log.warn("Email verification failed: Email {} is already verified", email);
            throw new InvalidVerificationCodeException("User email is already verified");
        }

        if (codeEntity.getExpiresAt().isBefore(now)) {
            log.warn("Email verification failed: Verification code for email {} has expired", email);
            throw new InvalidVerificationCodeException("Verification code has expired");
        }

        if (codeEntity.getAttemptCount() >= 5) {
            log.warn("Email verification failed: Attempt limit exceeded for email {}", email);
            throw new InvalidVerificationCodeException("Maximum verification attempts exceeded. Please request a new code.");
        }

        codeEntity.setAttemptCount(codeEntity.getAttemptCount() + 1);

        String inputHash = TokenHashUtils.hashToken(rawCode);
        if (!codeEntity.getCodeHash().equals(inputHash)) {
            emailVerificationCodeRepository.save(codeEntity);
            log.warn("Email verification failed: Incorrect code entered for email {}", email);
            throw new InvalidVerificationCodeException("Invalid verification code");
        }

        return codeEntity;
    }

    public User validateUserForResendCode(Optional<User> userOpt, String email) {
        User user = userOpt.orElseThrow(() -> {
            log.warn("Resend code failed: User with email {} not found", email);
            return new InvalidVerificationCodeException("User not found");
        });

        if (user.getStatus() != UserStatus.UNVERIFIED) {
            log.warn("Resend code failed: Email {} status is {}, not UNVERIFIED", email, user.getStatus());
            throw new InvalidVerificationCodeException("User email is already verified or inactive");
        }

        return user;
    }
}
