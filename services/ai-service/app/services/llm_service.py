from app.core.config import settings
from langchain_openai import ChatOpenAI

llm = ChatOpenAI(
    model=settings.OPENAI_MODEL,
    api_key=settings.OPENAI_API_KEY
)


def generate_text(prompt: str) -> str:
    response = llm.invoke(prompt)
    return response.content
