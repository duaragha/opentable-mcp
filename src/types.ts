export interface Restaurant {
  name: string;
  url: string;
  cuisine: string;
  priceRange: string;
  rating: number;
  reviewCount: number;
  neighborhood: string;
  address?: string;
  imageUrl?: string;
}

export interface TimeSlot {
  time: string;
  type: string;
}

export interface Availability {
  restaurantName: string;
  date: string;
  requestedTime: string;
  partySize: number;
  timeSlots: TimeSlot[];
  message?: string;
}

export interface RestaurantDetails {
  name: string;
  address: string;
  neighborhood: string;
  cuisine: string;
  priceRange: string;
  rating: number;
  reviewCount: number;
  description: string;
  hours: Record<string, string>;
  diningStyle?: string;
  dressCode?: string;
  parking?: string;
  paymentOptions?: string;
  website?: string;
  phone?: string;
  tags: string[];
}

export interface MenuItem {
  name: string;
  description: string;
  price: string;
}

export interface MenuSection {
  section: string;
  items: MenuItem[];
}

export interface Review {
  rating: number;
  date: string;
  text: string;
  diningDate?: string;
  foodRating?: number;
  serviceRating?: number;
  ambienceRating?: number;
  valueRating?: number;
  noise?: string;
}

export interface ReviewSummary {
  overall: number;
  food: number;
  service: number;
  ambience: number;
  value: number;
  totalReviews: number;
  noise: string;
  reviews: Review[];
}
