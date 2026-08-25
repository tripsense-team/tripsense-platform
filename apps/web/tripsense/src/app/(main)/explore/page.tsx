import type { Metadata } from "next";
import { PlaceDiscoveryView } from "@/features/places";

export const metadata: Metadata = {
  title: "Khám phá địa điểm & Du lịch | TripSense",
  description: "Tìm kiếm và khám phá các địa điểm ẩm thực, cafe, mua sắm và du lịch với bản đồ tương tác TripSense.",
};

export default function ExplorePage() {
  return <PlaceDiscoveryView />;
}
