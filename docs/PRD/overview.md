# Statice — Şirket ve Proje Genel Bakışı

## Statice Kimdir?

Statice, Hollanda'da faaliyet gösteren, sertifikalı bir **e-atık geri dönüşüm ve yeniden kullanım tesisi** işleten bir şirkettir. Tesis, elektronik atıkları (WEEE — Waste Electrical and Electronic Equipment) kabul eder, tartар, tasnif eder ve geri kazanım oranlarını raporlar.

### Tedarik Kaynakları

| Kaynak | Açıklama |
|--------|----------|
| **Bireyler (Private Individuals)** | Tüketicilerin doğrudan teslim ettiği e-atıklar |
| **Stichting Open (PRO)** | Hollanda'da e-atık toplama konteynerleri işleten büyük tedarikçi |

Gelen yükler, Van Happen Recycling gibi harici taşıyıcılar tarafından kamyonlarla getirilir. Tek bir kamyon, her biri ayrı kayıt altına alınan birden fazla konteyner (bak/skip) taşıyabilir.

---

## Mevcut Durum Neydi?

Proje öncesinde Statice'in tüm operasyonel süreçleri **Excel tabloları ve kağıt tabanlı Pfister tartı biletleri** üzerinden yürütülüyordu. Bu yöntem:

- Manuel veri girişi hatalarına açık
- Hollanda'nın zorunlu dijital raporlama yükümlülükleriyle uyumsuz
- Tedarikçilere doğrulama raporu sunmayı güçleştiren

bir yapıydı.

---

## Proje Ne Yapıyor?

**Statice Dashboard**, bu kağıt tabanlı operasyonları uçtan uca dijitalleştiren bir MRF (Material Recovery Facility) yönetim sistemidir. Şu operasyonel akışları kapsar:

### 1. Gelen Kargo Yönetimi (Inbound)
Araç gelişi, taşıyıcı ve tedarikçi eşleştirmesi, sipariş oluşturma ve karşılama süreçleri.

### 2. Skip / Varlık Kaydı
Her konteynerin benzersiz kimliğiyle (SKP-YYYYMMDD-NNN formatında) sisteme alınması, etiket basımı ve takibi.

### 3. Pfister Kantara Entegrasyonu
Araç brüt ağırlığı, boş ağırlığı (tare) ve net kargo ağırlığının otomatik yakalanması. Mevcut sürümde Pfister cihazı **simüle edilmektedir**; gerçek entegrasyon ilerleyen sürümde yalnızca `pfisterSimulator.js` dosyasının değiştirilmesiyle sağlanacaktır.

### 4. Tasnif ve Malzeme Kaydı
Gelen e-atıkların ürün kategorilerine göre kırılımı (fraksiyon bazında ağırlık girişi) ve geri kazanım oranlarının hesaplanması.

### 5. Raporlama
Hollanda resmi kurumlarına (CBS, LMA, Eyalet) ve tedarikçilere sunulmak üzere çeşitli raporlar üretilmesi.

---

## Üretilen Raporlar

| Kod | Rapor Adı | Alıcı |
|-----|-----------|-------|
| RPT-01 | Supplier / Client Circularity Statement | Tedarikçiler |
| RPT-02 | Material Recovery Summary | İç yönetim |
| RPT-03 | Chain-of-Custody Report | Denetçiler |
| RPT-04 | Inbound Weight Register | LMA / CBS |
| RPT-05 | Waste Stream Analysis | Eyalet / LMA |
| RPT-06 | Skip Asset Utilisation | İç yönetim |

---

## İş Hedefleri

| Hedef | Ölçüt |
|-------|-------|
| Kağıt tartı biletlerini ortadan kaldır | Tüm tartımlar %100 dijital olarak kaydedilir |
| Sipariş başına çoklu skip kaydını destekle | Her araçta en az 1 skip bir siparişe bağlanır |
| Pfister entegrasyonunu hazır tut | Simülasyon, gelecekteki gerçek entegrasyona birebir tekabül eder |
| Uyumlu yasal ve tedarikçi raporları üret | LMA, CBS, Eyalet raporları ek düzeltme gerektirmez |
| Tam izlenebilirlik | Her gelen sevkiyat için eksiksiz denetim izi |

---

## Teknik Yapı

| Katman | Teknoloji |
|--------|-----------|
| Frontend | React 18, React Router v6, Tailwind CSS, shadcn/ui, Zustand |
| Backend | Node.js, Express.js |
| Veritabanı | PostgreSQL 15 + Prisma ORM |
| Kimlik Doğrulama | JWT (bellek içi access token + HttpOnly cookie refresh token) |
| Raporlama | PDFKit (PDF) + ExcelJS (XLSX) |
| API | RESTful JSON |

---

## Kullanıcı Rolleri

| Rol | Sorumluluk |
|-----|------------|
| **Admin** | Kullanıcı, tedarikçi, taşıyıcı yönetimi |
| **Facility Manager** | Tüm operasyonel modüllere tam erişim |
| **Weighing Operator** | Tartım ekranı |
| **Sorting Employee** | Tasnif veri girişi |
| **Finance Manager** | Raporlama modülü |

---

## Kapsam Dışı

Aşağıdaki özellikler bu sistemde **kesinlikle yer almamaktadır**:

- Giden lojistik planlama
- Mobil uygulama
- Tedarikçi / müşteri portalı
- Faturalama
- DIWASS API entegrasyonu *(zorunlu Hollanda dijital atık raporlama sistemi — ayrı proje)*
- Çok tesisli / çok kiracılı mimari
- Gerçek Pfister TCP/IP entegrasyonu *(simülasyon yeterli)*

---

## Terimler Sözlüğü

| Terim | Açıklama |
|-------|----------|
| **Afvalstroom** | Atık akışı — kategorize edilmiş malzeme akışı (ör. WEEE, plastik, metal) |
| **Afvalstroomnummer** | Hollanda makamlarınca atanan atık akış kayıt numarası |
| **Bak / Skip** | Araç üzerinde taşınan konteyner birimi |
| **CBS** | Centraal Bureau voor de Statistiek — Hollanda İstatistik Kurumu |
| **DIWASS** | Zorunlu Hollanda dijital atık raporlama sistemi (kapsam dışı) |
| **LMA** | Landelijk Meldpunt Afvalstoffen — Ulusal Atık Bildirim Merkezi |
| **MRF** | Material Recovery Facility — Malzeme Geri Kazanım Tesisi |
| **Pfister** | Statice tesisindeki kantara sistemi markası |
| **PRO** | Producer Responsibility Organisation — ör. Stichting Open |
| **WEEE** | Waste Electrical and Electronic Equipment — AB e-atık düzenleyici kategorisi |

---

*Bu belge proje bağlamını özetler. Teknik gereksinimler için [docs/PRD.md](../PRD.md) ana kaynak belgedir.*
