package fu.tripsense.userservice.service;

import fu.tripsense.userservice.entity.User;

public interface VerificationService {

    void createAndSendVerificationCode(User user);

    User verifyEmailCode(String email, String code);

    void resendVerificationCode(String email);
}
