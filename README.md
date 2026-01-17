# 🐋 Binance Pro-Pulse Trading Dashboard with Whale Detection

## 🚀 Özellikler

- ✅ Real-time Binance Futures WebSocket integration
- ✅ **Whale Detection System** (Büyük emir ve order book analizi)
- ✅ **Dynamic Stop Loss** (Pump başlangıç noktasına göre)
- ✅ PUMP Detection (Volume spike + price momentum)
- ✅ TREND Start Detection (Konsolidasyon breakout)
- ✅ ELITE Mode (Parabolic, Staircase, Institutional patterns)
- ✅ Automated Trading with partial take-profits
- ✅ Trailing Stop Loss
- ✅ Live PNL tracking
- ✅ Trade history with analytics

---

## 📦 Kurulum

```bash
# 1. Dependencies yükleyin
npm install

# 2. Uygulamayı başlatın
npm run dev
```

Tarayıcıda `http://localhost:3000` adresine gidin.

---

## 🐋 Whale Detection Nasıl Kullanılır?

### Adım 1: Aktif Edin
Sağ panelde (Trading Controls) **🐋 WHALE** butonuna tıklayın.

### Adım 2: Ayarları Yapın
- **Min Score:** 55 (varsayılan) - Düşürürseniz daha fazla alert
- **Dynamic SL:** ON - Pump başlangıç noktasına göre SL

### Adım 3: Whale Alert Bekleyin
1-3 dakika içinde **🐋 75** badge'li alert gelecek:
```
🐋 WHALE ACCUMULATION
Whale Score: 75/100
Büyük emirler tespit edildi (6.5x ortalama)
Support: $0.055
🎯 Dynamic SL will use support level
```

### Adım 4: Trade Açın
**🐋 WHALE ENTRY** butonuna tıklayın → Otomatik işlem başlar.

---

## 📁 Proje Yapısı

```
whale-detection-project/
├── App.tsx                      # Ana uygulama (whale detection logic)
├── types.ts                     # Type definitions
├── constants.tsx                # Config defaults
├── index.tsx                    # Entry point
├── index.html                   # HTML template
├── components/
│   ├── AlertsPanel.tsx          # Whale alerts UI
│   ├── TradingControls.tsx      # Bot settings + whale config
│   ├── PositionsPanel.tsx       # Live positions + dynamic SL
│   ├── MarketOverview.tsx       # Market scanner
│   └── TradingChart.tsx         # TradingView chart
├── package.json
├── tsconfig.json
├── vite.config.ts
├── .gitignore
└── Dokümantasyon/
    ├── INSTALLATION_GUIDE.md    # Detaylı kurulum
    ├── WHALE_DETECTION_README.md # Sistem açıklaması
    ├── COMPONENT_UPDATES.md     # UI değişiklikleri
    └── TECHNICAL_CHANGES.md     # Backend değişiklikler
```

---

## 🎯 Hızlı Test

```typescript
// 1. Whale Mode'u aktif edin (UI'dan)
// 2. Console'da şunu yazın:

// Mock whale alert oluştur
const mockAlert = {
  id: 'test-1',
  symbol: 'BTCUSDT',
  side: 'LONG',
  reason: '🐋 WHALE ACCUMULATION',
  change: 2.5,
  price: 88000,
  previousPrice: 86000,
  timestamp: Date.now(),
  executed: false,
  isElite: true,
  eliteType: 'WHALE_ACCUMULATION',
  autoTrade: true,
  whaleDetails: {
    score: 75,
    largeOrders: 30,
    orderBookImbalance: 3.2,
    volatilitySpike: true,
    supportLevel: 85000,
    resistanceLevel: 92000,
    description: "Büyük emirler tespit edildi (6.5x)"
  }
};
```

---

## 📊 Config Ayarları

### Whale Detection
```typescript
whaleDetectionEnabled: true    // Whale mode on/off
whaleMinScore: 55              // Minimum score (0-100)
useDynamicStopLoss: true       // Dinamik SL kullan
```

### Diğer Ayarlar
```typescript
autoTrading: true              // Otomatik işlem
eliteMode: true                // Sadece elite sinyaller
pumpDetectionEnabled: true     // Pump detection
leverage: 20                   // Kaldıraç
riskPerTrade: 1.0              // İşlem başı risk %
stopLossPercent: 2.0           // SL mesafesi %
tp1Percent: 1.0                // TP1 %
tp2Percent: 3.0                // TP2 %
maxConcurrentTrades: 20        // Max eşzamanlı işlem
```

---

## 🐛 Sorun Giderme

### Whale Alert Gelmiyor
```typescript
// constants.tsx
whaleMinScore: 45  // Düşürün
```

### Çok Fazla Alert
```typescript
// constants.tsx
whaleMinScore: 65  // Yükseltin
```

### WebSocket Hatası
Binance API erişilebilir mi kontrol edin. VPN gerekebilir.

---

## 📚 Detaylı Dokümantasyon

1. **INSTALLATION_GUIDE.md** - Kurulum ve ilk test
2. **WHALE_DETECTION_README.md** - Sistem nasıl çalışır
3. **COMPONENT_UPDATES.md** - UI değişiklikleri
4. **TECHNICAL_CHANGES.md** - Backend değişiklikler

---

## ⚠️ Önemli Notlar

- Bu bir **simülasyon/backtest** aracıdır
- Canlı trading için **kendi sorumluluğunuzdadır**
- API key'leri eklenmemiştir (sadece public WebSocket)
- Risk yönetimi her zaman aktif tutun

---

## 🎓 Nasıl Çalışır?

### Whale Detection Pipeline:
```
Ticker Stream
    ↓
Hot Symbol Detection (Volume spike)
    ↓
AggTrade + BookTicker Streams (Seçili coinler için)
    ↓
Whale Score Calculation (0-100)
    ↓
Alert Oluştur (Score ≥ 55)
    ↓
Dynamic SL Hesapla (Support/Resistance)
    ↓
Auto Trading (Position aç)
```

### FHE Örneği:
```
09:00 → Volume spike → Hot symbol
09:05 → Büyük emir ($50K, avg $8K)
       → Order book: 3.2x imbalance
       → Whale Score: 75/100 ✅
09:06 → Alert + Otomatik entry $0.06
       → Dynamic SL: $0.055 (pump başlangıcı)
09:30 → Fiyat: $0.088 (+46%)
       → Static SL $0.062'de kapanırdı ❌
       → Dynamic SL tuttu ✅
```

---

## 🚀 Başarılar!

Whale detection sistemi production-ready. FHE benzeri pump'ları yakalamaya hazırsınız! 🐋

**İletişim:** Sorunlar için issue açın veya feedback verin.
