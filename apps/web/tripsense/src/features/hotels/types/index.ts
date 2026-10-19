
import type { Location, PlacePhotoEvidence } from "@/features/places/types";

export type HotelProperty = {
  business_id: string;
  id: string;
  name: string;
  destination: string;
  address: string;
  time_zone: string;
  check_in_time: string;
  check_out_time: string;
  status: string;
};

export type HotelRoom = {
  id: string;
  name: string;
  capacity: number;
};

export type HotelOffer = {
  address: string;
  capacity: number;
  cancellation_policy: string;
  free_cancellation_until: string;
  property_id: string;
  room_type_id: string;
  name: string;
  room_name: string;
  destination: string;
  total: number;
  currency: string;
  available_rooms: number;
  checked_at: string;
};

export type HotelCriteria = {
  destination: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  quantity: number;
};

export type HotelBooking = {
  version: number;
  payment_method: string;
  cancellation_policy: string;
  free_cancellation_until: string;
  id: string;
  property_id: string;
  room_type_id: string;
  property_name: string;
  room_name: string;
  check_in: string;
  check_out: string;
  quantity: number;
  guests: number;
  total: number;
  subtotal?: number;
  discount_amount?: number;
  voucher_code?: string | null;
  currency: string;
  status: string;
  expires_at: string;
};

export type VoucherDto = {
  code: string;
  title: string;
  description?: string;
  discount_type: "PERCENT" | "FIXED_AMOUNT";
  discount_value: number;
  max_discount_amount?: number;
  min_order_amount: number;
  currency: string;
  valid_from: string;
  valid_until: string;
  usage_limit: number;
  usage_count: number;
};

export type PayOsPayment = {
  provider: string;
  state: string;
  amount: number;
  currency: string;
  checkoutUrl: string;
  expiresAt: string;
  resolution: string;
  lastCheckedAt: string;
};

export type PayOsPaymentResult = {
  booking: HotelBooking;
  payment?: PayOsPayment;
};

export type HotelInventory = {
  stay_date: string;
  allocation: number;
  held: number;
  booked: number;
  nightly_price: number;
  stop_sell: boolean;
};

export type HotelNotification = {
  id: string;
  event_type: string;
  aggregate_id: string;
  message?: string;
  read_at: string | null;
  created_at: string;
};

export interface HotelRoomData {
  id: string;
  name: string;
  roomsLeft: number;
  sqFt?: number;
  sqM?: number;
  sleeps: number;
  bedType?: string;
  refundable: boolean;
  refundPolicyText: string;
  pricePerNight: number;
  currency: string;
  totalForStay: number;
  totalWithTax: number;
  photos: string[];
  amenities: string[];
  description?: string;
}
export interface HotelOTAOption {
  id: string;
  name: string;
  logoType: "booking" | "priceline" | "agoda" | "expedia";
  bookUrl: string;
  pricePerNight?: number;
  currency?: string;
}

export interface HotelFAQ {
  question: string;
  answer: string;
}

export interface HotelReview {
  authorName: string;
  avatarUrl?: string;
  rating?: number;
  text?: string;
  stayDuration?: string;
  date?: string;
}

export interface MindtripHotel {
  id: string;
  /** Stable Place Service ID; property IDs are not valid Place Details IDs. */
  placeId?: string;
  name: string;
  rating?: number;
  reviewCount?: number;
  category: string;
  destination: string;
  district?: string;
  city?: string;
  address?: string;
  phone?: string;
  website?: string;
  description?: string;
  photos: string[];
  primaryPhoto?: PlacePhotoEvidence;
  photoGallery?: PlacePhotoEvidence[];
  location?: Location;
  /**
   * Indicates whether this hotel is registered with real-time direct booking in TripSense.
   * If false, the UI will truthfully indicate that online booking is not yet available,
   * and provide direct phone/direction/website actions.
   */
  hasDirectBooking?: boolean;
  propertyId?: string;
  pricePerNight?: number;
  minPrice?: number;
  currency?: string;
  checkInTime?: string;
  checkOutTime?: string;
  amenities?: {
    popular: string[];
    room: string[];
    services: string[];
  };
  rooms?: HotelRoomData[];
  otaOptions?: HotelOTAOption[];
  faqs?: HotelFAQ[];
  reviews?: HotelReview[];
}

export interface PartnerPayoutAccount {
  id: string;
  business_id: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  branch_name?: string;
  is_verified: boolean;
  created_at: string;
  updated_at: string;
}

export interface PartnerWalletSummary {
  id: string;
  business_id: string;
  currency: string;
  available_balance: number;
  locked_balance: number;
  total_earned: number;
  total_withdrawn: number;
  completed_bookings_count: number;
  pending_escrow_gross: number;
  pending_escrow_net: number;
  payout_account?: PartnerPayoutAccount;
  created_at: string;
  updated_at: string;
}

export interface PartnerWithdrawalRequest {
  id: string;
  business_id: string;
  amount: number;
  currency: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "PENDING_REVIEW" | "PROCESSING" | "COMPLETED" | string;
  partner_notes?: string;
  admin_notes?: string;
  rejection_reason?: string;
  bank_reference_code?: string;
  receipt_image_url?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface CustomerRefundRequest {
  id: string;
  booking_id: string;
  user_id: string;
  property_name?: string;
  room_name?: string;
  amount: number;
  currency: string;
  bank_code: string;
  bank_name: string;
  account_number: string;
  account_holder_name: string;
  cancellation_reason?: string;
  status: "PENDING" | "COMPLETED" | "REJECTED" | "PENDING_REVIEW" | "PROCESSING" | "REFUNDED" | string;
  admin_notes?: string;
  rejection_reason?: string;
  bank_reference_code?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export interface FinancialLedgerEntry {
  id: string;
  business_id?: string;
  booking_id?: string;
  withdrawal_id?: string;
  refund_id?: string;
  entry_type: string;
  amount: number;
  currency: string;
  balance_after?: number;
  description?: string;
  created_at: string;
}

export interface AdminFinanceOverview {
  totalGmv: number;
  escrowHolding: number;
  platformRevenue: number;
  partnerPayable: number;
  pendingWithdrawalCount: number;
  pendingWithdrawalAmount: number;
  pendingRefundCount: number;
  pendingRefundAmount: number;
}

export const POPULAR_BANKS = [
  { code: "MB", name: "MBBank (Ngan hang Quan Doi)", shortName: "MBBank" },
  { code: "VCB", name: "Vietcombank (Ngoai thuong Viet Nam)", shortName: "Vietcombank" },
  { code: "TCB", name: "Techcombank (Ky thuong Viet Nam)", shortName: "Techcombank" },
  { code: "BIDV", name: "BIDV (Dau tu va Phat trien)", shortName: "BIDV" },
  { code: "CTG", name: "VietinBank (Cong thuong Viet Nam)", shortName: "VietinBank" },
  { code: "ACB", name: "ACB (A Chau)", shortName: "ACB" },
  { code: "VPB", name: "VPBank (Viet Nam Thinh Vuong)", shortName: "VPBank" },
  { code: "TPB", name: "TPBank (Tien Phong)", shortName: "TPBank" },
  { code: "STB", name: "Sacombank (Sai Gon Thuong Tin)", shortName: "Sacombank" },
  { code: "HDB", name: "HDBank (Phat trien TP.HCM)", shortName: "HDBank" },
  { code: "VIB", name: "VIB (Quoc Te)", shortName: "VIB" },
  { code: "MSB", name: "MSB (Hang Hai)", shortName: "MSB" },
  { code: "SHB", name: "SHB (Sai Gon - Ha Noi)", shortName: "SHB" },
  { code: "OCB", name: "OCB (Phuong Dong)", shortName: "OCB" },
];

export function buildVietQrUrl({
  bankCode,
  accountNumber,
  accountName,
  amount,
  description,
}: {
  bankCode: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  description: string;
}) {
  return `https://img.vietqr.io/image/${bankCode}-${accountNumber}-compact.png?amount=${Math.round(amount)}&addInfo=${encodeURIComponent(description)}&accountName=${encodeURIComponent(accountName)}`;
}
