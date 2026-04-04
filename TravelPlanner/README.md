# Travel Planner — Road Trip AI Assistant

## Stack

- **Frontend:** Next.js 16.2.1 (App Router, Turbopack), NextAuth v5, Tailwind CSS v4, react-markdown
- **Backend:** FastAPI + Uvicorn, SQLAlchemy, SQLite (local) / PostgreSQL (production)
- **AI:** Claude Sonnet 4.6 (chat), Claude Haiku 4.5 (auto-title generation)
- **Auth:** Google OAuth 2.0 via NextAuth

## Features

- Google Sign-In with token verification via FastAPI backend
- Road trip AI chatbot powered by Claude — suggests routes, stops, drive times, tips
- Conversation history saved to database with smart auto-generated titles
- Collapsible left sidebar with conversation list and delete support
- Dark mode toggle (persisted in localStorage)
- Markdown-rendered AI responses (headers, lists, bold, code)
- Sign out button in top-right corner on all authenticated pages

## Prerequisites

- Python 3.10+
- Node.js 18+
- A Google Cloud project with OAuth 2.0 credentials
- An Anthropic API key

## 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to **APIs & Services → Credentials**
3. Click **Create Credentials → OAuth 2.0 Client IDs**
4. Application type: **Web application**
5. Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
6. Copy your **Client ID** and **Client Secret**

## 2. Configure environment variables

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

## 3. Run the backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend runs at http://localhost:8000. Database tables are created automatically on startup.

## 4. Run the frontend

From the **project root**:

```bash
npm install
npm run dev
```

Frontend runs at http://localhost:3000

## Project Structure

```
TravelPlanner/
├── app/
│   ├── api/auth/         # NextAuth route handler
│   ├── chat/
│   │   ├── page.tsx      # Chat page (server, handles auth + searchParams)
│   │   └── ChatClient.tsx# Chat UI (client component)
│   ├── components/
│   │   ├── AppLayout.tsx # Sidebar + TopBar layout wrapper
│   │   ├── Sidebar.tsx   # Collapsible sidebar with conversation history
│   │   └── TopBar.tsx    # Top bar with sign out button
│   ├── signin/           # Sign-in page
│   └── welcome/          # Post-auth welcome page
├── backend/
│   ├── main.py           # FastAPI app, all endpoints
│   ├── database.py       # SQLAlchemy engine + session
│   ├── models.py         # Conversation + Message models
│   └── requirements.txt
├── auth.ts               # NextAuth config (Google provider)
└── .env.local            # Frontend env vars (not committed)
```

## Backend API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/auth/google` | Verify Google ID token |
| GET | `/health` | Health check |
| POST | `/conversations` | Create new conversation |
| GET | `/conversations?user_email=` | List user's conversations |
| GET | `/conversations/{id}` | Get conversation with messages |
| POST | `/conversations/{id}/messages` | Send message, get AI response |
| DELETE | `/conversations/{id}` | Delete conversation |

## App Flow

1. User visits `http://localhost:3000` → redirected to `/signin`
2. User clicks **Sign in with Google** → Google OAuth flow
3. On success → redirected to `/welcome` (shows avatar, name, backend status)
4. User clicks **Chat** in sidebar → opens road trip AI chatbot at `/chat`
5. Each conversation is saved to the database; title auto-generated after the first exchange
6. Past conversations appear in the sidebar and can be resumed or deleted

## Deployment

- **Frontend:** Vercel (connect GitHub repo, set env vars)
- **Backend:** Railway (set root directory to `backend`, add PostgreSQL plugin for `DATABASE_URL`)
- **Google OAuth:** Add your production Vercel URL to Authorized redirect URIs in Google Cloud Console
