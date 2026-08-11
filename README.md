# Scorli 🃏

A cross-platform (iOS + Android) card game scorekeeping app built with Expo, React Native, and TypeScript.

## Features

- Track scores for **Skyjo**, **Rummy**, and **Custom** card games
- Multi-player support (2–8 players) with color-coded columns
- Round-by-round score grid with live running totals
- Skyjo doubling penalty automatically applied when closer isn't strictly lowest
- Undo last round, edit any score
- Full offline persistence via SQLite (expo-sqlite + Drizzle ORM)
- Optional Supabase accounts, cloud backup, and sync
- Game history with final standings

## Offline-first by default

Scorli remains fully usable with no account and no network connection. Supabase auth and sync are additive: local games continue to work even when cloud features are not configured.

## Setup

### Prerequisites

- Node.js 20+
- [Expo CLI](https://docs.expo.dev/get-started/installation/): `npm install -g expo-cli`
- [EAS CLI](https://docs.expo.dev/eas/): `npm install -g eas-cli`

### Install dependencies

```bash
npm install
```

### Optional Supabase setup

1. Copy `.env.example` to `.env.local`.
2. Fill in `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
3. Apply the SQL in `supabase/migrations/` to your Supabase project.
4. Deploy the Edge Function in `supabase/functions/delete-account`.
5. Run the RLS assertions in `supabase/tests/rls_test.sql` after resetting your local Supabase DB.

If you skip these steps, Scorli still works locally with offline storage only.

### Start the development server

```bash
npm start
```

Then scan the QR code with **Expo Go** on your iOS or Android device, or press `i` for iOS simulator / `a` for Android emulator.

### Run on device via Expo Go

1. Install **Expo Go** from the App Store or Google Play.
2. Run `npm start`.
3. Scan the QR code shown in the terminal.

## Running Tests

```bash
npm test
```

## TypeScript Check

```bash
npm run typecheck
```

## Lint

```bash
npm run lint
```

## Adding a New Game Type

1. Create `src/rules/<gamename>.ts` implementing the `GameRules` interface from `src/rules/types.ts`.
2. Export the rule object from your file.
3. Add it to the registry in `src/rules/index.ts`:
   ```ts
   import { myGame } from './mygame';
   const registry: Record<string, GameRules> = {
     skyjo,
     rummy,
     custom,
     mygame: myGame,
   };
   ```
4. The new game type will appear automatically in the "New Game" screen.
5. Add a corresponding row to `game_types` (seeded in `src/db/client.ts` → `initDB`).

## EAS Build & Submit

### Development build (internal)

```bash
eas build --profile development --platform all
```

### Preview build

```bash
eas build --profile preview --platform all
```

### Production build

```bash
eas build --profile production --platform all
```

### Submit to stores

```bash
eas submit --platform ios
eas submit --platform android
```

Update `eas.json` with your Apple ID, ASC App ID, Apple Team ID, and Google service account key path before submitting.

## Database Migrations

```bash
npm run db:generate   # generate migration files from schema
npm run db:migrate    # apply local SQLite migrations
```

Supabase SQL migrations live under `supabase/migrations/`.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Expo SDK 51 + React Native |
| Language | TypeScript (strict) |
| Navigation | expo-router |
| Styling | NativeWind v4 (Tailwind) |
| State | Zustand |
| Database | expo-sqlite + Drizzle ORM |
| Cloud | Supabase Auth + Edge Functions |
| Testing | Jest + @testing-library/react-native |
| Linting | ESLint (eslint-config-expo) + Prettier |
| CI/CD | GitHub Actions + EAS |
