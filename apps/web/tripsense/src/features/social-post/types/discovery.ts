/**
 * Types for Community Discovery Rail widgets:
 * - Weather by destination
 * - Suggested creators & follow status
 * - Trending / recently shared destinations
 */

export interface SuggestedCreator {
  id: string;
  name: string;
  avatar: string;
  niche: string;
  nicheKey?: string;
  followerCount: number;
  isFollowing: boolean;
  tripCount?: number;
}

export type WeatherConditionType =
  | "sunny"
  | "partlyCloudy"
  | "cloudy"
  | "rainy"
  | "cool";

export interface DestinationWeather {
  id: string;
  cityName: string;
  cityKey: string;
  temperature: number;
  condition: string;
  conditionKey: string;
  tempRange: string;
  humidity: number;
  updatedAt: string;
  iconType: WeatherConditionType;
  travelTip?: string;
  travelTipKey?: string;
}

export interface TrendingDestination {
  id: string;
  name: string;
  cityNameKey: string;
  imageUrl: string;
  shareCountText: string;
  shareCount: number;
  subtitle: string;
  subtitleKey: string;
  slug: string;
}
