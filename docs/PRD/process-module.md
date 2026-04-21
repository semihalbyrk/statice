# Process Module — Statice MRF PRD

> **Amaç:** Bu doküman, Statice MRF (Material Recovery Facility) Dashboard'ında "Process" (sorting + processing + cataloguing) modülünün nasıl çalıştığını anlatır. Kod seviyesinde birebir referanslarla yazılmıştır. Claude'a bu dosya verildiğinde, modülün iç işleyişini, veri modelini, state machine'lerini ve business rule'larını tamamen anlayıp geliştirme/tasarım tartışmaları yapabilir.

> **Bağlam:** Statice Helden B.V. Hollanda'da WEEE (Waste Electrical and Electronic Equipment) ve diğer geri dönüşüm akışlarını işleyen bir MRF tesisidir. Inbound → Weighing → **Process** → Invoice/Outbound akışının **ikinci büyük aşaması** bu modüldür. "Process" aslında **iki ayrı alt-aşamadan** oluşur: (1) **Catalogue** (namı diğer "Shredding"), (2) **Processing** (namı diğer "Sorting").

---

## 1. Modülün Sistemdeki Yeri

```
Gate Operator: Inbound Order Girer
       ↓
Kamyon Gelir → Inbound (INB-NNNNN) Yaratılır
       ↓
Pfister Kantarı: Tare + Gross Weighings
       ↓
Inbound status: WEIGHED_OUT
       ↓
Operator "Ready for Sorting" der
       ↓
Inbound status: READY_FOR_SORTING
       ↓  (otomatik)
SortingSession yaratılır (status: PLANNED)
       ↓
╔════════════════════════════════════════╗
║  PROCESS MODULE                        ║
║                                        ║
║  ┌─────────────────────────────────┐  ║
║  │ Step 1: CATALOGUE (Shredding)   │  ║
║  │ Asset (konteyner) → Material    │  ║
║  └─────────────────────────────────┘  ║
║                ↓                       ║
║  ┌─────────────────────────────────┐  ║
║  │ Step 2: PROCESSING (Sorting)    │  ║
║  │ Material → Fractions + routes   │  ║
║  └─────────────────────────────────┘  ║
║                ↓                       ║
║  Finalize → Confirm Compliance        ║
╚════════════════════════════════════════╝
       ↓
SortingSession.status: SORTED
Inbound.status: SORTED
Order.status (otomatik): COMPLETED
       ↓
Faturalandırmaya hazır
```

**Ana dosyalar:**
- Frontend giriş: [client/src/pages/sorting/SortingProcessListPage.jsx](../../client/src/pages/sorting/SortingProcessListPage.jsx) (liste) ve [client/src/pages/sorting/SortingPage.jsx](../../client/src/pages/sorting/SortingPage.jsx) (detay)
- Backend servisler: [server/src/services/catalogueService.js](../../server/src/services/catalogueService.js), [server/src/services/processingService.js](../../server/src/services/processingService.js), [server/src/services/sortingService.js](../../server/src/services/sortingService.js), [server/src/services/sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js)
- Schema: [server/prisma/schema.prisma](../../server/prisma/schema.prisma) (SortingSession, AssetCatalogueEntry, ProcessingRecord, ProcessingOutcomeLine, MaterialMaster, FractionMaster, ReusableItem modelleri)

---

## 2. Veri Modeli

### 2.1 SortingSession (master aggregate)

Bir inbound'a karşılık BİR sorting session vardır (1:1, `inbound_id @unique`).

```prisma
model SortingSession {
  id                 String              @id
  inbound_id         String              @unique
  order_id           String
  recorded_by        String
  recorded_at        DateTime            @default(now())
  status             SortingStatus       @default(PLANNED)
  catalogue_status   WorkflowStageStatus @default(NOT_STARTED)
  processing_status  WorkflowStageStatus @default(NOT_STARTED)
  notes              String?

  inbound              Inbound
  sorting_lines        SortingLine[]        // legacy, geriye uyumluluk
  catalogue_entries    AssetCatalogueEntry[]
  processing_records   ProcessingRecord[]
  contamination_incidents ContaminationIncident[]
}
```

**Önemli:** `status` ve iki ayrı `WorkflowStageStatus` alanı (`catalogue_status`, `processing_status`) paralel olarak takip edilir. Session tek başına PLANNED/SORTED olabilirken, catalogue ve processing aşamaları ayrı ayrı NOT_STARTED/IN_PROGRESS/COMPLETED geçişi yapar.

**Enumlar** ([server/prisma/schema.prisma](../../server/prisma/schema.prisma)):
```prisma
enum SortingStatus { PLANNED, SORTED }
enum WorkflowStageStatus { NOT_STARTED, IN_PROGRESS, COMPLETED }
```

### 2.2 AssetCatalogueEntry (Catalogue Step Output)

Bir parcelin (Asset'in) hangi malzemeden ne kadar içerdiğini kaydeder. Bir asset'in birden fazla catalogue entry'si olabilir (örn. bir skip içinde hem "mixed metals" hem "plastics" bulunabilir).

```prisma
model AssetCatalogueEntry {
  id                      String   @id
  session_id              String
  asset_id                String
  material_id             String            // MaterialMaster.id
  weight_kg               Decimal           // > 0 kısıtı service katmanında
  reuse_eligible_quantity Int      @default(0)
  notes                   String?
  entry_order             Int      @default(0)

  reusable_items          ReusableItem[]
  processing_records      ProcessingRecord[]
}
```

**İş kuralı (auto-create):** Bir catalogue entry oluştuğunda:
1. Sistem otomatik olarak bir **DRAFT ProcessingRecord** yaratır (aşağıda).
2. `reuse_eligible_quantity > 0` ise, N tane **ReusableItem** kaydı yaratır.

Bkz. [catalogueService.js](../../server/src/services/catalogueService.js) `createEntry` fonksiyonu.

### 2.3 ProcessingRecord (Processing Step Container)

Bir catalogue entry'deki malzemenin nasıl işlendiğinin (hangi fraksiyonlara ayrıldığının) versiyonlu kaydı.

```prisma
model ProcessingRecord {
  id                     String                 @id
  session_id             String
  asset_id               String
  catalogue_entry_id     String?                // hangi catalogue entry'den doğdu
  material_id            String
  material_code_snapshot String                 // snapshot (değişmez)
  material_name_snapshot String
  weee_category_snapshot String
  status                 ProcessingRecordStatus @default(DRAFT)
  version_no             Int                    @default(1)
  is_current             Boolean                @default(true)
  supersedes_id          String?                // eski versiyon referansı (versioning chain)
  finalized_by           String?
  finalized_at           DateTime?
  confirmed_by           String?
  confirmed_at           DateTime?
  reason_code            String?                // reopen sebebi
  reason_notes           String?
  balance_delta_kg       Decimal                // sum(outcome.weight) - asset.net_weight

  outcomes ProcessingOutcomeLine[]
}

enum ProcessingRecordStatus {
  DRAFT       // düzenlenebilir
  FINALIZED   // kilitli, compliance bekliyor
  CONFIRMED   // kilitli, compliance onayladı
  SUPERSEDED  // eski versiyon, read-only
}
```

**Versioning kuralı:** Sadece `is_current = true` kayıtlar düzenlenebilir. Confirmed bir record'u "reopen" edildiğinde eskisi SUPERSEDED olur, yeni versiyon `version_no + 1` ile DRAFT statüsünde clone'lanır. Tarihsel iz bırakmak kritik (WSR compliance).

### 2.4 ProcessingOutcomeLine (Output Fractions)

Bir processing record'un hangi fraksiyonlara ayrıştırıldığını ve her fraksiyonun nereye gideceğini anlatır.

```prisma
model ProcessingOutcomeLine {
  id                              String          @id
  processing_record_id            String
  material_fraction               String          // serbest label
  fraction_id                     String?         // FractionMaster.id
  weight_kg                       Decimal         // > 0
  treatment_route                 TreatmentRoute  // legacy (RECYCLED/REUSED/DISPOSED)
  acceptant_stage                 AcceptantStage  // FIRST_ACCEPTANT / FOLLOWING
  process_description             String?
  share_pct                       Decimal         // weight_kg / asset.net_weight_kg * 100

  // Recovery profile — toplamı 100 olmalı
  prepared_for_reuse_pct          Decimal
  recycling_pct                   Decimal
  other_material_recovery_pct     Decimal
  energy_recovery_pct             Decimal
  thermal_disposal_pct            Decimal
}
```

**Recovery Profile:** Beş bileşenin toplamı **tam olarak 100** olmalı. Validation [processingService.js](../../server/src/services/processingService.js) `normaliseOutcomePayload` fonksiyonunda. Bu yüzdeler downstream işlemcide gerçekte ne olduğunu yansıtır ("bu fraksiyonun %90'ı gerçekten geri dönüştürüldü, %10'u enerjiye çevrildi" gibi).

### 2.5 MaterialMaster & FractionMaster (Referans Veriler)

**MaterialMaster:** Sisteme giren malzeme türleri. Her biri bir `WasteStream`'e bağlı, düzenleyici kodları taşır.

```prisma
model MaterialMaster {
  code                        String  @unique    // örn. "MAT-MIXED-METALS"
  name                        String
  waste_stream_id             String
  cbs_code                    String  // Hollanda CBS kodu
  weeelabex_group             String
  eural_code                  String
  weee_category               String  // Annex III kategorisi
  legacy_category_id          String? // ProductCategory (geriye uyumluluk)
  default_process_description String?

  fractions MaterialFraction[]   // çıkabilecek fraksiyonlar
}
```

**FractionMaster:** Çıkan ayrıştırılmış ürünler (bakır, demir, alüminyum, plastik mix vb.).

```prisma
model FractionMaster {
  code                                String  @unique
  name                                String
  eural_code                          String
  default_acceptant_stage             AcceptantStage

  // Default recovery pct'leri (kullanıcı override edebilir)
  prepared_for_reuse_pct_default      Decimal
  recycling_pct_default               Decimal
  other_material_recovery_pct_default Decimal
  energy_recovery_pct_default         Decimal
  thermal_disposal_pct_default        Decimal
}
```

**MaterialFraction (junction):** Hangi material hangi fraksiyonlara ayrışabilir.

```prisma
model MaterialFraction {
  material_id  String
  fraction_id  String
  sort_order   Int

  @@unique([material_id, fraction_id])
}
```

Örnek: Material "Mixed Metals" → Fractions ["Copper", "Ferrous", "Aluminium"]. Operator processing outcome yaratırken dropdown'dan bu fraksiyonları görür.

### 2.6 ReusableItem (Yeniden Kullanılabilir Eşyalar)

Catalogue step'inde operator "bu skip'te 3 tane yeniden kullanılabilir laptop var" derse, o anda 3 tane ReusableItem kaydı otomatik oluşur.

```prisma
model ReusableItem {
  id                   String    @id
  catalogue_entry_id   String    // onDelete: Cascade
  material_id          String
  brand                String?
  model_name           String?
  type                 String?
  serial_number        String?
  condition            String?   // örn. "GOOD", "FAIR", "POOR", "DAMAGED"
  notes                String?
}
```

Operator sonradan "Reusables" tab'ından her itemin detayını (marka, seri no, durum) girer.

### 2.7 SortingLine (Legacy, Geriye Uyumluluk)

Eski hızlı-allocation modeli. Asset → ProductCategory + (recycled%, reused%, disposed%) eşlemesi. Yeni flow'da **processing confirmation sonrası otomatik sync** edilir ([sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js) `syncCompatibilitySortingLines`). Faturalama/raporlama bu tabloyu okuyabilir.

### 2.8 ContaminationIncident

Sorting sırasında kontaminasyon (non-WEEE, hazardous, excessive moisture, sorting_required) bulunursa kaydedilir.

```prisma
model ContaminationIncident {
  incident_number         String  @unique   // INC-YYYYMMDD-NNNN
  order_id                String
  sorting_session_id      String?
  contamination_type      ContaminationType
  contamination_weight_kg Decimal?
  contamination_pct       Decimal?
  fee_amount              Decimal?
  fee_master_id           String?
  is_invoiced             Boolean
}

enum ContaminationType {
  NON_WEEE
  HAZARDOUS
  EXCESSIVE_MOISTURE
  SORTING_REQUIRED
}
```

Ücret, aktif kontratın `contamination_tolerance_pct` ve `ContractContaminationPenalty`'lerinden hesaplanır.

---

## 3. İki Aşamalı İş Akışı

### 3.1 Catalogue (Shredding) Aşaması

> **UI tab'ı:** `catalogue` → [SortingPage.jsx](../../client/src/pages/sorting/SortingPage.jsx)

**Amaç:** Her bir fiziksel parcel'in (Asset — genelde bir skip/konteyner) içinde ne olduğunu, ne kadar olduğunu kayıt altına almak.

**İşleyiş:**
1. Operator, sortingSession'daki her bir asset'i sırayla seçer (`activeAssetId`).
2. Her asset için **"Add Catalogue Entry"** butonu ile:
   - Material dropdown (o waste stream'e ait aktif materyaller)
   - Weight (kg, > 0 olmalı)
   - Reusable quantity (opsiyonel, ≥ 0)
   - Notes
3. Submit'te sistem:
   - `AssetCatalogueEntry` yaratır
   - Eğer `reuse_eligible_quantity > 0` ise **N ReusableItem** yaratır
   - Otomatik **draft ProcessingRecord** yaratır (bir sonraki aşama için)
4. Ağırlık balance göstergesi: Bu asset için girilen catalogue entry'lerinin toplamı vs asset.net_weight_kg
   - `catalogue_allocated_kg`, `catalogue_balance_kg`, `catalogue_is_balanced` hesaplanır
   - "Use Remaining" butonu kalan ağırlığı otomatik doldurur

**State transitions (workflow stage):**
- 0 entry: `catalogue_status = NOT_STARTED`
- Bazı asset'lerde entry var: `IN_PROGRESS`
- Tüm asset'lerde ≥1 entry var: `COMPLETED`

Bkz. [sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js) `updateSessionWorkflowStates`.

### 3.2 Processing (Sorting) Aşaması

> **UI tab'ı:** `outcomes` → [SortingPage.jsx](../../client/src/pages/sorting/SortingPage.jsx)

**Amaç:** Her bir material'in hangi fraksiyonlara ayrıştırıldığını ve fiziksel olarak nereye gideceğini belgelemek.

**İşleyiş:**
1. Catalogue tab'ından gelen draft ProcessingRecord'lar listelenir (asset başına).
2. Her record için **"Add Outcome Line"** ile:
   - Fraction dropdown (seçilen material'in MaterialFraction junction'ında bağlı fraksiyonlar)
   - Weight (kg, > 0)
   - Recovery profile 5 yüzde (toplam = 100)
     - `prepared_for_reuse_pct`
     - `recycling_pct`
     - `other_material_recovery_pct`
     - `energy_recovery_pct`
     - `thermal_disposal_pct`
   - Process description (serbest metin)
   - Acceptant stage (FIRST_ACCEPTANT / FOLLOWING)
3. Fraction seçildiğinde recovery default'ları otomatik doldurulur (FractionMaster'dan), operator override edebilir.
4. Validasyon:
   - Aynı fraksiyon aynı record'da iki kez olamaz
   - Recovery pct toplamı tam 100 olmalı
   - `share_pct` sistem tarafından hesaplanır: `weight_kg / asset.net_weight_kg * 100`
5. Balance göstergesi: Record'un outcome'larının toplam ağırlığı vs catalogue entry weight

### 3.3 Finalize → Confirm → (Reopen)

**Finalize Asset** (parcel bazında):
- Validasyon ([processingService.js](../../server/src/services/processingService.js) `finalizeAsset`):
  - ≥1 processing record olmalı
  - Her record'da ≥1 outcome olmalı
  - Her outcome'da fraction_id olmalı
  - Toplam outcome weight asset.net_weight_kg'den ±1 kg toleransta olmalı
  - Her outcome'un recovery pct'leri 100'e eşit olmalı
- Başarı: Tüm record'lar `status = FINALIZED` olur
- Rol: SORTING_EMPLOYEE, GATE_OPERATOR, ADMIN, COMPLIANCE_OFFICER

**Confirm Asset** (compliance review):
- Tüm record'lar FINALIZED olmalı
- Başarı: Tüm record'lar `status = CONFIRMED` olur
- Eğer tüm asset'lerin tüm record'ları CONFIRMED ise ([sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js) `finalizeSessionIfComplete`):
  - SortingSession `status = SORTED`
  - Inbound `status = SORTED`
  - Order `status = COMPLETED` (state machine izin veriyorsa)
  - Legacy SortingLine tablosu otomatik sync olur (geriye uyumluluk + faturalama)
- Rol: ADMIN, COMPLIANCE_OFFICER

**Reopen Asset** (düzeltme/amendment):
- Confirmed bir kayıtta hata bulunursa `reason_code` (BALANCE_CORRECTION, CERTIFICATE_FIX, DATA_ENTRY_ERROR, MATERIAL_RECLASSIFICATION, OTHER) ile reopen yapılır.
- Eski record'lar: `is_current = false, status = SUPERSEDED`
- Yeni versiyon yaratılır: `version_no++, supersedes_id = eski_id, status = DRAFT`, outcome'ları da clone'lanır
- Session geriye dönülür: SortingSession SORTED → PLANNED, Inbound SORTED → READY_FOR_SORTING
- Audit log yazılır
- Rol: ADMIN, COMPLIANCE_OFFICER

---

## 4. State Machine Özet

### 4.1 SortingSession

```
PLANNED ─(submit veya otomatik)─→ SORTED ─(reopen)─→ PLANNED
```

- `submitSession` ([sortingService.js](../../server/src/services/sortingService.js)): ≥1 SortingLine varsa ve pct toplamı 100 ise manuel submit (legacy path)
- `finalizeSessionIfComplete`: tüm asset'lerin tüm processing record'ları CONFIRMED olduğunda otomatik

### 4.2 ProcessingRecord

```
   ┌─────────────────────────────────────────┐
   │                                         │
   ▼                                         │
DRAFT ──→ FINALIZED ──→ CONFIRMED ──(reopen)─┘
                            │
                            └──(yeni versiyonda eski)──→ SUPERSEDED (terminal)
```

### 4.3 Inbound (parent context)

```
ARRIVED → WEIGHED_IN → WEIGHED_OUT → READY_FOR_SORTING ⇄ SORTED
                                                    │      ↑
                                        (reopen)    │      │
                                                    └──────┘  confirmAsset(all)
```

[inboundStateMachine.js](../../server/src/utils/inboundStateMachine.js) geçişleri tanımlar.

---

## 5. Validasyon Kuralları (Özet)

| Katman | Kural | Kaynak |
|---|---|---|
| Catalogue Entry | `weight_kg > 0` | [catalogueService.js](../../server/src/services/catalogueService.js) `createEntry` |
| Catalogue Entry | `reuse_eligible_quantity ≥ 0` | Service |
| Catalogue Entry | Material aktif olmalı | Service |
| Catalogue Entry | Asset bu session'ın inbound'una ait olmalı | Service |
| Processing Outcome | `weight_kg > 0` | [processingService.js](../../server/src/services/processingService.js) `normaliseOutcomePayload` |
| Processing Outcome | Fraction aktif olmalı | Service |
| Processing Outcome | Aynı record'da aynı fraction tekrar edemez | Service |
| Processing Outcome | 5 recovery pct toplamı = 100 | Service |
| Processing Outcome | Sadece DRAFT record'a outcome eklenebilir | Service |
| Finalize Asset | ≥1 record, her record'da ≥1 outcome | Service |
| Finalize Asset | Toplam outcome weight asset.net_weight_kg'e ±1 kg tolerance | Service |
| Confirm Asset | Tüm record'lar FINALIZED olmalı | Service |
| Reopen | Sadece CONFIRMED record'lar reopen edilebilir | Service |
| Reopen | `reason_code` zorunlu | Service |
| Contamination | Aktif kontrat varsa tolerance'a göre fee hesaplanır | [contaminationService.js](../../server/src/services/contaminationService.js) |

---

## 6. Rol Bazlı Yetkiler

Rotalar [server/src/routes/sorting.js](../../server/src/routes/sorting.js), [server/src/routes/catalogue.js](../../server/src/routes/catalogue.js), [server/src/routes/processing.js](../../server/src/routes/processing.js).

| Aksiyon | Rol |
|---|---|
| Session/catalog/processing görüntüleme (GET) | Tüm authenticated kullanıcılar |
| Catalogue entry CRUD | SORTING_EMPLOYEE, GATE_OPERATOR, ADMIN |
| Processing outcome CRUD | SORTING_EMPLOYEE, GATE_OPERATOR, ADMIN, COMPLIANCE_OFFICER |
| Finalize asset | SORTING_EMPLOYEE, GATE_OPERATOR, ADMIN, COMPLIANCE_OFFICER |
| Confirm asset | ADMIN, COMPLIANCE_OFFICER |
| Reopen asset | ADMIN, COMPLIANCE_OFFICER |
| Reopen session | ADMIN |
| MaterialMaster / FractionMaster CRUD | ADMIN |
| Contamination incident kaydetme | SORTING_EMPLOYEE, QC_INSPECTOR, ADMIN |

---

## 7. Frontend — SortingPage UX Haritası

Tek bir sayfada [SortingPage.jsx](../../client/src/pages/sorting/SortingPage.jsx) tab bazlı workflow:

```
┌──────────────────────────────────────────────────────────────────┐
│ Breadcrumb: Process > INB-00023                                   │
│                                                                    │
│ Session: SRT-00023  [Status Badge: PLANNED]                       │
│ Workflow: Catalogue [IN_PROGRESS] | Processing [NOT_STARTED]      │
│                                                                    │
│ [Record Contamination] [Reopen Session] (admin)                   │
├──────────────────────────────────────────────────────────────────┤
│ Assets Selector: [Skip A-01 ▾] [Skip A-02] [Skip A-03]            │
├──────────────────────────────────────────────────────────────────┤
│ Tabs: [Catalogue] [Processing] [Reusables] [History] [Reports]    │
├──────────────────────────────────────────────────────────────────┤
│  (active tab content)                                              │
│                                                                    │
│  CATALOGUE TAB:                                                    │
│    Balance:  520 / 580 kg  (60 kg remaining)                      │
│    [+ Add Entry]                                                   │
│    | Material          | Weight  | Reuse | Notes | Actions |     │
│    | Mixed Metals      | 300 kg  | 0     | -     | ✎ 🗑    |     │
│    | Plastics          | 220 kg  | 0     | -     | ✎ 🗑    |     │
│                                                                    │
│  PROCESSING TAB:                                                   │
│    Record #1: Mixed Metals (300 kg) [DRAFT]  [Finalize Parcel]   │
│      Balance:  295 / 300 kg  (±1 kg toleransında değil!)          │
│      [+ Add Outcome]                                               │
│      | Fraction   | Weight | Recycle% | Energy% | ...            │
│      | Copper     | 80 kg  | 95       | 5       |                 │
│      | Ferrous    | 180 kg | 90       | 10      |                 │
│      | Aluminium  | 35 kg  | 85       | 15      |                 │
│                                                                    │
│    Record #2: Plastics (220 kg) [FINALIZED]  [Confirm]           │
│      ...                                                           │
│                                                                    │
│  REUSABLES TAB:                                                    │
│    Item #1  Brand: [Apple]  Model: [MacBook Pro 13]               │
│             Serial: [XYZ123]  Condition: [GOOD ▾]                 │
│    ...                                                             │
│                                                                    │
│  HISTORY TAB:                                                      │
│    Record #1 versions:                                             │
│      v2 (current, CONFIRMED) ← v1 (SUPERSEDED, reason: DATA_ENTRY)│
│                                                                    │
│  REPORTS TAB:                                                      │
│    [Generate Downstream Report (RPT-DS)]                          │
└──────────────────────────────────────────────────────────────────┘
```

State yönetimi [sortingStore.js](../../client/src/store/sortingStore.js) (Zustand) üzerinden.

---

## 8. API Endpoint Katalogu

### Sorting
- `GET /api/sorting` — liste (status, search, page, limit)
- `GET /api/sorting/:sessionId` — detay (tüm alt koleksiyonlar dahil)
- `PATCH /api/sorting/:sessionId/submit` — manuel submit (legacy path)
- `PATCH /api/sorting/:sessionId/reopen` — (admin)
- `GET/POST/PUT/DELETE /api/sorting/:sessionId/lines[/:lineId]` — legacy sorting lines

### Catalogue
- `GET/POST/PUT /api/catalogue/materials[/:id]` — MaterialMaster CRUD
- `PUT /api/catalogue/materials/:id/fractions` — material'e bağlı fraksiyonları set etme
- `GET/POST/PUT /api/catalogue/fractions[/:id]` — FractionMaster CRUD
- `GET /api/catalogue/sessions/:sessionId/entries` — catalogue entries listesi
- `POST /api/catalogue/sessions/:sessionId/assets/:assetId/entries` — entry yarat
- `PUT/DELETE /api/catalogue/entries/:entryId` — güncelle/sil
- `GET /api/catalogue/sessions/:sessionId/reusables` — reusable itemler
- `PUT /api/catalogue/reusables/:id` — reusable item güncelle

### Processing
- `GET /api/processing/sessions/:sessionId/records` — processing record listesi (asset_id filter opsiyonel)
- `GET /api/processing/records/:recordId/history` — tüm versiyonlar (current + superseded)
- `POST /api/processing/records/:recordId/outcomes` — outcome ekle
- `PUT/DELETE /api/processing/outcomes/:outcomeId` — güncelle/sil
- `POST /api/processing/sessions/:sessionId/assets/:assetId/finalize`
- `POST /api/processing/sessions/:sessionId/assets/:assetId/confirm`
- `POST /api/processing/sessions/:sessionId/assets/:assetId/reopen`

Detaylar: [client/src/api/sorting.js](../../client/src/api/sorting.js), [client/src/api/catalogue.js](../../client/src/api/catalogue.js), [client/src/api/processing.js](../../client/src/api/processing.js).

---

## 9. Örnek End-to-End Senaryo

**Senaryo:** Stichting Open'dan gelen 2 skip'lik bir WEEE yükü (Inbound INB-00005, Order ORD-00005, Net 580 kg).

### Adım 1: Inbound'u işleme aç
Gate Operator weighing tamamlandıktan sonra `/inbounds/INB-00005` detay sayfasında **"Mark as Ready for Sorting"** der → Inbound `status = READY_FOR_SORTING`, otomatik SortingSession SRT-00005 yaratılır (status: PLANNED).

### Adım 2: Process listeye gir
Sorting Employee `/sorting` sayfasına girer, SRT-00005'i seçer (veya `/sorting/SRT-00005` direkt). Ekranda 2 asset görür: Skip A-01 (320 kg), Skip A-02 (260 kg).

### Adım 3: Catalogue (Shredding)
**Skip A-01 için:**
- Entry 1: Material "Mixed Metals", Weight 220 kg, Reusable 0
- Entry 2: Material "Plastics WEEE", Weight 100 kg, Reusable 0
- Balance: 320 / 320 kg ✓

Sistem otomatik 2 draft ProcessingRecord yaratır.

**Skip A-02 için:**
- Entry 1: Material "Laptops (Reusable)", Weight 50 kg, Reusable 3
- Entry 2: Material "Mixed Plastics", Weight 210 kg, Reusable 0
- Balance: 260 / 260 kg ✓

Reusable=3 olduğu için 3 ReusableItem kaydı yaratılır (brand/model/serial sonradan girilecek).

`catalogue_status: IN_PROGRESS → COMPLETED` (tüm asset'lerde ≥1 entry var).

### Adım 4: Processing (Sorting)

**Record 1 (Mixed Metals, 220 kg):**
- Outcome: Copper, 50 kg, recycling_pct=100
- Outcome: Ferrous, 140 kg, recycling_pct=95, energy_recovery_pct=5
- Outcome: Aluminium, 30 kg, recycling_pct=100
- Balance: 220 / 220 kg ✓

**Record 2 (Plastics WEEE, 100 kg):**
- Outcome: Plastic Mix, 100 kg, recycling_pct=60, energy_recovery_pct=40
- Balance: 100 / 100 kg ✓

(Skip A-02 için de benzer adımlar.)

### Adım 5: Finalize
Her asset için **Finalize Parcel** basılır. Record'lar DRAFT → FINALIZED. Validasyonlar geçer.

### Adım 6: Compliance Confirm
Compliance Officer her asset için **Confirm** basar. Record'lar FINALIZED → CONFIRMED.

Tüm asset'lerin tüm record'ları CONFIRMED olduğunda otomatik:
- SortingSession `status = SORTED`
- Inbound `status = SORTED`
- Order `status = COMPLETED` (state machine izin veriyorsa)
- Legacy SortingLine tablosu otomatik sync olur (invoicing pipeline için)

### Adım 7: Düzeltme (opsiyonel)
2 gün sonra Compliance Officer fark eder ki Record 2'deki Plastic Mix aslında %70 recycling olmalıymış. **Reopen** basar, `reason_code = DATA_ENTRY_ERROR`. Eski record SUPERSEDED olur, yeni v2 DRAFT olarak açılır. Düzeltir → Finalize → Confirm. Chain: v1 (SUPERSEDED) ← v2 (CONFIRMED).

---

## 10. Kontaminasyon (Contamination) Akışı

Sorting sırasında operator bir non-WEEE eşya (örn. bir kova buz) veya bir tehlikeli madde (örn. asbestli bir plaka) bulursa:

1. Session header'daki **"Record Contamination"** butonuna basar.
2. Modal açılır:
   - Type: NON_WEEE / HAZARDOUS / EXCESSIVE_MOISTURE / SORTING_REQUIRED
   - Açıklama
   - Kontaminasyon weight_kg veya pct
   - Estimated hours (sorting işçilik için)
3. Sistem:
   - Order'ın aktif kontratını bulur
   - `contamination_tolerance_pct` ile karşılaştırır (tolerans altındaysa fee=0)
   - Kontratın `ContractContaminationPenalty`'lerini (fee_type'lara göre) tarar
   - Fee hesaplar (FIXED / PERCENTAGE / PER_KG / PER_HOUR, min/max cap ile)
   - `ContaminationIncident` yaratır, `fee_master_id` ile bağlar
   - Incident number: `INC-YYYYMMDD-NNNN`
4. Daha sonra invoicing modülü bu incident'leri fatura satırına çevirir (`is_invoiced = true`).

Bkz. [contaminationService.js](../../server/src/services/contaminationService.js) ve [schema.prisma](../../server/prisma/schema.prisma) `ContaminationIncident`.

---

## 11. Seed Data Örneği

[server/prisma/seed.js](../../server/prisma/seed.js):
- **Waste Stream:** WEEE (code=WEEE, cbs_code=CBS-WEEE, weeelabex_code=WL-WEEE)
- **Product Categories:** WEEE-01 ... WEEE-20 (her biri recycled/reused/disposed default'lu)
- **MaterialMaster (5 adet):**
  - `mat-hdd` — Hard Disk Drives
  - `mat-pcb` — Printed Circuit Boards
  - `mat-sha` — Small Household Appliances
  - `mat-lha` — Large Household Appliances
  - `mat-scr` — Screens (TVs, monitors)
- **FractionMaster (7 adet):** Ferrous, Copper, Aluminium, PCB Fraction, Plastics Mix, Glass, Residual
- **MaterialFraction junctions:** her material için birden fazla fraksiyon bağlı

Bu seed data ile geliştirme ortamında direkt çalışılabilir veri var.

---

## 12. Bilinen Karmaşıklıklar ve Dikkat Edilmesi Gerekenler

### 12.1 İki Model Paralel Yaşıyor
- **SortingLine (legacy):** asset → category + hızlı pct allocation
- **ProcessingRecord + OutcomeLine (modern):** asset → material → fractions + recovery profile

Yeni geliştirmelerde modern modeli kullanın. Legacy model [sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js) `syncCompatibilitySortingLines` tarafından otomatik doldurulur — dışarıdan (invoicing) okunabilir.

### 12.2 Workflow Stage vs Session Status Karışıklığı
- `SortingSession.status` SADECE PLANNED/SORTED (iki değer).
- Gerçek ilerlemeyi `catalogue_status` ve `processing_status` izler.
- UI'da her üç alan da gösterilir, ama state transition'lar farklı hesaplanır.

### 12.3 Versioning Sorgusu
- Her zaman `where: { is_current: true }` kullanın (SUPERSEDED'lar hariç tutulsun).
- Geçmişi görmek için `getProcessingHistory(recordId)` çağırın — tüm versiyonları döner.

### 12.4 Balance Tolerance
- Finalize validation'da **±1 kg** tolerans var.
- UI'da "balanced" badge'i göstermek için `Math.abs(balance) <= 1` kullanılır.

### 12.5 Auto-Transitions
Tek bir aksiyon birden fazla state'i değiştirebilir:
- `confirmAsset` → tüm asset'ler confirmed'se → session → SORTED → inbound → SORTED → order → COMPLETED
- `reopenAsset` → session → PLANNED, inbound → READY_FOR_SORTING (cascade backward)

Bu zincirler [sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js) `finalizeSessionIfComplete` ve [processingService.js](../../server/src/services/processingService.js) `reopenAsset` içinde.

### 12.6 Recovery Percentages ≠ Treatment Route
- `treatment_route` legacy'dir (RECYCLED/REUSED/DISPOSED).
- Modern pratikte 5 recovery pct kullanılır ve bu beşten treatment route türetilebilir.
- Mesela: `prepared_for_reuse_pct > 0` ise treatment REUSED sayılabilir. `recycling_pct > 0` ise RECYCLED. Diğerleri DISPOSED kategori.
- Bkz. [sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js) `computeCompatibilityRouteTotals`.

### 12.7 Reusable Items Sync
Catalogue entry güncellendiğinde `reuse_eligible_quantity` değişirse:
- Artarsa → yeni ReusableItem yaratılır
- Azalırsa → en son yaratılanlar silinir (LIFO)

Manuel doldurulmuş detay veriler (brand, serial) kaybolabilir — operator uyarılır.

### 12.8 Contract Validation
Finalize aşamasında sistem, "material için geçerli processor sertifikası var mı" kontrolü YAPMIYOR şu anda — `validateProcessorCertification` fonksiyonu mevcut ama çağrılmıyor. Compliance için bu gelecekte gerekebilir.

---

## 13. Gelecek İyileştirme Adayları (PRD için tartışılabilir)

1. **Inbound + SortingSession otomatizasyonu:** Şu anda operator "Ready for Sorting" derse session açılıyor. Tam otomatik olabilir.
2. **Processor Certification Validation:** Finalize'da material'in processor'ının sertifikasını doğrula (bkz. madde 12.8).
3. **Session bazında downstream doğrulama raporu (RPT-DS):** Halihazırda stub var, production-ready değil.
4. **Reusable Items → Outbound entegrasyonu:** Reusable item'lar outbound orderlarla nasıl eşlenecek?
5. **Bulk actions:** Birden fazla asset'in aynı anda finalize edilmesi (şu an tek tek).
6. **Partial submit:** Bazı asset'ler finalize olmuşken sadece onları order'a yansıtma (şu an hepsi CONFIRMED olmalı).
7. **Fraction defaults UI:** Admin panelde FractionMaster recovery defaults'u görsel olarak yönetmek.

---

## 14. Hızlı Kod Erişim Referansları

| İhtiyaç | Dosya:Satır |
|---|---|
| SortingSession modeli | [server/prisma/schema.prisma](../../server/prisma/schema.prisma) (SortingSession) |
| ProcessingRecord modeli | [server/prisma/schema.prisma](../../server/prisma/schema.prisma) (ProcessingRecord) |
| Catalogue entry oluşturma + auto ProcessingRecord | [server/src/services/catalogueService.js](../../server/src/services/catalogueService.js) `createEntry` |
| Outcome validasyon + recovery pct normalizasyonu | [server/src/services/processingService.js](../../server/src/services/processingService.js) `normaliseOutcomePayload` |
| Finalize asset validasyonu | [server/src/services/processingService.js](../../server/src/services/processingService.js) `finalizeAsset` |
| Confirm asset + session auto-complete | [server/src/services/processingService.js](../../server/src/services/processingService.js) `confirmAsset` + [sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js) `finalizeSessionIfComplete` |
| Reopen asset (versioning) | [server/src/services/processingService.js](../../server/src/services/processingService.js) `reopenAsset` |
| Workflow stage computation | [server/src/services/sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js) `updateSessionWorkflowStates` |
| Legacy SortingLine sync | [server/src/services/sortingWorkflowService.js](../../server/src/services/sortingWorkflowService.js) `syncCompatibilitySortingLines` |
| Tek sayfa UI | [client/src/pages/sorting/SortingPage.jsx](../../client/src/pages/sorting/SortingPage.jsx) |
| Liste UI | [client/src/pages/sorting/SortingProcessListPage.jsx](../../client/src/pages/sorting/SortingProcessListPage.jsx) |
| Session state | [client/src/store/sortingStore.js](../../client/src/store/sortingStore.js) |
| API endpoints | [server/src/routes/sorting.js](../../server/src/routes/sorting.js), [catalogue.js](../../server/src/routes/catalogue.js), [processing.js](../../server/src/routes/processing.js) |

---

**Son notlar:**
- Bu modül **üretim kritik** — her mutation `prisma.$transaction` içinde ve `writeAuditLog` çağırıyor.
- Tüm state transition'lar state machine helper'larından geçiyor ([processingStateMachine.js](../../server/src/utils/processingStateMachine.js) benzeri yoksa servis içi kontrol).
- Integration test coverage: [server/src/__tests__/sorting.test.js](../../server/src/__tests__/sorting.test.js), [catalogue.test.js](../../server/src/__tests__/catalogue.test.js), [processing.test.js](../../server/src/__tests__/processing.test.js).
