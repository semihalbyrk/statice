# Reports Modülü — Statice MRF PRD

> **Amaç:** Bu doküman, Statice MRF Dashboard'ındaki raporlama modülünü açıklar. Hollanda mevzuatına uyum raporları (CBS, LMA, Province), tedarikçi sirkülasyon beyanları ve iç yönetim raporları üretilir.

> **Bağlam:** Statice, Hollanda çevre mevzuatı kapsamında düzenli raporlama yapmak zorundadır. Tüm raporlar sunucu tarafında üretilir (PDF + XLSX) ve manuel veri girişi olmaksızın sistemdeki operasyonel veriden otomatik hesaplanır.

---

## 1. Modülün Sistemdeki Yeri

```
Inbound → Weighing → Process (SortingSession) → [Veriler DB'de birikir]
                                                          ↓
                                              Reporting Manager / Admin
                                                          ↓
                                             Rapor tipi + parametreler seçilir
                                                          ↓
                                           reportDataService.js veri toplar
                                                          ↓
                          ┌────────────────────────────────────────┐
                          │  pdfReportGenerator.js (PDFKit)        │
                          │  xlsxReportGenerator.js (ExcelJS)      │
                          └────────────────────────────────────────┘
                                                          ↓
                                          PDF / XLSX dosyası → İndir veya E-posta
```

---

## 2. Rapor Tipleri

| Rapor ID | Adı | Hedef Kitle | Tipik Sıklık |
|----------|-----|-------------|--------------|
| RPT-01 | Supplier / Client Circularity Statement | Tedarikçi | Sipariş bazında veya talep üzerine |
| RPT-02 | Material Recovery Summary | CBS, Province, Yönetim | Aylık / Çeyreklik |
| RPT-03 | Chain-of-Custody Report | Uyum, Denetim | Sevkiyat bazında / talep üzerine |
| RPT-04 | Inbound Weight Register | Yönetim, Kantar | Günlük / Haftalık |
| RPT-05 | Waste Stream Analysis | Yönetim, Düzenleyici | Aylık |
| RPT-06 | Skip Asset Utilisation | Lojistik | Haftalık / Talep üzerine |

---

## 3. Veri Modeli

### 3.1 Report

```
Report
  id                UUID (PK)
  type              String (RPT-01 | RPT-02 | ... | RPT-06)
  generated_by      FK → User
  generated_at      DateTime
  parameters_json   Json (raporu oluşturmak için kullanılan parametreler)
  file_path_pdf     String? (dosya sistemi yolu)
  file_path_xlsx    String?
```

### 3.2 ReportSchedule

```
ReportSchedule
  id                UUID (PK)
  report_type       String
  frequency         String (DAILY | WEEKLY | MONTHLY)
  day_of_week       Int? (0-6, WEEKLY için)
  day_of_month      Int? (1-31, MONTHLY için)
  recipient_emails  String[] (alıcı e-posta adresleri)
  format            String (PDF | XLSX | BOTH)
  parameters_json   Json (rapor parametreleri)
  is_active         Boolean
  last_run_at       DateTime?
  next_run_at       DateTime
  created_at        DateTime
```

---

## 4. Rapor Detayları

### RPT-01 — Supplier / Client Circularity Statement

**Amaç:** Tedarikçiye gönderilen resmi belge — ne teslim edildi, nasıl işlendi, hangi geri kazanım oranları sağlandı.

**Format:** EU WEEE Directive uyumlu sirkülasyon beyanı. NVMP / Stichting Open işleme beyanı standardına uygun.

**Parametreler:**
- Tedarikçi (zorunlu, dropdown)
- Tarih aralığı (from / to)
- Sipariş referansları (tedarikçi + tarih aralığına göre otomatik doldurulur, checkbox seçimi)
- Materyal kategorileri (dahil/dışarıda bırak, çoklu seçim)

**Çıktı içeriği:**

*Başlık Bölümü:*
- Statice B.V. tesis adı, adresi, çevre izin numarası, KvK numarası
- Rapor üretim tarihi/saati
- Üreten kullanıcı adı
- Tedarikçi/müşteri adı ve kayıt bilgileri
- Raporlama dönemi

*Sipariş Özet Tablosu:*
- Sipariş Ref | Teslim Tarihi | Araç | Toplam Net Ağırlık (kg)

*Materyal Kategori Detay Tablosu:*
- CBS Kodu | Ürün Kategorisi | Toplam Net Ağırlık (kg) | Geri Dönüştürülen % | Yeniden Kullanılan % | Bertaraf % | Aşağı Akış İşleyici

*Gözetim Zinciri Bölümü:*
- Her materyal akışı için: aşağı akış işleyici adı, adresi, izin numarası, transfer yöntemi

---

### RPT-02 — Material Recovery Summary

**Amaç:** CBS, Province ve iç yönetim için periyodik materyal akışı ve geri kazanım oranı raporu.

**Parametreler:**
- Raporlama dönemi (ay/çeyrek/yıl veya özel tarih aralığı)
- Waste stream filtresi (opsiyonel)

**Çıktı içeriği:**

*Ana Veri Tablosu:*
- CBS Kodu | Ürün Kategorisi | Toplam Gelen (kg) | Geri Dönüştürülen (kg + %) | Yeniden Kullanılan (kg + %) | Bertaraf (kg + %) | Çöp Sahası (kg + %)

*Özet Satırı:* Tüm sütunlar için genel toplam

*Karşılaştırma Bölümü* (önceki dönem verisi varsa):
- Mevcut vs önceki dönem toplamları ve kategori bazında % değişim

---

### RPT-03 — Chain-of-Custody Report

**Amaç:** Uyum ve denetim için sevkiyat bazında izlenebilirlik belgesi.

**Parametreler:**
- Sipariş numarası (dropdown/arama, tek sipariş) VEYA tarih aralığı (toplu, sipariş başına bir rapor)

**Çıktı içeriği (sevkiyat başına):**
- Benzersiz sevkiyat tanımlayıcısı (sipariş numarası)
- Teslim detayları: taşıyıcı, araç plakası, arrived_at, sipariş referansı
- Skip düzeyinde detay: Asset Etiketi | Kategori | Gross (kg) | Tare (kg) | Net (kg) | Pfister Makbuz #
- Skip başına sıralama dökümü: Ürün Kategorisi | Ağırlık (kg) | Geri Dönüştürülen % | Yeniden Kullanılan % | Bertaraf % | Aşağı Akış İşleyici
- Aşağı akış işleyici detayları: ad, adres, izin numarası, transfer tarihi

---

### RPT-04 — Inbound Weight Register

**Amaç:** Tüm kantarlama olaylarının operasyonel günlük/haftalık kaydı.

**Parametreler:**
- Tarih aralığı (from / to)
- Taşıyıcı filtresi (opsiyonel)
- Waste stream filtresi (opsiyonel)

**Çıktı içeriği** (kantarlama olayı başına bir satır):
- Tarih/Saat | Sipariş # | Tedarikçi | Taşıyıcı | Araç Plakası | # Skip | Gross (kg) | Tare (kg) | Net (kg) | Pfister Makbuz # | Afvalstroomnummer

Taşıyıcı ve waste stream bazında ara toplamlar. Dönem için genel toplamlar.

---

### RPT-05 — Waste Stream Analysis

**Amaç:** Waste stream bazında materyal akışlarının aylık analizi.

**Konfigürasyon:** Ay/yıl veya tarih aralığı; waste stream çoklu seçim

**Çıktı:**
- Bar grafik (PDF'de sunucu tarafında statik görüntü olarak): ürün kategorisine göre gelen hacim
- Aynı verinin tablo formatı
- Kategoriler arası geri kazanım oranı karşılaştırması

---

### RPT-06 — Skip Asset Utilisation

**Amaç:** Skip kullanımı ve devir hızını gösteren lojistik yönetim raporu.

**Konfigürasyon:** Tarih aralığı; skip tipi filtresi

**Çıktı:**
- Dönemde alınan toplam skip sayısı
- Araç başına ortalama skip
- Skip tipine göre dağılım
- En çok kullanılan asset etiketleri listesi

---

## 5. API Endpoints

### Reports (`/api/reports`)

| Method | Path | Rol | Açıklama |
|--------|------|-----|----------|
| GET | `/reports` | RM, ADMIN | Son raporlar listesi (son 20) |
| POST | `/reports/generate` | RM, ADMIN | Rapor üret (type + parameters) |
| GET | `/reports/:id/download` | RM, ADMIN | PDF veya XLSX indir |
| DELETE | `/reports/:id` | ADMIN | Rapor kaydını sil |
| GET | `/reports/schedules` | RM, ADMIN | Zamanlanmış rapor listesi |
| POST | `/reports/schedules` | RM, ADMIN | Yeni zamanlama oluştur |
| PUT | `/reports/schedules/:id` | RM, ADMIN | Zamanlamayı güncelle |
| DELETE | `/reports/schedules/:id` | RM, ADMIN | Zamanlamayı sil |

---

## 6. Servis Katmanı

### `reportDataService.js` (~793 satır)

Her rapor tipi için veri toplama fonksiyonları:

- `getCircularityData(supplierId, dateRange, orderIds)` — RPT-01 için tedarikçi + sipariş + sıralama verileri
- `getMaterialRecoveryData(dateRange, wasteStreamFilter)` — RPT-02 için materyal akışı toplamları
- `getChainOfCustodyData(orderId | dateRange)` — RPT-03 için tam izlenebilirlik zinciri
- `getInboundWeightRegisterData(filters)` — RPT-04 için kantarlama kayıtları
- `getWasteStreamAnalysisData(period, wasteStreams)` — RPT-05 için waste stream analizi
- `getAssetUtilisationData(dateRange, skipType)` — RPT-06 için skip kullanım istatistikleri

### `pdfReportGenerator.js`

`PDFKit` kullanır:
- Her rapor tipi için özel PDF layout fonksiyonu
- Statice logosu, başlık, sayfa numaraları standart
- Tablo çizimi, kelime kaydırma, sayfa taşması yönetimi
- Grafik: RPT-05 için basit bar grafik (canvas → statik görüntü)
- Tüm raporlarda: üretim tarihi/saati + üreten kullanıcı adı

### `xlsxReportGenerator.js`

`ExcelJS` kullanır:
- Her rapor için ayrı worksheet'ler
- Sütun formatları (tarih, para birimi, yüzde)
- Stil: başlık satırı kalın, alternating row rengi
- Formüller: toplam satırları Excel SUM formülleri ile

### `reportScheduler.js`

Cron-tabanlı zamanlama:
- Her saat çalışır, `ReportSchedule.next_run_at ≤ now` olan kayıtları bulur
- Rapor üretir, e-posta ile gönderir (`nodemailer`)
- `last_run_at` ve `next_run_at` güncellenir

---

## 7. Business Rules

1. **Rapor üretim süresi:** 12 aylık veri seti için 10 saniye altında tamamlanmalı.
2. **Tüm raporlar:** Statice logosu, üretim tarihi/saati, üreten kullanıcı adı içerir.
3. **RPT-01 tedarikçi bazlı:** Hangi materyal kategorilerinin dahil/dışarıda tutulacağı tedarikçi bazında konfigüre edilebilir.
4. **Zamanlanmış raporlar:** Daily/Weekly/Monthly — konfigüre edilmiş e-posta adresine otomatik gönderilir. Format PDF / XLSX / Her İkisi seçilebilir.
5. **Dutch date/number formatting:** Düzenleyici raporlarda Hollanda tarih (DD-MM-YYYY) ve sayı (1.234,56) formatı kullanılır.
6. **Afvalstroomnummer:** RPT-04'te her satır için gösterilir (LMA uyumu).

---

## 8. UI Sayfaları

| Sayfa | Route | Rol | Açıklama |
|-------|-------|-----|----------|
| ReportsPage | `/reports` | RM, ADMIN | Sol sidebar: rapor tipleri; Ana alan: parametre formu + son raporlar |
| SchedulesPage | `/reports/schedules` | RM, ADMIN | Zamanlanmış raporları yönet |

**ReportsPage layout:**
- Sol sidebar: RPT-01'den RPT-06'ya ikon + isim listesi
- Seçilen rapor için konfigürasyon formu
- "Rapor Üret" butonu + "Zamanla" butonu
- Alt bölüm: son 20 üretilen rapor, PDF/XLSX indirme linkleri

---

## 9. Diğer Modüllerle Bağlantı Noktaları

| Modül | Bağlantı |
|-------|---------|
| **Inbound** | RPT-04 (Weight Register), RPT-03 (Chain-of-Custody) için inbound verileri |
| **Process** | RPT-01 (Circularity), RPT-02 (Recovery Summary) için sıralama/işleme verileri |
| **Contracts** | RPT-01'de tedarikçi kontrat bilgileri kullanılır |
| **Entities** | RPT-01, RPT-03'te tedarikçi/işleyici detayları (adres, izin numaraları) |
| **Outbound** | Begeleidingsbrief belgesi ayrı (outbound modülünde), ama materyal akışı raporlarına dahil |

---

## 10. Önemli Kararlar

- **Sunucu tarafı üretim:** Tüm raporlar backend'de üretilir, tarayıcıya dosya olarak gönderilir. Client-side rendering yok — büyük veri setleri için daha güvenilir.
- **İki format zorunlu:** PDF (resmi, gönderilebilir) + XLSX (veri analizi) her rapor için desteklenir.
- **Report kaydı:** Her üretilen rapor `Report` tablosuna kaydedilir — kim ne zaman hangi parametrelerle üretmiş iz bırakır.
- **Zamanlanmış raporlar saatlik cron:** Her saatte bir kontrol; deadline kaçırma riski düşük, sistem yükü az.
