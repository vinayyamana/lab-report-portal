# Deployment guide: Lab Report Portal

GitHub: https://github.com/vinayyamana/lab-report-portal
Live app: <paste your Vercel URL here>

Stack: Next.js 16 (frontend + API routes), PostgreSQL (Neon), Prisma 6, Vitest.

## 1. Run locally

Requirements: Node.js 20 or newer, a PostgreSQL database (a free Neon project works).

1. Clone: `git clone https://github.com/vinayyamana/lab-report-portal.git` then `cd lab-report-portal`
2. Create the env file BEFORE installing (npm install runs prisma generate, which needs DATABASE_URL):
   `cp .env.example .env` (Windows PowerShell: `Copy-Item .env.example .env`), then fill in the values from section 3.
3. `npm install`
4. `npx prisma migrate deploy` then `npx prisma db seed` (running the seed again resets the sample data)
5. `npm run dev` and open http://localhost:3000
6. `npm test`

Windows note: if prisma generate fails with EPERM, stop all running node processes, delete node_modules\.prisma and run the command again.

## 2. How it is deployed

- App: Vercel, imported from the GitHub repo. Build command: `npm run build` (runs prisma generate, then next build).
- Database: Neon PostgreSQL in an India region (for example AWS Mumbai), so health data stays in India (DPDP Act 2023).
- Add the environment variables from section 3 in Vercel: Settings, Environment Variables.
- Create tables once from your laptop, with the Neon DATABASE_URL in .env: `npx prisma migrate deploy` then `npx prisma db seed`.

## 3. Environment variables (names only, never values)

- DATABASE_URL (required): PostgreSQL connection string
- SESSION_SECRET (required): signs the login session cookie, use 32+ random characters
- AI_API_KEY (optional): key for the AI summary. If missing or the AI fails, locked summary templates are used
- AI_MODEL (optional): AI model name, a default is used when empty
- DEMO_SHOW_OTP (demo only): when true the OTP is shown on screen because SMS is mocked. Must be unset in a real deployment

.env.example also lists LINK_SECRET. The current code does not read it.

## 4. Demo logins for the reviewer

Set DEMO_SHOW_OTP=true on the demo deployment. After entering a mobile number, the login page shows "Demo code: ......". No passwords. All numbers are fake.

- Front desk: 9000000001. Open /desk: import samples/lis-export.csv, see callback tasks, resend a link, view the access log.
- Patient (family of 2): 9000000002. Lakshmi Prasanna K and Venkata Rao M. After the OTP, pick whose reports to open. Lakshmi's Haemoglobin 10.2 is Low and gets a plain-language summary in English, Telugu or Hindi.
- Patient (critical value): 9000000003. Farzana Begum, Potassium 6.8 mmol/L. No summary is shown and the front desk gets a callback task.

Expiring link flow: the SMS is mocked. In local development the link is printed in the terminal as "[MOCK SMS] ... /r/<token>". Open that path, request the OTP and enter it. In production the link is not printed (it is a secret).

## 5. Known limits

- SMS and WhatsApp are mocked. A real gateway is the next step.
- OTP requests are limited to 3 per mobile per 15 minutes.
- The PDF shows English parameter names only (standard PDF fonts). The screen report and summaries support Telugu and Hindi.