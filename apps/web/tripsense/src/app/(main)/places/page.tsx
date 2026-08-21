import type { Metadata } from "next";
import { PlaceDiscoveryView } from "@/features/places";

export const metadata: Metadata = {
  title: "Khám phá địa điểm Đà Nẵng | TripSense",
  description:
    "Tìm kiếm quán ăn ngon, cafe chill, nhà hàng hải sản và địa điểm du lịch nổi tiếng tại Đà Nẵng với bản đồ trực quan MapVina.",
};

export default function PlacesPage() {
  return <PlaceDiscoveryView />;
}
