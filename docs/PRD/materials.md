# Materials Modülü — Statice MRF PRD

> **Amaç:** Bu doküman, Statice MRF Dashboard'ındaki materyal ve fraksiyon master data yönetimini açıklar. `MaterialMaster`, `FractionMaster`, `Processor` ve bunları birbirine bağlayan modeller burada tanımlanır. Bu veriler Process modülünün (Fase 1 + Fase 2) temel referans katmanıdır.

> **Bağlam:** Statice tesisine gelen her atık, fiziksel olarak materyallere (Mixed Metals, Laptops, PCBs...) ayrılır. Bu materyaller daha sonra fraksiyonlara (Ferrous Metals, Aluminium, Copper...) işlenir ve aşağı akış işleyicilere (Processor) gönderilir. Bu üç katmanın referans verileri Materials modülünde admin tarafından yönetilir.

---

## 1. Modülün Sistemdeki Yeri

```
Admin / Finance Manager → /admin/materials sayfası
       ↓
MaterialMaster tanımlanır
  - CBS kodu (Hollanda istatistik)
  - WEEELabex grubu (AB uyum)
  - EURAL kodu (Avrupa atık kataloğu)
  - WEEE kategorisi (Annex III)
  - average_weight_kg (yeniden kullanım: adet → kg çevrimi için)
       ↓
FractionMaster tanımlanır (materyalin işlenince dönüştüğü fraksiyonlar)
       ↓
MaterialFraction N:M bağlantısı kurulur
  "Bu materyal bu fraksiyonlara dönüşebilir"
       ↓
Processor tanımlanır + Sertifikalar eklenir
  "Bu işleyici bu materyalleri işleyebilir"
       ↓
Process Modülü (Fase 1 ve Fase 2) bu verileri kullanır:
  Fase 1: CatalogueEntry → hangi Asset hangi MaterialMaster içeriyor
  Fase 2: ProcessingRecord.outcomes → materyal hangi fraksiyona, hangi işleyiciye
       ↓
ContractRateLine bu MaterialMaster'lara referans verir (fiyatlandırma)
OutboundParcel da MaterialMaster'a bağlıdır (ne gönderiyoruz)
```

---

## 2. Temel Kavramlar

| Kavram | Açıklama |
|--------|----------|
| **MaterialMaster** | Atık türü tanımı. Fase 1'de asset içeriği bu materyallerle etiketlenir. Örn: "Mixed Metals", "Laptop", "PCB". |
| **FractionMaster** | Materyalin işlenmesi sonucu elde edilen fiziksel fraksiyon. Örn: "Ferrous Metals", "Aluminium", "Gold". |
| **MaterialFraction** | Hangi materyalin hangi fraksiyonlara dönüşebileceğini tanımlar (N:M). |
| **Processor** | Aşağı akış işleyicisi — belirli materyalleri işleyen dış tesis. WEEELabex listesinde olabilir. |
| **ProcessorCertificate** | İşleyicinin sertifikası. Hangi materyalleri işleyebileceği sertifika kapsamında tanımlanır. |
| **ReusableItem** | Fase 1 sırasında tespit edilen yeniden kullanılabilir ürünlerin kayıtları (marka, model, seri no). |
| **CBS Kodu** | Hollanda Centraal Bureau voor de Statistiek istatistik kodu — düzenleyici raporlarda kullanılır. |
| **WEEELabex Grubu** | AB WEEE direktifi uyum sınıflandırması (WEEELabex standardı). |
| **EURAL Kodu** | Avrupa Atık Kataloğu kodu (European Waste Catalogue) — sınır ötesi sevkiyatlarda zorunlu. |
| **WEEE Kategorisi (Annex III)** | AB WEEE Direktifi Annex III kapsamındaki ürün kategorisi. |
| **AcceptantStage** | Fraksiyon işleyicisinin zincirdeki yeri: `FIRST_ACCEPTANT` (doğrudan alıcı) veya `FOLLOWING` (ikinci kademe). |

---

## 3. Veri Modeli

### 3.1 MaterialMaster

```
MaterialMaster  (DB: ProductTypeMaster)
  id                          UUID (PK)
  code                        String (unique — kısa tanımlayıcı, örn. "MIXED_METALS")
  name                        String (görünen ad, örn. "Mixed Metals")
  waste_stream_id             FK → WasteStream

  -- Düzenleyici kodlar (Hollanda / AB)
  cbs_code                    String   (CBS istatistik kodu, zorunlu)
  weeelabex_group             String   (WEEELabex grubu, zorunlu)
  eural_code                  String   (Avrupa Atık Kataloğu kodu, zorunlu)
  weee_category               String   (Annex III kategorisi — DB: annex_iii_category)

  -- Opsiyonel
  legacy_category_id          FK → ProductCategory? (eski modele geçiş köprüsü)
  default_process_description String?
  average_weight_kg           Decimal? (adet başına kg — ReusableItem adet→ağırlık çevrimi için)

  is_active                   Boolean
  created_at / updated_at     DateTime

  -- İlişkiler
  fractions[]                 MaterialFraction[]          (hangi fraksiyonlara dönüşebilir)
  catalogue_entries[]         AssetCatalogueEntry[]       (Fase 1'de kullanıldığı yerler)
  processing_records[]        ProcessingRecord[]          (Fase 2'de kullanıldığı yerler)
  certificate_scopes[]        ProcessorCertificateMaterialScope[] (hangi işleyiciler işleyebilir)
  reusable_items[]            ReusableItem[]
  contract_rate_lines[]       ContractRateLine[]           (fiyatlandırmada referans)
  outbound_parcels[]          OutboundParcel[]             (çıkış parselleri)
```

**average_weight_kg neden önemli:**
Fase 1'de operatör "Bu skip'te 5 adet laptop var" diyebilir. Sistem, `average_weight_kg × adet` formülüyle kg'a çevirir. Bu alan boşsa adet girişi yapılamaz, yalnızca doğrudan kg girilebilir.

### 3.2 FractionMaster

```
FractionMaster
  id                                  UUID (PK)
  code                                String (unique — örn. "FERROUS", "AL_ALLOY")
  name                                String (görünen ad — örn. "Ferrous Metals")
  eural_code                          String (EURAL kodu)
  default_acceptant_stage             AcceptantStage (FIRST_ACCEPTANT | FOLLOWING)
  default_process_description         String?

  -- Geri kazanım oranı varsayılanları (Fase 2 ProcessingOutcomeLine için)
  prepared_for_reuse_pct_default      Decimal (default: 0)
  recycling_pct_default               Decimal (default: 0)
  other_material_recovery_pct_default Decimal (default: 0)
  energy_recovery_pct_default         Decimal (default: 0)
  thermal_disposal_pct_default        Decimal (default: 0)

  is_active                           Boolean
  created_at / updated_at             DateTime

  -- İlişkiler
  materials[]                         MaterialFraction[]
  processing_outcomes[]               ProcessingOutcomeLine[]
```

**5 geri kazanım yüzdesi toplamı = 100 olmalı** (ProcessingOutcomeLine service validasyonu).

### 3.3 MaterialFraction (N:M Junction)

```
MaterialFraction
  id          UUID
  material_id FK → MaterialMaster
  fraction_id FK → FractionMaster
  sort_order  Int (dropdown sıralaması için)
  is_active   Boolean

  @@unique([material_id, fraction_id])
```

Operatör Fase 2'de bir materyal seçtiğinde, bu tablodaki aktif fraksiyonlar dropdown'da gösterilir.

### 3.4 Processor (Aşağı Akış İşleyici)

```
Processor
  id                          UUID (PK)
  name                        String
  address                     String
  country                     String
  environmental_permit_number String (çevre izin numarası — zorunlu)
  is_weeelabex_listed         Boolean (WEEELabex akredite mi?)
  is_active                   Boolean
  created_at / updated_at     DateTime

  certificates[]              ProcessorCertificate[]
```

**Not:** `Processor` modeli `Entity` modelinden ayrı bir tablodur. `Entity` Statice'nin doğrudan iş yaptığı tarafları temsil eder (tedarikçi, taşıyıcı, alıcı). `Processor` ise Fase 2'deki aşağı akış işleyici referanslarıdır — doğrudan kontrat ilişkisi olmayabilir.

### 3.5 ProcessorCertificate

```
ProcessorCertificate
  id                  UUID
  processor_id        FK → Processor
  certificate_number  String
  certification_body  String (sertifikayı veren kurum)
  valid_from          DateTime
  valid_to            DateTime
  document_url        String? (sertifika belgesi linki)
  is_active           Boolean

  materials[]         ProcessorCertificateMaterialScope[]
```

### 3.6 ProcessorCertificateMaterialScope

```
ProcessorCertificateMaterialScope  (DB: ProcessorCertificateProductType)
  id              UUID
  certificate_id  FK → ProcessorCertificate
  material_id     FK → MaterialMaster

  @@unique([certificate_id, material_id])
```

Bu tablo "hangi sertifika hangi materyalleri kapsıyor" sorusunu yanıtlar. Fase 2'de operatör bir materyal seçtiğinde, o materyali işleyebilecek (aktif sertifikası olan) işleyiciler filtrelenebilir.

### 3.7 ReusableItem

```
ReusableItem
  id                  UUID
  catalogue_entry_id  FK → AssetCatalogueEntry (hangi catalogue entry'den geldi)
  material_id         FK → MaterialMaster
  brand               String? (marka)
  model_name          String? (model)
  type                String? (ürün tipi)
  serial_number       String? (seri numarası)
  condition           String? (durum: GOOD, FAIR, POOR...)
  notes               String?
  created_at          DateTime
```

Fase 1'de operatör "Bu skip'te 3 adet yeniden kullanılabilir laptop var" dediğinde, her biri için ayrı `ReusableItem` kaydı oluşturulur. Bu kayıtlar izlenebilirlik ve raporlama (Annex III) için tutulur.

---

## 4. API Endpoints

### Materials (`/api/catalogue/materials`, `/api/admin/materials`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/catalogue/materials` | ALL | Aktif materyal listesi (Fase 1 dropdown için) |
| GET | `/catalogue/materials/:id` | ALL | Materyal detayı + fraksiyonlar |
| POST | `/catalogue/materials` | ADMIN | Yeni materyal oluştur |
| PUT | `/catalogue/materials/:id` | ADMIN | Güncelle |
| PATCH | `/catalogue/materials/:id/status` | ADMIN | Aktif / pasif |
| GET | `/catalogue/fractions` | ALL | Aktif fraksiyon listesi (Fase 2 dropdown için) |
| POST | `/catalogue/fractions` | ADMIN | Yeni fraksiyon oluştur |
| PUT | `/catalogue/fractions/:id` | ADMIN | Güncelle |
| PUT | `/catalogue/materials/:id/fractions` | ADMIN | Materyal–fraksiyon N:M bağlantısını sync et |

### Processors (`/api/processors`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/processors` | ALL | İşleyici listesi |
| GET | `/processors/:id` | ALL | Detay + sertifikalar + kapsam |
| POST | `/processors` | ADMIN | Yeni işleyici |
| PUT | `/processors/:id` | ADMIN | Güncelle |
| POST | `/processors/:id/certificates` | ADMIN | Sertifika ekle |
| PUT | `/processors/certificates/:certId` | ADMIN | Sertifika güncelle |
| POST | `/processors/certificates/:certId/scopes` | ADMIN | Materyal kapsamı ekle |

---

## 5. Servis Katmanı (`catalogueService.js` ~651 satır)

```javascript
listMaterials(filters)
// Aktif materyaller, fraksiyonlarıyla birlikte
// filters: waste_stream_id, search (code, name), is_active

getMaterial(id)
// Tam detay: fraksiyonlar, certificate_scopes

createMaterial(data, userId)
// Validasyon: cbs_code, eural_code, weeelabex_group zorunlu
// AuditLog: CREATE

updateMaterial(id, data, userId)
// AuditLog: UPDATE

upsertMaterialFractions(materialId, fractionIds, userId)
// N:M sync: yeni bağlantılar ekle, kaldırılanları is_active=false yap

listFractions(filters)
// Aktif fraksiyonlar

createFraction(data, userId)
// 5 default yüzde toplamı = 100 validasyonu

listSessionEntries(sessionId, assetId?)
// Belirli session + opsiyonel asset için catalogue entry'leri

createEntry(sessionId, assetId, data, userId)
// AssetCatalogueEntry oluştur
// reuse_eligible_quantity > 0 ise average_weight_kg ile kg hesapla
// Otomatik draft ProcessingRecord oluştur (Fase 2 için hazırla)
// AuditLog: CREATE

updateEntry(sessionId, entryId, data, userId)
// Ağırlık, adet, notlar güncellenebilir
// DRAFT dışında güncelleme yapılamaz

finalizeEntry(sessionId, entryId, userId)
// DRAFT → FINALIZED

confirmEntry(sessionId, entryId, userId)
// FINALIZED → CONFIRMED (COMPLIANCE_OFFICER / ADMIN)
```

---

## 6. Business Rules

1. **Düzenleyici kod zorunluluğu:** `cbs_code`, `eural_code`, `weeelabex_group` her materyal için zorunlu. Bu kodlar RPT-02 ve RPT-05 raporlarında doğrudan kullanılır.

2. **average_weight_kg:** Yalnızca "adet sayılabilir" materyallerde doldurulur (örn. Laptop, Smartphone). Bu alan boşsa Fase 1'de operatör yalnızca kg girebilir, adet giremez.

3. **MaterialFraction geçmişi:** N:M bağlantısı silinmez, `is_active = false` yapılır. Eski ProcessingRecord'ların referans bütünlüğü korunur.

4. **ProcessorCertificate süresi:** `valid_to` geçmiş tarih olan sertifikalar UI'da "süresi dolmuş" olarak işaretlenir. Fase 2'de sadece aktif (valid_to ≥ bugün) sertifika kapsamındaki işleyiciler önerilir.

5. **WEEELabex listesi:** `is_weeelabex_listed = true` olan işleyiciler AB düzenleyici raporlarında öncelikli gösterilir.

6. **5 geri kazanım yüzdesi toplamı:** `FractionMaster` varsayılanları ve `ProcessingOutcomeLine` değerleri toplamı 100 olmalı. Service katmanında validate edilir.

7. **Materyal pasif yapılırsa:** Yeni `AssetCatalogueEntry`'de kullanılamaz. Mevcut kayıtlar bozulmaz.

8. **ReusableItem cascade delete:** `AssetCatalogueEntry` silinirse bağlı `ReusableItem`'lar da silinir (`onDelete: Cascade`).

---

## 7. UI Sayfaları

| Sayfa | Route | Rol | Açıklama |
|-------|-------|-----|----------|
| MaterialsManagementPage | `/admin/materials` | ADMIN | Materyal + fraksiyon listesi ve yönetimi |
| (Processor yönetimi) | `/admin/processors` | ADMIN | İşleyici listesi, sertifikalar, materyal kapsamları |

**MaterialsManagementPage:**
- İki sekme: "Materials" | "Fractions"
- Materials sekmesi: tablo (code, name, cbs_code, eural_code, waste stream, aktif/pasif) + satır aksiyonları (edit, deactivate)
- Fractions sekmesi: tablo (code, name, eural_code, default recovery %'leri)
- Materyal detayında: bağlı fraksiyonlar N:M yönetimi

---

## 8. Diğer Modüllerle Bağlantı Noktaları

| Modül | Bağlantı |
|-------|---------|
| **Process (Fase 1)** | `AssetCatalogueEntry.material_id` → MaterialMaster; `ReusableItem.material_id` |
| **Process (Fase 2)** | `ProcessingRecord.material_id`; `ProcessingOutcomeLine.fraction_id` → FractionMaster |
| **Contracts** | `ContractRateLine.material_id` → materyal bazında fiyatlandırma |
| **Outbound** | `OutboundParcel.material_id` → ne gönderildiğinin tanımı |
| **Reports** | RPT-02 (Material Recovery): `cbs_code` bazında gruplama; RPT-05 (Waste Stream): `weeelabex_group` bazında analiz |
| **Inbound** | `Asset.material_category_id` (legacy `ProductCategory`) — geçiş döneminde eski alan hâlâ kullanılıyor |

---

## 9. Önemli Kararlar

- **MaterialMaster ≠ ProductCategory:** Eski `ProductCategory` modeli yerini `MaterialMaster`'a bırakıyor. İkisi paralel var — `legacy_category_id` FK geçiş köprüsü. Yeni geliştirmeler `MaterialMaster` kullanır.

- **Processor ≠ Entity:** `Processor` model aşağı akış referans verisidir (Fase 2'de "nereye gidiyor" sorusu için). `Entity` ise Statice'nin doğrudan iş ilişkisi kurduğu tarafları temsil eder. Bazı işleyiciler hem `Processor` hem `Entity` olabilir (doğrudan kontrat varsa), ama zorunlu değil.

- **DB map isimleri:** Prisma modeli `MaterialMaster` ama DB tablosu `ProductTypeMaster`. Benzer şekilde `material_id` alanları DB'de `product_type_id` olarak map'lenmiş. Kod yazarken Prisma isimlerini kullan.

- **EURAL kodu sevkiyat belgelerinde:** `eural_code` Begeleidingsbrief'te ve sınır ötesi taşıma belgelerinde zorunlu. Her materyal ve fraksiyon için doldurulmalı.
