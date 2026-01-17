import { StrategyConfig } from './types';

// 🔧 UPDATED: Tüm yeni alanlar eklendi
export const DEFAULT_CONFIG: StrategyConfig = {
  autoTrading: true,          // ⚠️ İlk test için kapalı
  eliteMode: true, 
  pumpDetectionEnabled: true,
  whaleDetectionEnabled: true,  // YENİ: Whale detection aktif
  longEnabled: true,
  shortEnabled: false,          // ⚠️ İlk test için sadece LONG
  leverage: 15,                 // ⚠️ İlk test için düşük kaldıraç
  riskPerTrade: 1.0,        
  priceChangeThreshold: 0.9,    // 🔧 Config'den gelecek (ALERTS.PRICE_CHANGE_THRESHOLD)
  stopLossPercent: 2.0,     
  tp1Percent: 1.5,              // 🔧 Biraz artırıldı
  tp2Percent: 4.0,              // 🔧 Biraz artırıldı
  cooldownMinutes: 5,
  maxConcurrentTrades: 10,      // ⚠️ İlk test için düşük
  blacklist: ['FLOW', 'FOGO', 'BOME'], // 🔧 BOME eklendi
  whaleMinScore: 60,            // 🔧 55'ten 60'a çıkarıldı
  useDynamicStopLoss: true,     // YENİ: Dinamik SL kullan
  ringEnabled: true,            // YENİ: Whale alert ses bildirimi
};

export const COLORS = {
  bg: '#0b0e11',
  bgSecondary: '#1e2329',
  border: '#2b3139',
  text: '#eaecef',
  textSecondary: '#848e9c',
  up: '#00c076',
  down: '#f84960',
  accent: '#fcd535',
  elite: '#a855f7', 
};