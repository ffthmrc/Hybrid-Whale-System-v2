import { ActiveTrack, Kline, RecentTrade, TradingAlert, Side } from '../types';
import { fetchAllData, createAggTradeStream, createBookTickerStream } from './api';

// ========================================
// AKTİF TAKİP SİSTEMİ
// ========================================

export function createActiveTrack(
  symbol: string,
  pumpData: { price: number; change: number; volumeRatio: number; side: Side }
): ActiveTrack {
  const now = Date.now();

  console.log(`[Track] 🎯 Creating active track for ${symbol}`);
  console.log(`[Track]   Pump: ${pumpData.change.toFixed(2)}%, Volume: ${pumpData.volumeRatio.toFixed(2)}x`);

  return {
    symbol,
    startTime: now,
    pumpData,
    baseline: { price: pumpData.price, volume: 0 },
    klines: { m1: [], m5: [], m15: [] },
    recentTrades: [],
    sr: {
      support: pumpData.price * 0.98,
      resistance: pumpData.price * 1.02,
      pivots: []
    },
    streams: {},
    score: { whale: 0, trend: 0, momentum: 0 },
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
    tradeData: { avgSize: 0, largeTradeCount: 0, buyPressure: 0, sellPressure: 0, recentLargeSize: 0 },
    orderBook: { bidQty: 0, askQty: 0, imbalance: 1.0, lastUpdate: 0 },
    alerts: { whaleGenerated: false, trendGenerated: false },
    stage: 'INITIALIZING',
    stageHistory: [{ stage: 'INITIALIZING', timestamp: now, data: { pumpData } }],
    lastUpdate: now
  };
}

/** Reconnect destekli stream oluşturucu */
function createReconnectingStream(
  symbol: string,
  streamName: string,
  onMessage: (event: MessageEvent) => void
) {
  const url = `wss://fstream.binance.com/ws/${symbol.toLowerCase()}@${streamName}`;
  let ws: WebSocket | null = null;
  let timer: NodeJS.Timeout | null = null;
  let attempts = 0;
  const maxAttempts = 5;

  const connect = () => {
    if (attempts >= maxAttempts) {
      console.error(`[Stream] Max reconnect attempts reached for ${symbol}@${streamName}`);
      return;
    }

    ws = new WebSocket(url);

    ws.onopen = () => {
      console.log(`[Stream] Connected: ${symbol}@${streamName}`);
      attempts = 0;
    };

    ws.onmessage = onMessage;

    ws.onclose = () => {
      console.log(`[Stream] Closed: ${symbol}@${streamName} → reconnecting...`);
      attempts++;
      timer = setTimeout(connect, 5000);
    };

    ws.onerror = (err) => console.error(`[Stream] Error ${symbol}@${streamName}:`, err);
  };

  connect();

  return {
    close: () => {
      ws?.close();
      if (timer) clearTimeout(timer);
      console.log(`[Stream] Manually closed: ${symbol}@${streamName}`);
    }
  };
}

/** Stream'leri başlat + cleanup fonksiyonu ekle */
function startStreams(track: ActiveTrack) {
  track.streams.aggTrade = createReconnectingStream(track.symbol, 'aggTrade', (e) => {
    const trade = JSON.parse(e.data);
    const size = parseFloat(trade.q) * parseFloat(trade.p);
    if (size > track.tradeData.avgSize * 5) {
      console.log(`[Stream] LARGE TRADE ${track.symbol}: $${size.toFixed(2)}`);
      track.tradeData.largeTradeCount++;
      track.tradeData.recentLargeSize = Math.max(track.tradeData.recentLargeSize, size);
      track.conditions.largeOrders = true;
    }
  });

  track.streams.bookTicker = createReconnectingStream(track.symbol, 'bookTicker', (e) => {
    const d = JSON.parse(e.data);
    const bid = parseFloat(d.B);
    const ask = parseFloat(d.A);
    const imb = bid / (ask || 1);

    track.orderBook = { bidQty: bid, askQty: ask, imbalance: imb, lastUpdate: Date.now() };

    if (imb >= 2.5 || imb <= 0.4) {
      console.log(`[Stream] IMBALANCE ${track.symbol}: ${imb.toFixed(2)}x`);
      track.conditions.imbalance = true;
    }
  });

  // Cleanup metodu ekle
  track.cleanup = () => {
    track.streams.aggTrade?.close();
    track.streams.bookTicker?.close();
    track.streams = {};
    console.log(`[Track] Streams cleaned for ${track.symbol}`);
  };
}

/** Track'i temizle ve expire et */
export function expireTrack(track: ActiveTrack) {
  track.cleanup?.();
  track.stage = 'EXPIRED';
  track.klines = { m1: [], m5: [], m15: [] };
  track.recentTrades = [];
  track.streams = {};
  track.cleanup = undefined;

  console.log(`[Track] ${track.symbol} → EXPIRED and cleaned`);
}

/** Trend analizi (basit ama çalışan versiyon) */
function analyzeTrend(track: ActiveTrack) {
  const klines = track.klines.m5;
  if (klines.length < 10) return;

  const closes = klines.map(k => k.close);
  const volumes = klines.map(k => k.volume);

  const isRising = closes[closes.length - 1] > closes[closes.length - 3];
  const volIncreasing = volumes[volumes.length - 1] > volumes[volumes.length - 3] * 1.4;

  track.conditions.trendAlignment = isRising && volIncreasing;
  track.score.trend = track.conditions.trendAlignment ? 80 : 30;

  console.log(`[Track] Trend: ${track.conditions.trendAlignment ? 'YES' : 'NO'} for ${track.symbol}`);
}

/** Whale aktivite analizi */
function analyzeWhale(track: ActiveTrack) {
  const large = track.tradeData.largeTradeCount;
  const pressure = track.tradeData.buyPressure;

  track.conditions.largeOrders = large >= 3;
  track.conditions.imbalance = track.orderBook.imbalance >= 2.0 || track.orderBook.imbalance <= 0.5;

  track.score.whale = Math.min(100, large * 15 + (pressure > 0.65 ? 30 : 0));

  console.log(`[Track] Whale: score=${track.score.whale}, large=${large}, pressure=${(pressure*100).toFixed(1)}%`);
}

/** Skorları topla */
function calculateScores(track: ActiveTrack) {
  const active = Object.values(track.conditions).filter(Boolean).length;
  const total = Object.keys(track.conditions).length;

  track.score.momentum = Math.round((active / total) * 100);
  console.log(`[Track] Final scores → whale:${track.score.whale} trend:${track.score.trend} momentum:${track.score.momentum}`);
}

/** Analiz çalıştır */
function performAnalysis(track: ActiveTrack) {
  analyzeTrend(track);
  analyzeWhale(track);
  calculateScores(track);
}

/** Diğer fonksiyonlar (değişmeden kalıyor) */
function updateStage(track: ActiveTrack, stage: ActiveTrack['stage'], data?: any) {
  track.stage = stage;
  track.stageHistory.push({ stage, timestamp: Date.now(), data });
  const elapsed = ((Date.now() - track.startTime) / 1000).toFixed(1);
  console.log(`[Track] ${track.symbol} → ${stage} (+${elapsed}s)`);
}

function analyzeRecentTrades(track: ActiveTrack) {
  // ... (senin orijinal kodun aynı kalıyor)
}

function calculateSupportResistance(track: ActiveTrack) {
  // ... (senin orijinal kodun aynı kalıyor)
}

export async function initializeTrack(track: ActiveTrack): Promise<boolean> {
  try {
    updateStage(track, 'FETCHING_DATA');
    const data = await fetchAllData(track.symbol);

    track.klines.m1 = data.klines1m;
    track.klines.m5 = data.klines5m;
    track.klines.m15 = data.klines15m;
    track.recentTrades = data.recentTrades;

    track.baseline.openInterest = data.openInterest ?? undefined;
    track.baseline.fundingRate = data.fundingRate ?? undefined;
    track.baseline.volume = data.klines1m.at(-1)?.quoteVolume ?? 0;

    analyzeRecentTrades(track);
    calculateSupportResistance(track);

    updateStage(track, 'STREAMING');
    startStreams(track);

    updateStage(track, 'ANALYZING');
    performAnalysis(track);

    updateStage(track, 'TRACKING');

    return true;
  } catch (err) {
    console.error(`[Track] Init failed ${track.symbol}:`, err);
    updateStage(track, 'EXPIRED', { error: err });
    expireTrack(track);
    return false;
  }
}