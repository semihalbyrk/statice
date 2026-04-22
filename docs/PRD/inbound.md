# Inbound Modülü — Statice MRF PRD

> **Amaç:** Bu doküman, Statice MRF Dashboard'ındaki "Inbound" modülünü (sipariş yönetimi, araç gelişi, kantarlama) açıklar. Claude'a bu dosya verildiğinde, sistemdeki ilk büyük akışı —kamyonun kapıdan girişinden ağırlığının kaydedilmesine kadar— eksiksiz anlayıp geliştirme tartışmaları yapabilir.

> **Bağlam:** Statice Helden B.V. Hollanda'da WEEE (e-atık) ve diğer geri dönüşüm akışlarını işleyen bir MRF tesisidir. Inbound modülü **tüm operasyonun başlangıç noktasıdır**: tedarikçiden gelen atık, bir kamyonla tesise gelir, ağırlığı ölçülür ve process modülüne geçer.

---

## 1. Modülün Sistemdeki Yeri

```
Tedarikçi (PRO / Commercial / Private Individual)
       ↓
Order oluşturulur (Logistics Planner — opsiyonel, önceden)
       ↓
Kamyon tesise gelir → Gate Operator araç plakasını girer
       ↓
Sistem aktif kontrat + sipariş eşleştirir (matchPlate)
       ↓
Inbound (INB-YYYYMMDD-NNN) yaratılır
       ↓
Pfister Kantarı → GROSS weighing (araç dolu)
       ↓
Assets (konteynerler/skip'ler) kayıt edilir
       ↓
Pfister Kantarı → TARE weighing (araç boş)
       ↓
Net ağırlık hesaplanır, inbound status: WEIGHED_OUT
       ↓
Operator "Ready for Sorting" der
       ↓
Inbound status: READY_FOR_SORTING
       ↓  (otomatik)
SortingSession yaratılır → PROCESS MODÜLÜNE GEÇER
```

---

## 2. Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| **InboundOrder** | Planlanan teslimat kaydı (kamyon gelmeden önce). Opsiyoneldir — ad-hoc gelişlerde anında yaratılır. |
| **Inbound** | Bir kamyon ziyaretinin fiili kaydı. Kantarlama olayını (weighing event) içerir. `INB-YYYYMMDD-NNN` formatında numara alır. |
| **Asset (Skip/Bak)** | Kamyondaki her bir konteyner. Bir kamyonda birden fazla olabilir. `SKP-YYYYMMDD-NNN` formatında etiket alır. |
| **PfisterTicket** | Kantarın verdiği ağırlık makbuzu. GROSS veya TARE olabilir. |
| **Entity** | Sistem genelindeki birleşik master entity modeli. Tedarikçi, taşıyıcı, bertarafçı aynı tabloda. |
| **Contract** | InboundOrder otomatik olarak aktif bir kontratla eşleştirilir. Fiyatlandırma buradan gelir. |

---

## 3. Veri Modeli

### 3.1 InboundOrder

```
InboundOrder
  id                        UUID (PK)
  order_number              String (ORD-YYYYMMDD-NNN, unique)
  entity_supplier_id        FK → Entity (tedarikçi)
  transporter_id            FK → Entity (taşıyıcı)
  waste_stream_id           FK → WasteStream (birincil)
  waste_streams[]           OrderWasteStream[] (çoklu akış desteği)
  planned_date              DateTime
  planned_time_window_start DateTime?
  planned_time_window_end   DateTime?
  expected_skip_count       Int (default: 1)
  expected_asset_count      Int?
  vehicle_plate             String? (beklenen plaka)
  afvalstroomnummer         String? (Hollanda atık akış kodu)
  client_reference          String? (tedarikçinin kendi referans numarası)
  is_adhoc                  Boolean (default: false)
  is_lzv                    Boolean (default: false — uzun araç)
  status                    OrderStatus
  incident_category         IncidentCategory? (DAMAGE|DISPUTE|SPECIAL_HANDLING|DRIVER_INSTRUCTION)
  incident_notes            String?
  notes                     String?
  matched_contract_id       FK → SupplierContract? (otomatik eşleşme)
  created_by                FK → User
  created_at                DateTime
  updated_at                DateTime
```

**OrderStatus state machine:**
```
PLANNED → ARRIVED → IN_PROGRESS → COMPLETED → INVOICED
                              ↓
                           DISPUTE (incident kaydedilince)
                              ↓
                           IN_PROGRESS veya COMPLETED'a dönebilir
PLANNED|ARRIVED|IN_PROGRESS|DISPUTE → CANCELLED
```

### 3.2 OrderWasteStream (N:M junction)

```
OrderWasteStream
  id                  UUID
  order_id            FK → InboundOrder
  waste_stream_id     FK → WasteStream
  afvalstroomnummer   String?
  planned_amount_kg   Decimal?
```

### 3.3 OrderDocument

```
OrderDocument
  id              UUID
  order_id        FK → InboundOrder
  document_type   String (PDF, IMAGE, etc.)
  file_name       String
  storage_path    String
  uploaded_by     FK → User
  uploaded_at     DateTime
```

### 3.4 Inbound (Weighing Event)

```
Inbound
  id                  UUID (PK)
  inbound_number      String (INB-YYYYMMDD-NNN, unique)
  order_id            FK → InboundOrder
  vehicle_id          FK → Vehicle
  waste_stream_id     FK → WasteStream
  asset_count         Int (kaç konteyner)
  status              InboundStatus
  net_weight_kg       Decimal? (hesaplanır)
  loss_weight_kg      Decimal? (fire)
  loss_reason         LossReason?
  gross_ticket_id     FK → PfisterTicket? (gross kantarlama)
  tare_ticket_id      FK → PfisterTicket? (tare kantarlama)
  arrived_at          DateTime
  weighed_in_at       DateTime?
  weighed_out_at      DateTime?
  sorted_at           DateTime?
  confirmed_by        FK → User?
  confirmed_at        DateTime?
  assets[]            Asset[]
  weighings[]         InboundWeighing[]
  sorting_session     SortingSession? (1:1, otomatik yaratılır)
```

**InboundStatus state machine:**
```
ARRIVED → WEIGHED_IN → WEIGHED_OUT → READY_FOR_SORTING → SORTED
```
- `READY_FOR_SORTING` ve `SORTED` terminal — daha fazla düzenleme olmaz.
- `READY_FOR_SORTING`'e geçince SortingSession otomatik yaratılır.

### 3.5 Asset (Container/Skip)

```
Asset
  id                    UUID (PK)
  asset_label           String (SKP-YYYYMMDD-NNN, unique)
  inbound_id            FK → Inbound
  sequence              Int (kamyondaki sıra: 1, 2, 3...)
  container_type        String (OPEN_TOP|CLOSED_TOP|GITTERBOX|PALLET|OTHER)
  parcel_type           String (CONTAINER|MATERIAL)
  waste_stream_id       FK → WasteStream
  material_category_id  FK → ProductCategory? (legacy)
  gross_weight_kg       Decimal?
  tare_weight_kg        Decimal?
  net_weight_kg         Decimal? (computed)
  gross_weighing_id     FK → InboundWeighing?
  tare_weighing_id      FK → InboundWeighing?
```

Tare ağırlığı için `CONTAINER_TARE_WEIGHTS` sabit değerleri kullanılır (konteyner tipine göre default tare).

### 3.6 InboundWeighing

```
InboundWeighing
  id              UUID
  inbound_id      FK → Inbound
  sequence        Int
  weighing_type   String (GROSS|TARE)
  weight_kg       Decimal
  pfister_ticket_id FK → PfisterTicket?
  recorded_by     FK → User
  recorded_at     DateTime
```

### 3.7 PfisterTicket

```
PfisterTicket
  id                  UUID
  ticket_number       String (PF-YYYY-NNNNNN)
  weighing_type       String (GROSS|TARE)
  weight_kg           Decimal
  device_id           String?
  source              String (INBOUND_WEIGHING|OUTBOUND_WEIGHING|CALIBRATION)
  order_id            FK → InboundOrder?
  inbound_id          FK → Inbound?
  timestamp           DateTime
  raw_payload         String
  is_manual_override  Boolean (default: false)
  override_reason     String?
  override_by         FK → User?
```

### 3.8 Vehicle

```
Vehicle
  id                  UUID
  registration_plate  String (unique — arama anahtarı)
  carrier_id          FK → Entity? (legacy carrier bağlantısı)
  vehicle_type        String?
  max_weight_kg       Decimal?
  tare_weight_kg      Decimal?
```

---

## 4. API Endpoints

### Orders (`/api/orders`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/orders` | ALL | Sipariş listesi (status, date, carrier_id, search filtreleri) |
| GET | `/orders/:id` | ALL | Sipariş detayı + inbounds |
| POST | `/orders` | LOGISTICS_PLANNER, ADMIN | Planlı sipariş oluştur |
| PUT | `/orders/:id` | LOGISTICS_PLANNER, ADMIN | Sipariş güncelle |
| DELETE | `/orders/:id` | ADMIN | İptal et |
| GET | `/orders/match-plate` | GATE_OPERATOR, ADMIN | Plakaya göre sipariş eşleştir |
| POST | `/orders/adhoc-arrival` | GATE_OPERATOR, ADMIN | Plansız geliş için sipariş oluştur |
| POST | `/orders/:id/incident` | ALL | DAMAGE/DISPUTE kaydı ekle |
| POST | `/orders/:id/documents` | ALL | Doküman yükle |
| GET | `/orders/:id/documents` | ALL | Doküman listesi |
| GET | `/orders/:id/documents/:docId/download` | ALL | İndir |
| DELETE | `/orders/:id/documents/:docId` | ADMIN | Sil |
| GET | `/orders/planning-board` | LOGISTICS_PLANNER, ADMIN | Planlama tahtası görünümü |

### Weighing Events (`/api/weighing-events`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/weighing-events/:inboundId` | ALL | Weighing event detayı |
| POST | `/weighing-events/:inboundId/weigh` | GATE_OPERATOR, ADMIN | Pfister kantarlama başlat (GROSS\|TARE) |
| PATCH | `/weighing-events/:inboundId/confirm` | GATE_OPERATOR, ADMIN | Net ağırlığı onayla |
| POST | `/weighing-events/:inboundId/assets` | GATE_OPERATOR, ADMIN | Asset/skip kayıt et |
| PUT | `/weighing-events/:inboundId/assets/:assetId` | GATE_OPERATOR, ADMIN | Asset güncelle |
| POST | `/weighing-events/:inboundId/ready-for-sorting` | GATE_OPERATOR, ADMIN | WEIGHED_OUT → READY_FOR_SORTING |
| GET | `/weighing-events/:inboundId/ticket` | ALL | PDF ağırlık makbuzu indir |

---

## 5. Servis Katmanı

### `orderService.js` (~759 satır)

- `listOrders(filters)` — sayfalandırılmış liste, her sipariş için expected/received asset sayısı enrichment
- `getOrder(id)` — tam detay: inbounds, matched contract, waste streams
- `createOrder(data, userId)` — `order_number` üretir, `OrderWasteStream` junction'larını sync eder
- `updateOrder(id, data, userId)` — `orderStateMachine` üzerinden durum geçişleri
- `cancelOrder(id, userId)` — CANCELLED'a geç
- `setIncident(orderId, category, notes, userId)` — DISPUTE otomatik status geçişi
- `getPlanningBoard(filters)` — takvim/timeline görünümü
- `matchPlate(plate)` — ±7 gün pencerede araç plakasına göre sipariş ara
- `createAdhocArrival(data, userId)` — plansız geliş akışı

### `inboundService.js` (~1,212 satır)

- `listInbounds()` — sayfalandırılmış
- `getInbound(id)` — tam detay: araç, weighing event, assets + gross/tare ticket'lar
- `createInbound(orderId, vehicleData, userId)` — `INB` numarası üretir, status: ARRIVED
- `recordWeighing(inboundId, weighingType, weightKg, userId)` — pfisterGateway çağrısı, asset ağırlıklarını güncelle
- `confirmWeighing(inboundId, userId)` — net ağırlık hesapla, WEIGHED_IN → WEIGHED_OUT
- `registerAsset(inboundId, assetData, userId)` — `SKP` etiketi üretir, CONTAINER_TARE_WEIGHTS'ten default tare yükle
- `readyForSorting(inboundId, userId)` — WEIGHED_OUT → READY_FOR_SORTING, **SortingSession otomatik yaratılır**
- Ağırlık düzeltme: `WeightAmendmentReason` enum (CALIBRATION_ERROR, EQUIPMENT_MALFUNCTION, INCORRECT_READING, SUPERVISOR_CORRECTION, OTHER)

### `pfisterGateway.js` / `pfisterSimulator.js`

Pfister entegrasyonu **single-interface pattern** ile izole:
```javascript
pfisterService.requestWeighing(weighingType: 'GROSS'|'TARE')
// Returns: Promise<PfisterTicket>
// { ticket_number, weight_kg, timestamp, device_id, raw_payload }
```
Simülatör: GROSS 8,000–24,000 kg, TARE 6,000–10,000 kg arası rastgele değer, 1,500ms gecikme.
**Gerçek Pfister API'sına geçişte yalnızca `pfisterSimulator.js` değiştirilir — controller/route dokunulmaz.**

---

## 6. Business Rules

1. **Çoklu asset:** Bir kamyonda birden fazla konteyner olabilir. Her asset ayrı ayrı ağırlık alır; toplam net ağırlık = Σ asset net ağırlıkları.
2. **Ad-hoc geliş:** Plansız gelen araç için sipariş anında yaratılır (`is_adhoc = true`), durum direkt ARRIVED olarak set edilir.
3. **Contract matching:** Sipariş COMPLETED'a geçtiğinde `contractService.findActiveContractForSupplier()` otomatik çalışır.
4. **Incident → DISPUTE:** `setIncident()` çağrıldığında sipariş durumu DISPUTE'ya geçer. Lojistik planlayıcı bu görevi çözdükten sonra tekrar IN_PROGRESS/COMPLETED'a gelebilir.
5. **Terminal inbound durumları:** `READY_FOR_SORTING` ve `SORTED` — bu aşamadan sonra inbound kaydı düzenlenemez.
6. **Ağırlık override:** Yalnızca ADMIN yapabilir, her override AuditLog'a `WeightAmendmentReason` ile kaydedilir.

---

## 7. UI Sayfaları

| Sayfa | Route | Rol | Açıklama |
|-------|-------|-----|----------|
| OrdersPage | `/orders` | LP, ADMIN | Tüm siparişler + filtreler |
| OrderDetailPage | `/orders/:id` | ALL | Sipariş detayı + inbound sekmesi |
| OrderCreatePage | `/orders/new` | LP, ADMIN | Planlı sipariş formu |
| PlanningBoardPage | `/orders/board` | LP, ADMIN | Takvim/timeline tahtası |
| ArrivalPage | `/arrivals/new` | GO, ADMIN | Gate operator: plaka girişi → eşleşme → kantarlama |
| InboundsPage | `/inbounds` | ALL | Tüm weighing event'leri listele |
| WeighingEventPage | `/weighing/:inboundId` | GO, ADMIN | Kantarlama akışı UI (3 sütunlu layout) |

---

## 8. Diğer Modüllerle Bağlantı Noktaları

| Modül | Bağlantı |
|-------|---------|
| **Contracts** | `matchContractForOrder()` — sipariş tamamlanınca aktif kontrat otomatik eşleştirilir |
| **Process** | `readyForSorting()` → `SortingSession` yaratılır; inbound → sorting akışı başlar |
| **Entities** | `entity_supplier_id`, `transporter_id` FK'lar → Entity tablosundan tedarikçi/taşıyıcı çekilir |
| **Reports** | RPT-04 (Inbound Weight Register), RPT-03 (Chain-of-Custody) için inbound verileri kullanılır |
| **Admin** | `WasteStream`, `ProductCategory` master verileri inbound formlarında kullanılır |

---

## 9. Önemli Kararlar

- **Inbound = Weighing Event:** Tek model hem araç gelişini hem kantarlama akışını temsil eder. Ayrı "ArrivalRecord" modeli yok.
- **SortingSession auto-create:** Gate operator "Ready for Sorting" dediğinde işlem modülü otomatik tetiklenir — ayrı bir sorter aksiyonu gerekmez.
- **Pfister single interface:** Simülatör → gerçek geçişte minimum kod değişikliği. Bu PRD'nin temel tasarım kararlarından biri.
- **LZV flag (`is_lzv`):** Uzun araçlar (LZV — Longer and Heavier Vehicle) için özel işaretleme; Hollanda taşımacılık mevzuatı gereksinimi.
