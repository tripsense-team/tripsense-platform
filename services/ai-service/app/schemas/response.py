from pydantic import BaseModel

class ChatResponse(BaseModel):
    user_message: str
    response: str