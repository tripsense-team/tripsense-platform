from langgraph.graph import StateGraph, START, END
from app.graph.state import ItineraryState
from app.tools.weather_tool import get_weather
from app.tools.location_tool import search_places
from app.services.llm_service import generate_text


# node1 
   # nhận state (request từ user)
        # ->  xử lí 
            # -> update state 
                # -> return state
def analyze_request(state: ItineraryState):
    return {
        "destination":"Đà Nẵng",
        "duration": 3
    }

def weather_node(state: ItineraryState):
    weather = get_weather(
        state["destination"]
    )
    return {
        "weather": weather
    }

def location_node(state: ItineraryState):
    places = search_places(
        state["destination"]
    )
    return {
        "places": places
    }

def generate_itinerary(state: ItineraryState):
    prompt = f"""
    Bạn là chuyên gia lập kế hoạch du lịch.

    Hãy tạo lịch trình:
    
    Điểm đến:
    {state['destination']} 

    Số ngày:
    {state['duration']}

    Thời tiết:
    {state['weather']}

    Địa điểm:
    {state['places']}
    """
    itinerary = generate_text(prompt)

    return {
        "itinerary": itinerary
    }



builder = StateGraph(ItineraryState)

# đăng ký node vào graph
builder.add_node("analyze_request", analyze_request)
builder.add_node("weather", weather_node)
builder.add_node("location", location_node)
builder.add_node("generate_itinerary", generate_itinerary)

# thứ tự chạy các node trong graph
builder.add_edge(START, "analyze_request")
builder.add_edge("analyze_request", "weather")
builder.add_edge("weather", "location")
builder.add_edge("location", "generate_itinerary")
builder.add_edge("generate_itinerary", END)

itinerary_graph = builder.compile()


