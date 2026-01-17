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
    PRICE_CHANGE_MIN: 1.0,      // Minimum fiyat değişimi % (önceki: 0.7, önerilen: 1.0-1.5)
    VOLUME_RATIO_MIN: 2.0,      // Minimum hacim artışı (önceki: 1.8, önerilen: 2.0-2.5)
    VOLUME_RATIO_5M_AVG: 1.8,   // 5 dakikalık ortalamaya göre hacim (önceki: 1.6)
    VOLUME_RATIO_10M_AVG: 2.2,  // 10 dakikalık ortalamaya göre hacim (önceki: 2.0)
    COOLDOWN_MS: 180000,        // Aynı coin için tekrar pump alert süresi (3 dakika = 180000ms)
  },
  
  // ==========================================
  // TREND START KRİTERLERİ
  // ==========================================
  TREND: {
    MIN_CANDLES: 10,            // Minimum mum sayısı (önceki: 10, önerilen: 15-20)
    CONSOLIDATION_MAX: 1.5,     // Konsolidasyon aralığı % (önceki: 2.0, önerilen: 1.0-1.5)
    BREAKOUT_MIN: 1.0,          // Minimum breakout % (önceki: 0.8, önerilen: 1.0-1.5)
    TREND_CONFIRM_CANDLES: 2,   // Trend teyit için mum sayısı
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
    INSTITUTIONAL_PRICE_CHANGE: 0.9, // % (önceki: 0.4)
    
    // BASIC MOMENTUM
    BASIC_PRICE_CHANGE: 1.0,        // % (önceki: 0.6)
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
  // WHALE TESPİT AYARLARI
  // ==========================================
  WHALE: {
    LARGE_TRADE_MULTIPLIER: 5,   // Ortalama trade'in kaç katı "büyük" sayılır
    ORDER_IMBALANCE_THRESHOLD: 2.0, // Bid/Ask imbalance eşiği
    MIN_WHALE_SCORE: 60
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
  longEnabled: true,
  shortEnabled: true,
  leverage: 20,
  riskPerTrade: 1.0,          // %
  priceChangeThreshold: 1.0,   // %
  stopLossPercent: 2.0,        // %
  tp1Percent: 1.0,             // %
  tp2Percent: 3.0,             // %
  cooldownMinutes: 5,
  maxConcurrentTrades: 20,
  blacklist: ['FLOW', 'FOGO', 'CELO'],
};

// ==========================================
// AÇIKLAMALAR
// ==========================================
/*
PUMP TESPİTİ:
- PRICE_CHANGE_MIN: Ne kadar yüksekse o kadar az pump alert gelir
- VOLUME_RATIO_MIN: Ne kadar yüksekse o kadar az pump alert gelir
- COOLDOWN_MS: Ne kadar yüksekse aynı coin için daha az tekrarlı alert

TREND TESPİTİ:
- MIN_CANDLES: Düşükse daha erken sinyal, yüksekse daha güvenilir
- CONSOLIDATION_MAX: Düşükse daha sıkı konsolidasyon gerekir
- BREAKOUT_MIN: Yüksekse daha güçlü breakout gerekir

MOMENTUM:
- Volume ratio yüksekse = daha az ama daha kaliteli sinyal
- Price change yüksekse = daha az ama daha belirgin hareketler

ÖNERİLEN BAŞLANGIÇ DEĞERLERİ:
- Çok sinyal istiyorsan: Düşük değerler
- Kaliteli sinyal istiyorsan: Yüksek değerler
- Test için: Orta değerler (şu anki ayarlar)
*/