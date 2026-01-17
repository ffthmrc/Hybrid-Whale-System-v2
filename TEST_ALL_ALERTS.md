# 🧪 TÜM BİLDİRİM TÜRLERİNİ TEST REHBERİ

## ✅ Güncelleme: Alert Type Gösterimi

Artık **Active Positions** ve **Trade History**'de işlemin hangi alert türünden açıldığı görünüyor!

### Görünüm:
```
┌────────────────────────────────────┐
│ BTC  LONG 20X                      │
│ AUTO  WHALE ACCUMULATION           │ ← YENİ!
└────────────────────────────────────┘
```

---

## 📊 9 BİLDİRİM TÜRÜ VE TEST YÖNTEMLERİ

### 1️⃣ **🐋 WHALE ACCUMULATION** (Balina Birikimi)
**Koşullar:**
```typescript
✅ whaleDetectionEnabled: true
✅ Hot symbol (2x+ volume spike veya 1%+ volatility)
✅ Large orders: 5x+ ortalama trade size
✅ Whale score >= whaleMinScore (default 55)
```

**Test:**
```bash
# 1. Config ayarla
whaleDetectionEnabled: true
whaleMinScore: 40  # Düşür (daha çok alert)

# 2. Console'u aç (F12)
# 3. Şu mesajları ara:
"[Market Radar] ... is now HOT!"
"[Whale Analysis] ... Score: XX"

# 4. Bekle: Büyük emirli coinlerde alert
# Örnek: BTC, ETH gibi yüksek hacimli coinler
```

**Neden Göremiyorsun?**
- Hot symbol olması lazım (volume spike)
- AggTrade stream'den büyük emir tespit etmeli
- Minimum 5x büyük emir gerekli

---

### 2️⃣ **🏦 INSTITUTION ENTRY** (Kurumsal Giriş)
**Koşullar:**
```typescript
✅ whaleDetectionEnabled: true
✅ Hot symbol
✅ Order book imbalance: 2.5x+ (bid/ask dengesizliği)
✅ Large orders YOK veya düşük
✅ Whale score >= whaleMinScore
```

**Test:**
```bash
# 1. Config ayarla
whaleMinScore: 35  # Daha düşük

# 2. Console'da ara:
"orderBookImbalance"

# 3. Bekle: Ani emir defteri dengesizliği
# Örnek: Breaking news olan coinler
```

**Neden Göremiyorsun?**
- BookTicker stream'den imbalance gerekli
- 2.5x+ bid/ask oranı şart
- Hot symbol olması lazım

---

### 3️⃣ **💰 SMART MONEY FLOW** (Akıllı Para)
**Koşullar:**
```typescript
✅ whaleDetectionEnabled: true
✅ Hot symbol
✅ Whale score >= whaleMinScore
✅ Large orders ve orderBook imbalance YOK
✅ Volatility spike veya candle pattern var
```

**Test:**
```bash
# 1. whaleMinScore: 30  # Düşür
# 2. Bekle: Orta seviye whale skorları
# 3. Large order ve imbalance olmayan durumlar
```

**Bu 3 Whale Türü Arasındaki Fark:**
```
WHALE ACCUMULATION:   Büyük emirler VAR
INSTITUTION ENTRY:    Emir defteri dengesizliği VAR
SMART MONEY FLOW:     İkisi de YOK, ama whale skoru yeterli
```

---

### 4️⃣ **🔥 PUMP** (Hacim Patlaması)
**Koşullar:**
```typescript
✅ pumpDetectionEnabled: true
✅ %1+ fiyat değişimi (1 dakikalık mum)
✅ Volume spike:
   - 2.5x+ son dakika
   - VE (2.3x+ son 5 dakika ortalama VEYA 3x+ son 20 dakika ortalama)
✅ 5 dakika cooldown (spam önleme)
```

**Test:**
```bash
# 1. Config:
pumpDetectionEnabled: true
autoTrading: false  # PUMP'lar otomatik açılmaz

# 2. Console'da izle:
[Market Radar] volume spikes

# 3. Bekle: Düşük cap coinlerde ani hareketler
# Örnek: SPELL, MEME, yeni listinglenenler

# 4. Alert gelince: Manuel "QUICK ENTRY" butonu olacak
```

**Neden Sadece Bunu Görüyorsun?**
- Volume spike kolayca oluşuyor (2.5x yeterli)
- Whale detection için hot symbol + büyük emirler gerekli (daha zor)

---

### 5️⃣ **🚀 TREND START** (Trend Başlangıcı)
**Koşullar:**
```typescript
✅ 20+ mum geçmişi
✅ Konsolidasyon: Son 15 mumda %0.5'ten az hareket
✅ Breakout: %2+ fiyat değişimi (1 dakikalık mum)
✅ Trend teyit: Son 3 mum aynı yönde (bullish/bearish)
✅ Volume spike: 2x+ (checkPumpStart kontrolü)
✅ Context: SMA10 ve SMA20 uygun
```

**Test:**
```bash
# 1. Sideways hareket eden coin bul
# Örnek: 15 dakika boyunca %0.5 içinde hareket eden

# 2. Bekle: Ani %2+ breakout

# 3. Console'da göreceksin:
"isTrendStart: true"
"breakoutPercent: 2.X"

# 4. Alert gelir: "🚀 TREND START"
```

**Neden Göremiyorsun?**
- Konsolidasyon şartı çok katı (%0.5)
- %2 breakout gerekiyor (büyük hareket)
- Volume spike şart

**Kolaylaştırma (Test için):**
```typescript
// App.tsx line ~161
const isConsolidating = rangePercent < 1.0;  // 0.5 → 1.0
const isBreakout = Math.abs(candleChangePct) >= 1.5;  // 2.0 → 1.5
```

---

### 6️⃣ **⚡ STAIRCASE** (Merdiven)
**Koşullar:**
```typescript
✅ eliteMode: true
✅ Son 5 fiyat sürekli yükseliş/düşüş
   - Bullish: her fiyat >= önceki * 0.9994
   - Bearish: her fiyat <= önceki * 1.0006
✅ Volume: 1.15x+ ortalama
```

**Test:**
```bash
# 1. Config:
eliteMode: true
priceChangeThreshold: 1.0

# 2. Bekle: Sürekli yükselen/düşen coin
# Örnek: Strong trend'deki coinler (SOL, LINK)

# 3. Göreceksin: "ELITE STAIRCASE"
```

---

### 7️⃣ **🏛️ INSTITUTIONAL** (Kurumsal Hacim)
**Koşullar:**
```typescript
✅ eliteMode: true
✅ Volume: 1.6x+ ortalama
✅ Staircase değil (sürekli yükseliş/düşüş yok)
```

**Test:**
```bash
# 1. eliteMode: true
# 2. Bekle: Yüksek hacimli ani hareketler
# 3. Staircase olmayan durumlar
```

---

### 8️⃣ **🚀 PARABOLIC** (Parabolik)
**Koşullar:**
```typescript
✅ eliteMode: true
✅ Volume: 2.4x+ ortalama (en yüksek)
```

**Test:**
```bash
# 1. eliteMode: true
# 2. Bekle: ÇOOK yüksek hacim spike
# 3. Göreceksin: "ELITE PARABOLIC"
```

---

### 9️⃣ **⚡ PULSE MOMENTUM** (Normal)
**Koşullar:**
```typescript
✅ eliteMode: false  # VEYA elite koşulları sağlanmadı
✅ %1+ fiyat değişimi
✅ Blacklist'te değil
✅ 10 saniye cooldown
```

**Test:**
```bash
# 1. Config:
eliteMode: false
priceChangeThreshold: 1.0

# 2. Her %1+ harekette alert
# 3. En sık gördüğün alert bu olmalı
```

---

## 🎯 ÖNCELIK SIRASI (Kod Mantığı)

```
1. PUMP (pumpDetectionEnabled: true)
   ↓ pumpAlertCreated = true → DİĞERLERİ ENGELLENİR

2. TREND START (her zaman kontrol edilir)
   ↓ pumpAlertCreated = true → DİĞERLERİ ENGELLENİR

3. ELITE (eliteMode: true) veya PULSE (eliteMode: false)
   ↓ Normal momentum alert

4. WHALE (whaleDetectionEnabled: true VE isHotSymbol: true)
   ↓ En son kontrol edilir ama yüksek öncelikli
```

**ÖNEMLİ:** 
- Bir symbol için 1 dakikada SADECE 1 ALERT oluşur
- İlk tetiklenen alert diğerlerini engeller
- Whale detection en güçlü ama en son kontrol edilir

---

## 🔧 TEST AYARLARI (Kolay Alert İçin)

### Maksimum Alert Almak İçin:
```typescript
// constants.tsx
export const DEFAULT_CONFIG: StrategyConfig = {
  autoTrading: true,
  eliteMode: true,           // Elite alert'leri aç
  pumpDetectionEnabled: true, // Pump alert'leri aç
  whaleDetectionEnabled: true, // Whale alert'leri aç
  
  priceChangeThreshold: 0.8,  // 1.0 → 0.8 (daha hassas)
  whaleMinScore: 35,          // 55 → 35 (daha çok whale)
  
  blacklist: [],              // Boşalt (tüm coinler)
};
```

### Console Log'ları Aktif Et:
```typescript
// App.tsx içinde zaten var:
console.log(`[Market Radar] ${symbol} is now HOT!`);
console.log(`[Whale Analysis] ${symbol} Score: ${totalScore}`);
console.log(`[Auto Trade] Opening ${alert.side} on ${symbol} triggered by ${alert.reason}`);
```

---

## 📋 TEST CHECKLISTI

### PUMP (🔥):
- [ ] pumpDetectionEnabled: true
- [ ] %1+ fiyat değişimi gördün
- [ ] Volume 2.5x+ spike var
- [ ] Alert: "🔥 PUMP"
- [ ] autoTrade: false (manuel)

### TREND START (🚀):
- [ ] Sideways coin buldun
- [ ] %2+ breakout oldu
- [ ] Alert: "🚀 TREND START"
- [ ] autoTrade: true

### ELITE ALERTS (⚡):
- [ ] eliteMode: true
- [ ] STAIRCASE: Sürekli yükseliş + 1.15x volume
- [ ] INSTITUTIONAL: 1.6x volume
- [ ] PARABOLIC: 2.4x volume
- [ ] autoTrade: true

### PULSE (⚡):
- [ ] eliteMode: false
- [ ] %1+ fiyat değişimi
- [ ] Alert: "PULSE MOMENTUM"
- [ ] autoTrade: true

### WHALE ALERTS (🐋):
- [ ] whaleDetectionEnabled: true
- [ ] Hot symbol var (console'da gördün)
- [ ] Whale score >= 35
- [ ] Alert: "🐋 WHALE ..." (3 tür)
- [ ] autoTrade: true
- [ ] Ses: "ting-ting-ting" 🔔

---

## 🐛 SORUN GİDERME

### "Sadece PUMP ve PULSE görüyorum"
**Sebep:** Diğer alert'ler daha katı koşullara sahip

**Çözüm:**
```typescript
// TREND START için:
rangePercent < 1.0  // 0.5 yerine
isBreakout >= 1.5   // 2.0 yerine

// WHALE için:
whaleMinScore: 30   // 55 yerine
```

### "Whale alert hiç gelmiyor"
**Kontrol et:**
1. whaleDetectionEnabled: true mi?
2. Console'da "is now HOT!" mesajı var mı?
3. Hot symbol'de 5x+ büyük emir var mı?

**Debug:**
```typescript
// App.tsx line ~330'a ekle:
console.log(`[Debug] ${symbol} Hot: ${isHotSymbol}, Score: ${whaleScore?.score || 0}`);
```

### "Elite alert'ler gelmiyor"
**Kontrol et:**
1. eliteMode: true mi?
2. Volume spike yeterli mi? (1.15x, 1.6x, 2.4x)

---

## 🎓 ÖNERİLEN TEST SIRASI

### 1. PULSE MOMENTUM (En Kolay)
```
eliteMode: false
priceChangeThreshold: 0.8
→ Her %0.8+ harekette alert
```

### 2. PUMP (Kolay)
```
pumpDetectionEnabled: true
→ Volume spike'larda alert
```

### 3. ELITE (Orta)
```
eliteMode: true
→ Yüksek hacimli hareketlerde
```

### 4. TREND START (Zor)
```
Sideways coin bekle
→ Breakout'ta alert
```

### 5. WHALE (En Zor)
```
whaleMinScore: 30
→ Hot symbol'lerde büyük emirlerde
```

---

## ✅ BAŞARILI TEST GÖSTERGELERİ

Position açıldığında göreceksin:
```
┌────────────────────────────────────┐
│ SPELL  SHORT 20X                   │
│ AUTO  PUMP ← Alert türü            │ ← YENİ!
│ Entry: $0.088                      │
└────────────────────────────────────┘
```

Trade history'de:
```
┌────────────────────────────────────┐
│ BTC  LONG 20X                      │
│ AUTO  WHALE ACCUMULATION           │ ← YENİ!
│ +$245.00  +12.25%                  │
└────────────────────────────────────┘
```

Console'da:
```
[Market Radar] SPELL is now HOT! Spike: 3.2x
[Whale Analysis] BTC Score: 78 { largeOrders: 25, imbalance: 15 }
[Auto Trade] Opening LONG on BTC triggered by 🐋 WHALE ACCUMULATION
```

---

## 🚀 SONUÇ

**9 Bildirim Türü:**
1. 🐋 WHALE ACCUMULATION (büyük emir)
2. 🏦 INSTITUTION ENTRY (emir defteri)
3. 💰 SMART MONEY FLOW (whale skoru)
4. 🔥 PUMP (hacim patlaması, manuel)
5. 🚀 TREND START (konsolidasyon breakout)
6. ⚡ STAIRCASE (sürekli yükseliş + hacim)
7. 🏛️ INSTITUTIONAL (yüksek hacim)
8. 🚀 PARABOLIC (çok yüksek hacim)
9. ⚡ PULSE MOMENTUM (standart)

**Test Sırası:** PULSE → PUMP → ELITE → TREND → WHALE

**En Kolay:** PULSE ve PUMP (her saat birkaç tane)
**En Zor:** WHALE (günde birkaç tane, hot symbol + büyük emir gerekli)

Başarılar! 🎯
