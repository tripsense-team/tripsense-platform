import { apiClient } from "@/services/api-client";
import type {
  AdminReviewDecisionRequest,
  ApplicationDetailDto,
  BusinessDetailDto,
  CancelRestaurantReservationRequest,
  CommunityPublication,
  CommunityPublicationRequest,
  CreateBusinessDraftRequest,
  CreateGuideInquiryInput,
  CreateGuidePromotionDraftRequest,
  CreateManagementClaimRequest,
  CreateRestaurantReservationRequest,
  GuideInquiryDto,
  GuidePromotionDto,
  GuidePromotionSummaryDto,
  GuideProposalInput,
  GuideTaxonomyData,
  InquiryContactsDto,
  IntakeRequest,
  ManagementClaimDecisionRequest,
  ManagementClaimDto,
  PartnerCandidateDto,
  PartnerContextDto,
  ProposalDecisionRequest,
  PublicGuideProfileDto,
  PublicRestaurantListingDto,
  PublicationRequest,
  RestaurantMenuBatchRequest,
  RestaurantMenuItemDto,
  RestaurantReservationDecisionRequest,
  RestaurantReservationDto,
  RevokeConsentRequest,
  SubmitApplicationRequest,
  SubmitGuidePromotionRequest,
} from "../types";

interface ApiResponseWrapper<T> {
  success: boolean;
  data: T;
  message?: string;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const method = options.method || "GET";
  const response = await apiClient<ApiResponseWrapper<T>>(path, {
    ...options,
    method,
  });
  return response.data;
}

// -------------------------------------------------------------
// Partner Platform Enrollment & Context
// -------------------------------------------------------------

export async function enrollPartner(acceptedTermsVersion = "1.0"): Promise<{ roles: string[] }> {
  return request<{ roles: string[] }>("/api/users/me/partner-enrollment", {
    method: "POST",
    body: JSON.stringify({ acceptedTermsVersion }),
  });
}

export async function getPartnerContext(): Promise<PartnerContextDto> {
  return request<PartnerContextDto>("/api/partners/businesses");
}

export async function adminGetApplicationChecklist(applicationId: string): Promise<{ code: string; label: string; required: boolean }[]> {
  return request(`/api/admin/partner-applications/${applicationId}/checklist`);
}

export async function getBusinessDetail(businessId: string): Promise<BusinessDetailDto> {
  return request<BusinessDetailDto>(`/api/partners/businesses/${businessId}`);
}

export async function createBusinessDraft(
  req: CreateBusinessDraftRequest,
): Promise<BusinessDetailDto> {
  return request<BusinessDetailDto>("/api/partners/businesses", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function updateBusinessDraft(
  businessId: string,
  req: { displayName?: string; draftProfile?: Record<string, unknown> },
): Promise<BusinessDetailDto> {
  return request<BusinessDetailDto>(`/api/partners/businesses/${businessId}`, {
    method: "PATCH",
    body: JSON.stringify(req),
  });
}

export async function submitBusinessApplication(
  businessId: string,
  req: SubmitApplicationRequest,
): Promise<ApplicationDetailDto> {
  return request<ApplicationDetailDto>(`/api/partners/businesses/${businessId}/applications`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getBusinessApplications(
  businessId: string,
): Promise<ApplicationDetailDto[]> {
  return request<ApplicationDetailDto[]>(`/api/partners/businesses/${businessId}/applications`);
}

export async function updatePublicationState(
  businessId: string,
  req: PublicationRequest,
): Promise<BusinessDetailDto> {
  return request<BusinessDetailDto>(`/api/partners/businesses/${businessId}/publication`, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

export async function updateIntakeState(
  businessId: string,
  req: IntakeRequest,
): Promise<BusinessDetailDto> {
  return request<BusinessDetailDto>(`/api/partners/businesses/${businessId}/intake`, {
    method: "PUT",
    body: JSON.stringify(req),
  });
}

// -------------------------------------------------------------
// Guide Promotions Management (Partner)
// -------------------------------------------------------------

export async function getGuidePromotions(businessId: string): Promise<GuidePromotionDto[]> {
  return request<GuidePromotionDto[]>(`/api/partners/businesses/${businessId}/guide-promotions`);
}

export async function createGuidePromotion(
  businessId: string,
  req: CreateGuidePromotionDraftRequest,
): Promise<GuidePromotionDto> {
  return request<GuidePromotionDto>(`/api/partners/businesses/${businessId}/guide-promotions`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function submitGuidePromotion(
  businessId: string,
  promotionId: string,
  req: SubmitGuidePromotionRequest,
): Promise<GuidePromotionDto> {
  return request<GuidePromotionDto>(
    `/api/partners/businesses/${businessId}/guide-promotions/${promotionId}/submit`,
    {
      method: "POST",
      body: JSON.stringify(req),
    },
  );
}

export async function getCommunityPublication(
  businessId: string,
  promotionId: string,
): Promise<CommunityPublication> {
  return request<CommunityPublication>(
    `/api/partners/businesses/${businessId}/guide-promotions/${promotionId}/community-publication`,
  );
}

export async function updateCommunityPublication(
  businessId: string,
  promotionId: string,
  req: CommunityPublicationRequest,
): Promise<CommunityPublication> {
  return request<CommunityPublication>(
    `/api/partners/businesses/${businessId}/guide-promotions/${promotionId}/community-publication`,
    {
      method: "PUT",
      body: JSON.stringify(req),
    },
  );
}

// -------------------------------------------------------------
// Guide Inquiries & In-Depth Discussion Workflow
// -------------------------------------------------------------

export async function createGuideInquiry(
  guideBusinessId: string,
  req: CreateGuideInquiryInput,
): Promise<GuideInquiryDto> {
  return request<GuideInquiryDto>(`/api/guides/${guideBusinessId}/inquiries`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getCustomerInquiries(state?: string): Promise<GuideInquiryDto[]> {
  const query = state ? `?state=${encodeURIComponent(state)}` : "";
  return request<GuideInquiryDto[]>(`/api/me/guide-inquiries${query}`);
}

export async function getBusinessInquiries(
  businessId: string,
  state?: string,
): Promise<GuideInquiryDto[]> {
  const query = state ? `?state=${encodeURIComponent(state)}` : "";
  return request<GuideInquiryDto[]>(
    `/api/partners/businesses/${businessId}/guide-inquiries${query}`,
  );
}

export async function getInquiryDetail(inquiryId: string): Promise<GuideInquiryDto> {
  return request<GuideInquiryDto>(`/api/guide-inquiries/${inquiryId}`);
}

export async function getInquiryContacts(inquiryId: string): Promise<InquiryContactsDto> {
  return request<InquiryContactsDto>(`/api/guide-inquiries/${inquiryId}/contacts`);
}

export async function sendInquiryProposal(
  inquiryId: string,
  req: GuideProposalInput,
): Promise<GuideInquiryDto> {
  return request<GuideInquiryDto>(`/api/guide-inquiries/${inquiryId}/proposals`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function decideInquiryProposal(
  inquiryId: string,
  req: ProposalDecisionRequest,
): Promise<GuideInquiryDto> {
  return request<GuideInquiryDto>(`/api/guide-inquiries/${inquiryId}/proposal-decisions`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function revokeContactConsent(
  inquiryId: string,
  req: RevokeConsentRequest,
): Promise<void> {
  await request<void>(`/api/guide-inquiries/${inquiryId}/contact-consents/revoke`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function addInquiryMessage(
  inquiryId: string,
  content: string,
): Promise<GuideInquiryDto> {
  return request<GuideInquiryDto>(`/api/guide-inquiries/${inquiryId}/responses`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

// -------------------------------------------------------------
// Public Guide Profile, Taxonomy & Discovery
// -------------------------------------------------------------

export async function getPublicGuideProfile(guideBusinessId: string): Promise<PublicGuideProfileDto> {
  return request<PublicGuideProfileDto>(`/api/guides/${guideBusinessId}`);
}

export async function getPublicGuidePromotion(
  promotionId: string,
): Promise<GuidePromotionSummaryDto> {
  return request<GuidePromotionSummaryDto>(`/api/guide-promotions/${promotionId}`);
}

export async function getGuideTaxonomy(): Promise<GuideTaxonomyData> {
  return request<GuideTaxonomyData>("/api/guide-taxonomy");
}

// -------------------------------------------------------------
// Admin Partners & Claims Management
// -------------------------------------------------------------

export async function adminGetApplications(
  state?: string,
  kind?: string,
): Promise<ApplicationDetailDto[]> {
  const params = new URLSearchParams();
  if (state) params.set("state", state);
  if (kind) params.set("kind", kind);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<ApplicationDetailDto[]>(`/api/admin/partner-applications${query}`);
}

export async function adminReviewApplication(
  applicationId: string,
  req: AdminReviewDecisionRequest,
): Promise<ApplicationDetailDto> {
  return request<ApplicationDetailDto>(`/api/admin/partner-applications/${applicationId}/decision`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function adminGetManagementClaims(): Promise<ManagementClaimDto[]> {
  return request<ManagementClaimDto[]>("/api/admin/management-claims");
}

export async function createManagementClaim(
  req: CreateManagementClaimRequest,
): Promise<ManagementClaimDto> {
  return request<ManagementClaimDto>("/api/partners/management-claims", {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function getMyManagementClaims(): Promise<ManagementClaimDto[]> {
  return request<ManagementClaimDto[]>("/api/partners/management-claims");
}

export async function adminReviewManagementClaim(
  claimId: string,
  req: ManagementClaimDecisionRequest,
): Promise<ManagementClaimDto> {
  return request<ManagementClaimDto>(`/api/admin/management-claims/${claimId}/decision`, {
    method: "POST",
    body: JSON.stringify(req),
  });
}

export async function searchBusinessCandidates(
  kind?: string,
  name?: string,
): Promise<PartnerCandidateDto[]> {
  const params = new URLSearchParams();
  if (kind) params.set("kind", kind);
  if (name) params.set("name", name);
  const query = params.toString() ? `?${params.toString()}` : "";
  return request<PartnerCandidateDto[]>(`/api/partners/business-candidates${query}`);
}

// -------------------------------------------------------------
// Restaurant Menu & Public Listing
// -------------------------------------------------------------

export async function getRestaurantMenu(
  businessId: string,
): Promise<RestaurantMenuItemDto[]> {
  return request<RestaurantMenuItemDto[]>(
    `/api/partners/businesses/${businessId}/restaurant-menu`,
  );
}

export async function updateRestaurantMenu(
  businessId: string,
  req: RestaurantMenuBatchRequest,
): Promise<RestaurantMenuItemDto[]> {
  return request<RestaurantMenuItemDto[]>(
    `/api/partners/businesses/${businessId}/restaurant-menu`,
    {
      method: "PUT",
      body: JSON.stringify(req),
    },
  );
}

export interface ExtractedMenuResultDto {
  items: RestaurantMenuItemDto[];
  totalItems: number;
  detectedCurrency: string;
}

export async function extractRestaurantMenuFromImage(
  fileOrBase64: File | string,
): Promise<ExtractedMenuResultDto> {
  if (typeof fileOrBase64 === "string") {
    return request<ExtractedMenuResultDto>("/api/ai/restaurant-menu/extract", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: fileOrBase64 }),
    });
  }

  const formData = new FormData();
  formData.append("file", fileOrBase64);

  return request<ExtractedMenuResultDto>("/api/ai/restaurant-menu/extract", {
    method: "POST",
    body: formData,
  });
}

export async function updateContactSharing(
  businessId: string,
  req: { expectedVersion: number; publicContactConsent: boolean },
): Promise<void> {
  await request<void>(
    `/api/partners/businesses/${businessId}/contact-sharing`,
    {
      method: "PUT",
      body: JSON.stringify(req),
    },
  );
}

export async function getPublicRestaurant(
  businessId: string,
): Promise<PublicRestaurantListingDto> {
  return request<PublicRestaurantListingDto>(
    `/api/public/restaurants/${businessId}`,
  );
}

export async function searchPublicRestaurants(
  query?: string,
): Promise<PublicRestaurantListingDto[]> {
  const q = query ? `?query=${encodeURIComponent(query)}` : "";
  return request<PublicRestaurantListingDto[]>(`/api/public/restaurants${q}`).catch(() => []);
}

// -------------------------------------------------------------
// Restaurant Table Reservation Requests (C06)
// -------------------------------------------------------------

export async function createRestaurantReservation(
  businessId: string,
  req: CreateRestaurantReservationRequest,
  requestKey?: string,
): Promise<RestaurantReservationDto> {
  const headers: Record<string, string> = {};
  if (requestKey) headers["Idempotency-Key"] = requestKey;
  return request<RestaurantReservationDto>(
    `/api/restaurants/${businessId}/reservation-requests`,
    {
      method: "POST",
      headers,
      body: JSON.stringify(req),
    },
  );
}

export async function getMyRestaurantReservations(
  page = 0,
  size = 20,
): Promise<{ content: RestaurantReservationDto[]; totalElements: number }> {
  return request<{ content: RestaurantReservationDto[]; totalElements: number }>(
    `/api/me/restaurant-reservation-requests?page=${page}&size=${size}`,
  );
}

export async function getRestaurantReservation(
  id: string,
): Promise<RestaurantReservationDto> {
  return request<RestaurantReservationDto>(
    `/api/restaurant-reservation-requests/${id}`,
  );
}

export async function cancelRestaurantReservation(
  id: string,
  req: CancelRestaurantReservationRequest,
): Promise<RestaurantReservationDto> {
  return request<RestaurantReservationDto>(
    `/api/restaurant-reservation-requests/${id}/cancel`,
    {
      method: "POST",
      body: JSON.stringify(req),
    },
  );
}

export async function getBusinessRestaurantReservations(
  businessId: string,
  state?: string,
  page = 0,
  size = 20,
): Promise<{ content: RestaurantReservationDto[]; totalElements: number }> {
  const query = state ? `&state=${encodeURIComponent(state)}` : "";
  return request<{ content: RestaurantReservationDto[]; totalElements: number }>(
    `/api/partners/businesses/${businessId}/reservation-requests?page=${page}&size=${size}${query}`,
  );
}

export async function decideRestaurantReservation(
  businessId: string,
  id: string,
  req: RestaurantReservationDecisionRequest,
): Promise<RestaurantReservationDto> {
  return request<RestaurantReservationDto>(
    `/api/partners/businesses/${businessId}/reservation-requests/${id}/decision`,
    {
      method: "POST",
      body: JSON.stringify(req),
    },
  );
}




