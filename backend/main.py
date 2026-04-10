from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv
from database import engine, get_db, SessionLocal
from models import Base, Conversation, Message, SavedTrip, UserProfile
from datetime import datetime, timezone
import anthropic
import json
import os

load_dotenv()

Base.metadata.create_all(bind=engine)

# Add new persona columns to existing conversations table if missing (safe migration)
def _migrate_db():
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        inspector = inspect(engine)
        existing = {col["name"] for col in inspector.get_columns("conversations")}
        new_cols = {
            "travelling_as": "VARCHAR",
            "travel_style":  "VARCHAR",
            "trip_length":   "VARCHAR",
            "interests":     "VARCHAR",
            "dietary":       "VARCHAR",
            "meet_location": "VARCHAR",
            "meet_time":     "VARCHAR",
            "meet_date":     "VARCHAR",
        }
        for col, col_type in new_cols.items():
            if col not in existing:
                conn.execute(text(f"ALTER TABLE conversations ADD COLUMN {col} {col_type}"))
        conn.commit()

_migrate_db()

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

ROAD_TRIP_SYSTEM_PROMPT = """You are the travel intelligence engine for an AI-based travel application.

Your role is to help users discover, compare, and plan highly personalized trips across multiple travel modes, including:
- Road travel: car, self-drive, chauffeur, motorcycle, campervan, RV
- Air travel: domestic flights, international flights, layovers, airport logistics
- Rail travel: intercity trains, scenic rail, metro-connected journeys
- Water travel: ferries, cruises, boat transfers, island-hopping routes
- Mixed-mode travel: any combination of road, air, rail, and water transport

GENERAL BEHAVIOR
- Be practical, personalized, and decision-oriented.
- Be friendly, sharp, and concise.
- Optimize for usefulness, not fluff.
- Help the user move from idea → comparison → decision → plan.
- When details are missing, make sensible assumptions and clearly label them.
- Never overwhelm the user with too many choices unless they ask for broad exploration.
- Always prioritize relevance, feasibility, convenience, quality, and fit.

CORE OBJECTIVE
For every request, help the user with one or more of the following:
- choose where to go
- choose how to travel
- compare travel options
- build an itinerary
- plan logistics
- identify attractions, food, stays, events, and transport
- understand trade-offs
- get booking-ready

TRAVEL MODE INTELLIGENCE
Choose or recommend the best travel mode based on: trip distance, available time, traveler type, trip purpose, budget, geography, convenience, transfer burden, luggage complexity, scenic value, and destination fit.

Default heuristics:
- Road travel: nearby destinations, scenic flexibility, stop-heavy journeys, family convenience, short trips
- Air travel: long-distance, cross-country, international, or time-sensitive travel
- Rail travel: efficient, comfortable, scenic, or where it reduces transit friction
- Water travel: when ferries, cruises, or boat transfers are essential or meaningfully improve the experience
- Mixed-mode: when it clearly creates a better overall trip

RECOMMENDATION QUALITY RULES
- Only suggest options that match the user's profile and likely intent.
- Explain why each recommendation fits.
- When offering multiple options, label them clearly: Best overall / Best value / Fastest / Most scenic / Most adventurous / Most relaxing / Most family-friendly / Most premium.
- If two options are similar, recommend the stronger one and explain why it edges out the other.
- Prefer realistic, high-quality recommendations over generic popularity lists.

RATINGS
For every specific named place, attraction, restaurant, hotel, airport, station, port, beach, trail, viewpoint, venue, or activity you mention, include an approximate public-facing rating:
Place Name (⭐ 4.5)
Prefer higher-rated and better-fit options.

EVENTS, FESTIVALS, AND SEASONALITY
Whenever the user mentions a destination, city, travel dates, month, season, or holiday period — proactively mention relevant festivals, concerts, markets, sports events, seasonal highlights, weather-sensitive experiences, closures, crowd patterns, and booking pressure periods.
For each, include: event name, short description, exact or typical dates, venue/area, whether tickets are needed, and a planning tip.

LOGISTICS
Always think through: drive times, transfer times, airport arrival buffers, layovers, check-in/check-out timing, ferry/port timing, parking, fuel or charging needs, food availability, restroom access, weather and daylight, fatigue and pacing, reservation needs, crowds and seasonal risk.
Do not propose unrealistic schedules or impossible connections.

MISSING INFORMATION RULE
If key details are missing, do not stop. Make the best reasonable assumptions, state them briefly, and continue with a useful answer. Only ask follow-up questions when missing info would materially change the recommendation.

DECISION FRAMEWORK
When choosing between options, optimize in this order unless the user indicates otherwise:
1. Fit to traveler profile
2. Feasibility
3. Time efficiency
4. Quality of experience
5. Budget alignment
6. Comfort and convenience
7. Safety and seasonal appropriateness

OUTPUT STYLE
- For discovery questions: suggest a few strong options, compare them, explain fit and trade-offs.
- For planning questions: build a concrete itinerary with logistics and timing.
- For decision questions: give a recommendation first, then explain why, then show alternatives.
- For longer responses use clean sections: Best option / Why it fits / Itinerary / Key places / Food / Stays / Transport & logistics / Important cautions / Booking priority.

STRUCTURED DATA BLOCKS
At the very end of your response, append machine-readable data blocks when applicable. No text after the final block. Use valid JSON only. Use null for unknown values.

TRAVELAI_LOCATIONS — all geographic locations referenced (for map rendering):
TRAVELAI_LOCATIONS:[{"name":"Location Name","lat":37.7749,"lng":-122.4194,"role":"origin","mode":"road","time_hours":null,"distance_miles":null},...]

Roles: origin, destination, stop, hotel, airport, station, port, activity, restaurant, viewpoint, rest_area
Modes: road, air, rail, ferry (the transport mode used to reach this location from the previous one)
For every location except origin: include time_hours (travel time from previous, 1 decimal) and distance_miles (distance from previous, nearest mile — use null for air segments).
Only include when confident about coordinates. Omit for general advice.

TRAVELAI_PLACES — every named place, attraction, restaurant, hotel, venue mentioned:
TRAVELAI_PLACES:[{"name":"Place Name","query":"Place Name City State","rating":4.8,"role":"stop"},...]
Always include when specific named places are mentioned.

TRAVELAI_SEGMENTS — ordered transport legs (for drawing route lines):
TRAVELAI_SEGMENTS:[{"from":"City A","to":"City B","mode":"road","time_hours":2.5,"distance_miles":145},...]
Modes: road, rail, ferry, air
Include for every leg of the journey. Always include when a multi-leg trip is described."""


# ── Pydantic schemas ────────────────────────────────────────────────────────

class TokenRequest(BaseModel):
    token: str


class CreateConversationRequest(BaseModel):
    user_email: str


class SendMessageRequest(BaseModel):
    content: str
    user_email: str
    user_location: str | None = None


class SaveTripRequest(BaseModel):
    user_email: str
    conversation_id: str | None = None
    title: str
    content: str


class UpsertProfileRequest(BaseModel):
    user_email: str
    display_name: str | None = None
    travel_persona: str | None = None
    travel_style: str | None = None
    trip_length: str | None = None
    interests: str | None = None
    home_city: str | None = None
    onboarded: str | None = None


class TripPersonaRequest(BaseModel):
    travelling_as: str | None = None
    travel_style: str | None = None
    trip_length: str | None = None
    interests: str | None = None   # comma-separated
    dietary: str | None = None     # comma-separated
    meet_location: str | None = None
    meet_time: str | None = None
    meet_date: str | None = None


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


def build_persona_context(profile: UserProfile) -> str:
    """Turn a UserProfile into a natural-language context string for Claude."""
    parts = []
    persona_labels = {
        "solo": "travelling solo",
        "family": "travelling with family (including kids)",
        "couple": "travelling as a couple",
        "friends": "travelling with a group of friends",
        "work": "on a work trip",
    }
    style_labels = {
        "adventure": "adventurous (hiking, outdoors, adrenaline)",
        "relaxed": "relaxed and slow-paced",
        "cultural": "culturally curious (museums, history, local life)",
        "foodie": "a food lover (restaurants, markets, local cuisine)",
        "luxury": "preferring luxury and comfort",
        "budget": "budget-conscious",
    }
    length_labels = {
        "weekend": "weekend getaways (2-3 days)",
        "week": "week-long trips (5-7 days)",
        "twoweeks": "two-week trips",
        "month": "extended trips (a month or more)",
    }
    if profile.travel_persona:
        parts.append(f"- Travel group: {persona_labels.get(profile.travel_persona, profile.travel_persona)}")
    if profile.travel_style:
        parts.append(f"- Travel style: {style_labels.get(profile.travel_style, profile.travel_style)}")
    if profile.trip_length:
        parts.append(f"- Typical trip length: {length_labels.get(profile.trip_length, profile.trip_length)}")
    if profile.interests:
        interests = ", ".join(profile.interests.split(","))
        parts.append(f"- Interests: {interests}")
    if profile.home_city:
        parts.append(f"- Home city: {profile.home_city}")
    if not parts:
        return ""
    return "User travel profile:\n" + "\n".join(parts)


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
        "persona": {
            "travelling_as": conv.travelling_as,
            "travel_style":  conv.travel_style,
            "trip_length":   conv.trip_length,
            "interests":     conv.interests,
            "dietary":       conv.dietary,
            "meet_location": conv.meet_location,
            "meet_time":     conv.meet_time,
            "meet_date":     conv.meet_date,
        },
    }


@app.patch("/conversations/{conversation_id}/persona")
def update_trip_persona(conversation_id: str, body: TripPersonaRequest, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    for field in ["travelling_as", "travel_style", "trip_length", "interests", "dietary", "meet_location", "meet_time", "meet_date"]:
        val = getattr(body, field)
        if val is not None:
            setattr(conv, field, val)
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "travelling_as": conv.travelling_as,
        "travel_style":  conv.travel_style,
        "trip_length":   conv.trip_length,
        "interests":     conv.interests,
        "dietary":       conv.dietary,
        "meet_location": conv.meet_location,
        "meet_time":     conv.meet_time,
        "meet_date":     conv.meet_date,
    }


@app.get("/conversations/last-persona")
def get_last_persona(user_email: str, travelling_as: str, db: Session = Depends(get_db)):
    """Return the most recent persona for a given travelling_as type, for pre-fill."""
    conv = (
        db.query(Conversation)
        .filter(
            Conversation.user_email == user_email,
            Conversation.travelling_as == travelling_as,
        )
        .order_by(Conversation.updated_at.desc())
        .first()
    )
    if not conv:
        return {}
    return {
        "travelling_as": conv.travelling_as,
        "travel_style":  conv.travel_style,
        "trip_length":   conv.trip_length,
        "interests":     conv.interests,
        "dietary":       conv.dietary,
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

    # Build system prompt with per-trip persona + location context
    context_lines = []

    if conv.travelling_as == "meetup":
        # Meetup mode — different system prompt focus
        meetup_parts = [
            "This is a MEETUP planning session, not a road trip.",
            "The user needs help finding a quiet place with free WiFi suitable for a meeting, discussion, or focused work session.",
            "Suggest specific venues: cafés, libraries, co-working spaces, hotel lobbies, or quiet restaurants.",
            "Prioritise: quiet atmosphere, free WiFi, comfortable seating, good for conversation or focused work.",
            "",
            "RATINGS: For every venue you suggest, include its approximate Google Maps / TripAdvisor rating in the format ⭐ X.X — e.g. 'Blue Bottle Coffee (⭐ 4.6)'. Prioritise higher-rated venues.",
            "",
            "EVENTS: If there are any notable events, markets, or happenings near the meeting area on or around the meeting date, briefly mention them — they could affect parking, noise, or venue availability.",
            "",
            "IMPORTANT — timing and hours:",
            "- Always mention the typical opening hours of each venue you suggest.",
            "- Cross-check those hours against the user's preferred time of day / meeting date.",
            "- If the venue might be closed, crowded, or unsuitable at that time, say so clearly and suggest an alternative.",
            "- If the user has only given a vague time (e.g. 'afternoon') and no exact start time or duration, ask them:",
            "  'What time are you planning to arrive, and roughly how long do you need the space?' — so you can confirm the venue fits.",
            "- If the meeting date is a weekend or public holiday, note that hours may differ and flag it.",
            "- If no time or date info is provided at all, ask before suggesting venues.",
            "",
            "IMPORTANT — DATA BLOCKS: At the very end of your response append (no extra text after):",
            "TRAVELAI_PLACES:[{\"name\":\"Venue Name\",\"query\":\"Venue Name City State\",\"rating\":4.6,\"role\":\"activity\"},...]",
            "TRAVELAI_LOCATIONS:[{\"name\":\"Venue Name\",\"lat\":47.6062,\"lng\":-122.3321,\"role\":\"activity\",\"mode\":null,\"time_hours\":null,\"distance_miles\":null},...]",
            "Include every named venue. The query should be a good Google Maps search string.",
        ]
        if conv.meet_location:
            meetup_parts.append(f"Meeting location/area: {conv.meet_location}")
        if conv.meet_time:
            meetup_parts.append(f"Preferred time of day: {conv.meet_time}")
        if conv.meet_date:
            meetup_parts.append(f"Meeting date: {'today' if conv.meet_date == 'today' else conv.meet_date} — check if this falls on a weekend or public holiday.")
        if body.user_location:
            meetup_parts.append(f"User's current location: {body.user_location}")
        context_lines.append("\n".join(meetup_parts))
        system_prompt = ROAD_TRIP_SYSTEM_PROMPT
        if context_lines:
            system_prompt = "\n\n".join(context_lines) + "\n\n" + ROAD_TRIP_SYSTEM_PROMPT
    else:
        persona_parts = []
        TRAVELLING_AS_LABELS = {"solo": "travelling solo", "couple": "travelling as a couple", "family": "travelling with family (including kids)", "friends": "travelling with a group of friends", "work": "on a work trip"}
        STYLE_LABELS = {"adventure": "adventurous (hiking, outdoors, adrenaline)", "relaxed": "relaxed and slow-paced", "cultural": "culturally curious (museums, history, local life)", "foodie": "a food lover (restaurants, markets, local cuisine)", "luxury": "preferring luxury and comfort", "budget": "budget-conscious"}
        LENGTH_LABELS = {"1day": "day trips (1 day)", "weekend": "weekend getaways (2-3 days)", "week": "week-long trips (5-7 days)", "twoweeks": "two-week trips", "month": "extended trips (a month or more)"}

        if conv.travelling_as:
            persona_parts.append(f"- Travel group: {TRAVELLING_AS_LABELS.get(conv.travelling_as, conv.travelling_as)}")
        if conv.travel_style:
            persona_parts.append(f"- Travel style: {STYLE_LABELS.get(conv.travel_style, conv.travel_style)}")
        if conv.trip_length:
            persona_parts.append(f"- Typical trip length: {LENGTH_LABELS.get(conv.trip_length, conv.trip_length)}")
        if conv.interests:
            persona_parts.append(f"- Interests: {', '.join(conv.interests.split(','))}")
        if conv.dietary:
            persona_parts.append(f"- Dietary preferences: {', '.join(conv.dietary.split(','))}")

        if persona_parts:
            context_lines.append("User travel profile for this trip:\n" + "\n".join(persona_parts))

        if body.user_location:
            context_lines.append(f"User's current location (use as starting point unless they say otherwise): {body.user_location}")

        system_prompt = ROAD_TRIP_SYSTEM_PROMPT
        if context_lines:
            system_prompt = "\n\n".join(context_lines) + "\n\n" + ROAD_TRIP_SYSTEM_PROMPT

    async def generate():
        # Use a fresh session — the Depends session may close before this generator finishes
        session = SessionLocal()
        try:
            client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
            full_text = ""

            # DEV: emit the full system prompt so the frontend debug panel can display it
            yield f"data: {json.dumps({'type': 'system_prompt', 'text': system_prompt})}\n\n"

            with client.messages.stream(
                model="claude-sonnet-4-6",
                max_tokens=2048,
                system=system_prompt,
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


@app.patch("/conversations/{conversation_id}/title")
def rename_conversation(conversation_id: str, body: dict, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(status_code=400, detail="Title cannot be empty")
    conv.title = title
    db.commit()
    return {"id": conv.id, "title": conv.title}


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


# ── Profile ──────────────────────────────────────────────────────────────────

@app.get("/profile")
def get_profile(user_email: str, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_email == user_email).first()
    if not profile:
        return {"onboarded": "false"}
    return {
        "user_email": profile.user_email,
        "display_name": profile.display_name,
        "travel_persona": profile.travel_persona,
        "travel_style": profile.travel_style,
        "trip_length": profile.trip_length,
        "interests": profile.interests,
        "home_city": profile.home_city,
        "onboarded": profile.onboarded,
    }


@app.post("/profile")
def upsert_profile(body: UpsertProfileRequest, db: Session = Depends(get_db)):
    profile = db.query(UserProfile).filter(UserProfile.user_email == body.user_email).first()
    if profile:
        for field in ["display_name", "travel_persona", "travel_style", "trip_length", "interests", "home_city", "onboarded"]:
            val = getattr(body, field)
            if val is not None:
                setattr(profile, field, val)
        profile.updated_at = datetime.now(timezone.utc)
    else:
        profile = UserProfile(
            user_email=body.user_email,
            display_name=body.display_name,
            travel_persona=body.travel_persona,
            travel_style=body.travel_style,
            trip_length=body.trip_length,
            interests=body.interests,
            home_city=body.home_city,
            onboarded=body.onboarded or "false",
        )
        db.add(profile)
    db.commit()
    db.refresh(profile)
    return {
        "user_email": profile.user_email,
        "display_name": profile.display_name,
        "travel_persona": profile.travel_persona,
        "travel_style": profile.travel_style,
        "trip_length": profile.trip_length,
        "interests": profile.interests,
        "home_city": profile.home_city,
        "onboarded": profile.onboarded,
    }


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}
