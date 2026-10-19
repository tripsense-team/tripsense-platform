/** Declared onboarding preferences only; never the User travel-preferences payload. */
export type DeclaredTravelPreferences = {
  travelParty?: string;
  budgetTier?: string;
  stayStyles: string[];
  foodStyles: string[];
  activityInterests: string[];
  splurgeCategories: string[];
};

const MAX_SIGNALS = 200; // Eight catalog dimensions x 20 selections + derived signals.
const MAX_BODY_BYTES = 65_536;
const TIMEOUT_MS = 1500;
const OPTIONS = {
  TRAVEL_PARTY: ["SOLO", "COUPLE", "FRIENDS", "FAMILY"],
  BUDGET_TIER: ["BUDGET", "MID_RANGE", "PREMIUM"],
  STAY_STYLE: ["HOTEL", "HOMESTAY", "RESORT", "HOSTEL"],
  FOOD_STYLE: ["LOCAL_FOOD", "STREET_FOOD", "FINE_DINING", "CAFE"],
  ACTIVITY_INTEREST: ["NATURE", "HIKING", "CULTURE", "BEACH", "NIGHTLIFE"],
  SPLURGE_CATEGORY: [
    "HOTEL", "HOMESTAY", "RESORT", "HOSTEL", "LOCAL_FOOD", "STREET_FOOD",
    "FINE_DINING", "CAFE", "NATURE", "HIKING", "CULTURE", "BEACH", "NIGHTLIFE",
  ],
} satisfies Record<string, readonly string[]>;

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function mapContextPreferences(
  payload: unknown,
): DeclaredTravelPreferences | undefined {
  if (!Array.isArray(payload) || payload.length > MAX_SIGNALS) {
    throw new Error("Invalid Context signal array");
  }
  const groups = new Map<string, Map<string, number>>();
  for (const signal of payload) {
    if (!isObject(signal)) throw new Error("Invalid Context signal");
    const { dimensionCode, valueCode, confidence, source } = signal;
    if (
      source !== "ONBOARDING" || typeof dimensionCode !== "string"
      || typeof valueCode !== "string" || typeof confidence !== "number"
      || !Number.isFinite(confidence) || confidence <= 0 || confidence > 1
    ) continue;
    if (!Object.hasOwn(OPTIONS, dimensionCode)) continue;
    const options: readonly string[] = OPTIONS[dimensionCode as keyof typeof OPTIONS];
    if (!options.includes(valueCode)) continue;
    const values = groups.get(dimensionCode) ?? new Map<string, number>();
    values.set(valueCode, Math.max(values.get(valueCode) ?? 0, confidence));
    groups.set(dimensionCode, values);
  }
  if (groups.size === 0) return undefined;
  const multiple = (dimension: string) => [...(groups.get(dimension)?.keys() ?? [])].sort();
  const single = (dimension: string) => [...(groups.get(dimension)?.entries() ?? [])]
    .sort(([a, aw], [b, bw]) => bw - aw || a.localeCompare(b))[0]?.[0];
  return {
    travelParty: single("TRAVEL_PARTY"),
    budgetTier: single("BUDGET_TIER"),
    stayStyles: multiple("STAY_STYLE"),
    foodStyles: multiple("FOOD_STYLE"),
    activityInterests: multiple("ACTIVITY_INTEREST"),
    splurgeCategories: multiple("SPLURGE_CATEGORY"),
  };
}

async function readJsonBounded(response: Response): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Missing response body");
  let size = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) throw new Error("Personalization body exceeds limit");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
}

export async function fetchUserContext(
  endpoints: { userServiceUrl: string; contextServiceUrl: string },
  authorization?: string,
  fetcher: typeof fetch = fetch,
): Promise<{ displayName?: string; preferences?: DeclaredTravelPreferences }> {
  if (!authorization) return {};
  const get = async (url: string): Promise<unknown> => {
    const response = await fetcher(url, {
      headers: { Authorization: authorization },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      redirect: "error", // Never forward the bearer through a downstream redirect.
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error("Personalization source unavailable");
    }
    return readJsonBounded(response);
  };
  // Optional identity must not gate declared Context (or vice versa).
  const [identity, declared] = await Promise.allSettled([
    get(`${endpoints.userServiceUrl}/api/users/me`),
    get(`${endpoints.contextServiceUrl}/api/context/preferences?purpose=TRIP_PLANNING`)
      .then(mapContextPreferences),
  ]);
  let displayName: string | undefined;
  if (identity.status === "fulfilled" && isObject(identity.value) && isObject(identity.value.data)) {
    const name = identity.value.data.displayName || identity.value.data.name;
    if (typeof name === "string" && name.length <= 160) displayName = name;
  }
  return {
    displayName,
    preferences: declared.status === "fulfilled" ? declared.value : undefined,
  };
}
