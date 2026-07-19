# Lockout.io System Specification

## Overview
Lockout.io is a competitive programming lockout platform where users compete in real-time 1v1 match-ups to solve programming problems. The system integrates with the Codeforces API to track user submissions and verify problem completion.

---

## 1. Database Architecture (Supabase / PostgreSQL)

### Users Table
Tracks user authentication, profiles, current Codeforces handles, rating, and availability status.
* `id`: uuid (Primary Key, matches auth.users)
* `handle`: varchar (Codeforces username, unique)
* `rating`: integer (Default: 1500)
* `status`: varchar (Enum: `'free'`, `'busy'`)
* `created_at`: timestamptz

### Leaderboard Table
Tracks all-time ranking, wins, losses, and overall points for users.
* `id`: uuid (Primary Key)
* `user_id`: uuid (Foreign Key -> Users.id)
* `handle`: varchar (Codeforces username)
* `points`: integer (Default: 0)
* `wins`: integer (Default: 0)
* `losses`: integer (Default: 0)
* `rank`: integer
* `updated_at`: timestamptz

### Matches Table
Tracks individual 1v1 lockout matches, active problems, current scores, and settings.
* `id`: uuid (Primary Key)
* `challenger_id`: uuid (Foreign Key -> Users.id)
* `opponent_id`: uuid (Foreign Key -> Users.id)
* `status`: varchar (Enum: `'pending'`, `'active'`, `'completed'`, `'abandoned'`)
* `mode`: varchar (Enum: `'Mode A'`, `'Mode B'`)
* `problems`: jsonb (List of Codeforces problems selected for the match, with point values)
* `scores`: jsonb (Point tracking per player per problem)
* `winner_id`: uuid (Foreign Key -> Users.id, nullable)
* `created_at`: timestamptz
* `completed_at`: timestamptz

---

## 2. Centralized Polling & Rate-Limiting Logic

To prevent Codeforces API rate limit blocks and ensure scalable performance, all submission polling is channeled through a centralized background queue loop on the backend. No individual setInterval loops are allowed per room.

### Mode A: Standard Duel (Conveyor Belt Logic)
* **Polling Strategy**: One handle at a time (sequential conveyor belt).
* **Rate-Limit Guardrail**: **2-second interval** delay between querying each handle.
* **Details**: Iterates through the list of active players in all active Mode A matches. If there are $N$ active players, player $i$ is polled at step $i$, then the system sleeps for 2 seconds before polling player $i+1$.

### Mode B: Mashup / High-Frequency Tracking
* **Polling Strategy**: Batch/pool polling.
* **Tracking Guardrail**: **3-second pool** refresh cycle.
* **Details**: High-frequency tracking utilizing the Codeforces contest status or multi-handle polling API. Refreshes the score and submission status for all active Mode B participants every 3 seconds.

---

## 3. Developer Stack Hierarchy

Users are categorized into rating tiers based on their lockout rating, modeled after competitive programming ranks with corresponding visual color designations:

| Tier | Rating Range | Visual Color | Hex Code / Tailwind Class |
| :--- | :--- | :--- | :--- |
| **Script Kiddie** | `< 1200` | Gray | `#94A3B8` (`text-slate-400`) |
| **Debugger** | `1200 - 1399` | Green | `#22C55E` (`text-green-500`) |
| **Stack Overlord** | `1400 - 1599` | Cyan | `#06B6D4` (`text-cyan-500`) |
| **Core Engineer** | `1600 - 1899` | Blue | `#3B82F6` (`text-blue-500`) |
| **System Architect** | `1900 - 2199` | Purple | `#A855F7` (`text-purple-500`) |
| **Kernel Master** | `2200+` | Red | `#EF4444` (`text-red-500`) |
