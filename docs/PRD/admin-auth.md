# Admin & Auth Modülü — Statice MRF PRD

> **Amaç:** Bu doküman, Statice MRF Dashboard'ındaki kullanıcı yönetimi, kimlik doğrulama, denetim kaydı ve sistem yönetimi modüllerini açıklar.

> **Bağlam:** Tüm operasyonların merkezi yönetim noktası. Admin modülü; kullanıcı hesaplarını, rol-tabanlı erişimi, sistem genelindeki master verileri (waste stream, ücret katalogları) ve denetim izini yönetir. Auth, JWT tabanlı token akışını tanımlar.

---

## 1. Kullanıcı Rolleri

| Rol (Kod) | Türkçe | Yetkiler |
|-----------|--------|---------|
| `GATE_OPERATOR` | Kapı/Kantar Operatörü | Araç gelişi, kantarlama, skip kaydı |
| `LOGISTICS_PLANNER` | Lojistik Planlayıcı | Sipariş oluşturma, planlama tahtası, çıkış siparişi |
| `LOGISTICS_COORDINATOR` | Lojistik Koordinatör | Lojistik planlayıcıyla benzer; ek koordinasyon görevleri |
| `SORTING_EMPLOYEE` | Sıralama Çalışanı | Sorting session girişi (process modülü) |
| `QC_INSPECTOR` | Kalite Kontrol | İşleme kayıtlarını onaylama (`CONFIRMED` geçişi) |
| `REPORTING_MANAGER` | Raporlama Yöneticisi | Rapor üretimi ve zamanlanmış raporlar |
| `SALES` | Satış | Salt-okunur erişim + sirkülasyon beyanları |
| `FINANCE_USER` | Finans Kullanıcısı | Kontrat görüntüleme, fatura görüntüleme |
| `FINANCE_MANAGER` | Finans Müdürü | Kontrat ve fatura tam yönetimi, entity oluşturma |
| `COMPLIANCE_OFFICER` | Uyum Yetkilisi | Sorting onayı, denetim kayıtları, uyum raporları |
| `ADMIN` | Sistem Yöneticisi | Tam erişim; kullanıcı yönetimi, sistem ayarları |

---

## 2. Auth Modülü

### 2.1 Token Akışı

```
Kullanıcı /login sayfasına gider
       ↓
E-posta + şifre gönderilir
       ↓
Server: credentials doğrula → bcrypt hash karşılaştırması
       ↓
accessToken üretilir (15 dakika)  +  refreshToken üretilir (7 gün)
  ↓                                        ↓
Memory'de (Zustand store)          HttpOnly cookie'de saklanır
ASLA localStorage'a yazılmaz
       ↓
Her API isteğinde Authorization: Bearer <accessToken>
       ↓
accessToken süresi dolunca → 401 yanıtı
       ↓
Frontend otomatik /auth/refresh çağrısı
  → HttpOnly cookie'deki refreshToken ile yeni accessToken alınır
       ↓
Kullanıcı çıkışında: refreshToken server tarafında geçersiz kılınır
```

### 2.2 API Endpoints (`/api/auth`)

| Method | Path | Açıklama |
|--------|------|----------|
| POST | `/auth/login` | Kimlik doğrula, token üret, HttpOnly cookie set et |
| POST | `/auth/refresh` | Cookie'deki refresh token ile yeni access token |
| POST | `/auth/logout` | HttpOnly cookie'yi temizle |
| GET | `/auth/me` | Aktif kullanıcı profili + rol + izinler |

### 2.3 Middleware (`server/src/middleware/auth.js`)

```javascript
authenticateToken(req, res, next)
// Authorization header'dan Bearer token çıkarır
// JWT doğrular → req.user = { id, email, role }
// Geçersiz/süresi dolmuş → 401 Unauthorized

requireRole(roles[])
// req.user.role allowed list'te mi kontrol eder
// Yoksa → 403 Forbidden
```

Her route dosyasında:
```javascript
router.get('/endpoint', authenticateToken, requireRole(['ADMIN', 'FINANCE_MANAGER']), controller)
```

---

## 3. Admin Modülü

### 3.1 User Management

#### Veri Modeli

```
User
  id            UUID (PK)
  email         String (unique)
  password_hash String (bcrypt)
  full_name     String
  role          Role enum (11 rol)
  is_active     Boolean (default: true)
  last_login_at DateTime?
  created_at    DateTime
  updated_at    DateTime
```

#### API Endpoints (`/api/admin/users`)

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/admin/users` | Kullanıcı listesi |
| POST | `/admin/users` | Yeni kullanıcı oluştur |
| GET | `/admin/users/:id` | Kullanıcı detayı |
| PUT | `/admin/users/:id` | Güncelle (full_name, role, email) |
| POST | `/admin/users/:id/reset-password` | Şifre sıfırlama linki gönder |
| PATCH | `/admin/users/:id/status` | Aktif ↔ Deaktif |
| GET | `/admin/users/:id/activity` | Kullanıcının audit trail'i |

**Business Rules:**
- Deaktif kullanıcılar login yapamaz
- Admin kendi hesabını deaktif edemez
- Şifre sıfırlama e-posta ile gönderilir (nodemailer)
- Yeni kullanıcı oluşturulduğunda geçici şifre veya aktivasyon linki

### 3.2 Audit Log

Her DB mutation otomatik olarak kaydedilir:

#### Veri Modeli

```
AuditLog
  id          UUID (PK)
  user_id     FK → User
  action      String (CREATE | UPDATE | DELETE | STATUS_CHANGE | SUBMIT | APPROVE | TERMINATE | ...)
  entity_type String (örn. "InboundOrder", "SortingSession", "SupplierContract")
  entity_id   String (değiştirilen kaydın UUID'si)
  before      Json? (değişiklik öncesi snapshot)
  after       Json? (değişiklik sonrası snapshot)
  timestamp   DateTime
  ip_address  String?
```

#### `auditLog.js` Utility

```javascript
writeAuditLog({ userId, action, entityType, entityId, before, after }, tx?)
// Prisma transaction'ı içinde çalışır
// Her servis fonksiyonu kendi transaction'ında writeAuditLog çağırır
```

**Kapsanan olaylar:**
- Tüm CREATE / UPDATE / DELETE işlemleri
- Durum geçişleri (STATUS_CHANGE)
- Form gönderimleri (SUBMIT — SortingSession, WeighingEvent)
- Kontrat işlemleri (APPROVE, TERMINATE)
- Ağırlık düzeltmeleri (WEIGHT_OVERRIDE)
- Kullanıcı yönetimi (USER_CREATED, PASSWORD_RESET, USER_DEACTIVATED)

#### API Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/admin/audit-logs` | Sistem audit log listesi (entity_type, user_id, date filtreleri) |
| GET | `/admin/audit-logs/:id` | Belirli audit kaydının detayı (before/after JSON diff) |

### 3.3 Master Data Yönetimi

#### Waste Streams

```
WasteStream
  id          UUID
  code        String (unique, örn. "WEEE", "METALS", "PLASTICS")
  name_en     String
  name_nl     String
  cbs_code    String? (CBS istatistik kodu)
  is_active   Boolean
  created_at  DateTime
```

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/admin/waste-streams` | Tüm waste stream'ler |
| POST | `/admin/waste-streams` | Yeni ekle |
| PUT | `/admin/waste-streams/:id` | Güncelle |
| PATCH | `/admin/waste-streams/:id/status` | Aktif/pasif |

#### Product Categories (Legacy — MaterialMaster'a migrasyon aşamasında)

```
ProductCategory (eski model — yeni geliştirmeler MaterialMaster kullanır)
  id                   UUID
  code_cbs             String (CBS kodu, örn. "WEEE-01")
  description_en       String
  description_nl       String
  waste_stream_id      FK → WasteStream
  recycled_pct_default Decimal
  reused_pct_default   Decimal
  disposed_pct_default Decimal
  landfill_pct_default Decimal
  is_active            Boolean
```

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/admin/product-categories` | Tüm kategoriler |
| POST | `/admin/product-categories` | Yeni kategori |
| PUT | `/admin/product-categories/:id` | Güncelle |
| DELETE | `/admin/product-categories/:id` | Sil |

#### Sistem Ayarları

```
SystemSettings (tek satır tablo)
  company_name         String
  company_address      String
  default_currency     String (EUR)
  default_timezone     String (Europe/Amsterdam)
  locale               String (nl-NL)
  pfister_device_ip    String? (gerçek Pfister entegrasyonu için)
  pfister_port         Int?
```

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/admin/settings` | Mevcut ayarlar |
| PUT | `/admin/settings` | Ayarları güncelle |

#### Fee Master (Ücret Kataloğu)

Kontaminasyon cezaları ve diğer ücretler için referans veri:

```
FeeMaster
  id            UUID
  fee_code      String (unique, örn. "CONT-001")
  name          String
  fee_type      String (CONTAMINATION_CHARGE | PROCESSING_CHARGE | ADMINISTRATIVE_FEE)
  fee_rate_type String (FIXED | PERCENTAGE | PER_KG | PER_HOUR)
  rate          Decimal
  currency      String
  is_active     Boolean
```

| Method | Path | Açıklama |
|--------|------|----------|
| GET | `/admin/fees` | Ücret kataloğu listesi |
| POST | `/admin/fees` | Yeni ücret kalemi |
| PUT | `/admin/fees/:id` | Güncelle |
| PATCH | `/admin/fees/:id/status` | Aktif/pasif |

---

## 4. UI Sayfaları

| Sayfa | Route | Rol | Açıklama |
|-------|-------|-----|----------|
| UsersPage | `/admin/users` | ADMIN | Kullanıcı listesi + yönetim |
| AuditLogPage | `/admin/audit-log` | ADMIN | Sistem denetim kaydı |
| SystemSettingsPage | `/admin/settings` | ADMIN | Sistem ayarları |
| FeeMasterPage | `/admin/fees` | ADMIN, FM | Ücret kataloğu |
| MaterialsManagementPage | `/admin/materials` | ADMIN | Material + Fraction master data |
| LoginPage | `/login` | Herkese açık | E-posta + şifre formu |

---

## 5. Güvenlik Notları

1. **Şifreler bcrypt ile hash'lenir** — düz metin asla saklanmaz.
2. **refreshToken HttpOnly cookie** — XSS saldırılarında JavaScript erişimi yok.
3. **accessToken memory'de** — localStorage/sessionStorage kullanılmaz (XSS riski azaltılır).
4. **Token yenileme otomatik** — kullanıcı 401 aldığında frontend sessizce /auth/refresh çağırır.
5. **Her endpoint korumalı** — `authenticateToken` + `requireRole` middleware çifti zorunlu.
6. **SQL injection yok** — tüm sorgular Prisma parametreli query'leri kullanır.
7. **HTTPS production'da zorunlu** — geliştirmede HTTP, production'da HTTPS enforce edilir.

---

## 6. Seed Data (Geliştirme Ortamı)

```
admin@statice.nl        / Admin1234!    → ADMIN
planner@statice.nl      / Planner123!   → LOGISTICS_PLANNER
gate@statice.nl         / Gate1234!     → GATE_OPERATOR
reporting@statice.nl    / Report123!    → REPORTING_MANAGER
sorting@statice.nl      / Sorting123!   → SORTING_EMPLOYEE
finance@statice.nl      / Finance123!   → FINANCE_MANAGER
compliance@statice.nl   / Comply123!    → COMPLIANCE_OFFICER
```

`server/prisma/seed.js` (master data — entity'ler, waste stream'ler, kategoriler, kullanıcılar)
`server/scripts/seedDemoData.js` (operasyonel demo verisi — siparişler, inbound'lar, kontratlar)

---

## 7. Önemli Kararlar

- **11 rol:** Başlangıçta 4 rol vardı (PRD v2.0), sistem büyüdükçe Hollanda iş süreçlerindeki gerçek rol ayrımları (COMPLIANCE_OFFICER, FINANCE_MANAGER, QC_INSPECTOR vb.) eklendi.
- **AuditLog her mutation'da:** Tek bir mutation transaction'ı dışında kalan AuditLog yazımı yasak — veri tutarsızlığı riski. `writeAuditLog()` her zaman Prisma transaction'ı içinde çağrılır.
- **İki seeding scripti:** `seed.js` sadece master/referans veriyi yönetir (idempotent, güvenle tekrar çalıştırılabilir). `seedDemoData.js` operasyonel demo verisi içerir — production'da çalıştırılmaz.
