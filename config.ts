// ============================================
// TRADING SYSTEM CONFIGURATION
// Tüm ayarları buradan değiştirebilirsin
// ============================================

export const SYSTEM_CONFIG = {
  // ==========================================
  // ALERT LİMİTLERİ
  // ==========================================
  MAX_ALERTS: 1000,           // Maksimum alert sayısı (6 saat için yeterli)
  MAX_HISTORY: 500,           // Trade geçmişi limiti
  
  // ==========================================
  // PUMP TESPİT KRİTERLERİ
  // ==========================================
  PUMP: {
    PRICE_CHANGE_MIN: 1.2,      // Minimum fiyat değişimi % (önerilen: 1.2-1.5)
    VOLUME_RATIO_MIN: 2.5,      // Minimum hacim artışı (önerilen: 2.5-3.0)
    VOLUME_RATIO_5M_AVG: 2.2,   // 5 dakikalık ortalamaya göre hacim
    VOLUME_RATIO_10M_AVG: 2.5,  // 10 dakikalık ortalamaya göre hacim
    COOLDOWN_MS: 300000,        // Aynı coin için tekrar pump alert süresi (5 dakika)
  },
  
  // ==========================================
  // TREND START KRİTERLERİ
  // ==========================================
  TREND: {
    MIN_CANDLES: 15,            // Minimum mum sayısı (daha güvenilir)
    CONSOLIDATION_MAX: 1.2,     // Konsolidasyon aralığı % (daha sıkı)
    BREAKOUT_MIN: 1.2,          // Minimum breakout % (daha güçlü)
    TREND_CONFIRM_CANDLES: 2,   // Trend teyit için mum sayısı
  },
  
  // ==========================================
  // WHALE TESPİT AYARLARI (DÜZELTİLDİ!)
  // ==========================================
  WHALE: {
    // 🔧 YENİ: Threshold'lar ayrıldı ve artırıldı
    MIN_SCORE_WHALE: 75,             // WHALE_ACCUMULATION için min (artırıldı)
    MIN_SCORE_INST: 65,              // INSTITUTION_ENTRY için min (artırıldı)
    MIN_SCORE_TREND: 50,             // TREND_START için min (whale ile)
    LARGE_TRADE_MULTIPLIER: 5,       // Ortalama trade'in kaç katı "büyük" sayılır
    ORDER_IMBALANCE_THRESHOLD: 2.0,  // Bid/Ask imbalance eşiği
  },
  
  // ==========================================
  // MANİPÜLASYON TESPİTİ (YENİ!)
  // ==========================================
  MANIPULATION: {
    MIN_24H_VOLUME: 1000000,         // 🔧 $1M (önceki: $5M) - Daha düşük volume OK
    MAX_VOLATILITY_RANGE: 50,        // %50 max - Çok yüksek volatility bile OK
    MAX_PUMP_FREQUENCY: 10,          // 10/saat - Daha toleranslı
    ENABLE_AUTO_BLACKLIST: false,    // KAPALI - Manuel kontrol
  },
  
  // ==========================================
  // MOMENTUM/ELITE ALERT KRİTERLERİ
  // ==========================================
  MOMENTUM: {
    // PARABOLIC
    PARABOLIC_VOLUME_RATIO: 2.5,    // (önceki: 2.0)
    PARABOLIC_PRICE_CHANGE: 0.8,    // % (önceki: 0.5)
    
    // STAIRCASE
    STAIRCASE_VOLUME_RATIO: 1.5,    // (önceki: 1.2)
    STAIRCASE_PRICE_TOLERANCE: 0.998, // Yükseliş toleransı
    
    // INSTITUTIONAL
    INSTITUTIONAL_VOLUME_RATIO: 1.8, // (önceki: 1.4)
    INSTITUTIONAL_PRICE_CHANGE: 0.6, // % (önceki: 0.4)
    
    // BASIC MOMENTUM
    BASIC_PRICE_CHANGE: 0.8,        // % (önceki: 0.6)
    BASIC_VOLUME_RATIO: 1.3,        // (önceki: 1.1)
  },
  
  // ==========================================
  // GENEL ALERT AYARLARI
  // ==========================================
  ALERTS: {
    PRICE_CHANGE_THRESHOLD: 1.0,  // Genel minimum fiyat değişimi % (UI'dan da değiştirilebilir)
    COOLDOWN_MS: 15000,           // Aynı coin için alert arası süre (15 saniye)
    TREND_HIGHLIGHT_DURATION: 5000, // Trend highlight süresi (5 saniye)
  },
  
  // ==========================================
  // API AYARLARI
  // ==========================================
  API: {
    KLINES_1M_LIMIT: 60,        // 1m mum sayısı
    KLINES_5M_LIMIT: 24,        // 5m mum sayısı
    KLINES_15M_LIMIT: 16,       // 15m mum sayısı
    RECENT_TRADES_LIMIT: 200,   // Son trade sayısı
    AGG_TRADES_LIMIT: 500,      // Aggregate trade sayısı
    ORDER_BOOK_DEPTH: 20,       // Order book derinliği
    CACHE_DURATION_MS: 60000,   // Veri cache süresi (1 dakika)
    RATE_LIMIT_PER_MINUTE: 50,  // Dakikada maksimum API çağrısı
  },
  
  // ==========================================
  // FEE VE TRADE AYARLARI
  // ==========================================
  TRADING: {
    FEE_RATE: 0.0005,           // İşlem ücreti (%0.05)
    TRAILING_SL_PERCENT: 1.5,   // Trailing stop loss %
  },
};

// ==========================================
// DEFAULT STRATEGY CONFIG (UI'dan değiştirilebilir)
// ==========================================
export const DEFAULT_STRATEGY_CONFIG = {
  autoTrading: true,
  eliteMode: true,
  pumpDetectionEnabled: true,
  whaleDetectionEnabled: true,
  longEnabled: true,
  shortEnabled: false,         // İlk test sadece LONG
  leverage: 15,
  riskPerTrade: 1.0,
  priceChangeThreshold: 1.0,
  stopLossPercent: 2.0,
  tp1Percent: 1.5,
  tp2Percent: 4.0,
  cooldownMinutes: 5,
  maxConcurrentTrades: 10,
  blacklist: ['FLOW', 'FOGO', 'BOME', 'CELO'],  // 🔧 CELO eklendi
  whaleMinScore: 75,           // 🔧 60'tan 75'e çıkarıldı
  useDynamicStopLoss: true,
  ringEnabled: true,
};

// ==========================================
// AÇIKLAMALAR
// ==========================================
/*
🔧 YENİ DEĞİŞİKLİKLER:

1. WHALE THRESHOLD'LARI AYRILDI:
   - MIN_SCORE_WHALE: 75 (sadece en güçlü sinyaller)
   - MIN_SCORE_INST: 65 (orta güçlü)
   - MIN_SCORE_TREND: 50 (trend + whale)

2. MANİPÜLASYON TESPİTİ EKLENDİ:
   - Düşük volume coinleri engelle
   - Aşırı volatilite kontrolü
   - Pump frequency limiti
   - Otomatik blacklist

3. PUMP KRİTERLERİ SIKLAŞTIRILDI:
   - PRICE_CHANGE_MIN: 1.0 → 1.2
   - VOLUME_RATIO_MIN: 2.0 → 2.5
   - COOLDOWN: 3 dakika → 5 dakika

4. TREND KRİTERLERİ SIKLAŞTIRILDI:
   - MIN_CANDLES: 10 → 15
   - CONSOLIDATION_MAX: 1.5 → 1.2
   - BREAKOUT_MIN: 1.0 → 1.2

5. BLACKLIST:
   - CELO eklendi (manipülasyon riski)
   - UI'dan eklenebilir/çıkarılabilir

BEKLENEN SONUÇLAR:
- Daha az ama daha kaliteli sinyaller
- False positive oranı düşecek
- WHALE alert'leri daha güvenilir
- Manipüle coinler engellenecek
*/