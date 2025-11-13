import type { WeatherSnapshot } from "@/lib/weather/types";

export type ScenarioName = "clear" | "breezy" | "marginal" | "storm";

type ScenarioTemplate = Pick<
  WeatherSnapshot,
  | "visibility"
  | "windSpeed"
  | "windGust"
  | "ceiling"
  | "precipType"
  | "icingRisk"
  | "imc"
  | "thunderstorm"
  | "temperatureC"
  | "condition"
>;

export const SCENARIO_TEMPLATES: Record<ScenarioName, ScenarioTemplate> = {
  clear: {
    visibility: 10,
    windSpeed: 6,
    windGust: 12,
    ceiling: 12000,
    precipType: "none",
    icingRisk: false,
    imc: false,
    thunderstorm: false,
    temperatureC: 15,
    condition: "Clear skies",
  },
  breezy: {
    visibility: 8,
    windSpeed: 14,
    windGust: 22,
    ceiling: 8000,
    precipType: "none",
    icingRisk: false,
    imc: false,
    thunderstorm: false,
    temperatureC: 13,
    condition: "Breezy with scattered clouds",
  },
  marginal: {
    visibility: 3.5,
    windSpeed: 9,
    windGust: 16,
    ceiling: 900,
    precipType: "rain",
    icingRisk: false,
    imc: true,
    thunderstorm: false,
    temperatureC: 9,
    condition: "Low ceiling with light rain",
  },
  storm: {
    visibility: 1.5,
    windSpeed: 18,
    windGust: 30,
    ceiling: 500,
    precipType: "ts",
    icingRisk: true,
    imc: true,
    thunderstorm: true,
    temperatureC: 7,
    condition: "Thunderstorms in vicinity",
  },
};

export function buildSnapshot(
  scenario: ScenarioName,
  forecastFor: Date,
  observedAt = new Date(),
): WeatherSnapshot {
  const template = SCENARIO_TEMPLATES[scenario];
  return {
    provider: "mock-weatherapi",
    observedAt,
    forecastFor,
    ...template,
  };
}
