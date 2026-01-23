import { ActiveTrack, Kline, RecentTrade, TradingAlert, Side } from '../types';
import { fetchAllData, createAggTradeStream, createBookTickerStream } from './api';

// ========================================
// AKTÄ°F TAKİP SİSTEMİ
// ========================================

/**
 * Yeni aktif takip oluÅŸtur (PUMP sonrasÄ±)
 */
export function createActiveTrack(
  symbol: string,
  pumpData: { price: number; change: number; volumeRatio: number; side: Side }
): ActiveTrack {
  const now = Date.now();
  
  console.log(`[Track] 🎯 Creating active track for ${symbol}`);
  console.log(`[Track]   Pump: ${pumpData.change.toFixed(2)}%, Volume: ${pumpData.volumeRatio.toFixed(2)}x`);
  
  const track: ActiveTrack = {
    symbol,
    startTime: now,
    pumpData,
    baseline: {
      price: pumpData.price,
      volume: 0, // API'den gelecek
    },
    klines: {
      m1: [],
      m5: [],
      m15: []
    },
    recentTrades: [],
    sr: {
      support: pumpData.price * 0.98,
      resistance: pumpData.price * 1.02,
      pivots: []
    },
    streams: {},
    score: {
      whale: 0,
      trend: 0,
      momentum: 0
    },
    conditions: {
      consolidation: false,
      breakout: false,
      volumeConfirm: false,
      trendAlignment: false,
      largeOrders: false,
      imbalance: false,
      supportResistance: false,
      volatilitySpike: false
    },
    tradeData: {
      avgSize: 0,
      largeTradeCount: 0,
      buyPressure: 0,
      sellPressure: 0,
      recentLargeSize: 0
    },
    orderBook: {
      bidQty: 0,
      askQty: 0,
      imbalance: 1.0,
      lastUpdate: 0
    },
    alerts: {
      whaleGenerated: false,
      trendGenerated: false
    },
    stage: 'INITIALIZING',
    stageHistory: [
      { stage: 'INITIALIZING', timestamp: now, data: { pumpData } }
    ],
    lastUpdate: now
  };
  
  return track;
}

/**
 * API'den veri çek ve track'i başlat
 */
export async function initializeTrack(track: ActiveTrack): Promise<boolean> {
  try {
    // Stage update
    updateStage(track, 'FETCHING_DATA', { message: 'Fetching klines, trades, OI, funding...' });
    
    // API'den tüm veriyi paralel çek
    const data = await fetchAllData(track.symbol);
    
    // Kline verilerini ekle
    track.klines.m1 = data.klines1m;
    track.klines.m5 = data.klines5m;
    track.klines.m15 = data.klines15m;
    
    // Recent trades
    track.recentTrades = data.recentTrades;
    
    // Baseline güncelle
    track.baseline.openInterest = data.openInterest || undefined;
    track.baseline.fundingRate = data.fundingRate || undefined;
    track.baseline.volume = data.klines1m[data.klines1m.length - 1]?.quoteVolume || 0;
    
    // Trade analizi
    analyzeRecentTrades(track);
    
    // Support/Resistance hesapla
    calculateSupportResistance(track);
    
    console.log(`[Track] ✅ ${track.symbol} initialized successfully`);
    console.log(`[Track]   Klines: ${data.klines1m.length}/${data.klines5m.length}/${data.klines15m.length}`);
    console.log(`[Track]   Trades: ${data.recentTrades.length}`);
    console.log(`[Track]   OI: ${data.openInterest?.toFixed(2) || 'N/A'}`);
    console.log(`[Track]   SR: ${track.sr.support.toFixed(2)} / ${track.sr.resistance.toFixed(2)}`);
    
    // Stream'leri başlat
    updateStage(track, 'STREAMING', { message: 'Starting WebSocket streams...' });
    startStreams(track);
    
    // İlk analiz
    updateStage(track, 'ANALYZING', { message: 'Performing initial analysis...' });
    performAnalysis(track);
    
    // Tracking'e başla
    updateStage(track, 'TRACKING', { message: 'Active tracking started' });
    
    return true;
  } catch (error) {
    console.error(`[Track] ❌ Failed to initialize ${track.symbol}:`, error);
    updateStage(track, 'EXPIRED', { message: 'Initialization failed', error });
    return false;
  }
}

/**
 * Stage güncelleme (console logging için)
 */
function updateStage(track: ActiveTrack, stage: ActiveTrack['stage'], data?: any) {
  track.stage = stage;
  track.stageHistory.push({
    stage,
    timestamp: Date.now(),
    data
  });
  
  const elapsed = ((Date.now() - track.startTime) / 1000).toFixed(1);
  console.log(`[Track] 📍 ${track.symbol} stage: ${stage} (+${elapsed}s)`, data || '');
}

/**
 * Recent trades analizi
 */
function analyzeRecentTrades(track: ActiveTrack) {
  const trades = track.recentTrades;
  if (trades.length === 0) return;
  
  // Ortalama trade size
  const totalSize = trades.reduce((sum, t) => sum + t.quoteQty, 0);
  track.tradeData.avgSize = totalSize / trades.length;
  
  // Buy/Sell pressure
  let buyVolume = 0;
  let sellVolume = 0;
  
  trades.forEach(t => {
    if (t.isBuyerMaker) {
      sellVolume += t.quoteQty; // Maker sells
    } else {
      buyVolume += t.quoteQty; // Taker buys
    }
  });
  
  track.tradeData.buyPressure = buyVolume / (buyVolume + sellVolume);
  track.tradeData.sellPressure = sellVolume / (buyVolume + sellVolume);
  
  // Large trades (5x ortalama)
  const largeThreshold = track.tradeData.avgSize * 5;
  const largeTrades = trades.filter(t => t.quoteQty > largeThreshold);
  track.tradeData.largeTradeCount = largeTrades.length;
  track.tradeData.recentLargeSize = largeTrades.length > 0 
    ? Math.max(...largeTrades.map(t => t.quoteQty))
    : 0;
  
  console.log(`[Track] 💰 ${track.symbol} trade analysis:`);
  console.log(`  Avg size: $${track.tradeData.avgSize.toFixed(2)}`);
  console.log(`  Buy pressure: ${(track.tradeData.buyPressure * 100).toFixed(1)}%`);
  console.log(`  Large trades: ${track.tradeData.largeTradeCount}`);
  if (track.tradeData.recentLargeSize > 0) {
    console.log(`  Largest: $${track.tradeData.recentLargeSize.toFixed(2)} (${(track.tradeData.recentLargeSize / track.tradeData.avgSize).toFixed(1)}x avg)`);
  }
}

/**
 * Support/Resistance hesapla (pivot points)
 */
function calculateSupportResistance(track: ActiveTrack) {
  const klines = track.klines.m5;
  if (klines.length < 10) return;
  
  const closes = klines.map(k => k.close);
  const currentPrice = track.pumpData.price;
  
  // Pivotları bul (lokal min/max)
  const pivots: Array<{ price: number; type: 'support' | 'resistance'; strength: number }> = [];
  
  for (let i = 2; i < klines.length - 2; i++) {
    const current = klines[i].close;
    const prev2 = klines[i - 2].close;
    const prev1 = klines[i - 1].close;
    const next1 = klines[i + 1].close;
    const next2 = klines[i + 2].close;
    
    // Local low (support)
    if (current < prev2 && current < prev1 && current < next1 && current < next2) {
      const strength = Math.min(prev1 - current, prev2 - current, next1 - current, next2 - current);
      if (current < currentPrice) {
        pivots.push({ price: current, type: 'support', strength });
      }
    }
    
    // Local high (resistance)
    if (current > prev2 && current > prev1 && current > next1 && current > next2) {
      const strength = Math.min(current - prev1, current - prev2, current - next1, current - next2);
      if (current > currentPrice) {
        pivots.push({ price: current, type: 'resistance', strength });
      }
    }
  }
  
  // En yakın support/resistance
  const supports = pivots.filter(p => p.type === 'support').sort((a, b) => b.price - a.price);
  const resistances = pivots.filter(p => p.type === 'resistance').sort((a, b) => a.price - b.price);
  
  track.sr.support = supports.length > 0 ? supports[0].price : Math.min(...closes);
  track.sr.resistance = resistances.length > 0 ? resistances[0].price : Math.max(...closes);
  track.sr.pivots = pivots;
  
  console.log(`[Track] 🎯 ${track.symbol} S/R calculated:`);
  console.log(`  Support: $${track.sr.support.toFixed(6)} (${supports.length} pivots)`);
  console.log(`  Resistance: $${track.sr.resistance.toFixed(6)} (${resistances.length} pivots)`);
}

/**
 * WebSocket stream'lerini başlat
 */
function startStreams(track: ActiveTrack) {
  // AggTrade stream
  const aggTradeWS = createAggTradeStream(track.symbol);
  aggTradeWS.onmessage = (event) => {
    const trade = JSON.parse(event.data);
    const tradeSize = parseFloat(trade.q) * parseFloat(trade.p);
    
    // Large trade kontrolü
    if (tradeSize > track.tradeData.avgSize * 5) {
      console.log(`[Stream] 💰 ${track.symbol} LARGE TRADE: $${tradeSize.toFixed(2)} (${(tradeSize / track.tradeData.avgSize).toFixed(1)}x avg)`);
      track.tradeData.largeTradeCount++;
      track.tradeData.recentLargeSize = Math.max(track.tradeData.recentLargeSize, tradeSize);
      track.conditions.largeOrders = true;
    }
  };
  track.streams.aggTrade = aggTradeWS;
  
  // BookTicker stream
  const bookTickerWS = createBookTickerStream(track.symbol);
  bookTickerWS.onmessage = (event) => {
    const data = JSON.parse(event.data);
    const bidQty = parseFloat(data.B);
    const askQty = parseFloat(data.A);
    const imbalance = bidQty / askQty;
    
    track.orderBook = {
      bidQty,
      askQty,
      imbalance,
      lastUpdate: Date.now()
    };
    
    // Imbalance kontrolü (2.5x+)
    if (imbalance >= 2.5 || imbalance <= 0.4) {
      console.log(`[Stream] ⚖️ ${track.symbol} IMBALANCE: ${imbalance.toFixed(2)}x (Bid: $${bidQty.toFixed(0)}, Ask: $${askQty.toFixed(0)})`);
      track.conditions.imbalance = true;
    }
  };
  track.streams.bookTicker = bookTickerWS;
}

/**
 * Analiz yap (koşulları kontrol et)
 */
function performAnalysis(track: ActiveTrack) {
  // 1. Trend analizi
  analyzeTrend(track);
  
  // 2. Whale analizi
  analyzeWhale(track);
  
  // 3. Skorları hesapla
  calculateScores(track);
  
  // Log
  console.log(`[Track] 📊 ${track.symbol} analysis complete:`);
  console.log(`  Whale score: ${track.score.whale.toFixed(0)}/100`);
  console.log(`  Trend score: ${track.score.trend.toFixed(0)}/100`);
  console.log(`  Conditions:`, Object.entries(track.conditions).filter(([k, v]) => v).map(([k]) => k).join(', ') || 'none');
}

// ... (tracking.ts devam ediyor - çok uzun olduğu için ZIP'te tam hali)
