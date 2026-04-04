from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv
from database import engine, get_db, SessionLocal
from models import Base, Conversation, Message, SavedTrip
from datetime import datetime, timezone
import anthropic
import json
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

Be friendly, enthusiastic, and practical. Format longer responses with clear sections when helpful.

IMPORTANT: Whenever your response includes specific geographic locations (cities, landmarks, parks, viewpoints, stops along a route), append a JSON map data block at the very end of your response in this exact format (no extra text after it):

ROADAI_MAP:[{"name":"Location Name","lat":37.7749,"lng":-122.4194,"type":"stop"},...]

Use type "start" for the origin, "end" for the destination, and "stop" for everything in between. Only include this block when you have specific lat/lng coordinates you are confident about. Omit it if the response is general advice without specific locations."""


# ── Pydantic schemas ────────────────────────────────────────────────────────

class TokenRequest(BaseModel):
    token: str


class CreateConversationRequest(BaseModel):
    user_email: str


class SendMessageRequest(BaseModel):
    content: str
    user_email: str


class SaveTripRequest(BaseModel):
    user_email: str
    conversation_id: str | None = None
    title: str
    content: str


# ── Helpers ─────────────────────────────────────────────────────────────────

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


@app.post("/conversations/{conversation_id}/messages/stream")
async def send_message_stream(conversation_id: str, body: SendMessageRequest, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Save user message and read history before returning StreamingResponse
    user_msg = Message(conversation_id=conversation_id, role="user", content=body.content)
    db.add(user_msg)
    db.commit()

    all_messages = (
        db.query(Message)
        .filter(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
        .all()
    )
    history = [{"role": m.role, "content": m.content} for m in all_messages]
    is_first_exchange = len(all_messages) == 1
    current_title = conv.title

    async def generate():
        # Use a fresh session — the Depends session may close before this generator finishes
        session = SessionLocal()
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            full_text = ""

            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=2048,
                system=ROAD_TRIP_SYSTEM_PROMPT,
                messages=history,
            ) as stream:
                for text_chunk in stream.text_stream:
                    full_text += text_chunk
                    yield f"data: {json.dumps({'type': 'chunk', 'text': text_chunk})}\n\n"

            # Persist AI response
            ai_msg = Message(conversation_id=conversation_id, role="assistant", content=full_text)
            session.add(ai_msg)

            new_title = current_title
            if is_first_exchange:
                new_title = generate_title(body.content, full_text)
                session.query(Conversation).filter(Conversation.id == conversation_id).update(
                    {"title": new_title, "updated_at": datetime.now(timezone.utc)}
                )
            else:
                session.query(Conversation).filter(Conversation.id == conversation_id).update(
                    {"updated_at": datetime.now(timezone.utc)}
                )

            session.commit()
            yield f"data: {json.dumps({'type': 'done', 'title': new_title})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"
        finally:
            session.close()

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.delete("/conversations/{conversation_id}")
def delete_conversation(conversation_id: str, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    db.delete(conv)
    db.commit()
    return {"ok": True}


# ── Saved Trips ───────────────────────────────────────────────────────────────

@app.post("/saved-trips")
def save_trip(body: SaveTripRequest, db: Session = Depends(get_db)):
    trip = SavedTrip(
        user_email=body.user_email,
        conversation_id=body.conversation_id,
        title=body.title,
        content=body.content,
    )
    db.add(trip)
    db.commit()
    db.refresh(trip)
    return {"id": trip.id, "title": trip.title, "created_at": trip.created_at}


@app.get("/saved-trips")
def list_saved_trips(user_email: str, db: Session = Depends(get_db)):
    trips = (
        db.query(SavedTrip)
        .filter(SavedTrip.user_email == user_email)
        .order_by(SavedTrip.created_at.desc())
        .all()
    )
    return [{"id": t.id, "title": t.title, "content": t.content, "conversation_id": t.conversation_id, "created_at": t.created_at} for t in trips]


@app.delete("/saved-trips/{trip_id}")
def delete_saved_trip(trip_id: str, db: Session = Depends(get_db)):
    trip = db.query(SavedTrip).filter(SavedTrip.id == trip_id).first()
    if not trip:
        raise HTTPException(status_code=404, detail="Trip not found")
    db.delete(trip)
    db.commit()
    return {"ok": True}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}
