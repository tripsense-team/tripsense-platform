package fu.tripsense.tripservice.partner.dto;

import java.util.List;

public record GuideTaxonomyDto(
    int catalogVersion,
    List<TaxonomyItemDto> areas,
    List<TaxonomyItemDto> topics,
    List<TaxonomyItemDto> skills,
    List<TaxonomyItemDto> languages
) {}
