from enum import Enum
from typing import Any, Literal
from pydantic import BaseModel, Field

from ..recommendation.goal_normalizer import TravelGoal


class CoverageType(str, Enum):
    FOOD = "FOOD"
    LOCAL_SPECIALTY = "LOCAL_SPECIALTY"
    ATTRACTION = "ATTRACTION"
    MEAL = "MEAL"
    ACTIVITY = "ACTIVITY"


class CoverageRequirement(BaseModel):
    id: str
    type: CoverageType
    target: str
    mealSlot: Literal["BREAKFAST", "LUNCH", "DINNER", "SNACK", "ANY"] = "ANY"
    minCount: int = 1
    blocking: bool = True
    context: dict[str, Any] = Field(default_factory=dict)


def derive_coverage_requirements(goal: TravelGoal) -> list[CoverageRequirement]:
    """Derives structured, testable coverage requirements from a TravelGoal.

    This forms the authoritative contract between user intent and candidate retrieval.
    """
    requirements: list[CoverageRequirement] = []

    # 1. Must-eat foods (hard requirements)
    for index, food in enumerate(goal.mustEatFoods):
        food_norm = food.strip().casefold()
        # Suggest logical default meal slot based on Vietnamese culinary culture
        slot: Literal["BREAKFAST", "LUNCH", "DINNER", "SNACK", "ANY"] = "ANY"
        if food_norm in {"bánh mì", "phở", "xôi"}:
            slot = "BREAKFAST"
        elif food_norm in {"mì quảng", "bún chả cá", "bún bò", "bánh tráng cuốn thịt heo"}:
            slot = "LUNCH"
        elif food_norm in {"hải sản", "bánh xèo", "nem lụi", "lẩu"}:
            slot = "DINNER"
        elif food_norm in {"chè", "cà phê", "trà sữa"}:
            slot = "SNACK"

        clean_slug = food_norm.replace(" ", "_")
        requirements.append(
            CoverageRequirement(
                id=f"required_food_{clean_slug}_{index}",
                type=CoverageType.FOOD,
                target=food.strip(),
                mealSlot=slot,
                minCount=1,
                blocking=True,
                context={"food": food.strip()},
            )
        )

    # 2. Local specialties requirement
    if goal.localSpecialtiesRequired:
        requirements.append(
            CoverageRequirement(
                id="local_food_diversity",
                type=CoverageType.LOCAL_SPECIALTY,
                target=f"Đặc sản {goal.destination}",
                mealSlot="LUNCH",
                minCount=min(2, max(1, goal.durationDays * 2)),
                blocking=True,
                context={"destination": goal.destination},
            )
        )

    # 3. Meal slots (if meals requested or food requested)
    if goal.mealRequirements:
        for day in range(1, goal.durationDays + 1):
            if "lunch" in goal.mealRequirements:
                # If no food requirement explicitly claims lunch, add general lunch coverage
                has_lunch_food = any(r.type == CoverageType.FOOD and r.mealSlot == "LUNCH" for r in requirements)
                if not has_lunch_food and not goal.localSpecialtiesRequired:
                    requirements.append(
                        CoverageRequirement(
                            id=f"lunch_day_{day}",
                            type=CoverageType.MEAL,
                            target="Quán ăn trưa",
                            mealSlot="LUNCH",
                            minCount=1,
                            blocking=True,
                            context={"dayNumber": day},
                        )
                    )
            if "dinner" in goal.mealRequirements:
                has_dinner_food = any(r.type == CoverageType.FOOD and r.mealSlot == "DINNER" for r in requirements)
                if not has_dinner_food:
                    requirements.append(
                        CoverageRequirement(
                            id=f"dinner_day_{day}",
                            type=CoverageType.MEAL,
                            target="Quán ăn tối / Hải sản",
                            mealSlot="DINNER",
                            minCount=1,
                            blocking=True,
                            context={"dayNumber": day},
                        )
                    )

    # 4. Sightseeing / Attractions
    target_attractions = max(2, goal.durationDays * 2)
    requirements.append(
        CoverageRequirement(
            id="sightseeing_coverage",
            type=CoverageType.ATTRACTION,
            target=f"Địa điểm tham quan nổi tiếng {goal.destination}",
            mealSlot="ANY",
            minCount=target_attractions,
            blocking=bool(goal.requestedExperiences or not goal.mustEatFoods),
            context={"destination": goal.destination},
        )
    )

    # 5. Must-visit places
    for index, place in enumerate(goal.mustVisitPlaces):
        clean_slug = place.strip().casefold().replace(" ", "_")
        requirements.append(
            CoverageRequirement(
                id=f"must_visit_{clean_slug}_{index}",
                type=CoverageType.ACTIVITY,
                target=place.strip(),
                mealSlot="ANY",
                minCount=1,
                blocking=True,
                context={"placeName": place.strip()},
            )
        )

    return requirements
