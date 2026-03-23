Gerekli Bağımlılıklar
Node.js (v18+) — node -v ile kontrol
PostgreSQL (v15-16) — ya local kurulum ya da Docker
Git — repo'yu klonlamak için
Sıfırdan Kurulum Adımları

Sıfırdan Kurulum — statice-test

# 1. Klonla
cd ~/statice-test
git clone https://github.com/semihalbyrk/statice.git .

# 2. Root dependencies
npm install

# 3. Server kurulumu
cd server
npm install

# 4. .env dosyasını oluştur (repo'da gelmiyor!)
cat > .env << 'EOF'
DATABASE_URL=postgresql://statice:statice123@localhost:5432/statice_mrf
JWT_SECRET=statice-jwt-secret-dev-2026
JWT_REFRESH_SECRET=statice-refresh-secret-dev-2026
PORT=3001
NODE_ENV=development
EOF

# 5. PostgreSQL DB — Docker ile:
cd ..
docker compose up -d
#    VEYA local PG varsa:
#    createdb statice_mrf  (ya da psql ile)

# 6. Migration + Seed
cd server
npx prisma migrate dev
node prisma/seed.js

# 7. Server başlat
npm run dev
# → http://localhost:3001

# 8. Yeni terminal — Client
cd ~/statice-test/client
npm install
npm run dev
# → http://localhost:3000

# 9. Login: admin@statice.nl / Admin1234!
Dikkat edilmesi gerekenler:

.env dosyası git'te yok — 4. adımı atlarsanız server çalışmaz
PostgreSQL'in çalışıyor olması lazım (5. adım) — yoksa migration patlar
Makinede Node.js, Git, ve Docker (veya local PostgreSQL) kurulu olmalı