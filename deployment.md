# Deployment

## Run locally
1. Node 20+. `npm install`
2. Copy `.env.example` to `.env` and fill the values (see names below)
3. `npx prisma migrate deploy`
4. `npx prisma db seed`
5. `npm run dev` -> http://localhost:3000
6. `npm test`

## Environment variables (names only)
- `DATABASE_URL` (Postgres connection string)
- `SESSION_SECRET` (32+ random chars)
- `LINK_SECRET` (random text)
- `DEMO_SHOW_OTP` (`true` shows OTP and links on screen, because SMS is mocked)
- `AI_API_KEY` (optional, empty)

## How it is deployed
- Code on GitHub, deployed to Vercel (`vercel --prod`)
- Build: `prisma generate && next build`
- Database: Neon Postgres (free plan)
- Live: https://lab-portal-ten.vercel.app

## Demo logins (fake data, OTP is shown on screen)
- Front desk: 9000000001 (opens /desk)
- Patient, one report (critical potassium): 9000000003
- Family, two patients: 9000000002 (Lakshmi, Venkata Rao)
- Secure link demo: /desk -> Resend link -> open the demo link shown -> OTP -> report
