package fu.tripsense.socialservice.service.impl;

import fu.tripsense.socialservice.client.PublicProfileClientResponse;
import fu.tripsense.socialservice.client.UserPublicProfileClient;
import fu.tripsense.socialservice.dto.response.SuggestedCreatorResponse;
import fu.tripsense.socialservice.entity.SocialUserFollow;
import fu.tripsense.socialservice.exception.SocialException;
import fu.tripsense.socialservice.repository.SocialPostRepository;
import fu.tripsense.socialservice.repository.SocialTripShareRepository;
import fu.tripsense.socialservice.repository.SocialUserFollowRepository;
import fu.tripsense.socialservice.security.AuthenticatedUser;
import fu.tripsense.socialservice.service.SocialCreatorService;
import java.util.*;
import java.util.stream.Collectors;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class SocialCreatorServiceImpl implements SocialCreatorService {

  private final SocialPostRepository postRepository;
  private final SocialUserFollowRepository followRepository;
  private final SocialTripShareRepository tripShareRepository;
  private final UserPublicProfileClient publicProfileClient;

  private static final List<String> DEFAULT_NICHES =
      List.of(
          "Trekking & Camping",
          "Food & Culture",
          "Travel Photography",
          "Motorbike Roadtrip",
          "Beach & Resorts",
          "Solo Travel & Cafes");

  private static final List<String> DEFAULT_NICHE_KEYS =
      List.of(
          "creatorNicheTrekking",
          "creatorNicheFoodie",
          "creatorNichePhotography",
          "creatorNicheRoadtrip",
          "creatorNicheBeach",
          "creatorNicheSolo");

  @Override
  @Transactional(readOnly = true)
  public List<SuggestedCreatorResponse> getSuggestedCreators(
      AuthenticatedUser currentUserOrNull, int limit) {
    if (limit < 1 || limit > 20) {
      throw new SocialException(
          HttpStatus.BAD_REQUEST, "INVALID_LIMIT", "Limit must be between 1 and 20");
    }

    UUID viewerId = currentUserOrNull != null ? currentUserOrNull.id() : null;

    // 1. Fetch active creators with public posts/shares, excluding viewer
    List<Object[]> activeSummaries =
        postRepository.findActiveCreatorSummaries(viewerId, PageRequest.of(0, 50));

    if (activeSummaries.isEmpty()) {
      return Collections.emptyList();
    }

    List<UUID> creatorIds = new ArrayList<>();
    Map<UUID, String> fallbackNames = new HashMap<>();
    Map<UUID, Long> postCounts = new HashMap<>();

    for (Object[] row : activeSummaries) {
      UUID creatorId = (UUID) row[0];
      String displayName = row[1] != null ? row[1].toString() : "TripSense Creator";
      long count = row[2] instanceof Number ? ((Number) row[2]).longValue() : 0L;

      creatorIds.add(creatorId);
      fallbackNames.put(creatorId, displayName);
      postCounts.put(creatorId, count);
    }

    // 2. Fetch public profile details (avatar, display name) from user-service
    Map<UUID, PublicProfileClientResponse> profiles =
        publicProfileClient.fetchPublicProfiles(creatorIds);

    // 3. Resolve follow status for viewer
    Set<UUID> followedIds = Collections.emptySet();
    if (viewerId != null) {
      followedIds =
          followRepository
              .findByIdFollowerUserIdAndIdFollowedUserIdIn(viewerId, creatorIds)
              .stream()
              .map(f -> f.getId().getFollowedUserId())
              .collect(Collectors.toSet());
    }

    // 4. Build creator candidates with follower counts
    List<CreatorCandidate> candidates = new ArrayList<>();
    for (int i = 0; i < creatorIds.size(); i++) {
      UUID creatorId = creatorIds.get(i);
      PublicProfileClientResponse profile = profiles.get(creatorId);

      String name =
          (profile != null && profile.displayName() != null && !profile.displayName().isBlank())
              ? profile.displayName()
              : fallbackNames.getOrDefault(creatorId, "Creator");

      String avatar = (profile != null) ? profile.avatarUrl() : null;
      if (avatar == null || avatar.isBlank()) {
        avatar = "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80";
      }

      long followerCount = followRepository.countByIdFollowedUserId(creatorId);
      boolean isFollowing = followedIds.contains(creatorId);
      long postCount = postCounts.getOrDefault(creatorId, 0L);

      int nicheIndex = Math.abs(creatorId.hashCode()) % DEFAULT_NICHES.size();
      String niche = DEFAULT_NICHES.get(nicheIndex);
      String nicheKey = DEFAULT_NICHE_KEYS.get(nicheIndex);

      candidates.add(
          new CreatorCandidate(
              creatorId,
              name,
              avatar,
              niche,
              nicheKey,
              followerCount,
              isFollowing,
              (int) postCount));
    }

    // 5. Prioritize creators viewer does NOT follow yet, then sort by followerCount desc, then postCount desc
    return candidates.stream()
        .sorted(
            Comparator.comparing(CreatorCandidate::isFollowing)
                .thenComparing(
                    Comparator.comparingLong(CreatorCandidate::followerCount).reversed())
                .thenComparing(
                    Comparator.comparingInt(CreatorCandidate::tripCount).reversed()))
        .limit(limit)
        .map(
            c ->
                new SuggestedCreatorResponse(
                    c.id(),
                    c.name(),
                    c.avatar(),
                    c.niche(),
                    c.nicheKey(),
                    c.followerCount(),
                    c.isFollowing(),
                    c.tripCount()))
        .collect(Collectors.toList());
  }

  private record CreatorCandidate(
      UUID id,
      String name,
      String avatar,
      String niche,
      String nicheKey,
      long followerCount,
      boolean isFollowing,
      int tripCount) {}
}
