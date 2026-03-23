Required Dependencies
1. Node.js (v18+) — check with node -v
2. PostgreSQL (v15-16) — either local installation or Docker
3. Git — to clone the repo

Setup Steps from Scratch

# 1. Clone
cd ~/statice-test
git clone https://github.com/semihalbyrk/statice.git .

# 2. Root dependencies
npm install

# 3. Server setup
cd server
npm install

# 4. Create .env file (not included in repo!)
cat > .env << 'EOF'
DATABASE_URL=postgresql://statice:statice123@localhost:5432/statice_mrf
JWT_SECRET=statice-jwt-secret-dev-2026
JWT_REFRESH_SECRET=statice-refresh-secret-dev-2026
PORT=3001
NODE_ENV=development

# 5. PostgreSQL DB — with Docker:
cd ..
docker compose up -d
#    OR if you have local PG:
#    createdb statice_mrf  (or via psql)

# 6. Migration + Seed
cd server
npx prisma migrate dev
node prisma/seed.js

# 7. Start server
npm run dev
# → http://localhost:3001

# 8. New terminal — Client
cd ~/statice-test/client
npm install
npm run dev
# → http://localhost:3000

# 9. Login: admin@statice.nl / Admin1234!

Important Notes:
1. .env file is not in git — if you skip step 4, the server won't work
2. PostgreSQL must be running (step 5) — otherwise migrations will fail
3. Node.js, Git, and Docker (or local PostgreSQL) must be installed on your machine
