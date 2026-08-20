export type TripStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | "ARCHIVED";
export type DisplayStatus = "DRAFT" | "UPCOMING" | "ONGOING" | "COMPLETED" | "CANCELLED" | "ARCHIVED";
export type DateChangePolicy = "BLOCK_IF_ITEMS_OUTSIDE_RANGE";
export type ItineraryItemType = "PLACE" | "MEAL" | "HOTEL" | "FLIGHT" | "TRANSFER" | "ACTIVITY" | "NOTE";
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
  ownerId: string;
  travelerCount: number | null;
  budgetAmount: number | null;
  budgetCurrency: string | null;
  notes: string | null;
  coverImageUrl: string | null;
  version: number;
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
  days: ItineraryDayResponse[];
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
  type: ItineraryItemType;
  title: string;
  startTime?: string | null;
  endTime?: string | null;
  durationMinutes?: number | null;
  notes?: string | null;
}

export interface UpdateItineraryItemRequest extends Partial<CreateItineraryItemRequest> {
  status?: ItineraryItemStatus;
  version?: number;
}

export interface ReorderItemsRequest {
  orderedItemIds: string[];
  version: number;
}
