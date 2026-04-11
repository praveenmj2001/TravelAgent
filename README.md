# RoadAI — AI Road Trip & Meetup Planner

An AI-powered travel assistant that helps you plan road trips and find meetup spots — with per-trip persona customisation, interactive maps, and streaming responses.

## Stack

- **Frontend:** Next.js 16.2.1 (App Router, Turbopack), NextAuth v5, Tailwind CSS v4, Leaflet/OpenStreetMap
- **Backend:** FastAPI + Uvicorn, SQLAlchemy, SQLite (local) / PostgreSQL (production)
- **AI:** Anthropic API — Sonnet 4.6 (chat), Haiku 4.5 (title generation)
- **Auth:** Google OAuth 2.0 via NextAuth
- **Deploy:** Vercel (frontend) + Railway (backend), auto-deploy via GitHub Actions on merge to `main`

## Features

- **Google Sign-In** with token verification via FastAPI
- **Streaming AI chat** — road trip routes, stops, drive times, tips rendered in real-time
- **Per-trip persona** — bottom sheet on new chat asks travel style, group type, interests, dietary preferences; saved per conversation
- **Meetup mode** — special persona type that finds quiet, WiFi-friendly venues with opening hours awareness
- **Interactive map** — Leaflet/OpenStreetMap with route polyline, fullscreen toggle, colour-coded stops
- **14-theme design system** (Voyara) — Seasons, Moods, Cultural themes with live switcher
- **Dark mode** — persisted in localStorage, respects theme system
- **Left sidebar** — conversation history + collapsible Trip Persona section per active chat
- **Saved trips** — bookmark any AI response to your profile
- **Print chat** — opens formatted conversation in new window with print dialog
- **Settings page** — profile card, saved trips list, persona editor

## Prerequisites

- Python 3.10+
- Node.js 18+
- Google Cloud project with OAuth 2.0 credentials
- Anthropic API key

## Setup

### 1. Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → **APIs & Services → Credentials**
2. **Create Credentials → OAuth 2.0 Client ID** → Web application
3. Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
4. Copy **Client ID** and **Client Secret**

### 2. Environment Variables

**Backend** (`backend/.env`):
```
GOOGLE_CLIENT_ID=<your-client-id>
FRONTEND_URL=http://localhost:3000
ANTHROPIC_API_KEY=<your-anthropic-api-key>
DATABASE_URL=sqlite:///./travelplanner.db
```

**Frontend** (`.env.local` at project root):
```
AUTH_GOOGLE_ID=<your-client-id>
AUTH_GOOGLE_SECRET=<your-client-secret>
AUTH_SECRET=<any-random-string>
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 3. Run Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Runs at `http://localhost:8000`. Database tables and migrations run automatically on startup.

### 4. Run Frontend

```bash
npm install
npm run dev
```

Runs at `http://localhost:3000`

## Project Structure

```
TravelPlanner/
├── app/
│   ├── api/auth/               # NextAuth route handler
│   ├── chat/
│   │   ├── page.tsx            # Chat page (server component)
│   │   ├── ChatClient.tsx      # Chat UI with streaming + persona sheet
│   │   ├── PersonaSheet.tsx    # Bottom sheet — per-trip persona wizard
│   │   ├── PersonaPanel.tsx    # Right panel (unused — moved to sidebar)
│   │   ├── personaConfig.ts    # Shared persona options + types
│   │   └── MapView.tsx         # Leaflet map with fullscreen support
│   ├── components/
│   │   ├── AppLayout.tsx       # Sidebar + TopBar wrapper
│   │   ├── Sidebar.tsx         # Collapsible sidebar with history + persona
│   │   ├── TopBar.tsx          # Top bar with theme switcher + sign out
│   │   ├── ThemeSwitcher.tsx   # 14-theme dropdown
│   │   └── LandingPage.tsx     # Marketing landing page
│   ├── settings/               # Profile, saved trips, persona editor
│   ├── signin/                 # Sign-in page
│   └── welcome/                # Post-auth welcome page
├── backend/
│   ├── main.py                 # FastAPI — all endpoints
│   ├── database.py             # SQLAlchemy engine + session
│   ├── models.py               # Conversation, Message, SavedTrip, UserProfile
│   └── requirements.txt
├── .github/workflows/
│   └── deploy.yml              # Auto-deploy to Vercel on push to main
├── auth.ts                     # NextAuth config
└── .env.local                  # Frontend env vars (not committed)
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/google` | Verify Google ID token |
| GET | `/health` | Health check |
| POST | `/conversations` | Create new conversation |
| GET | `/conversations?user_email=` | List user's conversations |
| GET | `/conversations/{id}` | Get conversation + messages + persona |
| DELETE | `/conversations/{id}` | Delete conversation |
| POST | `/conversations/{id}/messages/stream` | Stream AI response (SSE) |
| PATCH | `/conversations/{id}/persona` | Update trip persona |
| GET | `/conversations/last-persona?user_email=&travelling_as=` | Prefill from last session |
| POST | `/saved-trips` | Save a trip |
| GET | `/saved-trips?user_email=` | List saved trips |
| DELETE | `/saved-trips/{id}` | Delete saved trip |
| GET | `/profile?user_email=` | Get user profile |
| POST | `/profile` | Upsert user profile |

## App Flow

1. Visit `http://localhost:3000` → landing page or `/signin`
2. Sign in with Google → redirected to `/chat`
3. New chat → persona bottom sheet appears immediately (travel group, style, length, interests, dietary — or Meetup mode)
4. Chat with AI — responses stream in real-time, map appears when locations are mentioned
5. Trip persona shown in left sidebar, editable inline per conversation
6. Bookmark any AI response → appears in `/settings` under Saved Trips

## Deployment

- **Frontend:** Vercel — connect GitHub repo, set env vars, auto-deploys via GitHub Actions on merge to `main`
- **Backend:** Railway — connect GitHub repo, set root to `backend/`, branch `main`, add PostgreSQL for `DATABASE_URL`
- **Google OAuth:** Add your production Vercel URL to Authorized redirect URIs in Google Cloud Console

## GitHub Actions Secrets Required

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel account token |
| `VERCEL_ORG_ID` | Vercel team/org ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
