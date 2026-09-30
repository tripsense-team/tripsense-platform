export type BusinessKind = "HOTEL" | "RESTAURANT" | "TOUR_GUIDE";
export type ApplicationState = "DRAFT" | "SUBMITTED" | "CHANGES_REQUIRED" | "APPROVED" | "REJECTED" | "WITHDRAWN";
export type MembershipRole = "OWNER" | "MANAGER" | "STAFF";
export type PartnerCapability =
  | "HOTEL_LISTING"
  | "HOTEL_INVENTORY"
  | "HOTEL_BOOKING"
  | "RESTAURANT_LISTING"
  | "RESTAURANT_MENU"
  | "GUIDE_LISTING"
  | "GUIDE_PROMOTION"
  | "GUIDE_INQUIRY";

export interface BusinessDetailDto {
  id: string;
  kind: BusinessKind;
  ownerUserId: string;
  displayName: string;
  draftProfile?: Record<string, unknown> | null;
  draftSchemaVersion?: number | null;
  approvalValidity: "NONE" | "VALID" | "REVOKED";
  operationState: "ACTIVE" | "SUSPENDED";
  publicationState: "HIDDEN" | "PUBLISHED";
  acceptingNew: boolean;
  requiresReverification: boolean;
  reverificationApplicationId?: string | null;
  suspensionVersion: number;
  suspendedAt?: string | null;
  reinstatedAt?: string | null;
  approvedRevisionId?: string | null;
  version: number;
  contactConsentVersion?: string | null;
  myRole?: MembershipRole | null;
  capabilities?: PartnerCapability[];
  latestApplicationState?: ApplicationState | null;
  publicEligible: boolean;
  newIntakeEligible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerContextDto {
  role?: string;
  roles?: string[];
  businesses: BusinessDetailDto[];
}

export interface PartnerCandidateDto {
  id: string;
  kind: BusinessKind;
  displayName: string;
  publicationState: string;
  destination?: string;
  address?: string;
}

export interface CreateBusinessDraftRequest {
  kind: BusinessKind;
  displayName: string;
  draftProfile?: Record<string, unknown>;
}

export interface SubmitApplicationRequest {
  expectedVersion: number;
  checklistId?: string;
  checklistVersion?: string;
  requestedCapabilities: PartnerCapability[];
  profileSnapshot?: Record<string, unknown>;
  documentIds?: string[];
}

export interface ApplicationDetailDto {
  id: string;
  businessId: string;
  submittedByUserId?: string;
  revisionNumber?: number;
  revision?: number;
  state: ApplicationState;
  requestedCapabilities: PartnerCapability[];
  grantedCapabilities?: PartnerCapability[];
  reviewerUserId?: string | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  checklistId?: string | null;
  checklistVersion?: string | null;
  checklistResults?: Record<string, unknown> | null;
  documentIds?: string[];
  submittedAt: string;
  createdAt: string;
  updatedAt: string;
  version: number;
  businessVersion?: number;
}

export interface PublicationRequest {
  expectedVersion: number;
  state: "HIDDEN" | "PUBLISHED";
}

export interface IntakeRequest {
  expectedVersion: number;
  acceptingNew: boolean;
}

export interface CommunityPublication {
  promotionId: string;
  distributionVersion: number;
  desiredEnabled: boolean;
  syncState: "PENDING" | "DISTRIBUTED" | "DISABLED" | "UNKNOWN";
  postId?: string | null;
}

export interface CommunityPublicationRequest {
  expectedVersion: number;
  expectedRevisionId: string;
  enabled: boolean;
}

export type IndicativePriceUnit = "PER_PERSON" | "PER_GROUP" | "PER_HOUR" | "PER_DAY";

export interface GuidePromotionRevisionDto {
  id: string;
  promotionId: string;
  revisionNumber: number;
  title: string;
  summary: string;
  areaId: string;
  topicIds: string[];
  skillIds: string[];
  experienceDuration?: string | null;
  inclusions?: string[];
  exclusions?: string[];
  indicativePriceAmount?: number | null;
  indicativePriceCurrency?: string | null;
  indicativePriceUnit: IndicativePriceUnit;
  coverImageRef?: string | null;
  galleryImageRefs?: string[];
  state: ApplicationState;
  submittedAt?: string | null;
  reviewedAt?: string | null;
  reviewReason?: string | null;
  createdAt: string;
}

export interface GuidePromotionDto {
  id: string;
  businessId: string;
  approvedRevisionId?: string | null;
  publicationState: "HIDDEN" | "PUBLISHED";
  communityEnabled: boolean;
  communityPostId?: string | null;
  distributionVersion: number;
  version: number;
  currentRevision?: GuidePromotionRevisionDto | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateGuidePromotionDraftRequest {
  title: string;
  summary: string;
  areaId: string;
  topicIds: string[];
  skillIds: string[];
  experienceDuration?: string;
  inclusions?: string[];
  exclusions?: string[];
  indicativePriceAmount?: number;
  indicativePriceCurrency?: string;
  indicativePriceUnit: IndicativePriceUnit;
  coverImageRef?: string;
  galleryImageRefs?: string[];
}

export interface SubmitGuidePromotionRequest {
  expectedVersion: number;
  expectedRevisionId: string;
}

export interface PublicGuideProfileDto {
  businessId: string;
  displayName: string;
  bio?: string;
  languages?: { code: string; selfAssessedLevel: string }[];
  skillIds?: string[];
  expertise?: { areaId: string; topicId: string; description: string; experience: string }[];
  audienceTags?: string[];
  serviceLimitations?: string[];
  yearsExperience?: number;
  indicativePrice?: { amount: number; currency: string; unit: string };
  promotions?: GuidePromotionSummaryDto[];
}

export interface GuidePromotionSummaryDto {
  promotionId: string;
  businessId: string;
  approvedRevisionId: string;
  title: string;
  summary: string;
  areaId: string;
  topicIds: string[];
  skillIds: string[];
  experienceDuration?: string;
  indicativePriceAmount?: number;
  indicativePriceCurrency?: string;
  indicativePriceUnit?: string;
  coverImageRef?: string;
  businessDisplayName?: string;
  availability?: "AVAILABLE" | "PAUSED" | "UNAVAILABLE";
  canRequestInquiry?: boolean;
}

export type GuideInquiryState =
  | "SUBMITTED"
  | "IN_DISCUSSION"
  | "PROPOSAL_SENT"
  | "CONTACT_AGREED"
  | "DECLINED"
  | "WITHDRAWN"
  | "EXPIRED"
  | "CLOSED";

export type GuideProposalState = "DRAFT" | "SUBMITTED" | "ACCEPTED" | "SUPERSEDED" | "DECLINED";
export type ContactConsentChannel = "EMAIL" | "PHONE";
export type ContactConsentState = "ACTIVE" | "REVOKED";

export interface ContactConsentGrant {
  inquiryId: string;
  grantorUserId: string;
  granteeUserId: string;
  channel: ContactConsentChannel;
  state: ContactConsentState;
  consentedAt: string;
  revokedAt?: string | null;
}

export interface GuideInquiryRequirements {
  inquiryId: string;
  revision: number;
  areaId: string;
  topicIds: string[];
  requiredSkillIds: string[];
  languageCode: string;
  dateFrom: string;
  dateTo: string;
  preferredStartTime?: string | null;
  timeZone: string;
  durationMinutes: number;
  adults: number;
  children: number;
  goals: string;
  supportNotes?: string | null;
  budgetMinVnd?: number | null;
  budgetMaxVnd?: number | null;
}

export interface GuideProposal {
  id: string;
  inquiryId: string;
  revision: number;
  requirementsRevision: number;
  offeredAreaId: string;
  offeredTopicIds: string[];
  offeredSkillIds: string[];
  languageCode: string;
  unmetSoftRequirements?: string[];
  explanation?: string | null;
  proposedStartAt: string;
  timeZone: string;
  durationMinutes: number;
  program: string;
  inclusions: string[];
  exclusions: string[];
  estimatedTotalVnd: number;
  validUntil: string;
  state: GuideProposalState;
}

export interface GuideInquiryDto {
  id: string;
  guideBusinessId: string;
  customerId: string;
  sourcePromotionId?: string | null;
  sourceCommunityPostId?: string | null;
  state: GuideInquiryState;
  currentRequirementsRevision: number;
  currentProposalId?: string | null;
  expiresAt: string;
  version: number;
  requirements: GuideInquiryRequirements;
  currentProposal?: GuideProposal | null;
  guideDisplayName?: string;
  customerDisplayName?: string;
}

export interface GuideInquiryEntry {
  id: string;
  inquiryId: string;
  seq: number;
  actorId: string;
  actorRole: "CUSTOMER" | "GUIDE" | "ADMIN";
  kind: "QUESTION" | "REPLY" | "REQUIREMENTS_CHANGED" | "PROPOSAL" | "DECISION";
  content?: string | null;
  createdAt: string;
}

export interface InquiryContactsDto {
  inquiryId: string;
  counterpartyUserId: string;
  email?: string | null;
  emailConsented: boolean;
  phone?: string | null;
  phoneConsented: boolean;
  notice?: string | null;
}

export interface CreateGuideInquiryInput {
  promotionId?: string;
  expectedSourceRevisionId: string;
  sourceCommunityPostId?: string;
  areaId: string;
  topicIds: string[];
  requiredSkillIds?: string[];
  languageCode: string;
  dateFrom: string;
  dateTo: string;
  preferredStartTime?: string;
  timeZone: string;
  durationMinutes: number;
  adults: number;
  children: number;
  goals: string;
  supportNotes?: string;
  budgetVnd?: {
    minVnd?: number;
    maxVnd?: number;
  };
}

export interface ProposalContactConsent {
  shareEmail: boolean;
  sharePhone: boolean;
}

export interface GuideProposalInput {
  expectedVersion: number;
  requirementsRevision: number;
  offeredAreaId: string;
  offeredTopicIds: string[];
  offeredSkillIds: string[];
  languageCode: string;
  unmetSoftRequirements?: string[];
  explanation?: string;
  proposedStartAt: string;
  timeZone: string;
  durationMinutes: number;
  program: string;
  inclusions?: string[];
  exclusions?: string[];
  estimatedTotalVnd: number;
  validUntil: string;
  contactConsent: ProposalContactConsent;
}

export interface ProposalDecisionRequest {
  expectedVersion: number;
  proposalId: string;
  action: "REQUEST_REVISION" | "AGREE_TO_CONTACT";
  note?: string;
  contactConsent?: ProposalContactConsent;
}

export interface RevokeConsentRequest {
  channel: ContactConsentChannel;
  reason?: string;
}

export interface AdminReviewDecisionRequest {
  expectedBusinessVersion: number;
  expectedApplicationVersion: number;
  decision: "APPROVE" | "REQUEST_CHANGES" | "REJECT";
  checklistResults?: { code: string; result: string; reason?: string }[];
  capabilityDecisions?: { capability: PartnerCapability; grant: boolean; reason?: string }[];
  reason?: string;
}

export interface ManagementClaimDto {
  id: string;
  businessId?: string;
  targetBusinessId?: string;
  claimantUserId?: string;
  applicantUserId?: string;
  status?: string;
  state?: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED" | "WITHDRAWN";
  reason?: string;
  evidenceNotes?: string;
  claimantDocumentIds?: string[];
  decisionOutcome?: string;
  decisionReason?: string;
  version?: number;
  decidedBy?: string;
  decidedAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateManagementClaimRequest {
  businessId: string;
  reason?: string;
}

export interface ManagementClaimDecisionRequest {
  expectedVersion: number;
  outcome: "APPROVED" | "REJECTED";
  linkedBusinessIds?: string[];
  reason: string;
}

export interface TaxonomyItem {
  id: string;
  name: string;
  category?: string;
}

export interface GuideTaxonomyData {
  skills: TaxonomyItem[];
  areas: TaxonomyItem[];
  topics: TaxonomyItem[];
}
