# Contracts Modülü — Statice MRF PRD

> **Amaç:** Bu doküman, Statice MRF Dashboard'ındaki kontrat yönetimi modülünü açıklar. Tedarikçilerle yapılan anlaşmalar, atık akışı bazında fiyatlandırma, kontrat–sipariş eşleştirme mekanizması ve fatura üretimine temel oluşturan veri yapıları burada tanımlanır.

> **Bağlam:** Statice, atık akışlarını işlemek için tedarikçilerle (PRO'lar, ticari şirketler, bireyler) kontratlar yapar. Her kontrat: hangi malzemenin hangi fiyata işleneceğini, fatura döngüsünü ve kontaminasyon cezalarını belirler. Sipariş tamamlandığında kontrat otomatik eşleştirilir ve fatura hesapları bu kontrata göre yapılır.

---

## 1. Modülün Sistemdeki Yeri

```
Entity (tedarikçi / taşıyıcı / bertarafçı) yaratılır
       ↓
Finance Manager kontrat oluşturur (DRAFT)
       ↓
Waste stream'ler + rate line'lar eklenir
       ↓
Kontrat onaylanır → ACTIVE
       ↓
Inbound Order tamamlanınca otomatik eşleşme:
  contractService.findActiveContractForSupplier()
       ↓
Fatura dönemine göre invoice hesapları → INVOICE MODÜLÜ
       ↓
Kontrat süresi dolunca → EXPIRED
       veya manuel olarak → INACTIVE
```

---

## 2. Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| **SupplierContract** | Tedarikçiyle yapılan ana sözleşme. Birden fazla waste stream içerebilir. |
| **ContractWasteStream** | Kontrat içindeki her atık akışı. Ayrı fiyatlandırma satırlarına sahip olabilir. |
| **ContractRateLine** | Belirli bir malzeme/waste stream için birim fiyat (kg başına veya adet başına). |
| **ContractContaminationPenalty** | Kontrata bağlı ceza kalemleri (kirliliğe göre). `FeeMaster`'dan seçilir. |
| **FeeMaster** | Sistemdeki tüm ücret/ceza referans verileri (sabit, kg başına, %). |
| **MatchStrategy** | Siparişin kontratla nasıl eşleştirileceği: aynı gün kesin eşleşme, pencere, manuel, ad-hoc. |

---

## 3. Veri Modeli

### 3.1 SupplierContract

```
SupplierContract
  id                        UUID (PK)
  contract_number           String (CONTR-YYYY-XXXXX, unique)
  
  -- Entity FK'lar (yeni birleşik model)
  entity_supplier_id        FK → Entity (tedarikçi)
  agreement_transporter_id  FK → Entity? (taşıyıcı — opsiyonel)
  buyer_id                  FK → Entity? (alıcı)
  sender_id                 FK → Entity? (gönderici)
  disposer_id               FK → Entity? (bertarafçı)
  disposer_site_id          FK → DisposerSite? (bertaraf noktası)
  invoice_entity_id         FK → Entity? (kime fatura kesilecek)
  
  -- Kontrat tipi ve durumu
  contract_type             ContractType (SUPPLY|DISPOSAL|TRANSPORT|PROCESSING)
  status                    ContractStatus (DRAFT|ACTIVE|EXPIRED|INACTIVE)
  
  -- Geçerlilik
  effective_date            DateTime
  expiry_date               DateTime?
  
  -- Faturalama
  invoicing_frequency       String (PER_ORDER|WEEKLY|MONTHLY|QUARTERLY)
  payment_terms_days        Int? (örn. 30, 60)
  currency                  String (default: EUR)
  
  -- Eşleştirme stratejisi
  match_strategy            MatchStrategy (EXACT_SAME_DAY|EXACT_WINDOW|MANUAL|AD_HOC)
  
  notes                     String?
  created_at                DateTime
  updated_at                DateTime
  
  -- İlişkiler
  waste_streams[]           ContractWasteStream[]
  rate_lines[]              ContractRateLine[]
  penalties[]               ContractContaminationPenalty[]
  orders[]                  InboundOrder[]
```

**ContractStatus state machine:**
```
DRAFT → ACTIVE (onaylanınca)
          ↓
       EXPIRED (expiry_date geçince, otomatik)
       veya
       INACTIVE (manuel terminate)
```

### 3.2 ContractWasteStream

```
ContractWasteStream
  id                  UUID
  contract_id         FK → SupplierContract
  waste_stream_id     FK → WasteStream
  afvalstroomnummer   String? (PRO tedarikçiler için Hollanda atık akış kodu)
  receiver_id         FK → Entity? (bu akışı alacak entity)
  rate_lines[]        ContractRateLine[] (waste stream'e özel fiyatlandırma)
  
  @@unique([contract_id, waste_stream_id])  -- aynı kontrata aynı waste stream iki kez eklenemez
```

### 3.3 ContractRateLine

```
ContractRateLine
  id                      UUID
  contract_id             FK → SupplierContract
  contract_waste_stream_id FK → ContractWasteStream? (waste stream'e özel rate)
  material_id             FK → MaterialMaster? (materyal bazında rate)
  pricing_model           String (WEIGHT|QUANTITY)
  unit_rate               Decimal (kg veya adet başına tutar)
  btw_rate                Decimal (KDV oranı, örn. 21.0)
  processing_method       String? (işleme yöntemi açıklaması)
  valid_from              DateTime
  valid_to                DateTime?
  superseded_at           DateTime? (eski rate'lerin geçmiş kaydı)
```

Geçmiş rate takibi: `superseded_at` set edilince rate pasif olur, yeni rate yaratılır. Böylece eski siparişlerin fiyatları bozulmaz.

### 3.4 ContractContaminationPenalty

```
ContractContaminationPenalty
  id          UUID
  contract_id FK → SupplierContract
  fee_id      FK → FeeMaster
```

### 3.5 FeeMaster

```
FeeMaster
  id            UUID
  fee_code      String (unique)
  name          String
  fee_type      String (CONTAMINATION_CHARGE|PROCESSING_CHARGE|ADMINISTRATIVE_FEE)
  fee_rate_type String (FIXED|PERCENTAGE|PER_KG|PER_HOUR)
  rate          Decimal
  currency      String (default: EUR)
  is_active     Boolean
```

---

## 4. API Endpoints

### Contracts (`/api/contracts`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/contracts` | ALL | Liste (supplier_id, status, waste_stream_id filtreleri) |
| GET | `/contracts/:id` | ALL | Tam detay: rate lines, waste streams, penalties |
| GET | `/contracts/dashboard` | FINANCE_MANAGER, ADMIN | KPI görünümü (aktif, süresi dolan, onay bekleyen) |
| GET | `/contracts/match` | ALL | Kontrat eşleştirme motoru |
| GET | `/contracts/match-for-order` | ALL | Sipariş için eşleşen kontratı bul |
| POST | `/contracts` | FINANCE_MANAGER, ADMIN | Draft kontrat oluştur |
| PUT | `/contracts/:id` | FINANCE_MANAGER, ADMIN | Güncelle (DRAFT veya ACTIVE) |
| POST | `/contracts/:id/approve` | FINANCE_MANAGER, ADMIN | DRAFT → ACTIVE |
| POST | `/contracts/:id/terminate` | FINANCE_MANAGER, ADMIN | ACTIVE → INACTIVE |
| POST | `/contracts/:id/waste-streams` | FINANCE_MANAGER, ADMIN | Waste stream ekle |
| DELETE | `/contracts/:id/waste-streams/:cwsId` | FINANCE_MANAGER, ADMIN | Waste stream kaldır |
| POST | `/contracts/:id/rate-lines` | FINANCE_MANAGER, ADMIN | Rate line ekle/güncelle |
| PUT | `/contracts/rate-lines/:lineId` | FINANCE_MANAGER, ADMIN | Rate line güncelle |
| DELETE | `/contracts/rate-lines/:lineId` | FINANCE_MANAGER, ADMIN | Rate line sil |
| PUT | `/contracts/:id/penalties` | FINANCE_MANAGER, ADMIN | Ceza kalemlerini sync et |

---

## 5. Servis Katmanı

### `contractService.js` (~1,208 satır)

- `listContracts(filters)` — sayfalandırılmış, tam include
- `getContractById(id)` — rate lines, waste streams, penalties dahil tam detay
- `createContract(data, userId)` — DRAFT status, `CONTR-YYYY-XXXXX` numarası üretir
- `approveContract(id, userId)` — DRAFT → ACTIVE; effective_date geçmişte olamaz validasyonu
- `terminateContract(id, userId)` — ACTIVE → INACTIVE
- `addWasteStream(contractId, wsData, userId)` — `ContractWasteStream` oluştur
- `removeWasteStream(contractId, cwsId, userId)` — sil (rate line'lar varsa uyar)
- `addRateLine(contractId, lineData, userId)` — rate oluştur; mevcutsa `superseded_at` set edip yeni yarat
- `updateRateLine(lineId, data, userId)` — rate güncelle
- `removeRateLine(lineId, userId)` — sil
- `syncPenalties(contractId, penaltyData, userId)` — FeeMaster entry'lerini kontrata bağla
- **`findActiveContractForSupplier(supplierId, date)`** — inbound order tamamlanınca otomatik çağrılır; verilen tarih için aktif kontrat bulur
- **`matchContractForOrder(supplierId, materialId, date, tx)`** — materyal düzeyinde kontrat rate eşleştirmesi; fatura hesabında kullanılır

---

## 6. Business Rules

1. **Unique waste stream per contract:** Aynı kontrata aynı waste stream iki kez eklenemez (`@@unique` constraint).
2. **Rate geçmişi korunur:** Rate güncellemesi = eski rate'e `superseded_at` set et + yeni rate yarat. Eski siparişlerin fiyatı değişmez.
3. **Otomatik kontrat eşleştirme:** Sipariş COMPLETED durumuna geçince `findActiveContractForSupplier()` otomatik çalışır. Eşleşme bulunamazsa sipariş COMPLETED kalır ama `matched_contract_id` null olur — manuel eşleştirme gerekir.
4. **match_strategy:**
   - `EXACT_SAME_DAY`: Sipariş tarihi = kontrat effective date aynı gün
   - `EXACT_WINDOW`: effective_date ≤ sipariş tarihi ≤ expiry_date
   - `MANUAL`: Otomatik eşleşme denenmez, sistem kullanıcıya sormadan devam eder
   - `AD_HOC`: Ad-hoc gelişler için kontrat zorunlu değil
5. **BTW (KDV):** Her rate line'da ayrı BTW oranı tanımlanır (Hollanda KDV mevzuatı).
6. **PRO tedarikçiler:** `afvalstroomnummer` — LMA raporlaması için zorunlu.

---

## 7. UI Sayfaları

| Sayfa | Route | Rol | Açıklama |
|-------|-------|-----|----------|
| ContractsDashboardPage | `/contracts` | FM, ADMIN | KPI + aktif kontrat listesi |
| ContractDetailPage | `/contracts/:id` | FM, ADMIN | Tam kontrat görünümü, rate tabloları |
| ContractCreatePage | `/contracts/new` | FM, ADMIN | Yeni kontrat formu (entity seçimi, waste streams, rates) |

---

## 8. Diğer Modüllerle Bağlantı Noktaları

| Modül | Bağlantı |
|-------|---------|
| **Inbound** | Sipariş tamamlanınca `findActiveContractForSupplier()` çalışır → `matched_contract_id` set edilir |
| **Entities** | `entity_supplier_id`, `buyer_id`, `sender_id`, `disposer_id` — Entity tablosundan |
| **Invoices** | `ContractRateLine.unit_rate` × teslim edilen ağırlık = fatura tutarı; `invoicing_frequency` fatura dönemini belirler |
| **Reports** | RPT-01 (Circularity Statement) tedarikçi + tarih aralığına göre kontrat verilerini kullanır |
| **Admin** | `FeeMaster` kayıtları admin tarafından yönetilir, kontrat penalty'lerinde kullanılır |

---

## 9. Önemli Kararlar

- **Entity migration:** Eski `Supplier` / `Carrier` modelleri `Entity` modeline taşındı. Kontrat FK'ları `entity_*_id` ismiyle güncellendi, eski `supplier_id` / `carrier_id` FK'lar geçici backward-compat için kaldı.
- **Rate versioning:** "Update rate" yerine "supersede and create new" pattern'i; fatura hesaplarında geriye dönük tutarlılık sağlar.
- **Contamination penalties:** `FeeMaster`'dan seçilir — sabit bir ceza kataloğu var, her kontrat istediği kalemleri seçer.
- **CONTR numarası:** `CONTR-YYYY-XXXXX` formatı, yıllık sıfırlanan beş haneli sıra numarası.
