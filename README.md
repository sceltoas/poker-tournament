# Scelto Poker Tournament Dashboard

Real-time poker tournament management dashboard for company events.

## Quick Start

### Prerequisites
- Docker & Docker Compose (for PostgreSQL + Mailhog)
- Node.js 20+
- pnpm

### 1. Setup

```bash
cp .env.example .env
pnpm generate-vapid          # copy keys into .env
pnpm install
```

### 2. Start Dependencies

```bash
docker-compose up -d          # PostgreSQL + Mailhog
```

### 3. Initialize Database (first run)

```bash
pnpm db:migrate
pnpm db:seed
```

### 4. Start Dev Servers

```bash
pnpm dev                      # starts server (3001) + client (5173)
```

- **App**: [localhost:5173](http://localhost:5173)
- **API**: [localhost:3001](http://localhost:3001)
- **Mailhog**: [localhost:8025](http://localhost:8025)

### 5. Login

Go to [localhost:5173](http://localhost:5173), enter any seeded `@scelto.no` email,
then check [Mailhog](http://localhost:8025) for the magic link.

Admin accounts: `ken.gullaksen@scelto.no`, `erik.larsen@scelto.no`

## Features

- Graphical poker table view (up to 10 tables, 8 seats each)
- Real-time updates via WebSocket
- Player elimination with push + email notifications
- Admin-controlled table merging with suggestions
- AFK/back status toggle (no notifications)
- Beer toast broadcast
- Final results leaderboard with podium
- Passwordless magic-link authentication via email
