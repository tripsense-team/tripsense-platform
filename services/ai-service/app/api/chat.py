from fastapi import APIRouter
from app.schemas.request import ChatRequest
from app.schemas.response import ChatResponse
from app.services.itinerary_service import generate_itinerary

router = APIRouter()

@router.post("/chat")
def chat(request: ChatRequest) -> ChatResponse:
    result = generate_itinerary(request.message)

    return ChatResponse(
        user_message=request.message,
        response=result
    )
