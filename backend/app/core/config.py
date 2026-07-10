from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "ASTRA"
    API_V1_STR: str = "/api/v1"
    DEMO_MODE: bool = False
    
    # Database
    DATABASE_URL: str = "sqlite:///./astra.db"
    
    # JWT
    SECRET_KEY: str = "supersecretkey123"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    JWT_ISSUER: str = "astra-auth-service"
    JWT_AUDIENCE: str = "astra-clients"
    
    # LLM
    GROQ_API_KEY: str = ""
    
    # Whisper
    WHISPER_MODEL: str = "tiny"
    
    # Frontend
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Model Paths
    BERT_MODEL_DIR: str = "app/models/minilm"
    BERT_MODEL_PATH: str = "app/models/minilm/pytorch_model.bin"
    LABEL_ENCODER_PATH: str = "app/models/minilm/label_encoder.pkl"
    
    class Config:
        env_file = ".env"

settings = Settings()
