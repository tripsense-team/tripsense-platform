export type TripStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | "ARCHIVED";
export type DisplayStatus =
  | "DRAFT"
  | "UPCOMING"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED"
  | "ARCHIVED";
export type TripVisibility = "PRIVATE" | "PUBLIC";
export type DateChangePolicy = "BLOCK_IF_ITEMS_OUTSIDE_RANGE";
export type ItineraryItemType =
  | "PLACE"
  | "MEAL"
  | "HOTEL"
  | "FLIGHT"
  | "TRANSFER"
  | "ACTIVITY"
  | "NOTE";
export type ItineraryItemStatus = "PLANNED" | "DONE" | "SKIPPED" | "CANCELLED";

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PageResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  page: number;
  number?: number;
}

export interface TripResponse {
  id: string;
  name: string;
  destinationName: string;
  destinationPlaceId: string | null;
  startDate: string;
  endDate: string;
  status: TripStatus;
  displayStatus: DisplayStatus;
  visibility: TripVisibility;
  ownerId: string;
  travelerCount: number | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  notes: string | null;
  coverImageUrl: string | null;
  version: number;
  aggregateRevision?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ItineraryItemResponse {
  id: string;
  dayId: string;
  placeId: string | null;
  type: ItineraryItemType;
  title: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  status: ItineraryItemStatus;
  sortOrder: number;
  placeNameSnapshot: string | null;
  placeAddressSnapshot: string | null;
  latSnapshot: number | null;
  lngSnapshot: number | null;
  version: number;
  sourceKind?: string | null;
  sourceProposalId?: string | null;
  sourceItemKey?: string | null;
  warnings: string[];
}

export interface ItineraryDayResponse {
  id: string;
  date: string;
  dayNumber: number;
  version: number;
  items: ItineraryItemResponse[];
}

export interface ItineraryResponse {
  tripId: string;
  revision?: number;
  capabilities?: ItineraryCapabilities;
  days: ItineraryDayResponse[];
}

export interface ItineraryCapabilities {
  canView: boolean;
  canEdit: boolean;
  canManageMembers: boolean;
}

export type CollaborationChangeType =
  | "ITEM_ADDED"
  | "ITEM_UPDATED"
  | "ITEM_DELETED"
  | "ITEM_REORDERED"
  | "MEMBER_JOINED"
  | "MEMBER_LEFT"
  | "MEMBER_REMOVED"
  | "MEMBER_ROLE_CHANGED";

export interface CollaborationChangeEvent {
  eventId: string;
  schemaVersion: number;
  tripId: string;
  revision: number;
  type: CollaborationChangeType;
  actorUserId: string;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface CreateTripRequest {
  name: string;
  destinationName: string;
  destinationPlaceId?: string | null;
  startDate: string;
  endDate: string;
  travelerCount?: number | null;
  budgetAmount?: number | null;
  budgetCurrency?: string | null;
  notes?: string | null;
  coverImageUrl?: string | null;
}

export interface UpdateTripRequest extends Partial<CreateTripRequest> {
  dateChangePolicy?: DateChangePolicy;
  status?: TripStatus;
}

export interface CreateItineraryItemRequest {
  placeId?: string | null;
  placeRef?: string | null;
  type: ItineraryItemType;
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
  expectedTripRevision?: number;
}

export interface UpdateItineraryItemRequest
  extends Partial<CreateItineraryItemRequest> {
  status?: ItineraryItemStatus;
  version?: number;
}

export interface ReorderItemsRequest {
  orderedItemIds: string[];
  version: number;
  expectedTripRevision?: number;
}

export * from './collaboration';
