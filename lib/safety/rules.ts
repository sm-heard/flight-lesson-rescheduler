import type { TrainingLevel, WeatherLocation } from "@/drizzle/schema";
import type { WeatherPointCheck } from "@/lib/weather/types";

export type SafetyRuleCode =
  | "thunderstorm"
  | "icing"
  | "student_imc"
  | "student_visibility"
  | "student_wind"
  | "private_visibility"
  | "private_ceiling"
  | "ok";

export type PointSafetyResult = {
  location: WeatherLocation;
  safe: boolean;
  rule: SafetyRuleCode;
  message?: string;
};

export type SafetyAssessment = {
  safe: boolean;
  summary: string;
  failingPoint?: PointSafetyResult;
  points: PointSafetyResult[];
};

function checkCommonHazards(location: WeatherLocation, snapshot: WeatherPointCheck["snapshot"]): PointSafetyResult | null {
  if (snapshot.thunderstorm || snapshot.precipType === "ts") {
    return {
      location,
      safe: false,
      rule: "thunderstorm",
      message: "Thunderstorms in the area make this segment unsafe.",
    };
  }

  if (snapshot.icingRisk) {
    return {
      location,
      safe: false,
      rule: "icing",
      message: "Icing risk detected along the route.",
    };
  }

  return null;
}

function evaluateStudent(location: WeatherLocation, snapshot: WeatherPointCheck["snapshot"]): PointSafetyResult | null {
  if (snapshot.imc) {
    return {
      location,
      safe: false,
      rule: "student_imc",
      message: "Student pilots require VFR conditions; IMC detected.",
    };
  }

  if (snapshot.visibility <= 5) {
    return {
      location,
      safe: false,
      rule: "student_visibility",
      message: "Visibility must exceed 5 SM for student pilots.",
    };
  }

  if (snapshot.windSpeed >= 10) {
    return {
      location,
      safe: false,
      rule: "student_wind",
      message: "Surface winds exceed 10 kt limit for student pilots.",
    };
  }

  return null;
}

function evaluatePrivate(location: WeatherLocation, snapshot: WeatherPointCheck["snapshot"]): PointSafetyResult | null {
  if (snapshot.visibility <= 3) {
    return {
      location,
      safe: false,
      rule: "private_visibility",
      message: "Visibility below 3 SM for private pilot minimums.",
    };
  }

  if (snapshot.ceiling <= 1000) {
    return {
      location,
      safe: false,
      rule: "private_ceiling",
      message: "Ceiling below 1000 ft for private pilot minimums.",
    };
  }

  return null;
}

function pointAssessment(level: TrainingLevel, point: WeatherPointCheck): PointSafetyResult {
  const hazardResult = checkCommonHazards(point.location, point.snapshot);
  if (hazardResult) {
    return hazardResult;
  }

  switch (level) {
    case "student": {
      const result = evaluateStudent(point.location, point.snapshot);
      if (result) return result;
      break;
    }
    case "private": {
      const result = evaluatePrivate(point.location, point.snapshot);
      if (result) return result;
      break;
    }
    case "instrument":
    default:
      break;
  }

  return {
    location: point.location,
    safe: true,
    rule: "ok",
  };
}

export function evaluateSafety(
  level: TrainingLevel,
  points: WeatherPointCheck[],
): SafetyAssessment {
  const pointResults = points.map((point) => pointAssessment(level, point));
  const failingPoint = pointResults.find((result) => !result.safe);

  return {
    safe: !failingPoint,
    summary: failingPoint
      ? failingPoint.message || "Weather minimums not satisfied."
      : "All segments satisfy weather minimums.",
    failingPoint,
    points: pointResults,
  };
}
