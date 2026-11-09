# Lab Report Portal

Secure lab report delivery for patients and front-desk staff (brief #3, Diagnostic lab chain).

- Live: https://lab-portal-ten.vercel.app
- Stack: Next.js 16, TypeScript, Prisma 6, Postgres (Neon), Tailwind, Vitest

## What works end to end
- LIS CSV import -> report becomes signed -> expiring link created automatically (mock SMS)
- Patient login by mobile + OTP (family: one mobile, many patients)
- Link opens only after OTP to the registered mobile; links expire in 72 hours
- Out-of-range flags from rules (reference ranges), plain-language summary in English, Telugu and Hindi (locked templates)
- Critical values: no summary, callback task for staff
- Front desk: search, resend link (old link stops working), delivery status, callbacks, access log

## Run locally
See deployment.md.

## Tests
`npm test`
