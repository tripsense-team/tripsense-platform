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
  currency: string;
  status: string;
  expires_at: string;
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
  /**
   * Indicates whether this hotel is registered with real-time direct booking in TripSense.
   * If false, the UI will truthfully indicate that online booking is not yet available,
   * and provide direct phone/direction/website actions.
   */
  hasDirectBooking?: boolean;
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
