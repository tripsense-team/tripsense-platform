package fu.tripsense.socialservice.dto.response;

public record TrendingDestinationResponse(
    String id,
    String name,
    String cityNameKey,
    String imageUrl,
    String shareCountText,
    int shareCount,
    String subtitle,
    String subtitleKey,
    String slug) {}
