export interface Envelope<T> {
  success: boolean;
  data: T;
  message: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    offset: number;
    hasMore?: boolean;
  };
}
export interface User {
  id: number;
  fullName: string;
  email: string;
  role: string;
  phone?: string;
}
export interface AuthData {
  user: User;
  token?: string;
  accessToken?: string;
  refreshToken: string;
}
export interface Route {
  id: string;
  name: string;
  code?: string;
  routeCode?: string;
  displayCode?: string;
  province: string;
  provinceCode: string;
  startPoint?: string;
  endPoint?: string;
  originName?: string;
  destinationName?: string;
  operatingHours?: string;
  frequencyText?: string;
  time?: string;
  interval?: string;
  fare?: string;
  color?: string;
  path?: number[][];
  sourceNote?: string;
  sourceUrl?: string;
}
export interface Stop {
  id: string;
  name: string;
  address?: string;
  lat: number;
  lng: number;
  latitude?: number;
  longitude?: number;
  routeId?: string;
  distanceMeters?: number;
  routes?: Route[];
}
export interface Link {
  stopId: string;
  stopName: string;
  routeId: string;
  routeDisplayCode?: string;
  distanceMeters?: number;
  walkingMinutes?: number;
}
export interface Place {
  id: number;
  name: string;
  description?: string;
  shortDescription?: string;
  province?: string;
  provinceName?: string;
  provinceCode: string;
  category: string;
  categoryName?: string;
  latitude: number;
  longitude: number;
  thumbnailUrl?: string;
  averageRating: number;
  reviewCount: number;
  openingHours?: string;
  bestTime?: string;
  foodSuggestions?: string;
  isActive?: boolean;
  nearbyStops?: Link[];
  nearestStop?: Link;
  recommendedRoute?: Route;
  suggestedDurationMinutes?: number;
  timeBlock?: string;
  suggestedStart?: string;
  transferMinutes?: number;
  practicalNote?: string;
}
export interface Review {
  id: number;
  title: string;
  content: string;
  placeName: string;
  authorName?: string;
  userName?: string;
  province?: string;
  rating: number;
  status: string;
  isSeed?: boolean;
  createdAt: string;
}
export interface TripPlan {
  id?: number;
  itineraryId?: number;
  title: string;
  summary?: string;
  timeAvailable?: string;
  totalEstimatedTime?: number;
  items: Place[];
  createdAt?: string;
}
export interface Stats {
  totalRoutes: number;
  totalStops: number;
  totalTourismPlaces: number;
  totalProvinces: number;
  totalReviews: number;
  totalUsers?: number;
  totalReports?: number;
  pendingReviews?: number;
}
export interface ChatResponse {
  reply: string;
  route?: Route;
  suggestedPlaces?: Place[];
  destinationPlace?: Place;
  tripPlan?: TripPlan;
}
export interface Activity {
  id: number;
  label: string;
  actionType: string;
  description: string;
  createdAt: string;
  userName?: string;
}
