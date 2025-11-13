import type { WeatherLocation } from "@/drizzle/schema";

export type Coordinates = {
  lat: number;
  lon: number;
};

export type PrecipType = "none" | "rain" | "snow" | "mix" | "ts";

export type WeatherSnapshot = {
  provider: string;
  observedAt: Date;
  forecastFor: Date;
  visibility: number; // statute miles
  windSpeed: number; // knots
  windGust?: number; // knots
  ceiling: number; // feet
  precipType: PrecipType;
  icingRisk: boolean;
  imc: boolean;
  thunderstorm: boolean;
  temperatureC: number;
  condition: string;
};

export interface WeatherProvider {
  getForecast(coords: Coordinates, at: Date): Promise<WeatherSnapshot>;
}

export type WeatherPointCheck = {
  location: WeatherLocation;
  coords: Coordinates;
  snapshot: WeatherSnapshot;
};
