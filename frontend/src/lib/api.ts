import type {
  RouteComparison,
  TransitMode,
  Priority,
  ErrorResponse,
  ValidationErrorDetail,
  DayPlanRequest,
  DayPlanResponse,
  AuthUrlResponse,
  EmissionFactorResponse,
  CostFactorResponse,
} from "@/types/api";

export class ApiError extends Error {
  statusCode: number;
  detail: string | null;
  errors: ValidationErrorDetail[] | null;

  constructor(
    statusCode: number,
    message: string,
    detail?: string | null,
    errors?: ValidationErrorDetail[] | null
  ) {
    super(message);
    this.name = "ApiError";
    this.statusCode = statusCode;
    this.detail = detail ?? null;
    this.errors = errors ?? null;
  }
}

function isErrorResponse(data: unknown): data is ErrorResponse {
  return (
    typeof data === "object" &&
    data !== null &&
    "status_code" in data &&
    "message" in data
  );
}

export async function handleApiError(res: Response): Promise<never> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    // JSON parsing failed — fall back to raw text
    const text = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, text);
  }

  if (isErrorResponse(body)) {
    throw new ApiError(
      body.status_code,
      body.message,
      body.detail,
      body.errors
    );
  }

  // JSON parsed but doesn't match ErrorResponse shape
  throw new ApiError(res.status, JSON.stringify(body));
}

export async function planRoute(
  origin: string,
  destination: string,
  modes: TransitMode[] | null,
  constraint?: string | null,
  priority: Priority = "best_tradeoff"
): Promise<RouteComparison> {
  const res = await fetch("/api/v1/plan-route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      origin,
      destination,
      modes,
      constraint: constraint ?? null,
      priority,
    }),
  });

  if (!res.ok) {
    await handleApiError(res);
  }

  return res.json() as Promise<RouteComparison>;
}

export async function planDay(req: DayPlanRequest): Promise<DayPlanResponse> {
  const res = await fetch("/api/v1/plan-day", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });

  if (!res.ok) {
    await handleApiError(res);
  }

  return res.json() as Promise<DayPlanResponse>;
}

export async function getAuthUrl(): Promise<AuthUrlResponse> {
  const res = await fetch("/api/v1/auth/google");

  if (!res.ok) {
    if (res.status === 503) {
      throw new ApiError(503, "OAuth is not configured");
    }
    await handleApiError(res);
  }

  return res.json() as Promise<AuthUrlResponse>;
}

export async function getEmissionFactors(): Promise<EmissionFactorResponse[]> {
  const res = await fetch("/api/v1/emission-factors");

  if (!res.ok) {
    await handleApiError(res);
  }

  return res.json() as Promise<EmissionFactorResponse[]>;
}

export async function getCostFactors(): Promise<CostFactorResponse[]> {
  const res = await fetch("/api/v1/cost-factors");

  if (!res.ok) {
    await handleApiError(res);
  }

  return res.json() as Promise<CostFactorResponse[]>;
}
