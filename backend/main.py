from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv
from database import engine, get_db
from models import Base, Conversation, Message
from datetime import datetime, timezone
import anthropic
import os

load_dotenv()

Base.metadata.create_all(bind=engine)

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


# ── Pydantic schemas ────────────────────────────────────────────────────────

class TokenRequest(BaseModel):
    token: str


class CreateConversationRequest(BaseModel):
    user_email: str


class SendMessageRequest(BaseModel):
    content: str
    user_email: str


# ── Helpers ─────────────────────────────────────────────────────────────────

def call_claude(messages: list[dict]) -> str:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=1024,
        system=ROAD_TRIP_SYSTEM_PROMPT,
        messages=messages,
    )
    return response.content[0].text


def generate_title(user_message: str, ai_response: str) -> str:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=20,
        messages=[{
            "role": "user",
            "content": (
                "Give this road trip conversation a short title (3-5 words). "
                "Reply with ONLY the title, no punctuation, no quotes.\n\n"
                f"User: {user_message[:200]}\nAssistant: {ai_response[:200]}"
            ),
        }],
    )
    return response.content[0].text.strip()


# ── Auth ─────────────────────────────────────────────────────────────────────

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


# ── Conversations ─────────────────────────────────────────────────────────────

@app.post("/conversations")
def create_conversation(body: CreateConversationRequest, db: Session = Depends(get_db)):
    conv = Conversation(user_email=body.user_email)
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return {"id": conv.id, "title": conv.title, "created_at": conv.created_at}


@app.get("/conversations")
def list_conversations(user_email: str, db: Session = Depends(get_db)):
    convs = (
        db.query(Conversation)
        .filter(Conversation.user_email == user_email)
        .order_by(Conversation.updated_at.desc())
        .all()
    )
    return [{"id": c.id, "title": c.title, "updated_at": c.updated_at} for c in convs]


@app.get("/conversations/{conversation_id}")
def get_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {
        "id": conv.id,
        "title": conv.title,
        "messages": [{"role": m.role, "content": m.content} for m in conv.messages],
    }


@app.post("/conversations/{conversation_id}/messages")
def send_message(conversation_id: str, body: SendMessageRequest, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message
    user_msg = Message(conversation_id=conversation_id, role="user", content=body.content)
    db.add(user_msg)
    db.commit()

    # Build message history for Claude
    all_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in all_messages]

    # Call Claude
    ai_text = call_claude(history)

    # Save AI response
    ai_msg = Message(conversation_id=conversation_id, role="assistant", content=ai_text)
    db.add(ai_msg)

    # Generate title after first exchange
    if len(all_messages) == 1:
        conv.title = generate_title(body.content, ai_text)

    conv.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"response": ai_text, "title": conv.title}


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"ok": True}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}
