package fu.tripsense.socialservice.dto.response;
public record UploadSignatureResponse(String cloudName, String apiKey, long timestamp, String signature, String folder, String resourceType, java.util.List<String> allowedFormats) { }
