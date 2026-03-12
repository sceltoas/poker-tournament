# Scelto Poker Tournament Dashboard

## Project Overview
Real-time poker tournament management dashboard for Scelto company poker nights. Dark casino-themed UI with live WebSocket updates, push notifications, and passwordless auth.

## Tech Stack
- **Frontend**: Vite + React 18 + TypeScript (port 5173)
- **Backend**: Express + TypeScript + Socket.IO (port 3001)
- **Database**: PostgreSQL 16 via Prisma ORM
- **Auth**: Passwordless magic links via email (JWT sessions)
- **Notifications**: Web Push (VAPID) + email (Nodemailer)
- **Dev infra**: Docker Compose (PostgreSQL + Mailhog), pnpm workspaces

## Getting Started
```bash
cp .env.example .env
pnpm generate-vapid               # copy keys into .env
pnpm install
docker-compose up -d               # starts PostgreSQL + Mailhog
pnpm db:migrate
pnpm db:seed
pnpm dev                           # starts server (3001) + client (5173)
# App: localhost:5173 | Mailhog: localhost:8025 | API: localhost:3001
```

Admin account in seed: `ken.gullaksen@scelto.no`

## Architecture

### Directory Structure
```
poker-tournament/
├── docker-compose.yml
├── client/                     # Vite React app
│   ├── src/
│   │   ├── App.tsx             # Router + push notification init
│   │   ├── pages/
│   │   │   ├── DashboardPage   # Main tournament view (tables, eliminations, toasts)
│   │   │   ├── AdminPage       # Create tournament, select players
│   │   │   ├── LoginPage       # Magic link request
│   │   │   └── VerifyPage      # Magic link verification
│   │   ├── components/
│   │   │   ├── PokerTable      # Oval felt table with 8 positioned seats
│   │   │   ├── Header          # Nav bar with AFK, beer toast, admin buttons
│   │   │   ├── EliminatedList  # Knocked-out players list
│   │   │   ├── FinalResults    # Podium + full results table
│   │   │   ├── MergeBanner     # Admin merge suggestion banner
│   │   │   ├── BeerToastOverlay # Full-screen animated beer toast
│   │   │   └── NotificationToast
│   │   ├── contexts/
│   │   │   ├── AuthContext     # JWT token + player state
│   │   │   └── SocketContext   # Socket.IO connection
│   │   ├── hooks/
│   │   │   ├── useApi          # Fetch wrapper with auth headers
│   │   │   └── usePushNotifications  # Service worker + VAPID subscription
│   │   ├── types.ts            # Shared TypeScript interfaces
│   │   └── index.css           # Full CSS (dark casino theme)
│   └── public/sw.js            # Push notification service worker
│
└── server/                     # Express API
    ├── prisma/
    │   ├── schema.prisma       # 6 models: Player, Tournament, TournamentTable, TournamentPlayer, PushSubscription, MagicLink
    │   └── seed.ts             # 20 @scelto.no players
    └── src/
        ├── index.ts            # Express + Socket.IO setup
        ├── middleware/auth.ts  # JWT auth + admin guard
        ├── routes/
        │   ├── auth.ts         # POST /login, GET /verify, GET /me
        │   ├── tournaments.ts  # CRUD + eliminate, merge, AFK, toast, results
        │   ├── players.ts      # GET all, POST create
        │   └── push.ts         # Subscribe/unsubscribe push
        └── services/
            ├── websocket.ts    # Socket.IO event emitters
            ├── email.ts        # Magic links + elimination emails
            └── pushNotification.ts  # Web Push via VAPID
```

### Database Schema (Prisma)
- **Player** — id, name, email (@scelto.no), isAdmin flag
- **Tournament** — id, name, status (REGISTRATION → ACTIVE → FINISHED), timestamps
- **TournamentTable** — id, tournamentId, tableNumber, isActive
- **TournamentPlayer** — id, tournamentId, playerId, tableId, seatNumber, status (ACTIVE/ELIMINATED/AFK), finishPosition
- **PushSubscription** — endpoint + VAPID keys per player
- **MagicLink** — token-based passwordless login

### WebSocket Events (Socket.IO)
All scoped to `tournament:{id}` rooms:
- `tournament-update` — full state refresh
- `player-eliminated` — name, position, remaining count
- `merge-suggestion` — from/to table suggestion (admin only)
- `tables-merged` — confirmation with updated state
- `beer-toast` — player name broadcast
- `player-status-change` — AFK/back toggle
- `tournament-finished` — final state with results

### API Routes
```
POST   /api/auth/login              — request magic link
GET    /api/auth/verify?token=      — verify magic link, return JWT
GET    /api/auth/me                 — current player

GET    /api/tournaments             — list all
GET    /api/tournaments/:id         — full tournament state
POST   /api/tournaments             — create (admin, body: {name, playerIds[]})
POST   /api/tournaments/:id/start   — start tournament (admin)
POST   /api/tournaments/:id/eliminate/:playerId — eliminate player (admin or self)
POST   /api/tournaments/:id/merge   — merge tables (admin, body: {fromTableId, toTableId})
POST   /api/tournaments/:id/afk     — toggle AFK (self)
POST   /api/tournaments/:id/toast   — beer toast broadcast (any player)
GET    /api/tournaments/:id/results — final results

GET    /api/players                 — list all players
POST   /api/players                 — add player (admin)

POST   /api/push/subscribe          — save push subscription
POST   /api/push/unsubscribe        — remove push subscription
```

## Implemented Features
- [x] Graphical poker table view (up to 10 tables, 8 seats each, oval green felt)
- [x] Real-time updates via WebSocket (Socket.IO)
- [x] Player elimination with push notification (web) + email to all participants
- [x] Eliminated players greyed out at table until merge, shown in knocked-out list
- [x] Admin merge suggestions when table drops below 4 active players
- [x] Admin accepts/dismisses merge — players redistributed to new seats
- [x] Tournament creation: admin selects players from DB, auto-assigns to tables
- [x] Magic link login sent to all players when tournament created
- [x] AFK / I'm back toggle (no push/email for these)
- [x] Beer toast button — global animated overlay + web push (no email)
- [x] Final results: podium (1st/2nd/3rd) + full leaderboard when tournament ends
- [x] Dark casino-themed responsive CSS
- [x] Docker Compose for full local dev stack

## Planned Features / TODO
- [ ] Tournament history page — browse past tournaments and their results
- [ ] Player statistics — win rate, average finish position, tournaments played
- [ ] Blind timer — configurable blind levels with on-screen countdown + audio alert
- [ ] Chip count tracking — players or admin can log chip counts
- [ ] Spectator mode — non-players can watch without auth
- [ ] Table rebalancing — when tables are uneven (not just merge, but redistribute)
- [ ] Seating randomization on demand (admin reshuffles)
- [ ] Mobile-optimized table view (cards-style layout for small screens)
- [ ] Sound effects — card shuffle on tournament start, elimination sound, toast clink
- [ ] Admin: pause/resume tournament
- [ ] Admin: undo last elimination
- [ ] Dark/light theme toggle
- [ ] Cloud deployment config (fly.io / Railway / Render)
- [ ] CI/CD pipeline
- [ ] Test suite (Vitest for client, Jest/Supertest for server)

## Key Business Logic

### Table Assignment
On tournament creation, players are shuffled randomly and distributed evenly across tables (max 8 per table). Number of tables = ceil(playerCount / 8).

### Elimination Flow
1. Admin or player clicks eliminate
2. Server assigns `finishPosition = currentActivePlayers` (last place = highest number)
3. Status set to ELIMINATED, timestamp recorded
4. WebSocket emits `player-eliminated` to all in tournament room
5. Web Push sent to all active players (except eliminated)
6. Email sent to all active players
7. Server checks if only 1 player left → auto-finish tournament, assign position #1
8. Server checks if any table below threshold (4) → emit `merge-suggestion` to admins

### Merge Flow
1. Server suggests merging smallest table into table with most room
2. Admin sees banner, clicks Accept
3. Players from source table get new seat numbers at destination
4. Source table marked `isActive: false`
5. Full state refresh emitted via WebSocket

## Code Style
- TypeScript strict mode everywhere
- Functional React components with hooks
- No state management library — React context + local state + Socket.IO
- CSS is vanilla (single index.css file, no CSS modules or Tailwind)
- Express routes use async handlers
- Prisma for all DB access (no raw SQL)
