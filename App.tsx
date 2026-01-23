import React, { useState, useEffect, useCallback, useRef } from 'react';
import { SymbolData, Position, TradingAlert, StrategyConfig, AccountState, Side, TradeHistoryItem } from './types';
import { DEFAULT_CONFIG } from './constants';
import MarketOverview from './components/MarketOverview';
import TradingChart from './components/TradingChart';
import TradingControls from './components/TradingControls';
import AlertsPanel from './components/AlertsPanel';
import PositionsPanel from './components/PositionsPanel';
import { fetchAllData, fetch24hStats } from './utils/api';
import { SYSTEM_CONFIG } from './config';

const FEE_RATE = SYSTEM_CONFIG.TRADING.FEE_RATE;
const MAX_HISTORY = SYSTEM_CONFIG.MAX_HISTORY;
const MAX_ALERTS = SYSTEM_CONFIG.MAX_ALERTS;

interface PumpTracker {
  minuteVolumes: number[];
  lastPumpAlert: number;
  minuteStartVolume: number;
  currentMinute: number;
  pumpCount: number;
  lastPumpHour: number;
}

interface MinuteTick {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  quoteVolume: number;
  minute: number;
}

interface CandidateData {
  symbol: string;
  fetchedAt: number;
  klines1m: any[];
  klines5m: any[];
  klines15m: any[];
  recentTrades: any[];
  aggTrades: any[];
  orderBook: any;
  openInterest: number | null;
  fundingRate: number | null;
  support: number;
  resistance: number;
  avgTradeSize: number;
  buyPressure: number;
  largeOrderCount: number;
  orderBookImbalance: number;
}

type MobileTab = 'market' | 'alerts' | 'chart' | 'positions' | 'controls';

const App: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<string>('BTCUSDT');
  const [marketData, setMarketData] = useState<Record<string, SymbolData>>({});
  const [tempTrends, setTempTrends] = useState<Record<string, 'up' | 'down' | null>>({});
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeHistory, setTradeHistory] = useState<TradeHistoryItem[]>([]);
  const [alerts, setAlerts] = useState<TradingAlert[]>([]);
  const [config, setConfig] = useState<StrategyConfig>(DEFAULT_CONFIG);
  const [account, setAccount] = useState<AccountState>({
    balance: 10000,
    equity: 10000,
    dailyLoss: 0,
    lastTradeTimestamp: 0,
    initialBalance: 10000
  });

  const [mobileTab, setMobileTab] = useState<MobileTab>('chart');
  const [leftWidth, setLeftWidth] = useState(260);
  const [rightWidth1, setRightWidth1] = useState(300);
  const [rightWidth2, setRightWidth2] = useState(320);
  const [bottomHeight, setBottomHeight] = useState(320);
  const isResizing = useRef<string | null>(null);

  const processedAlertIds = useRef<Set<string>>(new Set());
  const minuteTicksRef = useRef<Record<string, MinuteTick>>({});
  const candleHistoryRef = useRef<Record<string, MinuteTick[]>>({});
  const lastMomentumAlertRef = useRef<Record<string, number>>({});
  const lastPumpAlertRef = useRef<Record<string, number>>({});
  const lastTrendAlertRef = useRef<Record<string, number>>({});
  const rollingHistoryRef = useRef<Record<string, { prices: number[], volumes: number[] }>>({});
  const trendTimeoutsRef = useRef<Record<string, any>>({});
  const pumpTrackerRef = useRef<Record<string, PumpTracker>>({});
  
  const analysisQueueRef = useRef<Set<string>>(new Set());
  const lastAnalysisRef = useRef<Record<string, number>>({});
  const candidateDataRef = useRef<Record<string, CandidateData>>({});
  const fetchingSymbolsRef = useRef<Set<string>>(new Set());

  // ══════════════════════════════════════════════════════════════
  // 🆕 YARDIMCI GÖSTERGE: EMA (9/21 için optimize edilmiş)
  // ══════════════════════════════════════════════════════════════

  const calculateEMA = useCallback((closes: number[], period: number): number | null => {
    if (!closes || closes.length < period) return null;
    
    // İlk EMA = SMA (Simple Moving Average)
    let ema = closes.slice(0, period).reduce((a, b) => a + b, 0) / period;
    
    const multiplier = 2 / (period + 1);
    
    // Kalan değerleri işle
    for (let i = period; i < closes.length; i++) {
      ema = (closes[i] - ema) * multiplier + ema;
    }
    
    return ema;
  }, []);

  // ══════════════════════════════════════════════════════════════
  // YARDIMCI GÖSTERGEler: RSI & MACD
  // ══════════════════════════════════════════════════════════════

  const calculateRSI = (closes: number[], period: number = 14): number => {
    if (closes.length < period + 1) return 50;
    let gains = 0, losses = 0;
    for (let i = 1; i <= period; i++) {
      const change = closes[i] - closes[i - 1];
      if (change > 0) gains += change;
      else losses -= change;
    }
    const avgGain = gains / period;
    const avgLoss = losses / period || 0.0001;
    const rs = avgGain / avgLoss;
    return 100 - (100 / (1 + rs));
  };

  const calculateMACD = (closes: number[]) => {
    if (closes.length < 50) return { macd: 0, signal: 0, histogram: 0 };

    const ema = (data: number[], period: number) => {
      if (data.length < period) return data[data.length - 1] || 0;
      let emaVal = data.slice(0, period).reduce((a, b) => a + b, 0) / period;
      const k = 2 / (period + 1);
      for (let i = period; i < data.length; i++) {
        emaVal = data[i] * k + emaVal * (1 - k);
      }
      return emaVal;
    };

    const macdSeries: number[] = [];
    for (let i = 26; i < closes.length; i++) {
      const short = ema(closes.slice(i - 11, i + 1), 12);
      const long = ema(closes.slice(i - 25, i + 1), 26);
      macdSeries.push(short - long);
    }

    const macdLine = macdSeries[macdSeries.length - 1] || 0;
    const signalLine = ema(macdSeries.slice(-9), 9) || 0;

    return {
      macd: macdLine,
      signal: signalLine,
      histogram: macdLine - signalLine
    };
  };

  // ══════════════════════════════════════════════════════════════
  // TREND CHECK (kendi candle history kullanıyor)
  // ══════════════════════════════════════════════════════════════

  const checkTrendStartWithData = useCallback((
    symbol: string,
    candleChangePct: number
  ): { isTrendStart: boolean; details: any } => {
    const MIN_CANDLES = SYSTEM_CONFIG.TREND.MIN_CANDLES || 15;
    const CONSOLIDATION_MAX = 4.0;
    const BREAKOUT_MIN = SYSTEM_CONFIG.TREND.BREAKOUT_MIN || 1.2;
    const TREND_CONFIRM_CANDLES = SYSTEM_CONFIG.TREND.TREND_CONFIRM_CANDLES || 2;

    const result = {
      isTrendStart: false,
      details: {
        consolidationRange: 'N/A',
        breakoutPercent: 'N/A',
        volumeRatio: 'N/A',
        trendConfirmed: false,
        context: 'INSUFFICIENT_DATA',
        conditionsMet: 0,
        rsi: 'N/A',
        macdHistogram: 'N/A',
        volatilityPct: 'N/A'
      }
    };

    const candles = candleHistoryRef.current[symbol] || [];
    if (candles.length < MIN_CANDLES + 3) {
      console.log(`[TREND] ${symbol} insufficient candles (${candles.length}/${MIN_CANDLES})`);
      return result;
    }

    const closes = candles.map(k => k.close);
    const volumes = candles.map(k => k.volume);

    const recentCloses = closes.slice(-MIN_CANDLES);
    const recentVolumes = volumes.slice(-MIN_CANDLES);

    const minClose = Math.min(...recentCloses);
    const maxClose = Math.max(...recentCloses);
    const consRangePct = ((maxClose - minClose) / minClose) * 100;
    const isConsolidating = consRangePct <= CONSOLIDATION_MAX;

    const ranges = recentCloses.map((c, i) =>
      i > 0 ? Math.abs(c - recentCloses[i-1]) / recentCloses[i-1] * 100 : 0
    ).slice(1);
    const avgVolPct = ranges.length ? ranges.reduce((a, b) => a + b, 0) / ranges.length : 0;
    const lowVol = avgVolPct < 2.0;

    const rsi = calculateRSI(recentCloses);
    const macd = calculateMACD(recentCloses);
    const momentumOk = rsi >= 45 && macd.histogram > -0.0005;

    const breakoutPct = candleChangePct;
    const isBreakout = breakoutPct >= BREAKOUT_MIN;

    const avgVol = recentVolumes.slice(0, -3).reduce((a, b) => a + b, 0) /
                   Math.max(1, recentVolumes.length - 3);
    const curVol = recentVolumes[recentVolumes.length - 1];
    const volRatio = avgVol > 0 ? curVol / avgVol : 0;
    const volConfirmed = volRatio >= 1.6;

    const recentCandles = candles.slice(-TREND_CONFIRM_CANDLES);
    const greenCount = recentCandles.filter(c => c.close > c.open).length;
    const trendConfirmed = greenCount >= TREND_CONFIRM_CANDLES - 1;

    let met = 0;
    if (isConsolidating) met++;
    if (lowVol) met++;
    if (momentumOk) met++;
    if (isBreakout) met++;
    if (volConfirmed) met++;
    if (trendConfirmed) met++;

    const isTrend = met >= 4;

    result.isTrendStart = isTrend;
    result.details = {
      consolidationRange: consRangePct.toFixed(2) + '%',
      breakoutPercent: breakoutPct.toFixed(2) + '%',
      volumeRatio: volRatio.toFixed(2) + 'x',
      trendConfirmed,
      context: isTrend ? 'STRONG_TREND_START' : met >= 3 ? 'POTENTIAL_TREND' : 'NO_TREND',
      conditionsMet: met,
      rsi: rsi.toFixed(1),
      macdHistogram: macd.histogram.toFixed(5),
      volatilityPct: avgVolPct.toFixed(2) + '%'
    };

    return result;
  }, [calculateRSI, calculateMACD]);

  // ══════════════════════════════════════════════════════════════
  // İlk yükleme: processed alerts
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    try {
      const stored = localStorage.getItem('processedAlerts');
      if (stored) {
        const ids = JSON.parse(stored);
        processedAlertIds.current = new Set(ids.slice(-1000));
      }
    } catch (e) {
      console.warn('[Storage] Failed to load processed alerts:', e);
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // Yardımcı fonksiyonlar
  // ══════════════════════════════════════════════════════════════

  const isBlacklisted = useCallback((symbol: string) => {
    if (!symbol) return false;
    const clean = symbol.toUpperCase().replace('USDT', '').trim();
    return config.blacklist.some(b => b.toUpperCase().replace('USDT', '').trim() === clean);
  }, [config.blacklist]);

  const calculateWhaleScore = useCallback((data: CandidateData): number => {
    let score = 0;
    score += Math.min(data.largeOrderCount * 5, 30);
    const pressureDev = Math.abs(data.buyPressure - 0.5);
    score += Math.min(pressureDev * 60, 30);
    const rangePct = ((data.resistance - data.support) / data.support) * 100;
    score += rangePct < 2 ? 20 : rangePct < 3 ? 10 : 5;
    if (data.openInterest && data.openInterest > 1000000) score += 10;
    if (data.fundingRate && Math.abs(data.fundingRate) > 0.0001) score += 10;
    
    if (data.orderBookImbalance >= 2.5 || data.orderBookImbalance <= 0.4) {
      score += 15;
    }
    
    return Math.min(100, Math.round(score));
  }, []);

  const checkManipulationRisk = useCallback(async (symbol: string) => {
    try {
      const stats = await fetch24hStats(symbol);
      if (!stats) return { isRisky: false };

      if (stats.quoteVolume < SYSTEM_CONFIG.MANIPULATION.MIN_24H_VOLUME) {
        return {
          isRisky: true,
          reason: `Low 24h volume ($${(stats.quoteVolume / 1e6).toFixed(2)}M)`,
          shouldBlacklist: true
        };
      }

      const range = ((stats.high - stats.low) / stats.low) * 100;
      if (range > SYSTEM_CONFIG.MANIPULATION.MAX_VOLATILITY_RANGE) {
        return {
          isRisky: true,
          reason: `Extreme volatility (${range.toFixed(1)}%)`,
          shouldBlacklist: true
        };
      }

      const tracker = pumpTrackerRef.current[symbol];
      if (tracker && tracker.pumpCount >= SYSTEM_CONFIG.MANIPULATION.MAX_PUMP_FREQUENCY) {
        return {
          isRisky: true,
          reason: `Excessive pump frequency (${tracker.pumpCount}/hour)`
        };
      }

      return { isRisky: false };
    } catch (err) {
      console.error('[Manipulation check failed]', err);
      return { isRisky: false };
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // fetchCandidateData (aggTrades + orderBook kullanıyor)
  // ══════════════════════════════════════════════════════════════

  const fetchCandidateData = useCallback(async (symbol: string): Promise<CandidateData | null> => {
    if (fetchingSymbolsRef.current.has(symbol)) return null;
    
    const cached = candidateDataRef.current[symbol];
    if (cached && Date.now() - cached.fetchedAt < SYSTEM_CONFIG.API.CACHE_DURATION_MS) {
      return cached;
    }

    fetchingSymbolsRef.current.add(symbol);
    try {
      const data = await fetchAllData(symbol);
      if (!data.isValid || data.klines5m.length < 10) return null;

      const closes = data.klines5m.map((k: any) => k.close);
      const support = Math.min(...closes.slice(-10));
      const resistance = Math.max(...closes.slice(-10));

      const aggTrades = data.aggTrades || [];
      const totalTradeSize = aggTrades.reduce((sum: number, t: any) => sum + t.quoteQty, 0);
      const avgTradeSize = totalTradeSize / (aggTrades.length || 1);

      let buyVol = 0, sellVol = 0;
      aggTrades.forEach((t: any) => {
        if (t.isBuyerMaker) sellVol += t.quoteQty;
        else buyVol += t.quoteQty;
      });
      const buyPressure = buyVol / (buyVol + sellVol || 1);

      const largeOrderCount = aggTrades.filter(
        (t: any) => t.quoteQty > avgTradeSize * SYSTEM_CONFIG.WHALE.LARGE_TRADE_MULTIPLIER
      ).length;

      const orderBook = data.orderBook;
      const orderBookImbalance = orderBook ? orderBook.imbalance : 1.0;

      const candidate: CandidateData = {
        symbol,
        fetchedAt: Date.now(),
        klines1m: data.klines1m,
        klines5m: data.klines5m,
        klines15m: data.klines15m,
        recentTrades: data.recentTrades,
        aggTrades: data.aggTrades,
        orderBook: data.orderBook,
        openInterest: data.openInterest,
        fundingRate: data.fundingRate,
        support,
        resistance,
        avgTradeSize,
        buyPressure,
        largeOrderCount,
        orderBookImbalance,
      };

      candidateDataRef.current[symbol] = candidate;
      return candidate;
    } catch (err) {
      console.error(`[fetchCandidateData] ${symbol} failed`, err);
      return null;
    } finally {
      fetchingSymbolsRef.current.delete(symbol);
    }
  }, []);

  // ══════════════════════════════════════════════════════════════
  // checkPumpStart
  // ══════════════════════════════════════════════════════════════

  const checkPumpStart = useCallback((
  symbol: string,
  price: number,
  tickVolume: number,
  priceChangePct: number
): { isPump: boolean; volumeRatio: number; details?: any } => {
  const now = Date.now();
  const currentMinute = Math.floor(now / 60000);

  if (!pumpTrackerRef.current[symbol]) {
    pumpTrackerRef.current[symbol] = {
      minuteVolumes: [],
      lastPumpAlert: 0,
      minuteStartVolume: 0,
      currentMinute,
      pumpCount: 0,
      lastPumpHour: 0
    };
  }

  const tracker = pumpTrackerRef.current[symbol];

  if (currentMinute !== tracker.currentMinute) {
    tracker.minuteVolumes.push(tracker.minuteStartVolume);
    if (tracker.minuteVolumes.length > 10) tracker.minuteVolumes.shift();
    tracker.minuteStartVolume = 0;
    tracker.currentMinute = currentMinute;
  }

  tracker.minuteStartVolume += tickVolume;

  let volumeRatio = 0;
  if (tracker.minuteVolumes.length >= 2) {
    const prevAvg = tracker.minuteVolumes.slice(0, -1).reduce((a, b) => a + b, 0) /
                    (tracker.minuteVolumes.length - 1);
    volumeRatio = prevAvg > 0 ? tracker.minuteStartVolume / prevAvg : 0;
  }

  const priceCondition = Math.abs(priceChangePct) >= SYSTEM_CONFIG.PUMP.PRICE_CHANGE_MIN;
  const volumeCondition = volumeRatio >= SYSTEM_CONFIG.PUMP.VOLUME_RATIO_MIN;
  const spamCheck = now - tracker.lastPumpAlert >= SYSTEM_CONFIG.PUMP.COOLDOWN_MS;

  if (!priceCondition || !volumeCondition || !spamCheck) {
    return { isPump: false, volumeRatio };
  }

  tracker.lastPumpAlert = now;
  tracker.pumpCount++;

  return { 
    isPump: true, 
    volumeRatio,
    details: { isCandidate: true }
  };
}, []);

  // ══════════════════════════════════════════════════════════════
  // 🆕 DÜZELTME: analyzePumpCandidate (EMA 9/21 trend direction check)
  // ══════════════════════════════════════════════════════════════

const analyzePumpCandidate = useCallback(async (
  symbol: string,
  price: number,
  candleChangePct: number,
  volumeRatio: number,
  referencePrice: number,
  timestamp: number
): Promise<{ alert: TradingAlert } | null> => {

  const debugReject = (stage: string, details: any) => {
    console.warn(`[FILTER] ❌ ${symbol} rejected at ${stage}`, details);
  };

  try {
    // 1️⃣ Manipulation check
    const manip = await checkManipulationRisk(symbol);
    if (manip.isRisky) {
      debugReject('MANIPULATION_CHECK', manip);
      return null;
    }

    // 2️⃣ Candidate data
    const candData = await fetchCandidateData(symbol);
    if (!candData) {
      debugReject('CANDIDATE_DATA', { reason: 'fetchCandidateData returned null' });
      return null;
    }

    // 3️⃣ Candle count (1m)
    const candles = candleHistoryRef.current[symbol] || [];
    if (candles.length < 5) {
      debugReject('CANDLE_COUNT', { candleCount: candles.length });
      return null;
    }

    // ══════════════════════════════════════════════════════════════
    // 🆕 4️⃣ EMA 9/21 TREND DIRECTION CHECK (15m timeframe)
    // ══════════════════════════════════════════════════════════════
    
    const klines15m = candData.klines15m || [];
    if (klines15m.length < 21) {
      debugReject('INSUFFICIENT_15M_DATA', { 
        count: klines15m.length, 
        required: 21,
        note: 'Need 21 candles for EMA 21 calculation' 
      });
      return null;
    }

    // 🔧 FIX: 15m closes çıkar (Kline object format)
    const closes15m = klines15m.map((k: any) => {
      // Kline interface format (api.ts'den geliyor)
      if (typeof k === 'object' && k !== null) {
        return typeof k.close === 'number' ? k.close : parseFloat(String(k.close || 0));
      }
      // Raw array format (fallback)
      if (Array.isArray(k) && k.length > 4) {
        return parseFloat(String(k[4]));
      }
      console.error(`[EMA] ${symbol} - Invalid kline format:`, k);
      return 0;
    });

    // 🔍 DEBUG: Validate data
    console.log(`[EMA-DEBUG] ${symbol}:`, {
      totalCandles: closes15m.length,
      first3: closes15m.slice(0, 3),
      last3: closes15m.slice(-3),
      hasNaN: closes15m.some(isNaN),
      hasZero: closes15m.some(v => v === 0),
      allValid: closes15m.every(v => typeof v === 'number' && !isNaN(v) && v > 0)
    });
    
    // EMA 9 ve EMA 21 hesapla
    const ema9 = calculateEMA(closes15m, 9);
    const ema21 = calculateEMA(closes15m, 21);

    if (!ema9 || !ema21) {
      debugReject('EMA_CALCULATION_FAILED', { ema9, ema21 });
      return null;
    }

    // Trend direction belirle
    const isUptrend = ema9 > ema21;
    const isDowntrend = ema9 < ema21;
    const trendStrength = Math.abs(((ema9 - ema21) / ema21) * 100);

    console.log(`[EMA] ${symbol} - EMA9: ${ema9.toFixed(6)}, EMA21: ${ema21.toFixed(6)}, Trend: ${isUptrend ? '📈 UPTREND' : isDowntrend ? '📉 DOWNTREND' : '⚖️ NEUTRAL'} (${trendStrength.toFixed(2)}%)`);

    // ══════════════════════════════════════════════════════════════
    // 🆕 5️⃣ CANDLE DIRECTION vs TREND DIRECTION VALIDATION
    // ══════════════════════════════════════════════════════════════
    
    const candleDirection = candleChangePct > 0 ? 'UP' : 'DOWN';

    // UPTREND'de DOWN mum → REJECT
    if (isUptrend && candleDirection === 'DOWN') {
      debugReject('TREND_CANDLE_MISMATCH', {
        trendType: 'UPTREND',
        candleDirection: 'DOWN',
        candleChangePct: candleChangePct.toFixed(2) + '%',
        ema9: ema9.toFixed(6),
        ema21: ema21.toFixed(6),
        reason: 'Cannot open SHORT in UPTREND'
      });
      return null;
    }

    // DOWNTREND'de UP mum → REJECT
    if (isDowntrend && candleDirection === 'UP') {
      debugReject('TREND_CANDLE_MISMATCH', {
        trendType: 'DOWNTREND',
        candleDirection: 'UP',
        candleChangePct: candleChangePct.toFixed(2) + '%',
        ema9: ema9.toFixed(6),
        ema21: ema21.toFixed(6),
        reason: 'Cannot open LONG in DOWNTREND'
      });
      return null;
    }

    // ══════════════════════════════════════════════════════════════
    // 6️⃣ SIDE DETERMINATION (with trend confirmation)
    // ══════════════════════════════════════════════════════════════
    
    const side: Side = candleChangePct > 0 ? 'LONG' : 'SHORT';

    // Double-check: LONG must be in UPTREND
    if (side === 'LONG' && !isUptrend) {
      debugReject('LONG_WITHOUT_UPTREND', { 
        side, 
        isUptrend, 
        ema9, 
        ema21,
        reason: 'LONG signal requires EMA9 > EMA21' 
      });
      return null;
    }

    // Double-check: SHORT must be in DOWNTREND
    if (side === 'SHORT' && !isDowntrend) {
      debugReject('SHORT_WITHOUT_DOWNTREND', { 
        side, 
        isDowntrend, 
        ema9, 
        ema21,
        reason: 'SHORT signal requires EMA9 < EMA21' 
      });
      return null;
    }

    // Config side check
    if (
      (side === 'LONG' && !config.longEnabled) ||
      (side === 'SHORT' && !config.shortEnabled)
    ) {
      debugReject('DIRECTION_DISABLED', { side });
      return null;
    }

    // ══════════════════════════════════════════════════════════════
    // 7️⃣ TECHNICAL FILTERS (RSI, MACD, Consolidation, Volatility)
    // ══════════════════════════════════════════════════════════════
    
    const recentCandles = candles.slice(-Math.min(15, candles.length));
    const closes = recentCandles.map(c => c.close);

    const minP = Math.min(...closes);
    const maxP = Math.max(...closes);
    const consRange = ((maxP - minP) / minP) * 100;

    const changes = closes.slice(1).map((p, i) => Math.abs(p - closes[i]));
    const avgChange = changes.reduce((a, b) => a + b, 0) / changes.length;
    const volPct = (avgChange / closes[closes.length - 1]) * 100;

    const rsi = calculateRSI(closes);
    const macd = calculateMACD(closes);

    const consOk = consRange <= 4.0;
    const volOk  = volPct < 2.0;
    const rsiOk  = rsi >= 45;
    const macdOk = macd.histogram > -0.0005;

    if (!(consOk && volOk && rsiOk && macdOk)) {
      debugReject('TECHNICAL_FILTERS', {
        consolidation: {
          value: consRange.toFixed(2),
          passed: consOk,
          rule: '≤ 4.0%'
        },
        volatility: {
          value: volPct.toFixed(2),
          passed: volOk,
          rule: '< 2.0%'
        },
        rsi: {
          value: rsi.toFixed(2),
          passed: rsiOk,
          rule: '≥ 45'
        },
        macd: {
          histogram: macd.histogram.toFixed(6),
          passed: macdOk,
          rule: '> -0.0005'
        }
      });
      return null;
    }

    // ══════════════════════════════════════════════════════════════
    // 8️⃣ WHALE & TREND ANALYSIS
    // ══════════════════════════════════════════════════════════════
    
    const whaleScore = calculateWhaleScore(candData);
    const trend = checkTrendStartWithData(symbol, candleChangePct);

    let eliteType: TradingAlert['eliteType'];
    let reason: string;
    let autoTrade = false;

    const now = Date.now();
    const isFollowUp =
      lastPumpAlertRef.current[symbol] &&
      now - lastPumpAlertRef.current[symbol] < 10 * 60 * 1000;

    const wThreshold = isFollowUp
      ? (config.whaleMinScore || 75) * 0.85
      : (config.whaleMinScore || 75);

    const iThreshold = isFollowUp
      ? Math.max(wThreshold - 5, 45)
      : Math.max(wThreshold - 5, 50);

    const tThreshold = isFollowUp
      ? Math.max(wThreshold - 20, 35)
      : Math.max(wThreshold - 25, 40);

    if (whaleScore >= wThreshold) {
      eliteType = 'WHALE_ACCUMULATION';
      reason = '🐋 WHALE ACCUMULATION';
      autoTrade = config.whaleDetectionEnabled;
    } else if (whaleScore >= iThreshold && rsi >= 58) {
      eliteType = 'INSTITUTION_ENTRY';
      reason = '🏛️ INSTITUTIONAL ENTRY';
      autoTrade = config.whaleDetectionEnabled;
    } else if (trend.isTrendStart && whaleScore >= tThreshold) {
      eliteType = 'TREND_START';
      reason = '🚀 TREND START';
      autoTrade = true;
    } else {
      eliteType = 'PUMP_START';
      reason = '🔥 PUMP DETECTED';
      autoTrade = false;
    }

    // ══════════════════════════════════════════════════════════════
    // ✅ ALERT CREATE (with trend validation)
    // ══════════════════════════════════════════════════════════════
    
    const alert: TradingAlert = {
      id: `${eliteType.toLowerCase()}-${symbol}-${timestamp}`,
      symbol,
      side,
      reason,
      change: candleChangePct,
      price,
      previousPrice: referencePrice,
      timestamp,
      executed: false,
      isElite: eliteType !== 'PUMP_START',
      eliteType,
      volumeMultiplier: volumeRatio,
      autoTrade,
      supportLevel: candData.support,
      resistanceLevel: candData.resistance,
      whaleDetails: {
        score: whaleScore,
        largeOrders: candData.largeOrderCount,
        orderBookImbalance: candData.orderBookImbalance,
        volatilitySpike: true,
        supportLevel: candData.support,
        resistanceLevel: candData.resistance,
        description: `Buy:${(candData.buyPressure * 100).toFixed(1)}% Large:${candData.largeOrderCount} Imb:${candData.orderBookImbalance.toFixed(2)}x RSI:${rsi.toFixed(1)} EMA9/21:${isUptrend ? '📈' : '📉'}`
      },
      trendDetails: trend.isTrendStart
        ? {
            consolidationRange: trend.details.consolidationRange,
            breakoutPercent: trend.details.breakoutPercent,
            volumeRatio: trend.details.volumeRatio,
            trendConfirmed: trend.details.trendConfirmed,
            context: trend.details.context,
            conditionsMet: trend.details.conditionsMet
          }
        : undefined
    };

    console.log(`[FILTER] ✅ ${symbol} PASSED ALL CHECKS - Creating ${eliteType} alert (${side}) - EMA Trend: ${isUptrend ? 'UP' : 'DOWN'}, Strength: ${trendStrength.toFixed(2)}%`);
    
    return { alert };

  } catch (err) {
    console.error(`[FILTER] ❌ ${symbol} analyzePumpCandidate crashed`, err);
    return null;
  }
}, [
  fetchCandidateData,
  calculateWhaleScore,
  checkManipulationRisk,
  checkTrendStartWithData,
  config,
  calculateRSI,
  calculateMACD,
  calculateEMA,
  lastPumpAlertRef
]);

  // ══════════════════════════════════════════════════════════════
  // QUEUE SYSTEM (debounce + cache)
  // ══════════════════════════════════════════════════════════════

  const queueAnalysis = useCallback((
    symbol: string,
    price: number,
    candleChangePct: number,
    volumeRatio: number,
    referencePrice: number,
    timestamp: number
  ) => {
    const now = Date.now();
    const lastAnalysis = lastAnalysisRef.current[symbol] || 0;
    
    if (now - lastAnalysis < SYSTEM_CONFIG.ANALYSIS.MIN_REANALYSIS_INTERVAL_MS) {
      console.log(`[QUEUE] ⏭️ ${symbol} recently analyzed (${((now - lastAnalysis)/1000).toFixed(0)}s ago), skipping`);
      return;
    }
    
    if (analysisQueueRef.current.has(symbol)) {
      console.log(`[QUEUE] ⏳ ${symbol} already in queue, skipping`);
      return;
    }
    
    if (analysisQueueRef.current.size >= SYSTEM_CONFIG.ANALYSIS.MAX_CONCURRENT_ANALYSIS) {
      console.log(`[QUEUE] 🚫 Max concurrent analysis (${analysisQueueRef.current.size}), skipping ${symbol}`);
      return;
    }
    
    analysisQueueRef.current.add(symbol);
    lastAnalysisRef.current[symbol] = now;
    
    console.log(`[QUEUE] ➕ ${symbol} added to queue (${analysisQueueRef.current.size} active)`);
    
    setTimeout(() => {
      analyzePumpCandidate(
        symbol, 
        price, 
        candleChangePct, 
        volumeRatio,
        referencePrice,
        timestamp
      ).then(result => {
        if (result) {
          console.log(`[QUEUE] ✅ ${symbol} analysis complete, creating alert...`);
          setAlerts(prev => [result.alert, ...prev].slice(0, MAX_ALERTS));
          
          setTempTrends(p => ({...p, [symbol]: candleChangePct > 0 ? 'up' : 'down'}));
          if (trendTimeoutsRef.current[symbol]) clearTimeout(trendTimeoutsRef.current[symbol]);
          trendTimeoutsRef.current[symbol] = setTimeout(() => 
            setTempTrends(p => ({...p, [symbol]: null})), 
            SYSTEM_CONFIG.ALERTS.TREND_HIGHLIGHT_DURATION
          );
        } else {
          console.warn(`[QUEUE] ⚠️ ${symbol} analysis returned null (filtered out)`);
        }
      }).catch(error => {
        console.error(`[QUEUE] ❌ ${symbol} analysis failed:`, error);
      }).finally(() => {
        analysisQueueRef.current.delete(symbol);
        console.log(`[QUEUE] ➖ ${symbol} removed from queue (${analysisQueueRef.current.size} active)`);
      });
    }, SYSTEM_CONFIG.ANALYSIS.QUEUE_DEBOUNCE_MS);
  }, [analyzePumpCandidate]);

// ══════════════════════════════════════════════════════════════
// WebSocket Ticker Stream - Production Ready
// ══════════════════════════════════════════════════════════════

useEffect(() => {
  let ws: WebSocket | null = null;
  let reconnectTimer: NodeJS.Timeout | null = null;
  let reconnectAttempts = 0;
  const MAX_RECONNECT = 5;
  const RECONNECT_DELAY = 3000;

  const initializeCandleHistory = async () => {
    const topCoins = ['BTCUSDT', 'ETHUSDT', 'BNBUSDT', 'SOLUSDT', 'XRPUSDT'];
    
    for (const symbol of topCoins) {
      try {
        const response = await fetch(`/binance-futures/fapi/v1/klines?symbol=${symbol}&interval=1m&limit=60`);
        if (!response.ok) continue;
        const klines = await response.json();
        
        candleHistoryRef.current[symbol] = klines.map((k: any) => ({
          open: parseFloat(k[1]),
          high: parseFloat(k[2]),
          low: parseFloat(k[3]),
          close: parseFloat(k[4]),
          volume: parseFloat(k[5]),
          quoteVolume: parseFloat(k[7]),
          minute: Math.floor(k[0] / 60000)
        }));
      } catch {}
    }
  };

  initializeCandleHistory();

  const connect = () => {
    if (ws?.readyState === WebSocket.OPEN) return;

    ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
    
    ws.onopen = () => {
      reconnectAttempts = 0;
    };

    ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (!Array.isArray(data)) return;

    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    const nextMarketData: Record<string, SymbolData> = {};

    data.forEach((item: any) => {
      const symbol = item.s;
      if (!symbol.endsWith('USDT')) return;
      
      const price = parseFloat(item.c);
      const volume = parseFloat(item.v);
      const quoteVolume = parseFloat(item.q);
      
      nextMarketData[symbol] = { 
        symbol, 
        price, 
        change24h: parseFloat(item.P), 
        volume: quoteVolume 
      };

      if (!rollingHistoryRef.current[symbol]) {
        rollingHistoryRef.current[symbol] = { prices: [], volumes: [] };
      }
      const hist = rollingHistoryRef.current[symbol];
      hist.prices.push(price);
      hist.volumes.push(quoteVolume);
      if (hist.prices.length > 30) { 
        hist.prices.shift(); 
        hist.volumes.shift(); 
      }

      if (!minuteTicksRef.current[symbol]) {
        minuteTicksRef.current[symbol] = {
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume,
          quoteVolume: quoteVolume,
          minute: currentMinute
        };
      } else if (minuteTicksRef.current[symbol].minute !== currentMinute) {
        const completedCandle = minuteTicksRef.current[symbol];
        
        if (!candleHistoryRef.current[symbol]) {
          candleHistoryRef.current[symbol] = [];
        }
        
        candleHistoryRef.current[symbol].push(completedCandle);
        
        if (candleHistoryRef.current[symbol].length > 60) {
          candleHistoryRef.current[symbol].shift();
        }
        
        minuteTicksRef.current[symbol] = {
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume,
          quoteVolume: quoteVolume,
          minute: currentMinute
        };
      } else {
        const tick = minuteTicksRef.current[symbol];
        tick.high = Math.max(tick.high, price);
        tick.low = Math.min(tick.low, price);
        tick.close = price;
        tick.volume += volume;
        tick.quoteVolume += quoteVolume;
      }

      const currentCandle = minuteTicksRef.current[symbol];
      const candleChangePct = ((currentCandle.close - currentCandle.open) / currentCandle.open) * 100;

      if (isBlacklisted(symbol)) return;

      if (config.pumpDetectionEnabled) {
        const tickVolume = currentCandle.quoteVolume;
        const pumpCheck = checkPumpStart(symbol, price, tickVolume, candleChangePct);
        
        if (pumpCheck.isPump) {
          const pumpCooldownPassed = !lastPumpAlertRef.current[symbol] || 
            (now - lastPumpAlertRef.current[symbol] > SYSTEM_CONFIG.PUMP.COOLDOWN_MS);
          
          if (pumpCooldownPassed) {
            lastPumpAlertRef.current[symbol] = now;
            
            queueAnalysis(
              symbol, 
              price, 
              candleChangePct, 
              pumpCheck.volumeRatio,
              currentCandle.open,
              now
            );
          }
        }
      }
    });
    
    setMarketData(prev => ({ ...prev, ...nextMarketData }));
  };
    
    ws.onerror = () => {};
    
    ws.onclose = () => {
      if (reconnectAttempts < MAX_RECONNECT) {
        reconnectAttempts++;
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY);
      }
    };
  };

  connect();

  return () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (ws) {
      ws.onclose = null;
      ws.close();
    }
  };
}, [isBlacklisted, config.pumpDetectionEnabled, checkPumpStart, queueAnalysis]);

  // ══════════════════════════════════════════════════════════════
  // Pozisyon takibi & TP/SL/Trailing
  // ══════════════════════════════════════════════════════════════

  const closeTrade = useCallback((pos: Position, currentPrice: number, reason: string) => {
    const isLong = pos.side === 'LONG';
    const diff = isLong ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
    const pnlBeforeFee = diff * pos.quantity;
    const fee = pos.quantity * currentPrice * FEE_RATE;
    const finalPnl = pnlBeforeFee - fee;

    const releasedMargin = pos.margin * (pos.quantity / pos.initialQuantity);
    const netChange = releasedMargin + finalPnl;

    const historyItem: TradeHistoryItem = {
      id: pos.id,
      symbol: pos.symbol,
      side: pos.side,
      leverage: pos.leverage,
      quantity: pos.quantity,
      entryPrice: pos.entryPrice,
      exitPrice: currentPrice,
      stopLoss: pos.stopLoss,
      tp1: pos.tp1,
      tp2: pos.tp2,
      pnl: finalPnl,
      pnlPercent: (finalPnl / releasedMargin) * 100,
      maxPnlPercent: pos.maxPnlPercent,
      timestamp: pos.timestamp,
      closedAt: Date.now(),
      duration: Date.now() - (pos.actualEntryTime || pos.timestamp),
      balanceAfter: account.balance + netChange,
      reason,
      efficiency: finalPnl > 0 ? 'PERFECT' : 'LOSS',
      details: reason,
      totalFees: pos.fees + fee,
      minPriceDuringTrade: pos.minPrice,
      maxPriceDuringTrade: pos.maxPrice,
      initialMargin: pos.margin,
      source: pos.source,
      alertType: pos.alertType
    };

    return { netBalanceChange: netChange, historyItem };
  }, [account.balance]);

  useEffect(() => {
    if (!positions.length) return;

    const interval = setInterval(() => {
      let needsUpdate = false;
      let balanceAdj = 0;
      const newHistory: TradeHistoryItem[] = [];
      const tp1Ratio = (config.tp1ClosePercent ?? 40) / 100;
      const tp2Ratio = (config.tp2ClosePercent ?? 30) / 100;
      const now = Date.now();

      const updatedPositions = positions.map(pos => {
        const market = marketData[pos.symbol];
        if (!market) return pos;

        const price = market.price;
        const isLong = pos.side === 'LONG';

        const slReached = isLong ? price <= pos.stopLoss : price >= pos.stopLoss;
        
        if (slReached) {
          const reason = pos.trailingStopActive ? 'TRAILING SL' : 'STOP LOSS';
          const { netBalanceChange, historyItem } = closeTrade(pos, price, reason);
          
          historyItem.slHitTime = now;
          
          balanceAdj += netBalanceChange;
          newHistory.push(historyItem);
          needsUpdate = true;
          return null;
        }

        const tp1Reached = !pos.tp1Hit && (isLong ? price >= pos.tp1 : price <= pos.tp1);
        
        if (tp1Reached) {
          const qtyClose = pos.initialQuantity * tp1Ratio;
          const keepQty = pos.quantity - qtyClose;
          const diff = isLong ? price - pos.entryPrice : pos.entryPrice - price;
          const pnl = (diff * qtyClose) - (qtyClose * price * FEE_RATE);
          const marginReleased = pos.margin * (qtyClose / pos.quantity);
          balanceAdj += pnl + marginReleased;

          newHistory.push({
            ...pos,
            id: `${pos.id}-tp1`,
            quantity: qtyClose,
            exitPrice: price,
            pnl,
            pnlPercent: (pnl / marginReleased) * 100,
            closedAt: now,
            reason: `TP1 (${config.tp1ClosePercent}%)`,
            balanceAfter: account.balance + balanceAdj,
            efficiency: 'PARTIAL',
            tp1HitTime: now,
          } as TradeHistoryItem);

          needsUpdate = true;
          return {
            ...pos,
            tp1Hit: true,
            tp1HitTime: now,
            quantity: keepQty,
            stopLoss: pos.entryPrice,
            margin: pos.margin - marginReleased,
            partialCloses: { ...pos.partialCloses, tp1: qtyClose }
          };
        }

        const tp2Reached = pos.tp1Hit && !pos.tp2Hit && (isLong ? price >= pos.tp2 : price <= pos.tp2);
        
        if (tp2Reached) {
          const qtyClose = pos.quantity * tp2Ratio;
          const keepQty = pos.quantity - qtyClose;
          const diff = isLong ? price - pos.entryPrice : pos.entryPrice - price;
          const pnl = (diff * qtyClose) - (qtyClose * price * FEE_RATE);
          const marginReleased = pos.margin * (qtyClose / pos.quantity);
          balanceAdj += pnl + marginReleased;

          newHistory.push({
            ...pos,
            id: `${pos.id}-tp2`,
            quantity: qtyClose,
            exitPrice: price,
            pnl,
            pnlPercent: (pnl / marginReleased) * 100,
            closedAt: now,
            reason: `TP2 (${config.tp2ClosePercent}%)`,
            balanceAfter: account.balance + balanceAdj,
            efficiency: 'PARTIAL',
            tp2HitTime: now,
          } as TradeHistoryItem);

          needsUpdate = true;
          return {
            ...pos,
            tp2Hit: true,
            tp2HitTime: now,
            trailingStopActive: true,
            trailingStartTime: now,
            quantity: keepQty,
            stopLoss: pos.tp1,
            margin: pos.margin - marginReleased,
            highestPrice: price,
            partialCloses: { ...pos.partialCloses, tp2: qtyClose }
          };
        }

        let updated = { ...pos };
        
        if (pos.trailingStopActive) {
          const refHigh = pos.highestPrice ?? pos.maxPrice ?? price;
          const newHigh = Math.max(refHigh, price);
          let newSL = pos.stopLoss;
          const trailPct = config.trailingPercent ?? 1.5;

          if (isLong) {
            const calc = newHigh * (1 - trailPct / 100);
            if (calc > pos.stopLoss) newSL = calc;
          } else {
            const calc = newHigh * (1 + trailPct / 100);
            if (calc < pos.stopLoss) newSL = calc;
          }

          if (newSL !== pos.stopLoss || newHigh !== pos.highestPrice) {
            updated = { ...updated, stopLoss: newSL, highestPrice: newHigh };
            needsUpdate = true;
          }
        }

        const newMax = Math.max(updated.maxPrice, price);
        const newMin = Math.min(updated.minPrice, price);
        if (newMax !== updated.maxPrice || newMin !== updated.minPrice) {
          updated = { ...updated, maxPrice: newMax, minPrice: newMin };
          needsUpdate = true;
        }

        return updated;
      }).filter(Boolean) as Position[];

      if (needsUpdate) {
        if (balanceAdj !== 0) {
          setAccount(p => ({ ...p, balance: p.balance + balanceAdj }));
        }
        if (newHistory.length) {
          setTradeHistory(p => [...newHistory, ...p].slice(0, MAX_HISTORY));
        }
        setPositions(updatedPositions);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [positions, marketData, closeTrade, account.balance, config]);

  // ══════════════════════════════════════════════════════════════
  // Auto-trade
  // ══════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!config.autoTrading || !alerts.length) return;

    const toProcess = alerts.filter(a => !processedAlertIds.current.has(a.id));
    if (!toProcess.length) return;

    let tempBalance = account.balance;
    let tempPos = [...positions];
    let changed = false;

    for (const alert of toProcess) {
      if (tempPos.length >= config.maxConcurrentTrades) break;

      if (tempPos.some(p => p.symbol === alert.symbol && p.side === alert.side)) {
        processedAlertIds.current.add(alert.id);
        continue;
      }

      const recentlyClosed = tradeHistory.some(t =>
        t.symbol === alert.symbol &&
        t.side === alert.side &&
        Date.now() - t.closedAt < 5 * 60 * 1000
      );

      if (recentlyClosed) {
        processedAlertIds.current.add(alert.id);
        continue;
      }

      const dirOk = alert.side === 'LONG' ? config.longEnabled : config.shortEnabled;
      const eliteOk = config.eliteMode ? !!alert.isElite : true;
      const autoOk = alert.autoTrade !== false;

      if (dirOk && eliteOk && autoOk) {
        processedAlertIds.current.add(alert.id);

        const riskUsd = tempBalance * (config.riskPerTrade / 100);
        const slDist = alert.price * (config.stopLossPercent / 100);
        const qty = riskUsd / slDist;
        const margin = (qty * alert.price) / config.leverage;
        const fee = qty * alert.price * FEE_RATE;

        if (margin + fee > tempBalance) continue;

        let sl = alert.side === 'LONG'
          ? alert.price - slDist
          : alert.price + slDist;

        if (config.useDynamicStopLoss && alert.supportLevel && alert.resistanceLevel) {
          if (alert.side === 'LONG' && alert.supportLevel < alert.price) {
            sl = alert.supportLevel * 0.998;
          } else if (alert.side === 'SHORT' && alert.resistanceLevel > alert.price) {
            sl = alert.resistanceLevel * 1.002;
          }
        }

        const alertTs = alert.timestamp || Date.now();
        const execTs = Date.now();
        const delaySec = Math.floor((execTs - alertTs) / 1000);

        const pos: Position = {
          id: alert.id,
          symbol: alert.symbol,
          side: alert.side,
          entryPrice: alert.price,
          quantity: qty,
          leverage: config.leverage,
          margin,
          fees: fee,
          stopLoss: sl,
          tp1: alert.side === 'LONG'
            ? alert.price * (1 + config.tp1Percent / 100)
            : alert.price * (1 - config.tp1Percent / 100),
          tp2: alert.side === 'LONG'
            ? alert.price * (1 + config.tp2Percent / 100)
            : alert.price * (1 - config.tp2Percent / 100),
          tp1Hit: false,
          tp2Hit: false,
          trailingStopActive: false,
          initialQuantity: qty,
          partialCloses: { tp1: 0, tp2: 0 },
          pnl: 0,
          pnlPercent: 0,
          maxPnlPercent: 0,
          timestamp: alertTs,
          actualEntryTime: execTs,
          executionDelay: delaySec,
          minPrice: alert.price,
          maxPrice: alert.price,
          source: 'AUTO',
          alertType: alert.eliteType,
          supportLevel: alert.supportLevel,
          resistanceLevel: alert.resistanceLevel
        };

        tempPos.push(pos);
        tempBalance -= margin + fee;
        changed = true;

        if (delaySec > 60) {
          console.warn(`[AUTO] Delayed exec ${alert.symbol}: ${delaySec}s`);
        }
      } else {
        processedAlertIds.current.add(alert.id);
      }
    }

    if (changed) {
      setAccount(p => ({ ...p, balance: tempBalance }));
      setPositions(tempPos);

      try {
        localStorage.setItem('processedAlerts', JSON.stringify([...processedAlertIds.current].slice(-1000)));
      } catch {}
    }
  }, [alerts, config, positions, account.balance, tradeHistory]);

  // ══════════════════════════════════════════════════════════════
  // Manuel kapatma & acil durdurma
  // ══════════════════════════════════════════════════════════════

  const handleManualClose = useCallback((id: string) => {
    const pos = positions.find(p => p.id === id);
    if (!pos) return;

    const price = marketData[pos.symbol]?.price || pos.entryPrice;
    const { netBalanceChange, historyItem } = closeTrade(pos, price, 'MANUAL EXIT');

    setPositions(prev => prev.filter(p => p.id !== id));
    setAccount(prev => ({ ...prev, balance: prev.balance + netBalanceChange }));
    setTradeHistory(prev => [historyItem, ...prev].slice(0, MAX_HISTORY));
  }, [positions, marketData, closeTrade]);

  const emergencyStop = useCallback(() => {
    let totalAdj = 0;
    const histItems: TradeHistoryItem[] = [];

    positions.forEach(pos => {
      const price = marketData[pos.symbol]?.price || pos.entryPrice;
      const { netBalanceChange, historyItem } = closeTrade(pos, price, 'EMERGENCY STOP');
      totalAdj += netBalanceChange;
      histItems.push(historyItem);
    });

    setPositions([]);
    setAccount(p => ({ ...p, balance: p.balance + totalAdj }));
    setTradeHistory(p => ([...histItems, ...p].slice(0, MAX_HISTORY)));
  }, [positions, marketData, closeTrade]);

  // ══════════════════════════════════════════════════════════════
  // Manuel pozisyon açma
  // ══════════════════════════════════════════════════════════════

  const openManualTrade = useCallback((params: any) => {
    let sym = (params.symbol || selectedSymbol).toUpperCase().trim();
    if (!sym.endsWith('USDT')) sym += 'USDT';

    const mkt = marketData[sym];
    if (!mkt) return;

    const entry = mkt.price;
    const risk = params.riskValue || config.riskPerTrade;
    const lev = params.leverage || config.leverage;
    const slPct = params.sl || config.stopLossPercent;
    const slDist = entry * (slPct / 100);
    const riskUsd = account.balance * (risk / 100);
    const qty = riskUsd / slDist;
    const margin = (qty * entry) / lev;
    const fee = qty * entry * FEE_RATE;

    if (margin + fee > account.balance) return;

    const now = Date.now();

    const pos: Position = {
      id: `man-${now}`,
      symbol: sym,
      side: params.side,
      entryPrice: entry,
      quantity: qty,
      leverage: lev,
      margin,
      fees: fee,
      stopLoss: params.side === 'LONG' ? entry - slDist : entry + slDist,
      tp1: params.side === 'LONG'
        ? entry * (1 + (params.tp1 || config.tp1Percent) / 100)
        : entry * (1 - (params.tp1 || config.tp1Percent) / 100),
      tp2: params.side === 'LONG'
        ? entry * (1 + (params.tp2 || config.tp2Percent) / 100)
        : entry * (1 - (params.tp2 || config.tp2Percent) / 100),
      tp1Hit: false,
      tp2Hit: false,
      trailingStopActive: false,
      initialQuantity: qty,
      partialCloses: { tp1: 0, tp2: 0 },
      pnl: 0,
      pnlPercent: 0,
      maxPnlPercent: 0,
      timestamp: now,
      actualEntryTime: now,
      executionDelay: 0,
      minPrice: entry,
      maxPrice: entry,
      source: 'MANUAL'
    };

    setPositions(p => [...p, pos]);
    setAccount(p => ({ ...p, balance: p.balance - margin - fee }));
    setSelectedSymbol(sym);
  }, [marketData, account.balance, selectedSymbol, config]);

  // ══════════════════════════════════════════════════════════════
  // Resize mantığı
  // ══════════════════════════════════════════════════════════════

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing.current) return;

    if (isResizing.current === 'left') {
      setLeftWidth(Math.max(200, Math.min(400, e.clientX)));
    } else if (isResizing.current === 'right1') {
      setRightWidth1(Math.max(250, Math.min(500, window.innerWidth - e.clientX - rightWidth2)));
    } else if (isResizing.current === 'right2') {
      setRightWidth2(Math.max(250, Math.min(500, window.innerWidth - e.clientX)));
    } else if (isResizing.current === 'bottom') {
      setBottomHeight(Math.max(150, Math.min(window.innerHeight - 200, window.innerHeight - e.clientY)));
    }
  }, [rightWidth2]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', () => {
      isResizing.current = null;
      document.body.style.cursor = 'default';
    });
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
    };
  }, [handleMouseMove]);

  // ══════════════════════════════════════════════════════════════
  // JSX Render
  // ══════════════════════════════════════════════════════════════

  return (
    <div className="flex flex-col h-screen w-full bg-[#0b0e11] text-[#eaecef] overflow-hidden font-sans">
      <div className="flex-1 flex overflow-hidden">
        <div
          className={`shrink-0 relative border-r border-[#2b3139] ${mobileTab === 'market' ? 'flex flex-1' : 'hidden lg:flex'}`}
          style={window.innerWidth >= 1024 ? { width: `${leftWidth}px` } : {}}
        >
          <MarketOverview
            data={marketData}
            selected={selectedSymbol}
            onSelect={s => {
              setSelectedSymbol(s);
              if (window.innerWidth < 1024) setMobileTab('chart');
            }}
            trends={tempTrends}
          />
          <div
            className="hidden lg:block absolute right-[-2px] top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#fcd535]/50 z-50 transition-colors"
            onMouseDown={() => {
              isResizing.current = 'left';
              document.body.style.cursor = 'col-resize';
            }}
          />
        </div>

        <div className={`flex-1 min-w-0 flex flex-col ${mobileTab === 'chart' || mobileTab === 'positions' ? 'flex' : 'hidden lg:flex'}`}>
          <div className={`flex-1 relative bg-black border-b border-[#2b3139] ${mobileTab === 'positions' ? 'hidden lg:block' : 'block'}`}>
            <TradingChart key={selectedSymbol} symbol={selectedSymbol} />
          </div>
          <div
            className="hidden lg:block h-1 cursor-row-resize hover:bg-[#fcd535]/50 z-50 transition-colors bg-[#2b3139]/30"
            onMouseDown={() => {
              isResizing.current = 'bottom';
              document.body.style.cursor = 'row-resize';
            }}
          />
          <div
            className={`overflow-hidden shrink-0 ${mobileTab === 'chart' ? 'hidden lg:block' : 'block flex-1'}`}
            style={window.innerWidth >= 1024 ? { height: `${bottomHeight}px` } : {}}
          >
            <PositionsPanel
              positions={positions}
              history={tradeHistory}
              onManualClose={handleManualClose}
              marketData={marketData}
              onSelectSymbol={s => {
                setSelectedSymbol(s);
                if (window.innerWidth < 1024) setMobileTab('chart');
              }}
            />
          </div>
        </div>

        <div
          className={`bg-[#0b0e11] border-l border-[#2b3139] flex-col shrink-0 relative ${mobileTab === 'alerts' ? 'flex flex-1' : 'hidden lg:flex'}`}
          style={window.innerWidth >= 1024 ? { width: `${rightWidth1}px` } : {}}
        >
          <div
            className="hidden lg:block absolute left-[-2px] top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#fcd535]/50 z-50 transition-colors"
            onMouseDown={() => {
              isResizing.current = 'right1';
              document.body.style.cursor = 'col-resize';
            }}
          />
          <AlertsPanel
            alerts={alerts}
            onSelect={s => {
              setSelectedSymbol(s);
              if (window.innerWidth < 1024) setMobileTab('chart');
            }}
            activePositions={positions}
            marketData={marketData}
            eliteMode={config.eliteMode}
            onQuickTrade={a =>
              openManualTrade({
                symbol: a.symbol,
                side: a.side,
                leverage: config.leverage,
                riskValue: config.riskPerTrade,
                sl: config.stopLossPercent,
                tp1: config.tp1Percent,
                tp2: config.tp2Percent
              })
            }
          />
        </div>

        <div
          className={`shrink-0 border-l border-[#2b3139] p-4 bg-[#0b0e11] overflow-y-auto custom-scrollbar relative ${mobileTab === 'controls' ? 'block flex-1' : 'hidden lg:block'}`}
          style={window.innerWidth >= 1024 ? { width: `${rightWidth2}px` } : {}}
        >
          <div
            className="hidden lg:block absolute left-[-2px] top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#fcd535]/50 z-50 transition-colors"
            onMouseDown={() => {
              isResizing.current = 'right2';
              document.body.style.cursor = 'col-resize';
            }}
          />
          <TradingControls
            config={config}
            setConfig={setConfig}
            account={account}
            marketData={marketData}
            positions={positions}
            emergencyStop={emergencyStop}
            onManualTrade={openManualTrade}
          />
        </div>
      </div>

      <div className="lg:hidden h-16 bg-[#1e2329] border-t border-[#2b3139] flex items-center justify-around px-2 shrink-0 shadow-[0_-5px_15px_rgba(0,0,0,0.5)] z-[100]">
        {[
          { id: 'market', label: 'Market', icon: '📊' },
          { id: 'alerts', label: 'Alerts', icon: '🔔' },
          { id: 'chart', label: 'Chart', icon: '📈' },
          { id: 'positions', label: 'Trade', icon: '💼' },
          { id: 'controls', label: 'Bot', icon: '⚙️' }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setMobileTab(t.id as MobileTab)}
            className={`flex flex-col items-center justify-center gap-1 transition-all ${
              mobileTab === t.id ? 'text-[#fcd535] scale-110' : 'text-[#848e9c]'
            }`}
          >
            <span className="text-xl">{t.icon}</span>
            <span className="text-[9px] font-black uppercase tracking-tighter">{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default App;