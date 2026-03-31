# Travel Planner — Google Auth App

## Prerequisites
- Python 3.10+
- Node.js 18+
- A Google Cloud project with OAuth 2.0 credentials

## Stack

- **Frontend:** Next.js 16.2.1 (App Router, Turbopack), NextAuth v5, Tailwind CSS v4
- **Backend:** FastAPI + Uvicorn, Google OAuth token verification

## 1. Get Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a project (or select an existing one)
3. Navigate to **APIs & Services → Credentials**
4. Click **Create Credentials → OAuth 2.0 Client IDs**
5. Application type: **Web application**
6. Add Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
7. Copy your **Client ID** and **Client Secret**

## 2. Configure environment variables

**Backend** (`backend/.env`):
```
GOOGLE_CLIENT_ID=<your-client-id>
FRONTEND_URL=http://localhost:3000
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

Backend runs at http://localhost:8000

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
├── app/              # Next.js App Router pages
│   ├── api/          # NextAuth route handler
│   ├── signin/       # Sign-in page
│   └── welcome/      # Post-auth welcome page
├── backend/          # FastAPI backend
│   ├── main.py
│   └── requirements.txt
├── auth.ts           # NextAuth config (Google provider)
├── next.config.ts
└── .env.local        # Frontend environment variables (not committed)
```

## Flow

1. User visits `http://localhost:3000` → redirected to `/signin`
2. User clicks "Sign in with Google" → Google OAuth flow
3. On success → redirected to `/welcome` (shows name, avatar)
4. Welcome page calls Python backend (`POST /auth/google`) to verify the token
5. Backend confirms identity and returns user info
