import { DateTime } from "luxon";

import { buildSnapshot, type ScenarioName } from "@/lib/weather/fixtures";
import type { Coordinates, WeatherProvider } from "@/lib/weather/types";

const DEFAULT_TZ = process.env.DEFAULT_TZ || "America/Los_Angeles";

const SCENARIO_ORDER: ScenarioName[] = ["clear", "breezy", "marginal", "storm"];

const HOUR_SCENARIOS: Record<number, ScenarioName> = {
  0: "clear",
  1: "clear",
  2: "clear",
  3: "clear",
  4: "clear",
  5: "clear",
  6: "clear",
  7: "breezy",
  8: "clear",
  9: "clear",
  10: "marginal",
  11: "marginal",
  12: "storm",
  13: "storm",
  14: "breezy",
  15: "marginal",
  16: "storm",
  17: "breezy",
  18: "clear",
  19: "clear",
  20: "clear",
  21: "clear",
  22: "clear",
  23: "clear",
};

function baseScenarioForHour(hour: number): ScenarioName {
  return HOUR_SCENARIOS[hour] ?? "clear";
}

function classifyLocationOffset(coords: Coordinates): number {
  // Rough classification for Seattle-based corridor: KBFI (~47.53), midpoint (~47.7), KPAE (~47.9)
  if (coords.lat > 47.8) return 1; // north end (KPAE)
  if (coords.lat > 47.6) return 2; // midpoint
  return 0; // south end (KBFI)
}

function shiftScenario(base: ScenarioName, offset: number): ScenarioName {
  const baseIndex = SCENARIO_ORDER.indexOf(base);
  const nextIndex = Math.min(
    SCENARIO_ORDER.length - 1,
    Math.max(0, baseIndex + offset),
  );
  return SCENARIO_ORDER[nextIndex];
}

function scenarioFor(coords: Coordinates, at: Date): ScenarioName {
  const dt = DateTime.fromJSDate(at).setZone(DEFAULT_TZ);
  const base = baseScenarioForHour(dt.hour);
  const dayFactor = dt.weekday % 2 === 0 ? 0 : -1; // Slightly calmer on even weekdays.
  const locationOffset = classifyLocationOffset(coords);
  const offset = Math.sign(locationOffset - 1) + dayFactor; // midpoint worsens conditions, south end slightly better on even days.
  return shiftScenario(base, offset);
}

export class MockWeatherProvider implements WeatherProvider {
  async getForecast(coords: Coordinates, at: Date) {
    const scenario = scenarioFor(coords, at);
    return buildSnapshot(scenario, at);
  }
}

export function createWeatherProvider(): WeatherProvider {
  return new MockWeatherProvider();
}
