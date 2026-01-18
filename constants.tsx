import { StrategyConfig } from './types';

// 🔧 UPDATED: Tüm yeni alanlar eklendi
export const DEFAULT_CONFIG: StrategyConfig = {
  autoTrading: true,
  eliteMode: true, 
  pumpDetectionEnabled: true,
  whaleDetectionEnabled: true,
  longEnabled: true,
  shortEnabled: false,
  leverage: 15,
  riskPerTrade: 1.0,
  priceChangeThreshold: 0.9,
  stopLossPercent: 2.0,
  tp1Percent: 1.5,
  tp2Percent: 4.0,
  tp3Enabled: true,          // 🔧 EKLE
  trailingPercent: 2.0,      // 🔧 EKLE
  tp1ClosePercent: 40,       // 🔧 EKLE
  tp2ClosePercent: 30,       // 🔧 EKLE
  cooldownMinutes: 5,
  maxConcurrentTrades: 10,
  blacklist: ['FLOW', 'FOGO', 'BOME', 'CELO'],  // 🔧 CELO eklendi
  whaleMinScore: 60,
  useDynamicStopLoss: false,  // 🔧 FALSE (ilk test)
  ringEnabled: true,
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