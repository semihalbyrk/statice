Prerequisites
Node.js (v18+) — Verify with node -v
PostgreSQL (v15-16) — Either a local installation or via Docker
Git — To clone the repository

Step-by-Step Setup from Scratch

1. Clone the Repository
Bash
cd ~/statice-test
git clone https://github.com/semihalbyrk/statice.git .

2. Install Root Dependencies
Bash
npm install

3. Server Setup
Bash
cd server
npm install

4. Create the .env File
The .env file is not included in the repository. Create it manually in the server directory with the following content:
Code snippet
DATABASE_URL=postgresql://statice:statice123@localhost:5432/statice_mrf
JWT_SECRET=statice-jwt-secret-dev-2026
JWT_REFRESH_SECRET=statice-refresh-secret-dev-2026
PORT=3001
NODE_ENV=development

5. PostgreSQL DB — via Docker:
cd ..
docker compose up -d

6. Migration + Seeding
Bash
cd server
npx prisma migrate dev
node prisma/seed.js

7. Start the Server
Bash
npm run dev
# Running at → http://localhost:3001

8. Client Setup (New Terminal)
Bash
cd ~/statice-test/client
npm install
npm run dev
# Running at → http://localhost:3000

9. Login Credentials
Email: admin@statice.nl
Password: Admin1234!

Important Notes:
Environment Variables: The .env file is not tracked by Git. If you skip Step 4, the server will not run.
Database Status: Ensure PostgreSQL is running (Step 5) before proceeding; otherwise, the migration process will fail.
System Requirements: Ensure Node.js, Git, and Docker (or a local PostgreSQL instance) are properly installed on your machine.
