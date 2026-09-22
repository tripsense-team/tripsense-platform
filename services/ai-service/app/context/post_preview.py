"""Bounded, deterministic follow-up for a provisional itinerary budget."""

import re
from typing import Any

KIND = "POST_PREVIEW_BUDGET"
KEYS = ("TRANSPORT_INCLUDED", "TRAVELER_COUNT", "BUDGET_SCOPE", "LODGING_TYPE", "DEPARTURE_POINT")


def extract_answers(text: str, requested_keys: list[str]) -> dict[str, Any]:
    value = text.casefold().strip()
    answers: dict[str, Any] = {}
    if "TRANSPORT_INCLUDED" in requested_keys:
        if re.search(r"(?:kh[oô]ng|chưa)\s+(?:c[oó]\s+)?(?:t[ií]nh|bao\s+g[oồ]m).*?(?:v[eé]|m[aá]y\s+bay|xe)|(?:exclude|not include).*?(?:flight|transport|ticket)", value):
            answers["TRANSPORT_INCLUDED"] = False
        elif re.search(r"(?:c[oó]\s+)?(?:t[ií]nh|bao\s+g[oồ]m).*?(?:v[eé]|m[aá]y\s+bay|xe)|include.*?(?:flight|transport|ticket)", value):
            answers["TRANSPORT_INCLUDED"] = True
        elif value in {"có", "yes", "có tính", "bao gồm"}:
            answers["TRANSPORT_INCLUDED"] = True
        elif value in {"không", "no", "không tính", "chưa tính"}:
            answers["TRANSPORT_INCLUDED"] = False
    if "TRAVELER_COUNT" in requested_keys:
        match = re.search(r"\b([1-9]|[1-2]\d)\s*(?:người|khách|people|persons?|travelers?)\b", value)
        if match:
            answers["TRAVELER_COUNT"] = int(match.group(1))
    if "BUDGET_SCOPE" in requested_keys:
        if re.search(r"(?:mỗi|một)\s+người|/\s*người|per\s+person|each\s+person", value):
            answers["BUDGET_SCOPE"] = "PER_PERSON"
        elif re.search(r"cả\s+(?:nhóm|đoàn)|tổng\s+(?:cộng|cho|ngân\s+sách)|cho\s+(?:cả\s+)?\d+\s+người|whole\s+(?:group|party)|total\s+for", value):
            answers["BUDGET_SCOPE"] = "GROUP"
    if "LODGING_TYPE" in requested_keys:
        if re.search(r"phòng\s+riêng|private\s+room", value):
            answers["LODGING_TYPE"] = "PRIVATE_ROOM"
        elif re.search(r"hostel|dorm|homestay|phòng\s+tập\s+thể", value):
            answers["LODGING_TYPE"] = "HOSTEL_HOMESTAY"
    if "DEPARTURE_POINT" in requested_keys:
        match = re.search(r"(?:xuất\s+phát\s+(?:từ|ở)|đi\s+từ|from)\s+([^,.;\n]{2,80})", text, re.IGNORECASE)
        if match:
            answers["DEPARTURE_POINT"] = match.group(1).strip()
        elif requested_keys == ["DEPARTURE_POINT"] and 2 <= len(text.strip()) <= 80 \
                and re.fullmatch(r"[\wÀ-ỹ .'-]+", text.strip()) \
                and text.casefold().strip() not in {"có", "không", "yes", "no"}:
            answers["DEPARTURE_POINT"] = text.strip()
    return answers


def required_keys(constraints: dict[str, Any], facts: dict[str, Any]) -> list[str]:
    if constraints.get("hardBudgetAmount") is None:
        return []
    missing = [key for key in KEYS[:4] if facts.get(key) is None]
    if facts.get("TRANSPORT_INCLUDED") is True and not facts.get("DEPARTURE_POINT"):
        missing.append("DEPARTURE_POINT")
    return missing


def question_block(missing: list[str], amount: float, currency: str = "VND") -> str:
    if not missing:
        return ""
    label = f"{amount:,.0f}".replace(",", ".") + f" {currency}"
    questions: list[str] = []
    if "TRANSPORT_INCLUDED" in missing:
        questions.append(f"**{label} này có tính vé xe/máy bay đến điểm đến không?**")
    details = []
    if "TRAVELER_COUNT" in missing:
        details.append("bạn đi mấy người")
    if "BUDGET_SCOPE" in missing:
        details.append(f"{label} là cho cả nhóm hay mỗi người")
    if "LODGING_TYPE" in missing:
        details.append("bạn muốn phòng riêng hay hostel/homestay")
    if details:
        questions.append("**" + ", ".join(details).capitalize() + "?**")
    if "DEPARTURE_POINT" in missing and len(questions) < 2:
        questions.append("**Bạn xuất phát từ đâu để mình tính phần vé đường dài?**")
    heading = "## Mình cần bạn trả lời để chốt lịch và canh ngân sách"
    lines = [f"{index}. {question}" for index, question in enumerate(questions[:2], 1)]
    return "\n\n" + heading + "\n" + "\n".join(lines) + "\n\nBản trên là xem trước; chi phí chưa có giá xác minh vẫn là chưa rõ."
