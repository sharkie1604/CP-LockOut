# Lockout.io Architectural State Memory

## Current Completed Features
- [x] Phase 1: Environment Monorepo Scaffold
- [x] Phase 2: Supabase Schema Configuration
- [x] Phase 3: Central Backend Worker Loop
- [/] Phase 4: Frontend Development (In Progress)

## Current Execution Focus
- Frontend API engine (`api.js`), visual theme rules (`theme.js`), and App component workspace structure completed. Reactive views for Lobby and Lockout Arena are connected to match APIs.

## State Variables & Key Mappings
- **Developer Stack Hierarchy (Rating Tiers & Colors)**:
  - Script Kiddie (<1200) - Gray (`#94A3B8`)
  - Debugger (1200-1399) - Green (`#22C55E`)
  - Stack Overlord (1400-1599) - Cyan (`#06B6D4`)
  - Core Engineer (1600-1899) - Blue (`#3B82F6`)
  - System Architect (1900-2199) - Purple (`#A855F7`)
  - Kernel Master (2200+) - Red (`#EF4444`)
- **Database Tables**: Users, Leaderboard, Matches.
- **Room Concurrency Lock Status column**: `users.status` ('free' vs 'busy').
- **Central Polling Queue Logic**:
  - **Mode A (Duel)**: Conveyor belt logic (2-second interval per handle).
  - **Mode B (Mashup)**: High-frequency pool tracking (3-second refresh cycle).