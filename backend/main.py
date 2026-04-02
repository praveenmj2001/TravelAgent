from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv
import anthropic
import os

load_dotenv()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_URL],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ROAD_TRIP_SYSTEM_PROMPT = """You are a road trip planning assistant. You help users plan amazing road trips — suggesting routes, stops, attractions, restaurants, rest areas, estimated drive times, and travel tips.

Keep your answers focused on road trips only. If a user asks about flights, cruises, or non-road-trip travel, politely redirect them to road trip options instead.

Be friendly, enthusiastic, and practical. Format longer responses with clear sections when helpful."""


class TokenRequest(BaseModel):
    token: str


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatRequest(BaseModel):
    messages: list[ChatMessage]


@app.post("/auth/google")
async def verify_google_token(body: TokenRequest):
    try:
        user_info = id_token.verify_oauth2_token(
            body.token,
            google_requests.Request(),
            GOOGLE_CLIENT_ID,
        )
        return {
            "id": user_info["sub"],
            "email": user_info["email"],
            "name": user_info.get("name"),
            "picture": user_info.get("picture"),
        }
    except ValueError as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")


@app.post("/chat")
async def chat(body: ChatRequest):
    if not ANTHROPIC_API_KEY:
        raise HTTPException(status_code=500, detail="Anthropic API key not configured")
    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=1024,
            system=ROAD_TRIP_SYSTEM_PROMPT,
            messages=[{"role": m.role, "content": m.content} for m in body.messages],
        )
        return {"response": message.content[0].text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
async def health():
    return {"status": "ok"}
