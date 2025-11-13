import { createWeatherProvider as createMockWeatherProvider } from "@/lib/weather/mock";
import type { WeatherProvider } from "@/lib/weather/types";

let cachedProvider: WeatherProvider | null = null;

export function getWeatherProvider(): WeatherProvider {
  if (cachedProvider) {
    return cachedProvider;
  }

  const providerName = (process.env.WEATHER_PROVIDER || "mock").toLowerCase();

  switch (providerName) {
    case "mock":
    default: {
      cachedProvider = createMockWeatherProvider();
      return cachedProvider;
    }
  }
}
