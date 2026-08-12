from app.graph.state import ItineraryState
from app.graph.itinerary_graph import itinerary_graph


def generate_itinerary(message: str):

    initial_state : ItineraryState = {
        "message": message,
        "destination": None,
        "duration": None,
        "weather": None,
        "itinerary": None
    }

    result = itinerary_graph.invoke(initial_state)
    return result["itinerary"]