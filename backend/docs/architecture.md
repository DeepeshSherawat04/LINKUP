# LINKUP Architecture

## Stack
- Frontend: React + Vite + TailwindCSS
- Backend: Node.js + Express
- Database: Supabase (Postgres)
- Cache: Redis
- AI: OpenAI (optional)

## Data Flow
1. User fills profile → stored in Supabase `users` table
2. Skills mapped to opportunities via `skills` table
3. Scoring engine calculates fit score
4. Execution plan + income simulation generated
5. Redis caches opportunity list for speed