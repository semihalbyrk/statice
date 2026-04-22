# Outbound Modülü — Statice MRF PRD

> **Amaç:** Bu doküman, Statice MRF Dashboard'ındaki çıkış (outbound) akışını açıklar: işlenmiş materyallerin alıcı/bertarafçılara sevkiyatı, begeleidingsbrief (yasal taşıma belgesi) üretimi, kantarlama ve teslimat takibi.

> **Bağlam:** Process modülünde işlenen WEEE ve diğer atık fraksiyonları, Outbound modülünde alıcılara gönderilir. Her sevkiyat Hollanda mevzuatı gereği bir **Begeleidingsbrief** (eşlik belgesi / BGL) ile çıkmalıdır. Outbound hem kontrat hem entity modülüne bağlıdır.

---

## 1. Modülün Sistemdeki Yeri

```
Process tamamlanır (SortingSession: SORTED)
       ↓
OutboundOrder oluşturulur (Logistics Planner)
  - Hangi buyer/sender/disposer?
  - Hangi waste stream'ler?
  - Hangi araç bekleniyor?
       ↓
OutboundOrder status: PLANNED
       ↓
İlk Outbound (fiziksel sevkiyat) yaratılır → IN_PROGRESS
       ↓
OutboundParcel'lar outbound'a bağlanır
       ↓
Pfister GROSS kantarlama (yüklü araç)
       ↓
Pfister TARE kantarlama (boş araç)
       ↓
Net ağırlık hesaplanır → WEIGHED
       ↓
Begeleidingsbrief PDF üretilir
       ↓
Araç hareket eder → DEPARTED
       ↓
Teslimat onayı → DELIVERED
       ↓
Tüm outbounds DELIVERED → OutboundOrder COMPLETED
```

---

## 2. Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| **OutboundOrder** | Çıkış siparişi — bir veya birden fazla fiziksel sevkiyatı organize eder. Kontrat ve entity'lerle ilişkilidir. |
| **Outbound** | Tek bir fiziksel sevkiyat (araç hareketi). `OUT-YYYYMMDD-NNN` formatında numara alır. |
| **OutboundParcel** | Sevkiyata yüklenen materyal paketi. Outbound olmadan da var olabilir (standalone), sonradan outbound'a atanır. `PRC-YYYYMMDD-NNN` formatında etiket alır. |
| **Begeleidingsbrief (BGL)** | Hollanda'da atık taşımacılığı için zorunlu yasal eşlik belgesi. PDF olarak üretilir. |
| **OutboundWeighingRecord** | Outbound için gross veya tare kantarlama kaydı. Pfister veya manuel olabilir. |

---

## 3. Veri Modeli

### 3.1 OutboundOrder

```
OutboundOrder
  id                      UUID (PK)
  order_number            String (ORD-OUT-YYYYMMDD-NNN, unique)
  contract_id             FK → SupplierContract? (ilişkili kontrat)
  
  -- Entity FK'lar
  buyer_id                FK → Entity? (alıcı)
  sender_id               FK → Entity? (gönderici)
  disposer_id             FK → Entity? (bertarafçı)
  transporter_id          FK → Entity? (taşıyıcı)
  
  vehicle_plate           String? (beklenen araç plakası)
  status                  OutboundOrderStatus
  expected_outbounds      Int (kaç fiziksel sevkiyat planlandı)
  expected_gross_weight_kg Decimal?
  
  waste_streams[]         OutboundOrderWasteStream[]
  outbounds[]             Outbound[]
  
  created_at              DateTime
  updated_at              DateTime
```

**OutboundOrderStatus state machine:**
```
PLANNED → IN_PROGRESS (ilk Outbound yaratılınca)
               ↓
          COMPLETED (tüm outbounds DELIVERED)
PLANNED | IN_PROGRESS → CANCELLED
```

### 3.2 OutboundOrderWasteStream

```
OutboundOrderWasteStream
  id                  UUID
  outbound_order_id   FK → OutboundOrder
  waste_stream_id     FK → WasteStream
  receiver_id         FK → Entity? (bu akışı alacak entity)
```

### 3.3 Outbound (Fiziksel Sevkiyat)

```
Outbound
  id                          UUID (PK)
  outbound_number             String (OUT-YYYYMMDD-NNN, unique)
  outbound_order_id           FK → OutboundOrder
  vehicle_plate               String
  status                      OutboundStatus
  gross_weight_kg             Decimal?
  tare_weight_kg              Decimal?
  net_weight_kg               Decimal? (computed)
  loading_started_at          DateTime?
  weighing_completed_at       DateTime?
  departure_at                DateTime?
  delivery_at                 DateTime?
  begeleidingsbrief_generated Boolean (default: false)
  
  parcels[]                   OutboundParcel[]
  weighing_records[]          OutboundWeighingRecord[]
  documents[]                 OutboundDocument[]
  
  created_by                  FK → User
  updated_by                  FK → User?
```

**OutboundStatus state machine:**
```
CREATED → LOADING → WEIGHED → DEPARTED → DELIVERED
```
- `CREATED`: Sevkiyat kaydı açıldı, yükleme başlamadı
- `LOADING`: GROSS tartım başladı / parçalar ekleniyor
- `WEIGHED`: Hem GROSS hem TARE tartım tamamlandı, net ağırlık hesaplandı
- `DEPARTED`: Araç tesisi terk etti (BGL önceden üretilmiş olmalı)
- `DELIVERED`: Alıcı tarafından teslim alındı

### 3.4 OutboundWeighingRecord

```
OutboundWeighingRecord
  id              UUID
  outbound_id     FK → Outbound
  weighing_type   String (GROSS|TARE)
  weight_kg       Decimal
  source          String (SCALE|MANUAL)
  pfister_ticket_id FK → PfisterTicket? (SCALE ise)
  recorded_by     FK → User
  recorded_at     DateTime
```

### 3.5 OutboundDocument

```
OutboundDocument
  id              UUID
  outbound_id     FK → Outbound
  document_type   String (BEGELEIDINGSBRIEF|SHIPPING_LABEL|WEIGHT_TICKET)
  status          String (PENDING|GENERATED|FAILED)
  file_name       String
  storage_path    String
  generated_by    FK → User
  generated_at    DateTime
```

### 3.6 OutboundParcel

```
OutboundParcel
  id            UUID (PK)
  parcel_label  String (PRC-YYYYMMDD-NNN, unique)
  material_id   FK → MaterialMaster (hangi materyal)
  outbound_id   FK → Outbound? (opsiyonel — başta standalone)
  status        OutboundParcelStatus
  weight_kg     Decimal
  quantity      Int?
  notes         String?
  created_at    DateTime
  linked_at     DateTime? (outbound'a atandığında)
  shipped_at    DateTime? (DEPARTED olunca)
```

**OutboundParcelStatus state machine:**
```
AVAILABLE → ASSIGNED (outbound'a bağlanınca)
               ↓
           SHIPPED (outbound DEPARTED olunca)
```

Parsel önce yaratılır, sonra bir outbound'a bağlanabilir. Birden fazla parsel aynı outbound'a eklenebilir. Outbound iptal edilirse parsel tekrar AVAILABLE'a döner.

---

## 4. API Endpoints

### OutboundOrder (`/api/outbound-orders`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/outbound-orders` | ALL | Liste (status, buyer_id filtreleri) |
| GET | `/outbound-orders/:id` | ALL | Detay: kontrat, waste streams, outbounds |
| POST | `/outbound-orders` | LP, ADMIN | Yeni çıkış siparişi oluştur |
| PUT | `/outbound-orders/:id` | LP, ADMIN | Güncelle |
| PATCH | `/outbound-orders/:id/status` | LP, ADMIN | Durum geçişi |
| DELETE | `/outbound-orders/:id` | ADMIN | İptal et (outbound başlamadıysa) |

### Outbound (`/api/outbounds`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/outbounds` | ALL | Liste (status, outbound_order_id filtreleri) |
| GET | `/outbounds/:id` | ALL | Detay: tartım kayıtları, belgeler, parseller |
| POST | `/outbounds/order/:orderId` | LC, ADMIN | Sipariş için yeni sevkiyat aç |
| POST | `/outbounds/:id/weighings` | GO, ADMIN | GROSS veya TARE tartım kaydet |
| POST | `/outbounds/:id/generate-bgl` | LC, ADMIN | Begeleidingsbrief PDF üret |
| PATCH | `/outbounds/:id/depart` | GO, ADMIN | WEIGHED → DEPARTED |
| PATCH | `/outbounds/:id/deliver` | GO, ADMIN | DEPARTED → DELIVERED |
| GET | `/outbounds/:id/documents/:docId/download` | ALL | Belge indir |

### Outbound Parcels (`/api/outbounds/:id/parcels`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/outbounds/:id/parcels` | ALL | Sevkiyata bağlı parseller |
| POST | `/outbounds/:id/parcels` | LC, ADMIN | Var olan parseli outbound'a bağla |
| DELETE | `/outbounds/:id/parcels/:parcelId` | LC, ADMIN | Parseli outbound'dan ayır |

---

## 5. Servis Katmanı

### `outboundService.js` (~644 satır)

- `listOutbounds()` — sayfalandırılmış
- `getOutbound(id)` — tam detay: parseller, tartım kayıtları, belgeler
- `createOutbound(orderId, data, userId)` — `OUT` numarası üretir, order PLANNED → IN_PROGRESS
- `recordWeighing(outboundId, data, userId)` — Pfister çağrısı (SCALE) veya manuel; CREATED → LOADING → WEIGHED otomatik geçiş
- `generateBgl(outboundId, userId)` — `begeleidingsbriefService` üzerinden PDF üret; `OutboundDocument` kaydı oluştur
- `depart(outboundId, userId)` — WEIGHED → DEPARTED (BGL üretilmemişse hata)
- `deliver(outboundId, userId)` — DEPARTED → DELIVERED; tüm outbounds DELIVERED ise order COMPLETED

### `outboundOrderService.js`

- OutboundOrder CRUD, state geçişleri
- `expected_outbounds` sayacını takip eder

### `outboundParcelService.js`

- Parsel oluştur, outbound'a bağla, ayır
- Status geçişlerini yönetir (AVAILABLE → ASSIGNED)

### `begeleidingsbriefService.js`

Begeleidingsbrief Hollanda atık taşımacılığında zorunlu bir belgedir:
- **Sender bilgileri** (Statice tesisi)
- **Transporter bilgileri** (VIHB lisans numarası dahil)
- **Receiver/Disposer bilgileri** (çevre izin numarası dahil)
- **Waste stream + EURAL kodu**
- **Ağırlık bilgileri** (net, gross, tare)
- **Tarih ve imza alanları**

`PDFKit` ile üretilir. AcroForm PDF şablonu doldurulur (Hollanda resmi formu).

---

## 6. Business Rules

1. **BGL zorunluluğu:** WEIGHED → DEPARTED geçişi ancak `begeleidingsbrief_generated = true` ise olabilir.
2. **VIHB numarası:** Taşıyıcı entity'nin `vihb_number` alanı BGL üretiminde zorunlu.
3. **Parsel standalone:** `OutboundParcel` outbound olmadan yaratılabilir (`outbound_id = null`). Daha sonra herhangi bir outbound'a atanabilir.
4. **Parsel ayrılması:** Outbound iptal edilirse bağlı parseller tekrar AVAILABLE olur.
5. **Tartım kaynağı:** `SCALE` (Pfister) tercih edilir; `MANUAL` ise audit log'a reason kaydedilir.
6. **Order completion:** Tüm `Outbound` kayıtları DELIVERED olunca `OutboundOrder` otomatik COMPLETED.

---

## 7. UI Sayfaları

| Sayfa | Route | Rol | Açıklama |
|-------|-------|-----|----------|
| OutboundOrderCreatePage | `/outbound-orders/new` | LP, ADMIN | Çıkış siparişi oluştur |
| OutboundOrderDetailPage | `/outbound-orders/:id` | ALL | Sipariş + outbound listesi |
| OutboundsPage | `/outbounds` | ALL | Tüm sevkiyatlar listesi |
| OutboundDetailPage | `/outbounds/:id` | ALL | Sevkiyat detayı + tartım UI |
| OutgoingParcelCreatePage | `/parcels/new` | LC, ADMIN | Parsel oluştur |
| OutgoingParcelDetailPage | `/parcels/:id` | ALL | Parsel detayı |

---

## 8. Diğer Modüllerle Bağlantı Noktaları

| Modül | Bağlantı |
|-------|---------|
| **Process** | SortingSession tamamlandıktan sonra işlenen materyaller OutboundParcel olarak çıkabilir |
| **Contracts** | `contract_id` FK — hangi kontrat kapsamında çıkış yapılıyor |
| **Entities** | `buyer_id`, `sender_id`, `disposer_id`, `transporter_id` — Entity tablosundan |
| **Reports** | Outbound verileri raporlara dahil edilir (malzeme akışı, recovery oranları) |
| **Inbound** | `PfisterTicket` modeli outbound weighing'ler için de kullanılır (source: OUTBOUND_WEIGHING) |

---

## 9. Begeleidingsbrief Hakkında

Hollanda Wet milieubeheer kapsamında e-atık ve tehlikeli atık taşımacılığında **Begeleidingsbrief** zorunludur. Belge:
- Gönderici (Statice, ontvanger of verwijderaar) bilgilerini içerir
- Taşıyıcının VIHB (Vervoerder Inzamelen en Behandelen WEEE) lisansını gösterir
- Alıcı/bertarafçının çevre iznini (omgevingsvergunning) içerir
- Atığın EURAL kodunu ve miktarını belirtir
- LMA (Landelijk Meldpunt Afvalstoffen) ile uyumlu format

**Teknik implementation:** `begeleidingsbriefService.js` AcroForm PDF şablonunu PDFKit ile doldurur. Statice'nin hazır Word/PDF formu dijitalleştirilmiştir.

---

## 10. Önemli Kararlar

- **OutboundParcel standalone:** Parseller önceden yaratılabilir, sevkiyat hazırlanırken seçilir. Bu, depo yönetimi senaryolarını destekler.
- **Pfister outbound:** Gelen kamyon için Pfister kullanıldığı gibi, giden kamyon için de Pfister tartımı yapılır. Aynı gateway kullanılır.
- **Outbound ↔ Order N:1:** Bir OutboundOrder'a birden fazla Outbound bağlanabilir (birden fazla araç yüklemesi).
