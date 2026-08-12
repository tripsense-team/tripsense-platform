package fu.tripsense.userservice.service;

public interface EmailService {

    void sendVerificationCode(String toEmail, String code);
}
