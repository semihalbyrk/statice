# Statice MRF Dashboard — Project Knowledge

## 1. Proje Nedir?

Statice, Hollanda'da bulunan bir **e-waste (elektronik atık) geri dönüşüm tesisi** (MRF — Material Recovery Facility). Bu dashboard, tesisin tüm operasyonel süreçlerini dijitalleştiren bir web uygulamasıdır.

**Problem:** Tesis şu anda Excel ve kağıt bazlı Pfister tartım fişleriyle çalışıyor. Bu, manuel veri girişi hataları yaratıyor ve Hollanda'nın zorunlu dijital raporlama yükümlülükleriyle uyumsuz.

**Çözüm:** Gelen kargo kaydı, tartım, ayırma (sorting) ve raporlamayı tek bir dashboard'da dijitalleştirmek.

**Geliştiren:** Evreka Engineering ekibi (Evreka360 ürün ailesinin bir parçası)

---

## 2. Tech Stack

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18, React Router v6, Tailwind CSS, shadcn/ui, Zustand |
| Backend | Node.js, Express.js, REST API |
| Database | PostgreSQL 15 + Prisma ORM |
| Auth | JWT (access token memory'de, refresh token HttpOnly cookie) |
| Raporlama | PDFKit (PDF), ExcelJS (XLSX) |
| Test | Vitest + Supertest (server), Vitest + React Testing Library (client) |
| Monorepo | `/client` (React, Vite, port 3000) + `/server` (Express, port 3001) |

---

## 3. Kullanıcı Rolleri

| Rol | Açıklama |
|-----|----------|
| GATE_OPERATOR | Kapıda araç kaydı, skip (konteyner) kaydı, tartım tetikleme |
| LOGISTICS_PLANNER | Planlı gelen sipariş oluşturma/yönetme |
| SORTING_EMPLOYEE | Ayırma kayıtları |
| REPORTING_MANAGER | Rapor oluşturma ve zamanlama |
| SALES | Satış ve kontrat yönetimi |
| QC_INSPECTOR | Kalite kontrol |
| FINANCE_USER / FINANCE_MANAGER | Fatura ve finansal işlemler |
| COMPLIANCE_OFFICER | Uyumluluk |
| ADMIN | Tam erişim |

---

## 4. Ana Modüller

### Modül 1 — Inbound Cargo & Order Management
- **Sipariş yaşam döngüsü:** PLANNED → ARRIVED → IN_PROGRESS → COMPLETED (veya CANCELLED)
- Lojistik planlayıcı planlı sipariş oluşturur
- Kapı operatörü araç geldiğinde plaka ile eşleştirir veya ad-hoc sipariş oluşturur
- Carrier (taşıyıcı) ve Supplier (tedarikçi) master listeleri admin tarafından yönetilir
- Supplier tipleri: Private Individual, PRO (Stichting Open), Third Party

### Modül 2 — Skip / Asset Registration
- Skip = fiziksel konteyner (bak). Bir araçta 1-3 skip olabilir
- Her skip'e benzersiz asset label atanır: `SKP-YYYYMMDD-NNN`
- Skip tipleri: OPEN_TOP, CLOSED_TOP, GITTERBOX, PALLET, OTHER
- Her skip bir ürün kategorisine bağlı, tartılır, izlenir

### Modül 3 — Pfister Weighing Integration (Simulated)
- Pfister Cloudweigh = tesisin tartı köprüsü (weighbridge)
- Şu an **simüle ediliyor** (pfisterSimulator.js). Gerçek entegrasyonda sadece bu dosya değişecek
- İş akışı: PENDING_GROSS → GROSS_COMPLETE → PENDING_TARE → TARE_COMPLETE → CONFIRMED
- Brüt tartım → skip kaydı → tara tartımı → net ağırlık hesaplanır → onay
- Dijital tartım fişi (weight ticket) PDF olarak indirilebilir

### Modül 4 — Sorting & Material Recording
- Araç boşaltılıp tartıldıktan sonra her skip'in içeriği fiziksel olarak ayrıştırılır
- Ürün kategorileri iki seviyeli: Waste Stream (Afvalstroom) → Product Category
- WEEE (e-waste) kategorileri: Büyük ev aletleri, küçük ev aletleri, IT ekipmanı, monitörler, kablolar, bataryalar vb. (20 CBS kodu)
- Her kategori için geri kazanım oranları: recycled %, reused %, disposed %, landfill % (toplam = 100%)
- SortingSession → SortingLine (skip başına, kategori başına ağırlık ve oranlar)

### Modül 5 — Reporting
| Rapor | Amaç |
|-------|------|
| RPT-01 | Supplier Circularity Statement — tedarikçiye gönderilen geri dönüşüm belgesi |
| RPT-02 | Material Recovery Summary — CBS, İl, yönetim için aylık/çeyreklik özet |
| RPT-03 | Chain-of-Custody — izlenebilirlik raporu |
| RPT-04 | Inbound Weight Register — günlük/haftalık tartım kaydı |
| RPT-05 | Waste Stream Analysis — atık akışı analizi |
| RPT-06 | Skip Asset Utilisation — konteyner kullanım raporu |

Tüm raporlar PDF ve XLSX olarak indirilebilir. Zamanlanmış (scheduled) raporlar e-posta ile gönderilebilir.

---

## 5. Ek Modüller (PRD Dışı, Sonradan Eklenen)

Prisma schema'ya bakıldığında PRD'deki 5 temel modülün ötesinde şunlar da eklenmiş:

- **Contracts (Kontratlar):** Tedarikçi/alıcı kontratları, pricing tiers, kontaminasyon izleme
- **Invoicing:** Fatura modülü (ContractStatus: DRAFT → ACTIVE → TERMINATED)
- **Inbound akışı genişletilmiş:** InboundStatus (ARRIVED → WEIGHED_IN → WEIGHED_OUT → READY_FOR_SORTING → SORTED)
- **Processing Records:** İşleme kayıtları (DRAFT → FINALIZED → CONFIRMED → SUPERSEDED)
- **Treatment Routes:** RECYCLED, REUSED, DISPOSED
- **Incidents:** Hasar, anlaşmazlık, özel işlem kayıtları
- **Weight Amendments:** Tartım düzeltmeleri (kalibrasyon hatası, ekipman arızası vb.)

---

## 6. Veri Modeli — Ana Entity'ler

```
User → (oluşturur) → InboundOrder
InboundOrder → Carrier, Supplier, WasteStream
InboundOrder → WeighingEvent(s)
WeighingEvent → Vehicle, PfisterTicket (gross/tare), Asset(s)
Asset (Skip) → ProductCategory
WeighingEvent → SortingSession → SortingLine(s)
SortingLine → ProductCategory (ağırlık + geri kazanım oranları)
Contract → Supplier, PricingTier(s)
AuditLog → her mutation'ı kaydeder
```

---

## 7. İş Akışı (End-to-End)

1. **Lojistik planlayıcı** planlı sipariş oluşturur (carrier, supplier, tarih, beklenen skip sayısı)
2. **Araç gelir** → kapı operatörü plakayı girer → sistem sipariş eşleştirir
3. **Brüt tartım** → Pfister tetiklenir → brüt ağırlık kaydedilir
4. **Skip kaydı** → araçtaki her konteyner ayrı ayrı kaydedilir
5. **Tara tartımı** → boş araç tartılır → net ağırlık hesaplanır
6. **Tartım onayı** → dijital tartım fişi oluşturulur
7. **Ayırma (sorting)** → her skip'in içeriği kategorilere ayrılır, ağırlıklar ve geri kazanım oranları girilir
8. **Raporlama** → CBS, tedarikçi, yönetim raporları oluşturulur

---

## 8. Hollanda Regülasyon Bağlamı

- **CBS:** Hollanda İstatistik Kurumu — atık akışı raporlaması gerekli
- **LMA:** Landelijk Meldpunt Afvalstoffen — ulusal atık bildirim noktası
- **Province:** İl düzeyinde çevre raporlaması
- **Afvalstroomnummer:** Hollanda atık akışı kayıt numarası
- **WEEE Directive:** AB elektronik atık direktifi — geri dönüşüm oranları burada tanımlı
- **Stichting Open (PRO):** E-waste toplama konteynerleri işleten Hollanda vakfı — ana yüksek hacimli tedarikçi
- **KvK number:** Hollanda Ticaret Odası kayıt numarası

---

## 9. Mimari Kararlar

- **Thin controllers:** Business logic service katmanında, controller sadece route/response
- **Prisma transactions:** Her DB mutation transaction içinde
- **AuditLog:** Her mutation'da zorunlu — timestamp, user, entity type, entity ID, JSON diff
- **JWT auth:** Access token 15dk, refresh token 7 gün (HttpOnly cookie)
- **Pfister service contract:** `pfisterService.requestWeighing('GROSS' | 'TARE')` → `Promise<PfisterTicket>`. Simülatörü değiştirmek controller/frontend'i etkilemez
- **Design tokens:** Evreka360 design system'den türetilmiş CSS variables + Tailwind classes

---

## 10. Kapsam Dışı (Out of Scope)

- DIWASS entegrasyonu
- Outbound lojistik
- Mobil uygulama
- Müşteri portalı
- (Invoicing kısmen eklenmiş durumda, PRD scope dışı ama implement edilmiş)

---

## 11. Geliştirme Ortamı

```bash
# Server: Express on port 3001
cd server && npm run dev

# Client: React/Vite on port 3000
cd client && npm run dev

# Database
cd server && npx prisma migrate dev
cd server && node prisma/seed.js

# Test
cd server && npm test
cd client && npm test
```

Default seed users:
- admin@statice.nl / Admin1234! → ADMIN
- planner@statice.nl / Planner123! → LOGISTICS_PLANNER
- gate@statice.nl / Gate1234! → GATE_OPERATOR
- reporting@statice.nl / Report123! → REPORTING_MANAGER
