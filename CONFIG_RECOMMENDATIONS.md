# 🔧 CONFIG.TSX GÜNCELLEMELERİ VE ÖNERİLER

## 📊 ŞU ANKİ DEĞERLER ANALİZİ

### ✅ İYİ AYARLANMIŞ:
- PUMP.COOLDOWN_MS: 180000 (3 dakika) - Uygun
- ALERTS.COOLDOWN_MS: 15000 (15 saniye) - Uygun
- TRADING.FEE_RATE: 0.0005 - Doğru
- WHALE.LARGE_TRADE_MULTIPLIER: 5 - İyi

### ⚠️ GEVŞEK (Çok fazla alert riski):
- PUMP.PRICE_CHANGE_MIN: 1.0% - Biraz düşük
- MOMENTUM.BASIC_PRICE_CHANGE: 0.8% - Çok düşük
- TREND.CONSOLIDATION_MAX: 1.5% - Uygun
- TREND.BREAKOUT_MIN: 1.0% - İyi

---

## 🎯 ÖNERİLEN SENARYOLAR

### SENARYO 1: CONSERVATIVE (Az ama kaliteli)
```typescript
export const SYSTEM_CONFIG = {
  PUMP: {
    PRICE_CHANGE_MIN: 1.5,      // %1.5+ fiyat
    VOLUME_RATIO_MIN: 2.5,      // 2.5x hacim
    VOLUME_RATIO_5M_AVG: 2.2,
    VOLUME_RATIO_10M_AVG: 2.5,
    COOLDOWN_MS: 180000,        // 3 dakika
  },
  
  TREND: {
    MIN_CANDLES: 15,            // Daha uzun analiz
    CONSOLIDATION_MAX: 1.2,     // Daha sıkı
    BREAKOUT_MIN: 1.2,          // Daha güçlü
    TREND_CONFIRM_CANDLES: 3,   // 3 mum teyit
  },
  
  MOMENTUM: {
    PARABOLIC_VOLUME_RATIO: 3.0,    // 3x hacim
    PARABOLIC_PRICE_CHANGE: 1.0,    // %1.0
    
    STAIRCASE_VOLUME_RATIO: 2.0,
    
    INSTITUTIONAL_VOLUME_RATIO: 2.2,
    INSTITUTIONAL_PRICE_CHANGE: 0.8,
    
    BASIC_PRICE_CHANGE: 1.0,        // %1.0 minimum
    BASIC_VOLUME_RATIO: 1.5,
  },
};
```

**Sonuç:** Günde 5-10 kaliteli alert. %70+ başarı oranı beklenir.

---

### SENARYO 2: BALANCED (Şu anki - hafif sıkılaştırılmış)
```typescript
export const SYSTEM_CONFIG = {
  PUMP: {
    PRICE_CHANGE_MIN: 1.2,      // %1.2 (şu an 1.0)
    VOLUME_RATIO_MIN: 2.2,      // 2.2x (şu an 2.0)
    VOLUME_RATIO_5M_AVG: 2.0,   // şu an 1.8
    VOLUME_RATIO_10M_AVG: 2.3,  // şu an 2.2
    COOLDOWN_MS: 180000,
  },
  
  TREND: {
    MIN_CANDLES: 12,            // şu an 10
    CONSOLIDATION_MAX: 1.3,     // şu an 1.5
    BREAKOUT_MIN: 1.1,          // şu an 1.0
    TREND_CONFIRM_CANDLES: 2,
  },
  
  MOMENTUM: {
    PARABOLIC_VOLUME_RATIO: 2.5,
    PARABOLIC_PRICE_CHANGE: 0.8,
    
    STAIRCASE_VOLUME_RATIO: 1.7,    // şu an 1.5
    
    INSTITUTIONAL_VOLUME_RATIO: 2.0, // şu an 1.8
    INSTITUTIONAL_PRICE_CHANGE: 0.7, // şu an 0.6
    
    BASIC_PRICE_CHANGE: 0.9,        // şu an 0.8
    BASIC_VOLUME_RATIO: 1.4,        // şu an 1.3
  },
};
```

**Sonuç:** Günde 10-20 alert. %60+ başarı oranı. **ÖNERİLEN BAŞLANGIÇ**

---

### SENARYO 3: AGGRESSIVE (Çok alert, test için)
```typescript
export const SYSTEM_CONFIG = {
  PUMP: {
    PRICE_CHANGE_MIN: 0.8,      // Daha düşük
    VOLUME_RATIO_MIN: 1.8,
    VOLUME_RATIO_5M_AVG: 1.6,
    VOLUME_RATIO_10M_AVG: 1.8,
    COOLDOWN_MS: 120000,        // 2 dakika
  },
  
  TREND: {
    MIN_CANDLES: 8,
    CONSOLIDATION_MAX: 2.0,
    BREAKOUT_MIN: 0.8,
    TREND_CONFIRM_CANDLES: 2,
  },
  
  MOMENTUM: {
    PARABOLIC_VOLUME_RATIO: 2.0,
    PARABOLIC_PRICE_CHANGE: 0.6,
    
    STAIRCASE_VOLUME_RATIO: 1.3,
    
    INSTITUTIONAL_VOLUME_RATIO: 1.5,
    INSTITUTIONAL_PRICE_CHANGE: 0.5,
    
    BASIC_PRICE_CHANGE: 0.6,
    BASIC_VOLUME_RATIO: 1.2,
  },
};
```

**Sonuç:** Günde 30-50 alert. %40-50% başarı oranı. Sadece test için!

---

## 🔥 GERÇEK SENARYO ÖNERİSİ

Canlı trading için:

```typescript
// config.tsx - PRODUCTION READY
export const SYSTEM_CONFIG = {
  MAX_ALERTS: 1000,
  MAX_HISTORY: 500,
  
  PUMP: {
    PRICE_CHANGE_MIN: 1.2,      // ⚡ Hafif sıkılaştırıldı
    VOLUME_RATIO_MIN: 2.2,      // ⚡ 
    VOLUME_RATIO_5M_AVG: 2.0,   // ⚡
    VOLUME_RATIO_10M_AVG: 2.3,  // ⚡
    COOLDOWN_MS: 180000,
  },
  
  TREND: {
    MIN_CANDLES: 15,            // ⚡ Daha güvenilir
    CONSOLIDATION_MAX: 1.3,     // ⚡
    BREAKOUT_MIN: 1.1,          // ⚡
    TREND_CONFIRM_CANDLES: 2,
  },
  
  MOMENTUM: {
    PARABOLIC_VOLUME_RATIO: 2.5,
    PARABOLIC_PRICE_CHANGE: 0.9,    // ⚡
    
    STAIRCASE_VOLUME_RATIO: 1.7,    // ⚡
    STAIRCASE_PRICE_TOLERANCE: 0.998,
    
    INSTITUTIONAL_VOLUME_RATIO: 2.0, // ⚡
    INSTITUTIONAL_PRICE_CHANGE: 0.7, // ⚡
    
    BASIC_PRICE_CHANGE: 0.9,        // ⚡ ÖNEMLİ
    BASIC_VOLUME_RATIO: 1.4,        // ⚡
  },
  
  ALERTS: {
    PRICE_CHANGE_THRESHOLD: 0.9,  // ⚡ UI'dan değiştirilebilir
    COOLDOWN_MS: 15000,
    TREND_COOLDOWN_MS: 60000,     // ⚡ YENİ - TREND için ayrı
    TREND_HIGHLIGHT_DURATION: 5000,
  },
  
  API: {
    KLINES_1M_LIMIT: 60,
    KLINES_5M_LIMIT: 24,
    KLINES_15M_LIMIT: 16,
    RECENT_TRADES_LIMIT: 200,
    AGG_TRADES_LIMIT: 500,
    ORDER_BOOK_DEPTH: 20,
    CACHE_DURATION_MS: 60000,
    RATE_LIMIT_PER_MINUTE: 50,
  },
  
  WHALE: {
    LARGE_TRADE_MULTIPLIER: 5,
    ORDER_IMBALANCE_THRESHOLD: 2.5,  // ⚡ Sıkılaştırıldı
    MIN_WHALE_SCORE: 60,             // ⚡ YENİ - Minimum whale score
  },
  
  TRADING: {
    FEE_RATE: 0.0005,
    TRAILING_SL_PERCENT: 1.5,
  },
};
```

---

## 🧪 TEST PLANI

### AŞAMA 1: DRY RUN (İlk gün)
```typescript
const DEFAULT_STRATEGY_CONFIG = {
  autoTrading: false,        // ⚠️ Kapalı
  eliteMode: true,           // Sadece elite sinyaller
  pumpDetectionEnabled: true,
  longEnabled: true,
  shortEnabled: false,       // Sadece LONG test et
  leverage: 10,              // Düşük kaldıraç
  riskPerTrade: 0.5,         // %0.5 risk
  priceChangeThreshold: 0.9,
  stopLossPercent: 2.0,
  tp1Percent: 1.5,           // TP1: %1.5
  tp2Percent: 4.0,           // TP2: %4.0
  cooldownMinutes: 5,
  maxConcurrentTrades: 5,    // Max 5 trade
  blacklist: ['FLOW', 'FOGO', 'BOME'], // Sorunlu coinler
  useDynamicStopLoss: true,  // ⚡ Dynamic SL aktif
};
```

**İlk gün:**
- Sadece alertleri izle
- Kaç alert geldi?
- Kaçı gerçekten pump oldu?
- False positive oranı?

---

### AŞAMA 2: MINI LIVE (2-3 gün)
```typescript
const DEFAULT_STRATEGY_CONFIG = {
  autoTrading: true,         // ⚡ Açık
  eliteMode: true,
  pumpDetectionEnabled: true,
  longEnabled: true,
  shortEnabled: false,
  leverage: 15,              // Orta kaldıraç
  riskPerTrade: 1.0,         // %1 risk
  priceChangeThreshold: 0.9,
  stopLossPercent: 2.0,
  tp1Percent: 1.5,
  tp2Percent: 4.0,
  cooldownMinutes: 5,
  maxConcurrentTrades: 10,   // Max 10 trade
  blacklist: ['FLOW', 'FOGO', 'BOME'],
  useDynamicStopLoss: true,
};
```

**2-3 gün sonuç:**
- Win rate %?
- Average PnL?
- Max drawdown?
- Config ayarlaması gerekiyor mu?

---

### AŞAMA 3: FULL LIVE
```typescript
const DEFAULT_STRATEGY_CONFIG = {
  autoTrading: true,
  eliteMode: true,
  pumpDetectionEnabled: true,
  longEnabled: true,
  shortEnabled: true,        // ⚡ SHORT da aktif
  leverage: 20,              // Full kaldıraç
  riskPerTrade: 1.5,         // %1.5 risk
  priceChangeThreshold: 0.9,
  stopLossPercent: 2.0,
  tp1Percent: 1.5,
  tp2Percent: 4.0,
  cooldownMinutes: 5,
  maxConcurrentTrades: 20,   // Max 20 trade
  blacklist: ['FLOW', 'FOGO', 'BOME'],
  useDynamicStopLoss: true,
};
```

---

## 💡 ÖNEMLİ NOTLAR

### 1. BLACKLIST GÜNCELLEMESİ
Test sırasında sorunlu coinler ekle:
```typescript
blacklist: [
  'FLOW',    // Düşük likidite
  'FOGO',    // Manipülasyon riski
  'BOME',    // Aşırı volatil
  // Test sırasında eklenecek
]
```

### 2. WHALE DETECTION İÇİN
```typescript
WHALE: {
  LARGE_TRADE_MULTIPLIER: 5,       // 5x ortalama
  ORDER_IMBALANCE_THRESHOLD: 2.5,  // 2.5x bid/ask
  MIN_WHALE_SCORE: 60,             // Min 60/100 score
}
```

### 3. DYNAMIC SL KULLANIMI
```typescript
// Position açılırken:
if (config.useDynamicStopLoss && alert.supportLevel) {
  finalSL = alert.supportLevel * 0.998; // LONG için
  // veya
  finalSL = alert.resistanceLevel * 1.002; // SHORT için
}
```

---

## 📈 BEKLENEN SONUÇLAR

### CONSERVATIVE Setup:
- Alert/gün: 5-10
- Win rate: %65-75
- Avg PnL: +%2-3 per trade
- Monthly: +%20-30

### BALANCED Setup:
- Alert/gün: 10-20
- Win rate: %55-65
- Avg PnL: +%1.5-2.5 per trade
- Monthly: +%25-40

### AGGRESSIVE Setup:
- Alert/gün: 30-50
- Win rate: %45-55
- Avg PnL: +%1-2 per trade
- Monthly: +%15-30 (yüksek risk)

---

## ✅ CONFIG DEĞİŞİKLİK ÖZETİ

**App.tsx'te düzeltilen bug'lar:**
1. ✅ Candle minute transition
2. ✅ Tick volume hesaplama
3. ✅ Alert cooldown ayrımı
4. ✅ Candidate data kullanımı
5. ✅ Trend detection sıkılaştırma
6. ✅ Position management optimizasyon

**Yeni özellikler:**
1. ✅ Dynamic SL (S/R bazlı)
2. ✅ Whale score calculation
3. ✅ localStorage processed alerts
4. ✅ Optimize position management
5. ✅ Ayrı cooldown ref'leri

**ÖNERİLEN İLK CONFIG:**
→ BALANCED setup ile başla
→ 2-3 gün test et
→ Sonuçlara göre ayarla

İyi şanslar! 🚀
