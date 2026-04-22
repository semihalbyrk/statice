# Entities Modülü — Statice MRF PRD

> **Amaç:** Bu doküman, Statice MRF Dashboard'ındaki birleşik entity modelini açıklar. Tedarikçi, taşıyıcı, bertarafçı ve alıcı gibi farklı roller tek bir `Entity` tablosunda tutulur. Eski `Supplier` / `Carrier` modelleri bu modele migrate edilmiştir.

> **Bağlam:** Hollanda atık mevzuatı, atık zincirindeki her aktörün (ontdoener, ontvanger, verwijderaar, handelaar, bemiddelaar) ayrı kayıt gereksinimleri vardır. Entity modeli bu yasal rolleri tek bir veri yapısında yönetir ve kontrat/sipariş ilişkilerini kurar.

---

## 1. Modülün Sistemdeki Yeri

```
Admin / Finance Manager → Entity oluşturur
       ↓
Entity rolleri seçilir:
  ✓ is_supplier (tedarikçi)     → supplier_type + supplier_roles zorunlu
  ✓ is_transporter (taşıyıcı)   → vihb_number zorunlu
  ✓ is_disposer (bertarafçı)    → environmental_permit_number zorunlu
  ✓ is_receiver (alıcı)         → environmental_permit_number zorunlu
       ↓
Kontrat oluştururken:
  - entity_supplier_id → tedarikçi
  - agreement_transporter_id → taşıyıcı
  - buyer_id → alıcı
  - disposer_id → bertarafçı
       ↓
Sipariş oluştururken:
  - entity_supplier_id → tedarikçi
  - transporter_id → taşıyıcı
       ↓
Begeleidingsbrief üretiminde entity verileri (VIHB, izin numarası) kullanılır
```

---

## 2. Hollanda Yasal Roller

| Rol | Hollandaca Terim | Açıklama |
|-----|------------------|----------|
| Supplier (ONTDOENER) | Ontdoener | Atığı üreten / teslimat yapan |
| Supplier (ONTVANGER) | Ontvanger | Atığı teslim alan |
| Supplier (HANDELAAR) | Handelaar | Atık ticareti yapan aracı |
| Supplier (BEMIDDELAAR) | Bemiddelaar | Atık aracılığı yapan |
| Transporter | Vervoerder | VIHB lisanslı taşıyıcı |
| Disposer | Verwijderaar | Çevre izinli bertarafçı |
| Receiver | Ontvanger | İşlenmiş materyali alan tesis |

---

## 3. Veri Modeli

### 3.1 Entity

```
Entity
  id                          UUID (PK)
  
  -- Şirket kimliği
  company_name                String
  street_and_number           String?
  postal_code                 String?
  city                        String?
  country                     String (default: "NL")
  kvk_number                  String? (KvK — Hollanda Ticaret Sicili, gerekli: supplier veya disposer için)
  btw_number                  String? (BTW — KDV numarası)
  iban                        String?
  
  -- Lisans / izin numaraları
  vihb_number                 String? (taşıyıcı için zorunlu)
  environmental_permit_number String? (bertarafçı/alıcı için zorunlu)
  
  -- İletişim
  contact_name                String?
  contact_email               String?
  contact_phone               String?
  
  -- Durum
  status                      EntityStatus (ACTIVE|INACTIVE)
  is_protected                Boolean (default: false — deaktif edilemez)
  
  -- Tedarikçi rolleri
  is_supplier                 Boolean (default: false)
  supplier_type               SupplierType? (PRO|COMMERCIAL)  [PRO = Stichting Open gibi üretici sorumluluk org.]
  supplier_roles              String[] (ONTDOENER|ONTVANGER|HANDELAAR|BEMIDDELAAR — array, birden fazla olabilir)
  pro_registration_number     String? (supplier_type = PRO ise zorunlu)
  
  -- Diğer roller
  is_transporter              Boolean (default: false)
  is_disposer                 Boolean (default: false)
  is_receiver                 Boolean (default: false)
  
  -- İlişkiler
  disposer_sites[]            DisposerSite[] (bertarafçı ise birden fazla tesis olabilir)
  contracts_as_supplier[]     SupplierContract[] (entity_supplier_id FK)
  contracts_as_transporter[]  SupplierContract[] (agreement_transporter_id FK)
  
  created_at                  DateTime
  updated_at                  DateTime
```

**Validasyon kuralları (service seviyesinde):**
- En az bir rol seçilmeli (`is_supplier || is_transporter || is_disposer || is_receiver`)
- `is_supplier = true` → `supplier_type` + `supplier_roles[]` (min 1) zorunlu
- `supplier_type = PRO` → `pro_registration_number` zorunlu
- `is_transporter = true` → `vihb_number` zorunlu
- `is_disposer = true` → `environmental_permit_number` + `kvk_number` zorunlu
- `is_receiver = true` → `environmental_permit_number` zorunlu
- `is_supplier = true` veya `is_disposer = true` → `kvk_number` zorunlu

### 3.2 DisposerSite (Bertarafçı Tesisleri)

Bertarafçı entity'nin birden fazla fiziksel işleme tesisi olabilir:

```
DisposerSite
  id                          UUID (PK)
  entity_id                   FK → Entity
  site_name                   String
  street_and_number           String?
  postal_code                 String?
  city                        String?
  country                     String (default: "NL")
  environmental_permit_number String? (tesis seviyesinde izin)
  status                      SiteStatus (ACTIVE|INACTIVE)
  
  created_at                  DateTime
  updated_at                  DateTime
```

---

## 4. API Endpoints

### Entities (`/api/entities`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/entities` | ALL | Liste (rol, status, isim/vihb arama filtreleri) |
| GET | `/entities/:id` | ALL | Tam profil: disposer sites, kontratlar, son siparişler |
| POST | `/entities` | ADMIN, FM | Entity oluştur |
| PUT | `/entities/:id` | ADMIN, FM | Güncelle |
| PATCH | `/entities/:id/status` | ADMIN | ACTIVE ↔ INACTIVE geçişi |
| GET | `/entities/protected` | ADMIN | Korumalı entity listesi |
| GET | `/entities/:id/disposer-sites` | ALL | Bertarafçı tesislerini listele |
| POST | `/entities/:id/disposer-sites` | ADMIN, FM | Yeni tesis ekle |
| PUT | `/entities/:id/disposer-sites/:siteId` | ADMIN, FM | Tesis güncelle |
| PATCH | `/entities/:id/disposer-sites/:siteId/status` | ADMIN | Tesis durumu değiştir |

---

## 5. Servis Katmanı

### `entityService.js` (~409 satır)

- `listEntities(filters)` — sayfalandırılmış; `role` filtresi ile sadece supplier/transporter/disposer/receiver listele
- `getEntityById(id)` — disposer sites, kontratlar, son siparişler dahil tam detay
- `createEntity(data, userId)` — rol validasyonları, AuditLog kaydı
- `updateEntity(id, data, userId)` — rol cleanup: `is_supplier = false` ise `supplier_type`, `supplier_roles`, `pro_registration_number` null'a set edilir
- `toggleEntityStatus(id, userId)` — ACTIVE ↔ INACTIVE; `is_protected = true` ise deaktif edilemez
- `listDisposerSites(entityId)` — tüm tesisler
- `createDisposerSite(entityId, data, userId)` — yeni tesis
- `updateDisposerSite(entityId, siteId, data, userId)` — güncelle
- `toggleDisposerSiteStatus(entityId, siteId, userId)` — tesis durumu

---

## 6. Business Rules

1. **Çoklu rol:** Bir entity aynı anda hem tedarikçi hem taşıyıcı olabilir (örn. kendi araçlarıyla getiren PRO). `is_supplier = true` ve `is_transporter = true` birlikte mümkün.
2. **Deaktiflik yayılımı:** Entity INACTIVE yapılırsa, bu entity'ye bağlı formlar (sipariş oluşturma, kontrat) onu dropdown'larda göstermez. Eski kayıtlara bağlı olduğu için silinmez.
3. **Protected entity:** `is_protected = true` olan entity'ler (örn. Stichting Open) deaktif edilemez — sistem bütünlüğü için.
4. **Supplier roles (Hollanda hukuku):** Bir tedarikçi birden fazla yasal role sahip olabilir:
   - `ONTDOENER`: Atığı üreten kişi/kuruluş
   - `ONTVANGER`: Atığı teslim alan
   - `HANDELAAR`: Atıkla ticaret yapan
   - `BEMIDDELAAR`: Aracılık eden
5. **PRO vs COMMERCIAL:**
   - `PRO` (Producer Responsibility Organisation): Stichting Open gibi kuruluşlar. `pro_registration_number` zorunlu.
   - `COMMERCIAL`: Ticari tedarikçiler.

---

## 7. UI Sayfaları

| Sayfa | Route | Rol | Açıklama |
|-------|-------|-----|----------|
| EntitiesPage | `/admin/entities` | ADMIN, FM | Tüm entity listesi + filtreler |
| EntityDetailPage | `/admin/entities/:id` | ADMIN, FM | Profil, disposer sites, kontratlar, son siparişler |
| EntityCreatePage | `/admin/entities/new` | ADMIN, FM | Çok adımlı oluşturma formu |
| EntityEditPage | `/admin/entities/:id/edit` | ADMIN, FM | Düzenleme formu |

---

## 8. Diğer Modüllerle Bağlantı Noktaları

| Modül | Bağlantı |
|-------|---------|
| **Contracts** | `entity_supplier_id`, `agreement_transporter_id`, `buyer_id`, `sender_id`, `disposer_id`, `invoice_entity_id` |
| **Inbound** | `entity_supplier_id`, `transporter_id` (sipariş oluştururken) |
| **Outbound** | `buyer_id`, `sender_id`, `disposer_id`, `transporter_id` (çıkış siparişinde) |
| **Begeleidingsbrief** | Entity'nin `vihb_number`, `environmental_permit_number`, adres bilgileri BGL'de kullanılır |
| **Reports** | Supplier bazlı raporlarda (RPT-01) entity verileri kullanılır |

---

## 9. Legacy Model Migration

Sistem başlangıçta ayrı `Supplier` ve `Carrier` modellerine sahipti:

```
ESKİ:
  Supplier { id, name, supplier_type, kvk_number, contact_* }
  Carrier  { id, name, kvk_number, licence_number, contact_* }

YENİ:
  Entity { id, company_name, is_supplier, is_transporter, ... (tüm roller tek tabloda) }
```

**Migration stratejisi:**
- Eski `Supplier` ve `Carrier` tablolar hâlâ var (backward-compat)
- Yeni kayıtlar `Entity` tablosuna yazılır
- Kontrat ve sipariş FK'ları `entity_*_id` ismiyle eklendi
- `compatFixtures.js` eski ve yeni FK'ları sync eden utility

---

## 10. Önemli Kararlar

- **Tek tablo, çoklu rol:** Ayrı `Supplier`, `Carrier`, `Processor`, `Receiver` tabloları yerine flag-based `Entity` tercih edildi. Hollanda mevzuatında bir kuruluş birden fazla role sahip olabilir; ayrı tablolar bu durumu modellemeyi zorlaştırır.
- **Veri doğrulama service seviyesinde:** `vihb_number` veya `environmental_permit_number` gereklilikleri DB constraint değil, `entityService.js` içindeki business validation ile sağlanır.
- **DisposerSite ayrı model:** Bertarafçıların birden fazla fiziksel tesisi olabileceği için site bilgileri `Entity`'den ayrı tutuldu. Begeleidingsbrief'te tesis adresi kullanılır.
