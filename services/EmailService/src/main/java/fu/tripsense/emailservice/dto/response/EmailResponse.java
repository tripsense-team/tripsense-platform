package fu.tripsense.emailservice.dto.response;

public record EmailResponse(
        boolean success,
        String message
) {}
