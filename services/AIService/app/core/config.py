# module os để truy cập biến môi trường, file system, hệ điều hành
import os

# import function đọc file .env
from dotenv import load_dotenv


# tìm file .env để load các biến môi trường
load_dotenv()

class Settings:

    # lấy giá trị openai_api_key
    OPENAI_API_KEY: str = os.getenv(
        "OPENAI_API_KEY"
    )
    
    OPENAI_MODEL: str = os.getenv(
        "OPENAI_MODEL",
        "gpt-5-gemini"
    )

# tạo object settings dùng chung
# các file khác cần thì import from app.core.config import settings
settings = Settings()