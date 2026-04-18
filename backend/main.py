from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, Response
from pydantic import BaseModel
from sqlalchemy.orm import Session
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests
from dotenv import load_dotenv
from database import engine, get_db, SessionLocal
from models import Base, Conversation, Message, SavedTrip, UserProfile, LikedPlace, ShareGist
from datetime import datetime, timezone
import anthropic
import json
import os
import uuid

load_dotenv()

Base.metadata.create_all(bind=engine)

# Add new persona columns to existing conversations table if missing (safe migration)
def _migrate_db():
    from sqlalchemy import text, inspect
    with engine.connect() as conn:
        inspector = inspect(engine)
        existing = {col["name"] for col in inspector.get_columns("conversations")}
        migrations = [
            ("travelling_as",    "ALTER TABLE conversations ADD COLUMN travelling_as VARCHAR"),
            ("travel_style",     "ALTER TABLE conversations ADD COLUMN travel_style VARCHAR"),
            ("trip_length",      "ALTER TABLE conversations ADD COLUMN trip_length VARCHAR"),
            ("interests",        "ALTER TABLE conversations ADD COLUMN interests VARCHAR"),
            ("dietary",          "ALTER TABLE conversations ADD COLUMN dietary VARCHAR"),
            ("pets",             "ALTER TABLE conversations ADD COLUMN pets VARCHAR"),
            ("meet_location",    "ALTER TABLE conversations ADD COLUMN meet_location VARCHAR"),
            ("meet_time",        "ALTER TABLE conversations ADD COLUMN meet_time VARCHAR"),
            ("meet_date",        "ALTER TABLE conversations ADD COLUMN meet_date VARCHAR"),
            ("spontaneous_vibe", "ALTER TABLE conversations ADD COLUMN spontaneous_vibe VARCHAR"),
        ]
        for col, sql in migrations:
            if col not in existing:
                conn.execute(text(sql))
        conn.commit()

        # Create liked_places table if missing
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS liked_places (
                id VARCHAR PRIMARY KEY,
                user_email VARCHAR NOT NULL,
                name VARCHAR NOT NULL,
                query VARCHAR NOT NULL,
                category VARCHAR,
                rating VARCHAR,
                created_at DATETIME
            )
        """))
        # Keep this schema aligned with models.ShareGist for startup-safe migration on existing DBs.
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS share_gists (
                id VARCHAR PRIMARY KEY,
                conversation_id VARCHAR NOT NULL,
                user_email VARCHAR NOT NULL,
                query VARCHAR NOT NULL,
                created_at DATETIME
            )
        """))
        conn.commit()

_migrate_db()

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")
ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
GOOGLE_PLACES_API_KEY = os.getenv("GOOGLE_PLACES_API_KEY")

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

REST STOPS (road trips)
For any road trip leg longer than 1.5 hours, proactively suggest rest stops tailored to the traveler profile:
- Family with kids: every 1.5–2 hours — prioritise rest areas with playgrounds, clean restrooms, picnic tables, and fast food options nearby.
- Elderly or accessibility needs: every 1–1.5 hours — prioritise smooth pull-offs, accessible restrooms, and shaded seating.
- Solo or couple: every 2–2.5 hours — can be lighter stops: fuel + coffee, scenic overlook, or a quick stretch.
- Groups/friends: suggest stops that double as experiences — quirky roadside attractions, local diners, breweries, viewpoints.
- Adventure/outdoors travelers: suggest trailhead pull-offs, scenic overlooks, or swimming spots as rest stops.
- Luxury travelers: prioritise premium rest stops — upscale service plazas, hotel lobbies for a coffee, or full sit-down lunch spots.
For each rest stop include: name, what it offers, approximate mileage/time from last stop, and why it fits this traveler.
Include rest stops in TRAVELAI_LOCATIONS with role "rest_area" and in TRAVELAI_PLACES.

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
At the very end of EVERY response that mentions any named place, location, city, attraction, restaurant, hotel, or destination — append ALL of the following blocks. No text after the final block. Use valid JSON only. Use null for unknown values. Never skip these blocks when specific places are named.

TRAVELAI_LOCATIONS — every named geographic location in this response (for map pin rendering):
TRAVELAI_LOCATIONS:[{"name":"Location Name","lat":37.7749,"lng":-122.4194,"role":"activity","mode":null,"time_hours":null,"distance_miles":null},...]

Rules:
- Include EVERY named city, town, attraction, restaurant, hotel, viewpoint, airport, station, port, rest area, or venue mentioned — not just route waypoints.
- For place-suggestion responses (e.g. "here are 5 restaurants to try"), include all 5 as separate location entries.
- Roles: origin, destination, stop, hotel, airport, station, port, activity, restaurant, viewpoint, rest_area
- Modes: road, air, rail, ferry (transport used to reach from previous location — use null for standalone place suggestions)
- time_hours / distance_miles: include for route legs, use null for standalone place suggestions.
- You MUST know the coordinates with reasonable confidence — do not fabricate lat/lng. If unsure, omit that single entry only.

TRAVELAI_PLACES — every named place, attraction, restaurant, hotel, venue mentioned:
TRAVELAI_PLACES:[{"name":"Place Name","query":"Place Name City State","rating":4.8,"role":"restaurant"},...]
Always include for every named place in the response.

TRAVELAI_SEGMENTS — ordered transport legs (for drawing route lines on the map):
TRAVELAI_SEGMENTS:[{"from":"City A","to":"City B","mode":"road","time_hours":2.5,"distance_miles":145},...]
Modes: road, rail, ferry, air
Include whenever a multi-stop journey or route is described. Omit only for pure place-listing responses with no route."""


# ── Pydantic schemas ────────────────────────────────────────────────────────

class TokenRequest(BaseModel):
    token: str


class CreateConversationRequest(BaseModel):
    user_email: str


class SendMessageRequest(BaseModel):
    content: str
    user_email: str
    user_location: str | None = None
    voice_mode: bool = False


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
    interests: str | None = None        # comma-separated
    dietary: str | None = None          # comma-separated
    pets: str | None = None             # comma-separated
    meet_location: str | None = None
    meet_time: str | None = None
    meet_date: str | None = None
    spontaneous_vibe: str | None = None


class LikePlaceRequest(BaseModel):
    user_email: str
    name: str
    query: str
    category: str | None = None
    rating: str | None = None


class CreateShareRequest(BaseModel):
    conversation_id: str
    user_email: str
    query: str


# ── Helpers ─────────────────────────────────────────────────────────────────

def generate_title(user_message: str, ai_response: str) -> str:
    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    response = client.messages.create(
        model="claude-haiku-4-5-20251001",
        max_tokens=20,
        messages=[{
            "role": "user",
            "content": (
                "Give this travel conversation a short title (3-5 words). "
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
            "travelling_as":    conv.travelling_as,
            "travel_style":     conv.travel_style,
            "trip_length":      conv.trip_length,
            "interests":        conv.interests,
            "dietary":          conv.dietary,
            "pets":             conv.pets,
            "meet_location":    conv.meet_location,
            "meet_time":        conv.meet_time,
            "meet_date":        conv.meet_date,
            "spontaneous_vibe": conv.spontaneous_vibe,
        },
    }


@app.patch("/conversations/{conversation_id}/persona")
def update_trip_persona(conversation_id: str, body: TripPersonaRequest, db: Session = Depends(get_db)):
    conv = db.query(Conversation).filter(Conversation.id == conversation_id).first()
    if not conv:
        raise HTTPException(status_code=404, detail="Conversation not found")
    for field in ["travelling_as", "travel_style", "trip_length", "interests", "dietary", "pets", "meet_location", "meet_time", "meet_date", "spontaneous_vibe"]:
        val = getattr(body, field)
        if val is not None:
            setattr(conv, field, val)
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()
    return {
        "travelling_as":    conv.travelling_as,
        "travel_style":     conv.travel_style,
        "trip_length":      conv.trip_length,
        "interests":        conv.interests,
        "dietary":          conv.dietary,
        "pets":             conv.pets,
        "meet_location":    conv.meet_location,
        "meet_time":        conv.meet_time,
        "meet_date":        conv.meet_date,
        "spontaneous_vibe": conv.spontaneous_vibe,
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
        "pets":          conv.pets,
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
    is_first_exchange = len(all_messages) == 1

    # Strip TRAVELAI JSON blocks from assistant messages before sending as history
    # — they are large (thousands of tokens) and the AI doesn't need them as context
    import re as _re
    _block_re = _re.compile(r'TRAVELAI_(?:LOCATIONS|PLACES|SEGMENTS):\[.*?\]', _re.DOTALL)
    def _strip_blocks(text: str) -> str:
        return _block_re.sub("", text).strip()

    # Cap history to last 10 messages to bound input token growth
    recent = all_messages[-10:]
    history = [
        {"role": m.role, "content": _strip_blocks(m.content) if m.role == "assistant" else m.content}
        for m in recent
    ]
    current_title = conv.title

    # Load user's liked places for personalisation
    liked = db.query(LikedPlace).filter(LikedPlace.user_email == body.user_email).order_by(LikedPlace.created_at.desc()).limit(50).all()
    liked_context = ""
    if liked:
        # Group by category for richer context
        from collections import defaultdict
        by_cat: dict = defaultdict(list)
        for p in liked:
            cat = (p.category or "place").lower()
            by_cat[cat].append(p)

        lines = [
            "USER TASTE PROFILE — the user has hearted these places from past recommendations.",
            "Use this to deeply personalise every suggestion: match the vibe, quality level, and style of what they already love.",
            "When you suggest a new place that resembles something they liked, explicitly say so (e.g. 'Similar vibe to [liked place] you saved').",
            "Prioritise categories they heart most. Never suggest something that clashes with their established taste.",
            "",
        ]
        for cat, places in sorted(by_cat.items(), key=lambda x: -len(x[1])):
            place_list = ", ".join(
                f"{p.name}" + (f" (⭐{p.rating})" if p.rating else "")
                for p in places
            )
            lines.append(f"  • Liked {cat}s: {place_list}")

        # Highlight top category as primary taste signal
        top_cat, _ = max(by_cat.items(), key=lambda x: len(x[1]))
        lines.append("")
        lines.append(f"Their strongest preference is for {top_cat}s — weight suggestions in this category more heavily.")

        liked_context = "\n".join(lines)

    # Build system prompt with per-trip persona + location context
    context_lines = []
    if liked_context:
        context_lines.append(liked_context)

    if conv.travelling_as == "spontaneous":
        # Spontaneous evening drive mode — proximity-first, kid-friendly, mood-driven
        VIBE_LABELS = {
            "scenic":     "a scenic drive with beautiful views",
            "foodie":     "food and treats (ice cream, street food, something delicious)",
            "citylights": "city lights and the night atmosphere",
            "nature":     "nature and the outdoors",
            "fun":        "something fun and exciting for kids",
            "surprise":   "something unexpected and special",
        }
        vibe_phrase = VIBE_LABELS.get(conv.spontaneous_vibe or "", "a great spontaneous experience")

        spontaneous_parts = [
            "SPONTANEOUS EVENING DRIVE MODE.",
            "The user wants to jump in the car RIGHT NOW with their kids for a spontaneous evening outing.",
            "",
            "CORE RULES:",
            "- All suggestions must be within ~1 hour drive of the user's current location.",
            "- It is EVENING or NIGHT — only suggest places that are actually open and atmospheric at this hour.",
            "- Kid-friendly is non-negotiable: safe, accessible, easy entry, suitable for children of all ages.",
            "- The experience should feel a little EXOTIC or SPECIAL — not the usual spots, something that makes it feel like a mini adventure.",
            "- Focus on the FEELING and VIBE of each place, not just logistics. Make the user want to go.",
            "- Keep it loose and mood-driven — suggest 2-3 options, let them pick what calls to them.",
            "- No strict itinerary. Think: 'drive there, experience it, drive back happy'.",
            "",
            f"Tonight's vibe: {vibe_phrase}.",
            "",
            "FORMAT: For each suggestion give it a name, a 2-3 sentence vibe description (sensory, evocative), drive time from their location, and why it works for kids in the evening.",
            "",
            "IMPORTANT — DATA BLOCKS: At the very end append:",
            "TRAVELAI_PLACES:[{\"name\":\"Place Name\",\"query\":\"Place Name City State\",\"rating\":4.5,\"role\":\"activity\"},...]",
            "TRAVELAI_LOCATIONS:[{\"name\":\"Place Name\",\"lat\":0.0,\"lng\":0.0,\"role\":\"activity\",\"mode\":null,\"time_hours\":null,\"distance_miles\":null},...]",
        ]
        if body.user_location:
            spontaneous_parts.append(f"User's current location (use as the starting point for all distance calculations): {body.user_location}")
        else:
            spontaneous_parts.append("User location not provided — ask for it before suggesting destinations.")
        context_lines.append("\n".join(spontaneous_parts))
        system_prompt = ROAD_TRIP_SYSTEM_PROMPT
        if context_lines:
            system_prompt = "\n\n".join(context_lines) + "\n\n" + ROAD_TRIP_SYSTEM_PROMPT

    elif conv.travelling_as == "meetup":
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
        if conv.pets:
            pet_labels = {"dog": "dog", "cat": "cat", "bird": "bird", "rabbit": "rabbit", "none": "no pets"}
            pets_list = [pet_labels.get(p.strip(), p.strip()) for p in conv.pets.split(",") if p.strip() != "none"]
            if pets_list:
                persona_parts.append(f"- Travelling with pets: {', '.join(pets_list)} — suggest pet-friendly accommodation, restaurants with outdoor seating or pet policies, pet-friendly attractions, and note any venues that do not allow pets")

        if persona_parts:
            context_lines.append("User travel profile for this trip:\n" + "\n".join(persona_parts))

        if body.user_location:
            context_lines.append(f"User's current location (use as starting point unless they say otherwise): {body.user_location}")

        system_prompt = ROAD_TRIP_SYSTEM_PROMPT
        if context_lines:
            system_prompt = "\n\n".join(context_lines) + "\n\n" + ROAD_TRIP_SYSTEM_PROMPT

    # Travel-agent voice mode: after responding, ask if there's anything else to capture
    if body.voice_mode:
        voice_instruction = (
            "VOICE INPUT MODE: The user just spoke their request via voice. "
            "After addressing their question or capturing their preference, end your response with a warm, "
            "concise travel-agent style follow-up — for example: "
            "'Is there anything else you'd like to add, or shall I start planning based on this?' "
            "Keep it brief and conversational, like a friendly travel agent on a call."
        )
        system_prompt = voice_instruction + "\n\n" + system_prompt

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
                max_tokens=8192,
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


# ── Share Gists ───────────────────────────────────────────────────────────────

@app.post("/share")
def create_share_gist(body: CreateShareRequest, db: Session = Depends(get_db)):
    conversation_id = (body.conversation_id or "").strip()
    user_email = (body.user_email or "").strip()
    query = (body.query or "").strip()
    if not conversation_id or not user_email or not query:
        raise HTTPException(status_code=400, detail="conversation_id, user_email, and query are required")

    share_id = str(uuid.uuid4())
    gist = ShareGist(
        id=share_id,
        conversation_id=conversation_id,
        user_email=user_email,
        query=query,
    )
    db.add(gist)
    db.commit()
    db.refresh(gist)

    return {
        "share_id": gist.id,
        "share_url": f"{FRONTEND_URL}/share/{gist.id}",
    }


@app.get("/share/{share_id}")
def get_share_gist(share_id: str, db: Session = Depends(get_db)):
    gist = db.query(ShareGist).filter(ShareGist.id == share_id).first()
    if not gist:
        raise HTTPException(status_code=404, detail="Share not found")
    return {
        "query": gist.query,
        "conversation_id": gist.conversation_id,
        "user_email": gist.user_email,
        "created_at": gist.created_at,
    }


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


# ── Liked Places ─────────────────────────────────────────────────────────────

@app.get("/liked-places")
def list_liked_places(user_email: str, db: Session = Depends(get_db)):
    places = db.query(LikedPlace).filter(LikedPlace.user_email == user_email).order_by(LikedPlace.created_at.desc()).all()
    return [{"id": p.id, "name": p.name, "query": p.query, "category": p.category, "rating": p.rating} for p in places]


@app.post("/liked-places")
def like_place(body: LikePlaceRequest, db: Session = Depends(get_db)):
    # Prevent duplicates by name+email
    existing = db.query(LikedPlace).filter(LikedPlace.user_email == body.user_email, LikedPlace.name == body.name).first()
    if existing:
        return {"id": existing.id, "name": existing.name, "already_liked": True}
    place = LikedPlace(
        user_email=body.user_email,
        name=body.name,
        query=body.query,
        category=body.category,
        rating=body.rating,
        created_at=datetime.now(timezone.utc),
    )
    db.add(place)
    db.commit()
    db.refresh(place)
    return {"id": place.id, "name": place.name, "already_liked": False}


@app.delete("/liked-places/{place_id}")
def unlike_place(place_id: str, db: Session = Depends(get_db)):
    place = db.query(LikedPlace).filter(LikedPlace.id == place_id).first()
    if not place:
        raise HTTPException(status_code=404, detail="Not found")
    db.delete(place)
    db.commit()
    return {"ok": True}


# ── Google Places Photos (Places API New) ────────────────────────────────────

@app.get("/places/photos")
async def get_place_photos(query: str):
    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(status_code=503, detail="Places API not configured")
    import httpx as _httpx

    headers = {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask": "places.displayName,places.rating,places.formattedAddress,places.photos",
    }

    async with _httpx.AsyncClient() as client:
        search_resp = await client.post(
            "https://places.googleapis.com/v1/places:searchText",
            headers=headers,
            json={"textQuery": query, "maxResultCount": 1},
        )
        search_data = search_resp.json()

    places = search_data.get("places", [])
    if not places:
        return {"photos": [], "name": query, "rating": None, "address": None}

    place = places[0]
    name = place.get("displayName", {}).get("text", query)
    rating = place.get("rating")
    address = place.get("formattedAddress")
    photo_refs = (place.get("photos") or [])[:10]

    # Return backend proxy URLs — keeps API key server-side, browser loads each photo directly
    backend_url = os.getenv("BACKEND_URL", "http://localhost:8000")
    photos = [
        f"{backend_url}/places/photo-proxy?ref={p['name']}"
        for p in photo_refs if p.get("name")
    ]

    return {"photos": photos, "name": name, "rating": rating, "address": address}


@app.get("/places/photo-proxy")
async def proxy_place_photo(ref: str):
    """Proxy a single Google Places photo — keeps API key server-side."""
    if not GOOGLE_PLACES_API_KEY:
        raise HTTPException(status_code=503, detail="Places API not configured")
    import httpx as _httpx

    async with _httpx.AsyncClient(follow_redirects=True) as client:
        resp = await client.get(
            f"https://places.googleapis.com/v1/{ref}/media",
            params={"maxWidthPx": 1200, "key": GOOGLE_PLACES_API_KEY},
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=resp.status_code, detail="Photo not found")

    return Response(
        content=resp.content,
        media_type=resp.headers.get("content-type", "image/jpeg"),
        headers={
            "Cache-Control": "public, max-age=86400",
            "Access-Control-Allow-Origin": "*",
        },
    )


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok"}
