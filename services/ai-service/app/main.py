# khởi tạo FastAPI application
# đăng kí các API router

# lấy class FastAPI từ thư viện fastapi
from fastapi import FastAPI
from app.api.chat import router as chat_router

app = FastAPI(
    title="TripSense AI Service",
    version="1.0.0"
)

app.include_router(
    chat_router,
    prefix="/api/v1"
)

@app.get("/health")
def health_check():
    return {
        "status": "UP",
        "service": "ai-service"
    }
