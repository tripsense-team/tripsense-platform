from dataclasses import dataclass
from enum import Enum

from ..models import ActionType


class ExecutionProfile(str, Enum):
    L0_DIRECT = "L0_DIRECT"
    L1_CONTEXTUAL = "L1_CONTEXTUAL"
    L2_GROUNDED_LOOKUP = "L2_GROUNDED_LOOKUP"
    L3_RECOMMEND = "L3_RECOMMEND"
    L4_PLAN = "L4_PLAN"
    L5_PROPOSE_ACTION = "L5_PROPOSE_ACTION"


@dataclass(frozen=True)
class ExecutionBudget:
    profile: ExecutionProfile
    clarification_attempts: int
    retrieval_rounds: int
    external_refresh_rounds: int
    tool_calls: int
    validation_attempts: int
    repair_attempts: int
    input_tokens: int
    output_tokens: int
    wall_seconds: int


_BUDGETS = {
    ExecutionProfile.L0_DIRECT: ExecutionBudget(ExecutionProfile.L0_DIRECT, 0, 0, 0, 0, 0, 0, 2_000, 500, 240),
    ExecutionProfile.L1_CONTEXTUAL: ExecutionBudget(ExecutionProfile.L1_CONTEXTUAL, 1, 1, 0, 1, 1, 0, 4_000, 800, 240),
    ExecutionProfile.L2_GROUNDED_LOOKUP: ExecutionBudget(ExecutionProfile.L2_GROUNDED_LOOKUP, 1, 2, 1, 3, 1, 0, 6_000, 1_000, 300),
    ExecutionProfile.L3_RECOMMEND: ExecutionBudget(ExecutionProfile.L3_RECOMMEND, 1, 2, 1, 4, 1, 1, 8_000, 1_500, 300),
    ExecutionProfile.L4_PLAN: ExecutionBudget(ExecutionProfile.L4_PLAN, 1, 2, 1, 8, 2, 1, 12_000, 2_000, 300),
    ExecutionProfile.L5_PROPOSE_ACTION: ExecutionBudget(ExecutionProfile.L5_PROPOSE_ACTION, 0, 1, 0, 3, 1, 0, 4_000, 800, 240),
}


def budget_for_action(action: ActionType) -> ExecutionBudget:
    profile = {
        ActionType.GENERAL_CHAT: ExecutionProfile.L0_DIRECT,
        ActionType.TRIP_QA: ExecutionProfile.L1_CONTEXTUAL,
        ActionType.PLACE_SEARCH: ExecutionProfile.L2_GROUNDED_LOOKUP,
        ActionType.PLACE_RECOMMENDATION: ExecutionProfile.L3_RECOMMEND,
        ActionType.PLAN_ITINERARY: ExecutionProfile.L4_PLAN,
        ActionType.MODIFY_ITINERARY: ExecutionProfile.L4_PLAN,
        ActionType.REFINE_PLAN: ExecutionProfile.L4_PLAN,
        ActionType.CURRENT_RESEARCH: ExecutionProfile.L2_GROUNDED_LOOKUP,
    }[action]
    return _BUDGETS[profile]
