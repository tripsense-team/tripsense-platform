from typing import TypedDict

# state của workflow AI
# state giữ toàn bộ dữ liệu để truyền giữa các node
class ItineraryState(TypedDict):
    user_message: str
    destination: str | None
    duration: int | None
    weather: str | None
    places: list[str] | None
    itinerary: str | None
    
