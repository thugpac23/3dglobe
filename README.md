# 🌍 Travel Globe Tracker

An interactive 3D dark-themed globe where **tati** and **iva** can track the countries they've visited. Built with Next.js, Three.js (globe.gl), Prisma, and Neon PostgreSQL.

## Features

- 🌐 Interactive 3D globe with country click/hover
- 🟡 **tati**'s visited countries shown in gold
- 🩷 **iva**'s visited countries shown in pink
- 🟠 Countries visited by **both** shown in orange
- 📊 Summary table with 3 columns: tati / iva / both
- 🔄 Real-time data synced from PostgreSQL (Neon)
- 🌒 Dark theme UI

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), TypeScript, Tailwind CSS |
| 3D Globe | globe.gl (Three.js-based) |
| ORM | Prisma |
| Database | PostgreSQL via Neon |
| Deployment | Vercel |

## Setup

### 1. Clone & install

```bash
git clone https://github.com/thugpac23/3dglobe.git
cd 3dglobe
npm install
```

### 2. Configure environment

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Edit `.env.local` with your Neon connection string:

```env
DATABASE_URL="postgresql://username:password@host/dbname?sslmode=require"
```

Get a free Neon database at [neon.tech](https://neon.tech).

### 3. Set up the database

```bash
# Push the Prisma schema to your database
npm run db:push

# Seed with all world countries
npm run db:seed
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deployment (Vercel)

1. Push to GitHub
2. Import the repository at [vercel.com](https://vercel.com)
3. Add environment variable `DATABASE_URL` in Vercel project settings
4. Vercel will auto-deploy on every push

The `vercel.json` file configures Vercel to run `prisma generate` before each build.

## API Routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/visits` | Get all visits with country data |
| `POST` | `/api/visit` | Add a visit `{ countryId, user }` |
| `DELETE` | `/api/visit` | Remove a visit `{ countryId, user }` |
| `GET` | `/api/country?iso=XX` | Look up a country by ISO code |

## Database Schema

```prisma
model Country {
  id      String  @id @default(cuid())
  name    String
  capital String
  isoCode String  @unique
  visits  Visit[]
}

model Visit {
  id        String   @id @default(cuid())
  countryId String
  user      User     // "tati" | "iva"
  createdAt DateTime @default(now())
  country   Country  @relation(...)

  @@unique([countryId, user])
}

enum User {
  tati
  iva
}
```

## Usage

1. **Select active user** — click the `tati` or `iva` button
2. **Click a country** on the globe — toggles visited state for the active user
3. **Hover** over a country to see who has visited it
4. View the **summary table** below the globe

## Country Coloring

| Color | Hex | Meaning |
|-------|-----|---------|
| 🟡 Gold | `#FFD700` | Only tati visited |
| 🩷 Pink | `#FF69B4` | Only iva visited |
| 🟠 Orange | `#FFB347` | Both visited |
