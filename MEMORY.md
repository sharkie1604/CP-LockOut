# Lockout.io Architectural State Memory

## Current Completed Features
- [ ] Phase 1: Environment Monorepo Scaffold (Pending)
- [ ] Phase 2: Supabase Schema Configuration (Pending)
- [ ] Phase 3: Central Backend Worker Loop (Pending)

## Current Execution Focus
- Currently working on initializing the basic monorepo file paths and configuring the backend `server.js` boilerplate.

## State Variables & Key Mappings
- User Rating Tiers: Script Kiddie (<1200), Debugger (1200-1399), Stack Overlord (1400-1599), Core Engineer (1600-1899), System Architect (1900-2199), Kernel Master (2200+).
- Room Concurrency Lock Status column: `users.status` ('free' vs 'busy').