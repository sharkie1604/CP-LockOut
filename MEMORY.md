# Lockout.io Architectural State Memory

## Current Completed Features
- [x] Phase 1: Environment Monorepo Scaffold
- [x] Phase 2: Supabase Schema Configuration
- [x] Phase 3: Central Backend Worker Loop
- [/] Phase 4: Frontend Development (In Progress)

## Current Execution Focus
- Real-time Supabase subscription loop wired up on the frontend (`App.jsx`). Polling interval removed in favor of instant event-based state updates. Ranks and colors finalized.

## State Variables & Key Mappings
- **Developer Stack Hierarchy (Rating Tiers & Colors)**:
  - Script Kiddie (<1200) - Gray (`#9E9E9E`)
  - Debugger (1200-1399) - Green (`#4CAF50`)
  - Stack Overlord (1400-1599) - Cyan (`#00BCD4`)
  - Core Engineer (1600-1899) - Blue (`#2196F3`)
  - System Architect (1900-2199) - Purple (`#9C27B0`)
  - Kernel Master (2200+) - Red (`#FF5722`)
- **Database Tables**: Users, Leaderboard, Matches.
- **Room Concurrency Lock Status column**: `users.status` ('free' vs 'busy').
- **Central Polling Queue Logic**:
  - **Mode A (Duel)**: Conveyor belt logic (2-second interval per handle).
  - **Mode B (Mashup)**: High-frequency pool tracking (3-second refresh cycle).