# Event Roster

Catering event and employee assignment management starter project.

## Stack
- Frontend: React + TypeScript + Tailwind CSS + Vite
- Backend: Node.js + Express
- Database: MongoDB + Mongoose
- Email OTP: Resend
- SMS assignment notification: Twilio (optional, requires account credentials)

## Requirements
- Node.js 20+
- MongoDB Atlas URI or local MongoDB
- Resend API key and a verified sender/domain
- Twilio credentials and a verified/approved SMS sender/number for real SMS delivery

## Run locally

### 1. Backend
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
Fill in `MONGODB_URI`, `JWT_SECRET`, `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
For real SMS, fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER`.

### 2. Frontend
Open a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal.

## Important integrations
- Resend is used to send registration email OTP. Resend requires a valid API key and a sender identity allowed by your Resend account.
- Twilio SMS is wired into the assignment API. Without Twilio environment variables, assignments are saved but SMS delivery is skipped and the API response explains this.
- Never commit `.env` files or share API keys.
- The app capitalizes typed input text in the UI. Email addresses are normalized to lowercase before sending to the backend.
- This is a starter implementation. Before production, add rate limiting, password reset, stronger audit logging, backups, and a review of security/privacy requirements.
