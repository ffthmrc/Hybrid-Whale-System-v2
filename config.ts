// ============================================
// TRADING SYSTEM CONFIGURATION
// Tüm ayarları buradan değiştirebilirsin
// ============================================

export const SYSTEM_CONFIG = {
  // ==========================================
  // ALERT LİMİTLERİ
  // ==========================================
  MAX_ALERTS: 1000,
  MAX_HISTORY: 500,
  
  // ==========================================
  // PUMP TESPİT KRİTERLERİ
  // ==========================================
  PUMP: {
    PRICE_CHANGE_MIN: 1.0,      // %1.0+ (daha sıkı)
    VOLUME_RATIO_MIN: 2.2,      // 2.2x (daha sıkı)
    COOLDOWN_MS: 300000,        // 5 dakika
  },
  
  // ==========================================
  // TREND START KRİTERLERİ
  // ==========================================
  TREND: {
    MIN_CANDLES: 15,
    CONSOLIDATION_MAX: 4.0,     // %4 max (daha geniş)
    BREAKOUT_MIN: 1.2,
    TREND_CONFIRM_CANDLES: 2,
  },
  
  // ==========================================
  // WHALE TESPİT AYARLARI
  // ==========================================
  WHALE: {
    MIN_SCORE_WHALE: 75,
    MIN_SCORE_INST: 70,
    MIN_SCORE_TREND: 50,
    LARGE_TRADE_MULTIPLIER: 5,
    ORDER_IMBALANCE_THRESHOLD: 2.0,
  },
  
  // ==========================================
  // MANİPÜLASYON TESPİTİ
  // ==========================================
  MANIPULATION: {
    MIN_24H_VOLUME: 1000000,
    MAX_VOLATILITY_RANGE: 30,
    MAX_PUMP_FREQUENCY: 5,
    ENABLE_AUTO_BLACKLIST: false,
  },
  
  // ==========================================
  // MOMENTUM/ELITE ALERT KRİTERLERİ
  // ==========================================
  MOMENTUM: {
    PARABOLIC_VOLUME_RATIO: 2.5,
    PARABOLIC_PRICE_CHANGE: 0.8,
    STAIRCASE_VOLUME_RATIO: 1.5,
    STAIRCASE_PRICE_TOLERANCE: 0.998,
    INSTITUTIONAL_VOLUME_RATIO: 1.8,
    INSTITUTIONAL_PRICE_CHANGE: 0.6,
    BASIC_PRICE_CHANGE: 0.8,
    BASIC_VOLUME_RATIO: 1.3,
  },
  
  // ==========================================
  // GENEL ALERT AYARLARI
  // ==========================================
  ALERTS: {
    PRICE_CHANGE_THRESHOLD: 1.0,
    COOLDOWN_MS: 15000,
    TREND_HIGHLIGHT_DURATION: 5000,
  },
  
  // ==========================================
  // API AYARLARI
  // ==========================================
  API: {
    KLINES_1M_LIMIT: 60,
    KLINES_5M_LIMIT: 24,
    KLINES_15M_LIMIT: 16,
    RECENT_TRADES_LIMIT: 200,
    AGG_TRADES_LIMIT: 500,
    ORDER_BOOK_DEPTH: 20,
    CACHE_DURATION_MS: 60000,       // 1 dakika cache
    RATE_LIMIT_PER_MINUTE: 50,
  },
  
  // ==========================================
  // FEE VE TRADE AYARLARI
  // ==========================================
  TRADING: {
    FEE_RATE: 0.0005,
    TRAILING_SL_PERCENT: 1.5,
  },
  
  // ==========================================
  // 🔧 YENİ: ANALYSIS QUEUE AYARLARI
  // ==========================================
  ANALYSIS: {
    QUEUE_DEBOUNCE_MS: 2000,        // 2 saniye bekle
    MIN_REANALYSIS_INTERVAL_MS: 60000,  // 60 saniye
    MAX_CONCURRENT_ANALYSIS: 3,     // Aynı anda max 3 analiz
  },
};

export const DEFAULT_STRATEGY_CONFIG = {
  autoTrading: true,
  eliteMode: true,
  pumpDetectionEnabled: true,
  whaleDetectionEnabled: true,
  longEnabled: true,
  shortEnabled: false,
  leverage: 15,
  riskPerTrade: 1.0,
  priceChangeThreshold: 1.0,
  stopLossPercent: 2.0,
  tp1Percent: 1.5,
  tp2Percent: 4.0,
  tp3Enabled: true,
  trailingPercent: 4.0,
  tp1ClosePercent: 40,
  tp2ClosePercent: 30,
  cooldownMinutes: 5,
  maxConcurrentTrades: 10,
  blacklist: ['FLOW', 'FOGO', 'BOME', 'CELO'],
  whaleMinScore: 75,
  useDynamicStopLoss: false,
  ringEnabled: true,
};