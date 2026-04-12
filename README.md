# TravelAI — AI Travel Planner

An AI-powered travel assistant that helps you plan trips, find meetup spots, and discover spontaneous evening outings — with per-trip persona customisation, inline maps, voice input, and streaming responses.

## Stack

- **Frontend:** Next.js 16.2.3 (App Router, Turbopack), NextAuth v5, Tailwind CSS v4, Leaflet/OpenStreetMap
- **Backend:** FastAPI + Uvicorn, SQLAlchemy, SQLite (local) / PostgreSQL (production)
- **AI:** Anthropic API — claude-sonnet-4-6 (chat, 64k output), claude-haiku-4-5 (title generation)
- **Auth:** Google OAuth 2.0 via NextAuth
- **Deploy:** Vercel (frontend) + Railway (backend), auto-deploy via GitHub Actions on merge to `main`

## Features

- **Google Sign-In** with token verification via FastAPI
- **Streaming AI chat** — routes, stops, drive times, tips rendered in real-time with 64k token output
- **Voice input** — mic button with 4-second silence detection; travel-agent follow-up after every voice message
- **Inline hearts** — heart any place mentioned in a response to save it; "Refine with my picks" reruns Claude tailored to your selections
- **Liked places profile** — saved places injected into every prompt for personalised suggestions; viewable + removable in Profile & Trips
- **Per-trip persona** — bottom sheet wizard on new chat: travel group, style, length, interests, dietary, pets
- **Spontaneous Drive mode** — evening vibe picker (Scenic / Food / City Lights / Nature / Fun / Surprise); Claude suggests kid-friendly spots within 1hr of your location, open right now
- **Meetup mode** — finds quiet, WiFi-friendly venues with opening hours awareness and timing cross-checks
- **Inline collapsible maps** — per-message Leaflet/OpenStreetMap map with route polyline, expands/collapses independently
- **Place info modal** — tap ⓘ on any place name to open a full-bleed modal with Google Places photos, carousel with thumbnails, rating, address, and Google Maps embed; backend proxy keeps API key server-side
- **Google Maps links** — place names in AI responses are clickable links to Google Maps
- **Streaming chat UI** — Google avatar + AI compass avatar, themed bubbles, floating input bar, suggested prompts on new chat, theme-reactive greeting messages
- **14-theme design system** (Voyara) — Seasons, Moods, Cultural themes with live switcher
- **Dark mode** — persisted in localStorage
- **Sidebar** — date-grouped conversation history (Today / Yesterday / This Week / Older), search/filter bar, show more/less, persona summary chips, left-border active indicator, user profile card with Google avatar
- **Saved trips** — bookmark any AI response to your profile
- **Profile & Trips page** — profile card, liked places grouped by category, saved trips list
- **Security scanning** — automated Bandit + Semgrep + npm/pip audit + Gitleaks on every push
- **Push-to-repo script** — one command to sync codebase to any external GitHub repo

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
GOOGLE_PLACES_API_KEY=<your-google-places-api-key>
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
│   │   ├── ChatClient.tsx      # Chat UI — streaming, hearts, voice, maps, avatars
│   │   ├── PlaceModal.tsx      # Place info modal — photos carousel + Maps embed
│   │   ├── PersonaSheet.tsx    # Bottom sheet — per-trip persona wizard
│   │   ├── personaConfig.ts    # Shared persona options + types
│   │   ├── MapView.tsx         # Leaflet map with fullscreen support
│   │   ├── MicButton.tsx       # Voice mic button (sm/md/lg sizes)
│   │   └── useVoiceInput.ts    # Web Speech API hook with silence detection
│   ├── components/
│   │   ├── AppLayout.tsx       # Sidebar + TopBar wrapper (responsive)
│   │   ├── Sidebar.tsx         # Sidebar — grouped history, search, persona chips, user card
│   │   ├── TopBar.tsx          # Top bar with theme switcher + sign out
│   │   ├── ThemeSwitcher.tsx   # 14-theme dropdown
│   │   ├── TravelAILogo.tsx    # Compass + neural lines SVG logo
│   │   └── LandingPage.tsx     # Marketing landing page
│   ├── settings/               # Profile, liked places, saved trips
│   ├── signin/                 # Sign-in page
│   └── welcome/                # Post-auth welcome page
├── backend/
│   ├── main.py                 # FastAPI — all endpoints + system prompts
│   ├── database.py             # SQLAlchemy engine + session
│   ├── models.py               # Conversation, Message, SavedTrip, UserProfile, LikedPlace
│   └── requirements.txt
├── scripts/
│   └── push-to-repo.sh         # Sync codebase to any external GitHub repo
├── .github/workflows/
│   ├── deploy.yml              # Auto-deploy to Vercel on push to main
│   └── security.yml            # Bandit + Semgrep + audit + Gitleaks on every push
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
| PATCH | `/conversations/{id}/title` | Rename conversation |
| POST | `/conversations/{id}/messages/stream` | Stream AI response (SSE) |
| PATCH | `/conversations/{id}/persona` | Update trip persona |
| GET | `/conversations/last-persona?user_email=&travelling_as=` | Prefill from last session |
| POST | `/saved-trips` | Save a trip |
| GET | `/saved-trips?user_email=` | List saved trips |
| DELETE | `/saved-trips/{id}` | Delete saved trip |
| GET | `/profile?user_email=` | Get user profile |
| POST | `/profile` | Upsert user profile |
| GET | `/liked-places?user_email=` | List liked places |
| POST | `/liked-places` | Save a liked place |
| DELETE | `/liked-places/{id}` | Remove a liked place |
| GET | `/places/photos?query=` | Fetch Google Places photos + rating + address |
| GET | `/places/photo-proxy?name=` | Proxy individual photo from Google (CORS-safe) |

## Persona Modes

| Mode | Description |
|------|-------------|
| Solo / Couple / Family / Friends / Work | Standard trip planning with full persona wizard |
| **Meetup** | Finds quiet WiFi-friendly venues; asks for location, time, date |
| **Spontaneous Drive** | Evening kid-friendly 1hr drive; picks vibe (Scenic / Food / City Lights / Nature / Fun / Surprise) |

## App Flow

1. Visit `http://localhost:3000` → landing page or `/signin`
2. Sign in with Google → redirected to `/chat`
3. New chat → persona bottom sheet (travel group, style, length, interests, dietary, pets — or Meetup / Spontaneous Drive mode)
4. Chat with AI — responses stream in real-time, inline map appears per message
5. Heart places inline → saved to profile → used in future suggestions
6. "Refine with my picks" → Claude reruns with your hearted selections
7. Trip persona in left sidebar, editable inline per conversation
8. Profile & Trips → view/remove liked places, manage saved trips

## Security

Automated security pipeline runs on every push and pull request:

| Tool | Checks |
|------|--------|
| **Bandit** | Python backend — hardcoded secrets, SQL injection, insecure functions |
| **Semgrep** | OWASP Top 10, XSS, React/Next.js patterns, secrets, SQLi |
| **npm audit** | Known CVEs in Node.js dependencies |
| **pip-audit** | Known CVEs in Python dependencies |
| **Gitleaks** | Accidentally committed API keys / secrets |

Reports saved as downloadable artifacts in GitHub Actions. Pipeline fails on any critical finding.

## Push to External Repo

```bash
./scripts/push-to-repo.sh https://github.com/other-user/other-repo.git branch-name "Optional PR title"
```

Handles unrelated git histories, skips secrets/build artifacts, auto-creates a PR.

## Deployment

- **Frontend:** Vercel — connect GitHub repo, set env vars, auto-deploys via GitHub Actions on merge to `main`
- **Backend:** Railway — connect GitHub repo, set root to `backend/`, branch `main`, add PostgreSQL for `DATABASE_URL`
- **Google OAuth:** Add your production Vercel URL to Authorized redirect URIs in Google Cloud Console

## Architecture

For a full technical breakdown — system diagram, auth flow, SSE streaming, database schema, component hierarchy, and CI/CD pipeline — see [ARCHITECTURE.md](ARCHITECTURE.md).

## GitHub Actions Secrets Required

| Secret | Description |
|--------|-------------|
| `VERCEL_TOKEN` | Vercel account token |
| `VERCEL_ORG_ID` | Vercel team/org ID |
| `VERCEL_PROJECT_ID` | Vercel project ID |
