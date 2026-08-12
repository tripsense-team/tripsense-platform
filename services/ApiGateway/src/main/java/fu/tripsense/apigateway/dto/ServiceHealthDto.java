package fu.tripsense.apigateway.dto;

public class ServiceHealthDto {
    private String serviceName;
    private String status;
    private Long responseTimeMs;

    public ServiceHealthDto() {
    }

    public ServiceHealthDto(String serviceName, String status, Long responseTimeMs) {
        this.serviceName = serviceName;
        this.status = status;
        this.responseTimeMs = responseTimeMs;
    }

    public String getServiceName() {
        return serviceName;
    }

    public void setServiceName(String serviceName) {
        this.serviceName = serviceName;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public Long getResponseTimeMs() {
        return responseTimeMs;
    }

    public void setResponseTimeMs(Long responseTimeMs) {
        this.responseTimeMs = responseTimeMs;
    }
}
