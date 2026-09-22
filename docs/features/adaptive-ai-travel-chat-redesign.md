# Adaptive AI Travel Chat Redesign — Specification & Implementation Plan

`STATUS: APPROVED — IMPLEMENTING`

- **Owner Service**: `services/ai-service`
- **Affected Components**: `services/ai-service`, `apps/web/tripsense`
- **Created Date**: 2026-09-21
- **Target PR Boundaries**:
  - Phase 1: Semantic TravelGoal, CoverageRequirements, Typed FoodEvidence, and CandidateEvaluator
  - Phase 2: Administrative GeographicScope, Evidence-Gain Adaptive Loop, and Canonical External Fallback
  - Phase 3: Whole-Day Itinerary Planner, Validation Separation (`validityState`, `canRenderPreview`, `canCommit`)
  - Phase 4: Frontend UI Alignment & Progress-Aware Activity Stream
  - Phase 5: Regression Tests (Tiên Sa + 43 DANANG + Bài Chòi Hội An, External Resolution 2/3, Graceful Extraction Fallback)

---

## 1. Goal & Requirements

### 1.1 Problem Statement & User Goal

The current TripSense AI Travel Chat behaves like a rigid rule/regex-heavy planner rather than an adaptive, evidence-driven travel planning agent:
1. **Shallow regex classification**: Brittle regexes collapse nuanced requests or misclassify food requirements into generic restaurant categories.
2. **Boolean / Unverified food matching**: Looking for string keywords in reviews without provenance leads to false claims (e.g. assigning a cafe to lunch because a review said "quán không có mì quảng").
3. **Weak geographic bounds**: Radius alone allows out-of-province candidates (e.g. Hội An) to leak into Da Nang plans.
4. **Missing CoverageRequirement layer**: `TravelGoal` jumped directly to ad-hoc `EvidenceGap` calculation, risking another fragile if-block engine.
5. **No evidence-gain loop termination**: Research could loop blindly or terminate early without measuring actual evidence gained.
6. **Mismatched validity semantics**: Conflated previewability with validity. An itinerary with 0 restaurants when food was requested showed `"GỢI Ý HỢP LỆ"`.
7. **External fallback leaking ungrounded venues**: Web search results could invent non-canonical cards/stops if resolution failed.

**Goal**: Transform AI Travel Chat into an adaptive agent using the canonical architectural pipeline:
```text
User Request
    ↓ (cheap fast path for trivial queries / LLM for travel semantics)
TravelGoal
    ↓
CoverageRequirements
    ↓
Evidence-Gap Analysis
    ↓
Adaptive Research Loop (Internal First → External Fallback → Canonical Resolution)
    ↓
Candidate Evaluation (Typed FoodEvidence + Administrative GeographicScope)
    ↓
Whole-Day Itinerary Optimization
    ↓
Deterministic Route Provider
    ↓
Strict Validation (validityState, canRenderPreview, canCommit)
    ↓
Live Activity Stream & Progressive UI
```

### 1.2 User Flows & Journey

#### Primary Scenario (Golden Case)
1. **User input**: `"lên lịch trình 1 ngày ở Đà Nẵng có bánh mì và các đặc sản"`
2. **Routing & Semantic Understanding**:
   - Fast path determines query is travel-semantic → routes to LLM structured extractor.
   - Extracts `TravelGoal`: Da Nang, 1 day, `mustEatFoods=["bánh mì"]`, `localSpecialtiesRequired=true`.
3. **Coverage Requirements Derivation**:
   - `required_banh_mi` (Type: `FOOD`, minCount: 1, blocking: true, meal: `BREAKFAST`)
   - `local_specialties` (Type: `LOCAL_SPECIALTY`, minCount: 2, blocking: true, meal: `LUNCH`/`DINNER`)
   - `sightseeing` (Type: `ATTRACTION`, minCount: 2, blocking: false)
4. **Progress-Aware Activity Stream**:
   - Emits structured progress:
     - `✓ Đã hiểu yêu cầu: Đà Nẵng · 1 ngày · bánh mì · đặc sản`
     - `● Đang kiểm tra những gì còn thiếu...`
     - `✓ Cần thêm: • quán bánh mì • món đặc sản cho bữa trưa • điểm tham quan buổi chiều`
     - `● Đang tìm quán bánh mì...` (stable `activityId`, updates with found/accepted counts).
5. **Adaptive Research Loop**:
   - Searches internal places. Computes candidate eligibility via `CandidateEvaluator`.
   - If Da Nang DB has 0 bánh mì candidates:
     - Triggers external `web_search` for authentic Da Nang bánh mì.
     - Resolves external findings against `place-service`. Successful matches become canonical candidates; unresolved venues remain textual evidence only.
   - Evaluates evidence gain: if gain > 0, marks gap resolved; if attempts exceed threshold without gain, marks gap unresolved.
6. **Candidate Evaluation & Geographic Filtering**:
   - Filters candidates by `GeographicScope` (Admin locality Da Nang matched; Hội An candidates rejected).
   - Evaluates `FoodEvidence`: checks dish against provider menu, category, description, or verified reviews with confidence.
7. **Itinerary Synthesis & Validation**:
   - Assembles full-day chronological schedule with geographic clustering.
   - Calculates routes via real OSRM provider.
   - Validates against `CoverageRequirements`: sets `validityState = VALID`, `canRenderPreview = true`, `canCommit = true`.
   - Web UI displays `✓ GỢI Ý HỢP LỆ` with active `Tạo chuyến đi` button.

### 1.3 Scope Boundaries

- **In-Scope**:
  - Structured `TravelGoal` and `CoverageRequirement`s.
  - Typed `FoodEvidence` with status (`VERIFIED`, `LIKELY`, `UNKNOWN`, `CONFLICTING`) and source provenance.
  - `GeographicScope` prioritizing administrative boundaries (`admin_area`, `canonical_destination_id`) over radius fallback.
  - Adaptive loop tracking `attempt_count`, `last_action_signature`, `evidence_gain`, and explicit termination.
  - Model semantic strategy compilation into concrete code-crafted provider queries.
  - Separate `validityState` (`VALID`, `PARTIAL`, `BLOCKED`, `INVALID`), `canRenderPreview`, and `canCommit`.
  - Frontend UI badges reflecting canonical states.
  - Stable `activityId` updates in live activity stream.
  - Automated tests reproducing the Tiên Sa + 43 DANANG + Bài Chòi Hội An case, external fallback resolution, and model extraction fallback.
- **Out-of-Scope**:
  - Inventing coordinates, place IDs, prices, or route metrics.
  - Direct database queries to `place-service` or `trip-service`.

---

## 2. Architecture & Service Boundaries

### 2.1 Component Architecture

```text
ai-service
├── Fast Path Router (Trivial queries: cancel, confirm, trip lookup)
├── Semantic Extractor (LLM structured output + Graceful Fallback)
│    └── TravelGoal
├── Coverage Compiler
│    └── CoverageRequirements (FOOD, LOCAL_SPECIALTY, ATTRACTION, MEAL)
├── Evidence-Gap Engine
│    └── EvidenceGaps (tracks requirementId, attempts, status)
├── Adaptive Research Orchestrator
│    ├── Internal Place Client (search_places, recommend_places, get_place_details)
│    ├── External Fallback (Brave web_search)
│    └── Canonical Resolver (web finding → place-service search → candidate)
├── Candidate Evaluator
│    ├── GeographicScope (Administrative locality match > boundary > distance)
│    └── FoodEvidence Evaluator (Provenance + confidence, rejects UNKNOWN)
├── Whole-Day Itinerary Planner & OSRM Router
├── Canonical Validator (validityState, canRenderPreview, canCommit)
└── Live Activity Tracker (stable activityId, progress counters)
```

### 2.2 Invariants

1. **Model = Intelligence, Code = Guardrails**: Model decides semantic research strategy; code compiles query strings, enforces budgets, limits, and validation.
2. **Canonical Place Rule**: Unresolved web results may inform text responses but must NEVER enter `PLACE_LIST` artifacts or itinerary preview stops.
3. **No Blind String Matching for Food**: Dish satisfaction requires `VERIFIED` or high-confidence `LIKELY` provenance. `UNKNOWN` never satisfies a requirement.
4. **Administrative Geographic Truth**: A place in Hội An (Quảng Nam) cannot satisfy a Da Nang itinerary stop unless Hội An was explicitly allowed as an excursion.

---

## 3. Contracts & Data Models

### 3.1 GeographicScope & TravelGoal (`app/recommendation/goal_normalizer.py`)

```python
class GeographicScope(BaseModel):
    destination_name: str
    canonical_destination_id: str | None = None
    admin_area: str | None = None # e.g. "Đà Nẵng", "Thành phố Đà Nẵng"
    country_code: str = "VN"
    center_lat: float | None = None
    center_lng: float | None = None
    soft_radius_km: float = 25.0
    hard_radius_km: float = 35.0
    allowed_excursions: list[str] = Field(default_factory=list)
    strict_destination: bool = True

class TravelGoal(BaseModel):
    schemaVersion: int = 2
    destination: str
    geographicScope: GeographicScope
    durationDays: int = Field(1, ge=1, le=7)
    startDate: date | None = None
    endDate: date | None = None
    travelerCount: int | None = None
    travelerType: str | None = None
    budgetAmount: float | None = None
    budgetCurrency: str = "VND"
    pace: Literal["RELAXED", "BALANCED", "FULL"] = "BALANCED"
    mustVisitPlaces: list[str] = Field(default_factory=list)
    mustEatFoods: list[str] = Field(default_factory=list)
    requestedCuisine: list[str] = Field(default_factory=list)
    localSpecialtiesRequired: bool = False
    mealRequirements: list[str] = Field(default_factory=lambda: ["breakfast", "lunch", "dinner"])
    requestedExperiences: list[str] = Field(default_factory=list)
    exclusions: list[str] = Field(default_factory=list)
    preferredAreas: list[str] = Field(default_factory=list)
    routePreference: Literal["EFFICIENT", "FLEXIBLE"] = "EFFICIENT"
```

### 3.2 CoverageRequirements (`app/retrieval/coverage.py`)

```python
class CoverageType(str, Enum):
    FOOD = "FOOD"
    LOCAL_SPECIALTY = "LOCAL_SPECIALTY"
    ATTRACTION = "ATTRACTION"
    MEAL = "MEAL"
    ACTIVITY = "ACTIVITY"

class CoverageRequirement(BaseModel):
    id: str # e.g. "required_banh_mi", "local_specialty_lunch", "famous_sightseeing"
    type: CoverageType
    target: str # e.g. "bánh mì", "mì quảng", "sightseeing"
    mealSlot: Literal["BREAKFAST", "LUNCH", "DINNER", "SNACK", "ANY"] = "ANY"
    minCount: int = 1
    blocking: bool = True
    context: dict[str, Any] = Field(default_factory=dict)
```

### 3.3 FoodEvidence & CandidateEvaluation (`app/retrieval/candidate_evaluator.py`)

```python
class FoodEvidenceStatus(str, Enum):
    VERIFIED = "VERIFIED"
    LIKELY = "LIKELY"
    UNKNOWN = "UNKNOWN"
    CONFLICTING = "CONFLICTING"

class FoodEvidenceSource(str, Enum):
    PROVIDER_MENU = "PROVIDER_MENU"
    PROVIDER_CATEGORY = "PROVIDER_CATEGORY"
    OFFICIAL_DESCRIPTION = "OFFICIAL_DESCRIPTION"
    WEB_SOURCE = "WEB_SOURCE"
    REVIEW = "REVIEW"

class FoodEvidence(BaseModel):
    food: str
    status: FoodEvidenceStatus
    source_type: FoodEvidenceSource
    source_id: str | None = None
    fetched_at: datetime | None = None
    confidence: float | None = None
    excerpt: str | None = None

class CandidateEvaluation(BaseModel):
    canonical_place_id: str
    eligible: bool
    satisfies_requirement_ids: list[str] = Field(default_factory=list)
    rejection_reasons: list[str] = Field(default_factory=list)
    unknown_fields: list[str] = Field(default_factory=list)
    food_evidences: list[FoodEvidence] = Field(default_factory=list)
    semantic_score: float = 0.0
    geographic_score: float | None = None
    route_score: float | None = None
```

### 3.4 EvidenceGap & Research Loop State (`app/retrieval/evidence_gaps.py`)

```python
class EvidenceGap(BaseModel):
    id: str
    requirement_id: str
    type: str
    target: str
    dayPart: str | None = None
    blocking: bool = True
    attempt_count: int = 0
    status: Literal["OPEN", "RESOLVED", "UNRESOLVED"] = "OPEN"
    last_action_signature: str | None = None
    evidence_gain: int = 0
```

### 3.5 Itinerary Validity & Preview Contract (`app/planning.py`)

```python
class ValidityState(str, Enum):
    VALID = "VALID"
    PARTIAL = "PARTIAL"
    BLOCKED = "BLOCKED"
    INVALID = "INVALID"

# Itinerary Preview Data:
{
    "status": "PREVIEW_ONLY",
    "validityState": "VALID",
    "canRenderPreview": True,
    "canCommit": True,
    "scope": "FULL",
    "constraints": TravelConstraints,
    "days": [ ... ],
    "issues": [ ... ]
}
```

---

## 4. Implementation Tasks

### Phase 1: Semantic Core & Coverage Engine
- [x] Plan and specifications approved.
- [ ] Implement `GeographicScope` and `TravelGoal` in `app/recommendation/goal_normalizer.py`.
- [ ] Implement `derive_coverage_requirements(goal: TravelGoal) -> list[CoverageRequirement]` in `app/retrieval/coverage.py`.
- [ ] Implement `FoodEvidence` and `CandidateEvaluator` in `app/retrieval/candidate_evaluator.py`:
  - Administrative locality match > coordinate boundary > distance > excursion.
  - Provenance-backed food verification with confidence; negative reviews or unverified places marked `UNKNOWN`.
- [ ] Implement `detect_evidence_gaps(requirements: list[CoverageRequirement], evaluations: list[CandidateEvaluation]) -> list[EvidenceGap]`.

### Phase 2: Adaptive Research Loop & Safe External Fallback
- [ ] Implement fast path routing in `main.py` for trivial / confirmation / cancellation queries.
- [ ] Implement model semantic research action proposal: code compiles concrete queries (`bánh mì Đà Nẵng`).
- [ ] Implement evidence-gain loop in `main.py`:
  - Track `executed_signatures`, `attempt_count`, and `evidence_gain`.
  - Terminate on `NO_USEFUL_ACTION` or when all blocking gaps resolve or exceed attempt limits.
- [ ] Implement canonical external fallback:
  - Trigger `web_search` when internal candidates for a requirement are missing/insufficient.
  - Call `place-service` to resolve venue names into canonical IDs.
- [x] Implement `detect_evidence_gaps(requirements: list[CoverageRequirement], evaluations: list[CandidateEvaluation]) -> list[EvidenceGap]`.

### Phase 2: Administrative GeographicScope, Adaptive Research Loop & External Fallback
- [x] Implement administrative destination scope in `app/recommendation/goal_normalizer.py`:
  - `GeographicScope` with `admin_area`, `country_code`, `soft_radius_km`, `hard_radius_km`, `allowed_excursions`, `strict_destination`.
  - Da Nang strictly excludes Hoi An / Quang Nam / Dien Ban unless explicitly listed in `allowed_excursions`.
- [x] Implement adaptive research loop in `app/main.py`:
  - Fast-path deterministic routing (`is_trivial_fast_path`) for trivial commands ("ok", "hủy", "cảm ơn", "đồng ý tạo trip").
  - Semantic action proposal by model -> Code-compiled tool query.
  - Duplicate action detection (`executed_signatures`), attempt counts, explicit termination.
  - Evidence gain measurement (`measure_evidence_gain`).
  - Safe external fallback with canonical resolution: web search venue names resolved via `place-service`; unresolved venues remain textual citations only.

### Phase 3: Whole-Day Itinerary Planner & Separated Validity
- [x] Update `app/planning.py`:
  - Dynamic slot assignment with proximity clustering.
  - Compute `validityState` (`VALID`, `PARTIAL`, `BLOCKED`, `INVALID`), `canRenderPreview`, and `canCommit`.
  - Zero restaurants when food was requested produces `BLOCKED`/`PARTIAL`; when only sightseeing was requested, 0 restaurants does NOT block.

### Phase 4: Frontend UI Alignment & Progress-Aware Activity Stream
- [x] Update `AgentActivity` in `app/activities.py` and `apps/web/tripsense/src/features/ai-chat/types.ts`:
  - Support `requirementId` and `progress: { found, accepted, rejected }`.
  - Update activity in place using stable `activityId`.
- [x] Update `artifact-renderer.tsx` and `agent-activity-panel.tsx` in web:
  - `VALID` (`canCommit = true`): `"GỢI Ý HỢP LỆ"` (emerald) + active Create Trip button.
  - `PARTIAL`: `"GỢI Ý CHƯA ĐỦ BẰNG CHỨNG"` (amber).
  - `BLOCKED` / `INVALID`: `"CẦN THÊM THÔNG TIN"` / `"KHÔNG HỢP LỆ"` (rose).
  - Display found/accepted progress counters.

### Phase 5: Regression Tests & Verification
- [x] Add `tests/test_adaptive_travel_agent.py`:
  - Reproduction test: Tiên Sa (attraction) + 43 DANANG (unknown food) + Bài Chòi Hội An (outside scope).
  - External fallback test: 0 internal bánh mì, 3 web results, 2 canonical resolved, 1 unresolved (text-only).
  - Graceful extraction fallback test: model fails structured extraction -> preserves raw constraints, does not wipe food requirements.
  - Fast path routing test.
  - Separate validity states test.

---

## 5. Verification Commands

```powershell
# Backend pytest in docker
docker exec -e PYTHONPATH=/app ai-service pytest -q tests

# Web vitest, typecheck, eslint
cd apps/web/tripsense
npm run test -- --reporter=dot
npm exec -- tsc --noEmit
npx eslint "src/features/ai-chat/**/*.{ts,tsx}"
npm run build
```

---

## Human Approval Gate

`STATUS: APPROVED — IMPLEMENTING`

Plan revisions incorporating all 8 architectural requirements approved on 2026-09-21. Implementation proceeding.
