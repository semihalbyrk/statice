# Orders Modülü — Statice MRF PRD

> **Amaç:** Bu doküman, Statice MRF Dashboard'ındaki sipariş yönetimi modülünü açıklar. Gelen teslimatların planlanması, sipariş–kontrat eşleştirme, araç plaka bazlı arama ve planlama tahtası bu modülde yönetilir. **Gate Operator akışından (kantarlama, araç gelişi) ayrıdır — o akış `inbound.md`'dedir.**

> **Bağlam:** Lojistik Planlayıcı, kamyon gelmeden önce "InboundOrder" oluşturur. Bu, beklenen teslimata ait tedarikçi, taşıyıcı, planlanan tarih, beklenen skip sayısı ve waste stream bilgilerini içerir. Kamyon geldiğinde Gate Operator bu siparişle eşleştirme yaparak kantarlama akışını başlatır.

---

## 1. Modülün Sistemdeki Yeri

```
Logistics Planner → /orders/new sayfası
       ↓
InboundOrder oluşturulur (status: PLANNED)
  - Tedarikçi (entity_supplier_id)
  - Taşıyıcı (transporter_id)
  - Planlanan tarih + zaman penceresi
  - Beklenen araç plakası (opsiyonel)
  - Waste stream(ler) + afvalstroomnummer
  - Beklenen skip/asset sayısı
       ↓
SEÇENEK A — Planlı geliş:
  Gate Operator plakayı girer → matchPlate() aktif siparişi bulur
  → Inbound yaratılır, sipariş ARRIVED'a geçer
  → [inbound.md akışına devam]

SEÇENEK B — Ad-hoc geliş:
  Sipariş önceden yoktur
  Gate Operator plakayı girer → eşleşme yok → createAdhocArrival()
  → Sipariş + Inbound anında yaratılır (is_adhoc = true)
  → [inbound.md akışına devam]

       ↓
Kantarlama tamamlanır → IN_PROGRESS → COMPLETED
       ↓
Sistem aktif kontratı otomatik eşleştirir
  findActiveContractForSupplier(supplier_id, tarih)
       ↓
Fatura dönemine göre invoice hesapları → INVOICED
```

---

## 2. Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| **InboundOrder** | Bir teslimatın planlama kaydı. Opsiyonel — ad-hoc gelişlerde anında yaratılır. |
| **Inbound** | Siparişe bağlı fiili kantarlama olayı. Bir siparişin birden fazla inbound'u olabilir (birden fazla araç). |
| **matchPlate** | Araç plakasına göre ±7 gün pencerede aktif sipariş arama fonksiyonu. |
| **MatchStrategy** | Siparişin kontratla nasıl eşleştirileceği stratejisi (EXACT_SAME_DAY, EXACT_WINDOW, MANUAL, AD_HOC). |
| **Planning Board** | Takvim/timeline görünümü — günlük/haftalık planlanan siparişleri ve durumlarını gösterir. |
| **Incident** | DAMAGE, DISPUTE, SPECIAL_HANDLING veya DRIVER_INSTRUCTION kaydı. Sipariş DISPUTE'ya geçer. |

---

## 3. Veri Modeli

### 3.1 InboundOrder

```
InboundOrder
  id                        UUID (PK)
  order_number              String (ORD-YYYYMMDD-NNN, unique)

  -- Entity FK'lar (birleşik model)
  entity_supplier_id        FK → Entity (tedarikçi)
  transporter_id            FK → Entity? (taşıyıcı — opsiyonel)

  -- Planlama bilgileri
  planned_date              DateTime
  planned_time_window_start DateTime?
  planned_time_window_end   DateTime?
  vehicle_plate             String? (beklenen plaka)
  expected_skip_count       Int (default: 1)
  expected_asset_count      Int?

  -- Waste stream
  waste_stream_id           FK → WasteStream (birincil)
  waste_streams[]           OrderWasteStream[] (çoklu akış desteği)
  afvalstroomnummer         String? (LMA/CBS raporlaması için)

  -- Referanslar
  client_reference          String? (tedarikçinin kendi numarası)
  matched_contract_id       FK → SupplierContract? (otomatik eşleşme, COMPLETED'da set edilir)

  -- Bayraklar
  is_adhoc                  Boolean (default: false — plansız geliş)
  is_lzv                    Boolean (default: false — uzun araç / LZV)

  -- Durum
  status                    OrderStatus

  -- Incident
  incident_category         IncidentCategory? (DAMAGE|DISPUTE|SPECIAL_HANDLING|DRIVER_INSTRUCTION)
  incident_notes            String?

  notes                     String?
  created_by                FK → User
  created_at                DateTime
  updated_at                DateTime

  -- İlişkiler
  inbounds[]                Inbound[] (1:N — aynı siparişe birden fazla araç gelebilir)
  documents[]               OrderDocument[]
```

### 3.2 OrderStatus State Machine

```
PLANNED ──────────────────────────────→ CANCELLED
   ↓
ARRIVED ──────────────────────────────→ CANCELLED
   ↓
IN_PROGRESS
   ↓         ↘
DISPUTE    COMPLETED ──────────────────→ INVOICED
   ↓          (matched_contract_id set edilir)
IN_PROGRESS veya COMPLETED'a dönebilir
```

| Durum | Anlamı |
|-------|--------|
| `PLANNED` | Sipariş oluşturuldu, araç henüz gelmedi |
| `ARRIVED` | Araç geldi, inbound yaratıldı |
| `IN_PROGRESS` | Kantarlama başladı (en az 1 inbound IN_PROGRESS) |
| `DISPUTE` | Hasar, anlaşmazlık veya özel durum kaydı açıldı |
| `COMPLETED` | Tüm inbound'lar tamamlandı, sıralama yapıldı |
| `INVOICED` | Fatura kesildi |
| `CANCELLED` | İptal edildi (yalnızca PLANNED veya ARRIVED'dan) |

### 3.3 OrderWasteStream (N:M Junction)

Bir sipariş birden fazla waste stream taşıyabilir:

```
OrderWasteStream
  id                  UUID
  order_id            FK → InboundOrder
  waste_stream_id     FK → WasteStream
  afvalstroomnummer   String?
  planned_amount_kg   Decimal? (tahmini ağırlık)
```

### 3.4 OrderDocument

```
OrderDocument
  id              UUID
  order_id        FK → InboundOrder
  document_type   String
  file_name       String
  storage_path    String
  uploaded_by     FK → User
  uploaded_at     DateTime
```

---

## 4. API Endpoints (`/api/orders`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/orders` | ALL | Liste (status, date, entity_supplier_id, search filtreleri) |
| GET | `/orders/:id` | ALL | Tam detay: inbound'lar, eşleşen kontrat, waste stream'ler |
| POST | `/orders` | LP, LC, ADMIN | Planlı sipariş oluştur |
| PUT | `/orders/:id` | LP, LC, ADMIN | Güncelle (yalnızca PLANNED'da tam düzenleme) |
| DELETE | `/orders/:id` | ADMIN | İptal et |
| GET | `/orders/match-plate` | GO, ADMIN | Plakaya göre aktif sipariş ara (±7 gün) |
| POST | `/orders/adhoc-arrival` | GO, ADMIN | Ad-hoc geliş için sipariş + inbound birlikte yarat |
| POST | `/orders/:id/incident` | ALL | Hasar/anlaşmazlık kaydı ekle |
| POST | `/orders/:id/documents` | ALL | Doküman yükle |
| GET | `/orders/:id/documents` | ALL | Doküman listesi |
| GET | `/orders/:id/documents/:docId/download` | ALL | İndir |
| DELETE | `/orders/:id/documents/:docId` | ADMIN | Sil |
| GET | `/orders/planning-board` | LP, LC, ADMIN | Planlama tahtası (takvim/timeline görünümü) |

---

## 5. Servis Katmanı (`orderService.js` ~759 satır)

```javascript
listOrders(filters)
// Sayfalandırılmış liste
// Her sipariş için enrichment: expected_asset_count, received_asset_count, remaining_count
// Filtreler: status[], entity_supplier_id, date range, search (order_number, vehicle_plate)

getOrder(id)
// Tam detay: inbound'lar + their assets, matched contract, waste stream'ler, dokümanlar

createOrder(data, userId)
// order_number üretir (ORD-YYYYMMDD-NNN)
// OrderWasteStream junction kayıtlarını sync eder
// AuditLog: CREATE

updateOrder(id, data, userId)
// orderStateMachine üzerinden durum geçişlerini validate eder
// AuditLog: UPDATE

cancelOrder(id, userId)
// PLANNED veya ARRIVED'dan CANCELLED'a geçiş
// AuditLog: STATUS_CHANGE

setIncident(orderId, category, notes, userId)
// IN_PROGRESS → DISPUTE otomatik geçiş
// AuditLog: INCIDENT

getPlanningBoard(filters)
// Tarih bazında gruplandırılmış sipariş listesi
// Lojistik planlama UI için

matchPlate(plate)
// Vehicle.registration_plate araması
// ±7 gün pencerede PLANNED veya ARRIVED status'taki siparişleri döner
// Sonuç yoksa "no match" — Gate Operator ad-hoc akışa yönlendirilir

createAdhocArrival(data, userId)
// InboundOrder (is_adhoc=true) + Inbound aynı transaction'da yaratır
// Order status: doğrudan ARRIVED
// AuditLog: CREATE (her ikisi için)
```

### `orderStateMachine.js`

```javascript
canTransition(from, to)         // boolean
getAllowedTransitions(status)   // geçilebilecek durum listesi
```

Geçiş tablosu:
```
PLANNED    → ARRIVED, CANCELLED
ARRIVED    → IN_PROGRESS, CANCELLED
IN_PROGRESS → DISPUTE, COMPLETED
DISPUTE    → IN_PROGRESS, COMPLETED
COMPLETED  → INVOICED
```

---

## 6. Business Rules

1. **Geçmiş tarih:** Yeni sipariş oluşturulurken `planned_date` geçmişte olamaz — edit için bu kısıtlama uygulanmaz.
2. **Çoklu inbound:** Bir siparişe birden fazla araç bağlanabilir (`inbounds[]` 1:N). Her araç için ayrı kantarlama yapılır.
3. **Ad-hoc flag:** `is_adhoc = true` olan siparişler raporlarda ayrı segment olarak görünebilir.
4. **LZV flag:** `is_lzv = true` — Hollanda'da Longer and Heavier Vehicle (uzun araç) özel işaretleme gerektirir; lojistik ve BGL belgelerinde gösterilir.
5. **Otomatik kontrat eşleştirme:** Sipariş `COMPLETED`'a geçince `contractService.findActiveContractForSupplier()` otomatik çalışır. Eşleşme bulunamazsa `matched_contract_id = null` — manuel müdahale gerekir, fatura kesilemez.
6. **DISPUTE flow:** Hasar/anlaşmazlık durumunda sipariş DISPUTE'ya geçer. Lojistik planlayıcı sorunu çözdüğünde tekrar IN_PROGRESS veya COMPLETED'a döndürülür.
7. **matchPlate ±7 gün:** Araç, planlanan tarihten 7 gün erken veya geç gelmiş olsa bile sipariş eşleştirilebilir.

---

## 7. UI Sayfaları

| Sayfa | Route | Rol | Açıklama |
|-------|-------|-----|----------|
| OrdersPage | `/orders` | LP, LC, ADMIN | Tüm siparişler, filtreler, arama |
| OrderDetailPage | `/orders/:id` | ALL | Sipariş detayı + inbound sekmesi + dokümanlar |
| OrderCreatePage | `/orders/new` | LP, LC, ADMIN | Sipariş oluşturma formu |
| PlanningBoardPage | `/orders/board` | LP, LC, ADMIN | Takvim/timeline bazlı planlama tahtası |

**OrdersPage:**
- Filtreler: durum (çoklu seçim), tarih aralığı, tedarikçi dropdown, taşıyıcı dropdown, sipariş no / plaka araması
- Sütunlar: Sipariş # | Tarih | Tedarikçi | Taşıyıcı | Waste Stream | Beklenen Skip | Durum | Aksiyonlar
- "Bugün" sekmesi: `planned_date = today`, zaman penceresine göre sıralı; ARRIVED/IN_PROGRESS olanlar mavi sol kenarlıkla

**PlanningBoardPage:**
- Günlük / haftalık görünüm
- Her sipariş kart olarak gösterilir: tedarikçi, zaman penceresi, beklenen skip, durum
- Sürükleme desteği (tarih değiştirme) — opsiyonel

---

## 8. Diğer Modüllerle Bağlantı Noktaları

| Modül | Bağlantı |
|-------|---------|
| **Inbound** | `matchPlate()` → Inbound yaratılınca sipariş ARRIVED; kantarlama tamamlanınca IN_PROGRESS/COMPLETED |
| **Contracts** | COMPLETED'da `findActiveContractForSupplier()` → `matched_contract_id` set edilir |
| **Entities** | `entity_supplier_id`, `transporter_id` — Entity tablosundan tedarikçi/taşıyıcı |
| **Reports** | RPT-04 (Weight Register): sipariş bazında kantarlama özeti; RPT-03 (Chain-of-Custody): tek sipariş izlenebilirlik belgesi |
| **Dashboard** | Bugünün siparişleri widget'ı (PLANNED vs ARRIVED vs COMPLETED) |

---

## 9. InboundOrder vs OutboundOrder — Fark ve İlişki

Sistemde iki farklı "order" kavramı vardır. Bunlar **birbirinden bağımsız modeller**dir, doğrudan FK ilişkileri yoktur — ortak bağlantı **SupplierContract** üzerinden kurulur.

```
TEDARİKÇİ                    STATİCE TESİSİ                    ALICI / BERTARAFÇI
     │                              │                                    │
     │  atık getirir                │                 işlenmiş materyal  │
     │──────────────────────────────▶                ────────────────────▶
     │                              │                                    │
  InboundOrder                      │                           OutboundOrder
  (gelen teslimat planı)            │                           (giden sevkiyat planı)
  entity_supplier_id → Entity       │                           buyer_id → Entity
  transporter_id → Entity           │                           transporter_id → Entity
  matched_contract_id → Contract ───┼─── SupplierContract ───── contract_id → Contract
                                    │
```

### Karşılaştırma Tablosu

| Özellik | InboundOrder | OutboundOrder |
|---------|-------------|---------------|
| Yön | Gelen (tesis ← tedarikçi) | Giden (tesis → alıcı/bertarafçı) |
| Kim oluşturur | Logistics Planner | Logistics Planner / Coordinator |
| Fiziksel hareket modeli | `Inbound` (kantarlama olayı) | `Outbound` (sevkiyat) |
| Numara formatı | `ORD-YYYYMMDD-NNN` | `ORD-OUT-YYYYMMDD-NNN` |
| Kontrat bağlantısı | Otomatik eşleştirme (COMPLETED'da) | Manuel seçim (oluşturulurken) |
| Waste stream | `OrderWasteStream` junction | `OutboundOrderWasteStream` junction |
| Fiziksel birim | Asset / Skip (`SKP-...`) | OutboundParcel (`PRC-...`) |
| Belge | Pfister ağırlık makbuzu | Begeleidingsbrief (BGL) |
| Kantarlama | Pfister GROSS + TARE (gelen araç) | Pfister GROSS + TARE (giden araç) |

### Operasyonel Akış İçinde Yerleri

```
[InboundOrder] → Inbound → Weighing → Process (Fase 1 + 2)
                                                ↓
                                    İşlenmiş materyaller depoda
                                                ↓
                                        [OutboundOrder] → Outbound → BGL → Sevkiyat
```

InboundOrder tamamlandığında (COMPLETED) üretilen materyaller `OutboundParcel` olarak `OutboundOrder`'a bağlanır. İkisi arasında doğrudan model ilişkisi **yoktur** — lojistik koordinatör hangi inbound materyalinin hangi outbound'a gittiğini manuel olarak yönetir.

---

## 10. Önemli Kararlar

- **Order ≠ Inbound:** Sipariş (lojistik plan) ile Inbound (fiili kantarlama olayı) bilinçli olarak ayrıdır. Bir sipariş birden fazla araç içerebilir; her araç = bir Inbound.
- **Ad-hoc transaction:** `createAdhocArrival()` hem siparişi hem inbound'u tek transaction'da yaratır — kısmi kayıt riski yok.
- **matchPlate ±7 gün:** Gerçek dünyada teslimalar gecikebilir veya erkene alınabilir. Aynı günde sınırlamak gereksiz sürtüşme yaratır.
- **ORD numarası:** `ORD-YYYYMMDD-NNN` — her gün sıfırlanan 3 haneli sıra numarası. Gün bazlı takip kolaylaşır.
