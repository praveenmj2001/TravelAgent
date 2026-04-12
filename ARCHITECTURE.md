# TravelAI — Architecture

## Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend Framework** | Next.js (App Router, Turbopack) | 16.2.1 |
| **UI Library** | React | 19.2.4 |
| **Styling** | Tailwind CSS | v4 |
| **Auth (Frontend)** | NextAuth | v5.0.0-beta.30 |
| **Maps** | Leaflet + React-Leaflet / OpenStreetMap | 1.9.4 / 5.0.0 |
| **Markdown** | react-markdown + remark-gfm | 10.1.0 |
| **Language** | TypeScript | v5 |
| **Backend Framework** | FastAPI + Uvicorn | 0.115.0 / 0.30.6 |
| **ORM** | SQLAlchemy | 2.0.36 |
| **Database (local)** | SQLite | — |
| **Database (prod)** | PostgreSQL | — |
| **Auth (Backend)** | Google Auth Library | 2.35.0 |
| **AI Provider** | Anthropic API | SDK 0.40.0 |
| **Chat Model** | claude-sonnet-4-6 | 64k output tokens |
| **Title Model** | claude-haiku-4-5 | — |
| **Frontend Deploy** | Vercel | — |
| **Backend Deploy** | Railway | — |
| **CI/CD** | GitHub Actions | — |
| **Security** | Bandit + Semgrep + Gitleaks + pip-audit + npm audit | — |

---

## System Architecture

```mermaid
graph TB
    subgraph Client["Browser"]
        UI["Next.js App Router\n(React 19, Tailwind v4)"]
        WS["Web Speech API\n(Voice Input)"]
        LF["Leaflet / OpenStreetMap\n(Inline Maps)"]
    end

    subgraph Vercel["Vercel (Frontend)"]
        NA["NextAuth v5\nGoogle OAuth Handler"]
        NR["Next.js Route Handlers\n/api/auth/*"]
    end

    subgraph Railway["Railway (Backend)"]
        FA["FastAPI\n(Uvicorn)"]
        DB[(SQLite / PostgreSQL\nSQLAlchemy ORM)]
    end

    subgraph External["External Services"]
        GO["Google OAuth 2.0"]
        AN["Anthropic API\nclaude-sonnet-4-6\nclaude-haiku-4-5"]
        OSM["OpenStreetMap\nTile Server"]
    end

    UI -- "HTTPS REST + SSE" --> FA
    UI -- "OAuth flow" --> NA
    NA -- "token verify" --> GO
    NA -- "session cookie" --> UI
    FA -- "verify ID token" --> GO
    FA -- "streaming /messages" --> AN
    FA -- "SQL" --> DB
    LF -- "map tiles" --> OSM
    WS -- "transcript" --> UI
```

---

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as Next.js
    participant NA as NextAuth
    participant G as Google OAuth
    participant BE as FastAPI

    U->>FE: Click "Sign in with Google"
    FE->>NA: Initiate OAuth
    NA->>G: Redirect to consent screen
    G-->>NA: Authorization code
    NA->>G: Exchange for ID token
    G-->>NA: id_token + profile
    NA-->>FE: Session cookie (JWT)
    FE->>BE: POST /auth/google {id_token}
    BE->>G: Verify token
    G-->>BE: User info (email, name)
    BE-->>FE: 200 OK
    FE->>U: Redirect to /chat
```

---

## Chat & SSE Streaming Flow

```mermaid
sequenceDiagram
    participant U as User
    participant FE as ChatClient.tsx
    participant BE as FastAPI
    participant AI as Anthropic API

    U->>FE: Type / speak message
    FE->>BE: POST /conversations/{id}/messages/stream
    Note over BE: Build system prompt with<br/>persona + liked places context
    BE->>AI: messages.stream() [claude-sonnet-4-6, 64k]
    loop SSE chunks
        AI-->>BE: text delta
        BE-->>FE: data: {"type":"delta","text":"..."}
    end
    AI-->>BE: message_stop
    BE->>AI: POST messages [haiku] — generate title
    BE-->>FE: data: {"type":"done","title":"..."}
    FE->>FE: injectHearts() — parse place names
    FE->>FE: Render Leaflet map per message
```

---

## Voice Input Flow

```mermaid
flowchart LR
    MB["MicButton.tsx\n(md=40px)"] -->|start| VH["useVoiceInput.ts\nWeb Speech API"]
    VH -->|"onresult\n(interim/final)"| TR["transcript state"]
    VH -->|"onspeechend\n→ 4s timer"| ST{"silence\n4 seconds?"}
    ST -->|yes| STOP["recognition.stop()"]
    ST -->|"new speech"| RT["reset timer"]
    STOP --> CC["ChatClient.tsx\nonSend callback\n(voiceSendRef)"]
    CC -->|"voice_mode: true"| BE["FastAPI\nstream endpoint"]
    BE -->|"system prompt\n+ follow-up instruction"| AI["Anthropic API"]
```

---

## Database Schema (ER Diagram)

```mermaid
erDiagram
    CONVERSATION {
        int id PK
        string user_email
        string title
        datetime created_at
        string travelling_as
        string travel_style
        string trip_length
        string interests
        string dietary
        bool has_pets
        string meetup_location
        string meetup_time
        string meetup_date
        string spontaneous_vibe
    }

    MESSAGE {
        int id PK
        int conversation_id FK
        string role
        text content
        datetime created_at
    }

    SAVED_TRIP {
        int id PK
        string user_email
        int conversation_id FK
        text content
        datetime created_at
    }

    USER_PROFILE {
        int id PK
        string email UK
        string display_name
        string avatar_url
        datetime created_at
    }

    LIKED_PLACE {
        int id PK
        string user_email
        string name
        string query
        string category
        float rating
        datetime created_at
    }

    CONVERSATION ||--o{ MESSAGE : "has"
    CONVERSATION ||--o{ SAVED_TRIP : "bookmarked as"
    USER_PROFILE ||--o{ LIKED_PLACE : "saves"
```

---

## Frontend Component Hierarchy

```mermaid
graph TD
    ROOT["app/layout.tsx\n(RootLayout)"]

    ROOT --> LP["LandingPage.tsx\n(unauthenticated)"]
    ROOT --> AL["AppLayout.tsx\n(authenticated wrapper)"]

    AL --> SB["Sidebar.tsx\n(history + persona)"]
    AL --> TB["TopBar.tsx\n(theme + sign out)"]
    AL --> MAIN["&lt;main&gt; — page content"]

    MAIN --> CP["chat/page.tsx\n(server component)"]
    MAIN --> SP["settings/page.tsx\n(server component)"]
    MAIN --> WP["welcome/page.tsx"]
    MAIN --> SI["signin/page.tsx"]

    CP --> CC["ChatClient.tsx\n(full chat UI)"]
    CC --> PS["PersonaSheet.tsx\n(wizard bottom sheet)"]
    CC --> MV["MapView.tsx\n(Leaflet per-message)"]
    CC --> MB["MicButton.tsx\n(voice trigger)"]
    CC --> VI["useVoiceInput.ts\n(Speech API hook)"]

    SP --> SC["SettingsClient.tsx\n(profile + trips + liked places)"]

    TB --> TS["ThemeSwitcher.tsx\n(14 themes)"]
    TB --> TL["TravelAILogo.tsx\n(SVG compass)"]
```

---

## API Endpoints

```mermaid
graph LR
    subgraph Auth
        A1["POST /auth/google"]
        A2["GET /health"]
    end

    subgraph Conversations
        C1["POST /conversations"]
        C2["GET /conversations?user_email="]
        C3["GET /conversations/{id}"]
        C4["DELETE /conversations/{id}"]
        C5["PATCH /conversations/{id}/title"]
        C6["POST /conversations/{id}/messages/stream"]
        C7["PATCH /conversations/{id}/persona"]
        C8["GET /conversations/last-persona"]
    end

    subgraph Trips
        T1["POST /saved-trips"]
        T2["GET /saved-trips?user_email="]
        T3["DELETE /saved-trips/{id}"]
    end

    subgraph Profile
        P1["GET /profile?user_email="]
        P2["POST /profile"]
        P3["GET /liked-places?user_email="]
        P4["POST /liked-places"]
        P5["DELETE /liked-places/{id}"]
    end
```

---

## Persona Modes & AI Prompt Routing

```mermaid
flowchart TD
    PM["Trip Persona\n(PersonaSheet.tsx)"] --> TG{travelling_as}

    TG -->|"solo / couple /\nfamily / friends / work"| STD["Standard Planner\nFull persona context\nRoute + stops + drive times"]
    TG -->|meetup| MT["Meetup Mode\nQuiet + WiFi venues\nOpening hours check\nLocation + time + date"]
    TG -->|spontaneous| SD["Spontaneous Drive Mode\nEvening only, open now\n1hr proximity\nKid-friendly\nVibe-driven (6 options)"]

    STD --> LP2["Liked Places\ninjected into system prompt\nGrouped by category"]
    MT --> LP2
    SD --> LP2

    LP2 --> AI2["claude-sonnet-4-6\n64k output tokens\nextended-output beta"]
```

---

## CI/CD & Security Pipeline

```mermaid
flowchart LR
    PUSH["git push / PR"] --> GHA["GitHub Actions"]

    GHA --> B["Bandit\nPython static analysis\nFail on HIGH severity"]
    GHA --> S["Semgrep\nOWASP Top 10 + secrets\nFail on ERROR severity"]
    GHA --> D["Dependency Audit\nnpm audit + pip-audit\nFail on high/critical"]
    GHA --> G["Gitleaks\nSecret scanning\ncontinue-on-error"]

    B --> GATE["Security Gate\n(needs all 4 jobs)"]
    S --> GATE
    D --> GATE
    G --> GATE

    GATE -->|pass| DEPLOY["deploy.yml\nVercel + Railway\n(merge to main only)"]
    GATE -->|fail| BLOCK["Block merge\nUpload artifacts"]
```
