import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  pumpCount: number;           // 🔧 YENİ: Saatteki pump sayısı
  lastPumpHour: number;        // 🔧 YENİ: Son pump saati
}

interface MinuteTick {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  minute: number;
}

interface CandidateData {
  symbol: string;
  fetchedAt: number;
  klines1m: any[];
  klines5m: any[];
  recentTrades: any[];
  openInterest: number | null;
  fundingRate: number | null;
  support: number;
  resistance: number;
  avgTradeSize: number;
  buyPressure: number;
  largeOrderCount: number;
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
  
  // 🔧 FIX #1: CANDLE TRACKING - Dakika bazlı doğru tracking
  const minuteTicksRef = useRef<Record<string, MinuteTick>>({});
  const candleHistoryRef = useRef<Record<string, MinuteTick[]>>({});
  
  // 🔧 FIX #3: ALERT COOLDOWN - Ayrı ref'ler
  const lastMomentumAlertRef = useRef<Record<string, number>>({});
  const lastPumpAlertRef = useRef<Record<string, number>>({});
  const lastTrendAlertRef = useRef<Record<string, number>>({});
  
  const rollingHistoryRef = useRef<Record<string, { prices: number[], volumes: number[] }>>({});
  const trendTimeoutsRef = useRef<Record<string, any>>({});
  
  const pumpTrackerRef = useRef<Record<string, PumpTracker>>({});
  const lastQuoteVolumeRef = useRef<Record<string, number>>({});
  
  // Hybrid sistem için candidate data cache
  const candidateDataRef = useRef<Record<string, CandidateData>>({});
  const fetchingSymbolsRef = useRef<Set<string>>(new Set());

  // LocalStorage'dan processed alerts yükle
  useEffect(() => {
    try {
      const stored = localStorage.getItem('processedAlerts');
      if (stored) {
        const ids = JSON.parse(stored);
        processedAlertIds.current = new Set(ids.slice(-1000)); // Son 1000
      }
    } catch (e) {
      console.warn('[Storage] Failed to load processed alerts:', e);
    }
  }, []);

  const isBlacklisted = useCallback((symbol: string) => {
    if (!symbol) return false;
    const cleanSymbol = symbol.toUpperCase().replace('USDT', '').trim();
    return config.blacklist.some(b => b.toUpperCase().replace('USDT', '').trim() === cleanSymbol);
  }, [config.blacklist]);

  // 🔧 FIX #4: CANDIDATE DATA + WHALE SCORE CALCULATION
  const calculateWhaleScore = useCallback((candidateData: CandidateData): number => {
    let score = 0;
    
    // 1. Large Orders (max 30 puan)
    const largeOrderScore = Math.min(candidateData.largeOrderCount * 5, 30);
    score += largeOrderScore;
    
    // 2. Buy/Sell Pressure (max 30 puan)
    const pressureDeviation = Math.abs(candidateData.buyPressure - 0.5);
    const pressureScore = pressureDeviation * 60; // 0.5'ten uzaklaşma = whale activity
    score += Math.min(pressureScore, 30);
    
    // 3. Support/Resistance spread (max 20 puan)
    const priceRange = candidateData.resistance - candidateData.support;
    const rangePercent = (priceRange / candidateData.support) * 100;
    const rangeScore = rangePercent < 2 ? 20 : (rangePercent < 3 ? 10 : 5);
    score += rangeScore;
    
    // 4. Bonus: OI ve Funding (max 20 puan)
    if (candidateData.openInterest && candidateData.openInterest > 1000000) {
      score += 10;
    }
    if (candidateData.fundingRate && Math.abs(candidateData.fundingRate) > 0.0001) {
      score += 10;
    }
    
    return Math.min(100, Math.round(score));
  }, []);

  // 🔧 PHASE 2: MANİPÜLASYON TESPİTİ
  const checkManipulationRisk = useCallback(async (symbol: string): Promise<{
    isRisky: boolean;
    reason?: string;
    shouldBlacklist?: boolean;
  }> => {
    try {
      // 1. 24h stats çek
      const stats = await fetch24hStats(symbol);
      if (!stats) {
        return { isRisky: false };
      }

      // 2. Volume kontrolü
      if (stats.quoteVolume < SYSTEM_CONFIG.MANIPULATION.MIN_24H_VOLUME) {
        console.warn(`[Manipulation] ⚠️ ${symbol} - Low volume: $${(stats.quoteVolume / 1000000).toFixed(2)}M`);
        return {
          isRisky: true,
          reason: `Low 24h volume ($${(stats.quoteVolume / 1000000).toFixed(2)}M < $5M)`,
          shouldBlacklist: true
        };
      }

      // 3. Volatility range kontrolü
      const range = ((stats.high - stats.low) / stats.low) * 100;
      if (range > SYSTEM_CONFIG.MANIPULATION.MAX_VOLATILITY_RANGE) {
        console.warn(`[Manipulation] ⚠️ ${symbol} - Extreme volatility: ${range.toFixed(2)}%`);
        return {
          isRisky: true,
          reason: `Extreme volatility (${range.toFixed(1)}% > 10%)`,
          shouldBlacklist: true
        };
      }

      // 4. Pump frequency kontrolü
      const tracker = pumpTrackerRef.current[symbol];
      if (tracker) {
        const currentHour = Math.floor(Date.now() / 3600000);
        
        // Saat değişti mi?
        if (tracker.lastPumpHour !== currentHour) {
          tracker.pumpCount = 0;
          tracker.lastPumpHour = currentHour;
        }
        
        if (tracker.pumpCount >= SYSTEM_CONFIG.MANIPULATION.MAX_PUMP_FREQUENCY) {
          console.warn(`[Manipulation] ⚠️ ${symbol} - Too many pumps: ${tracker.pumpCount}/hour`);
          return {
            isRisky: true,
            reason: `Excessive pump frequency (${tracker.pumpCount} pumps/hour)`,
            shouldBlacklist: false // Geçici engel, blacklist'e ekleme
          };
        }
      }

      // Tüm kontroller OK
      return { isRisky: false };
      
    } catch (error) {
      console.error(`[Manipulation] ❌ Error checking ${symbol}:`, error);
      return { isRisky: false };
    }
  }, []);

  const fetchCandidateData = useCallback(async (symbol: string): Promise<CandidateData | null> => {
    if (fetchingSymbolsRef.current.has(symbol)) return null;
    
    const cached = candidateDataRef.current[symbol];
    if (cached && Date.now() - cached.fetchedAt < SYSTEM_CONFIG.API.CACHE_DURATION_MS) {
      return cached;
    }

    fetchingSymbolsRef.current.add(symbol);
    
    try {
      console.log(`[Hybrid] 🔍 Fetching detailed data for ${symbol}...`);
      const data = await fetchAllData(symbol);
      
      if (!data.isValid || data.klines5m.length < 10) {
        console.warn(`[Hybrid] ⚠️ ${symbol} - Insufficient data`);
        return null;
      }
      
      // Support/Resistance hesaplama
      const closes = data.klines5m.map((k: any) => k.close);
      const support = Math.min(...closes.slice(-10));
      const resistance = Math.max(...closes.slice(-10));
      
      // Trade analizi
      const totalTradeSize = data.recentTrades.reduce((sum: number, t: any) => sum + t.quoteQty, 0);
      const avgTradeSize = totalTradeSize / (data.recentTrades.length || 1);
      
      let buyVolume = 0, sellVolume = 0;
      data.recentTrades.forEach((t: any) => {
        if (t.isBuyerMaker) sellVolume += t.quoteQty;
        else buyVolume += t.quoteQty;
      });
      const buyPressure = buyVolume / (buyVolume + sellVolume || 1);
      
      // Large order count
      const largeOrderCount = data.recentTrades.filter(
        (t: any) => t.quoteQty > avgTradeSize * SYSTEM_CONFIG.WHALE.LARGE_TRADE_MULTIPLIER
      ).length;

      const candidateData: CandidateData = {
        symbol,
        fetchedAt: Date.now(),
        klines1m: data.klines1m,
        klines5m: data.klines5m,
        recentTrades: data.recentTrades,
        openInterest: data.openInterest,
        fundingRate: data.fundingRate,
        support,
        resistance,
        avgTradeSize,
        buyPressure,
        largeOrderCount
      };
      
      candidateDataRef.current[symbol] = candidateData;
      console.log(`[Hybrid] ✅ ${symbol} - S:${support.toFixed(6)} R:${resistance.toFixed(6)} BuyP:${(buyPressure*100).toFixed(1)}% LargeOrders:${largeOrderCount}`);
      
      return candidateData;
    } catch (error) {
      console.error(`[Hybrid] ❌ Failed to fetch ${symbol}:`, error);
      return null;
    } finally {
      fetchingSymbolsRef.current.delete(symbol);
    }
  }, []);

  // PUMP DETECTION
  const checkPumpStart = useCallback((
    symbol: string, 
    price: number, 
    tickVolume: number,
    priceChangePct: number
  ): { isPump: boolean; volumeRatio: number } => {
    const now = Date.now();
    const currentMinute = Math.floor(now / 60000);
    
    if (!pumpTrackerRef.current[symbol]) {
      const currentHour = Math.floor(now / 3600000);
      pumpTrackerRef.current[symbol] = {
        minuteVolumes: [],
        lastPumpAlert: 0,
        minuteStartVolume: 0,
        currentMinute,
        pumpCount: 0,            // 🔧 PHASE 2
        lastPumpHour: currentHour // 🔧 PHASE 2
      };
    }
    
    const tracker = pumpTrackerRef.current[symbol];
    
    if (tracker.currentMinute !== currentMinute) {
      tracker.minuteVolumes.push(tracker.minuteStartVolume);
      if (tracker.minuteVolumes.length > 20) tracker.minuteVolumes.shift();
      tracker.minuteStartVolume = 0;
      tracker.currentMinute = currentMinute;
    }
    
    tracker.minuteStartVolume += tickVolume;
    
    const priceCondition = Math.abs(priceChangePct) >= SYSTEM_CONFIG.PUMP.PRICE_CHANGE_MIN;
    let volumeCondition = false;
    let volumeRatio = 0;
    
    if (tracker.minuteVolumes.length >= 2) {
      const lastMinuteVolume = tracker.minuteVolumes[tracker.minuteVolumes.length - 1];
      const currentVolume = tracker.minuteStartVolume;
      
      const condition1 = currentVolume > lastMinuteVolume * SYSTEM_CONFIG.PUMP.VOLUME_RATIO_MIN;
      
      let condition2 = false;
      if (tracker.minuteVolumes.length >= 5) {
        const last5Avg = tracker.minuteVolumes.slice(-5).reduce((a,b) => a+b, 0) / 5;
        condition2 = currentVolume > last5Avg * SYSTEM_CONFIG.PUMP.VOLUME_RATIO_5M_AVG;
      }
      
      let condition3 = false;
      if (tracker.minuteVolumes.length >= 10) {
        const avg10 = tracker.minuteVolumes.slice(-10).reduce((a,b) => a+b, 0) / 10;
        condition3 = currentVolume > avg10 * SYSTEM_CONFIG.PUMP.VOLUME_RATIO_10M_AVG;
      }
      
      volumeCondition = condition1 || condition2 || condition3;
      volumeRatio = lastMinuteVolume > 0 ? currentVolume / lastMinuteVolume : 0;
    }
    
    const spamCheck = (now - tracker.lastPumpAlert) > SYSTEM_CONFIG.PUMP.COOLDOWN_MS; 
    const isPump = priceCondition && volumeCondition && spamCheck;
    
    if (isPump) {
      tracker.lastPumpAlert = now;
      
      // 🔧 PHASE 2: Pump count artır
      const currentHour = Math.floor(now / 3600000);
      if (tracker.lastPumpHour !== currentHour) {
        tracker.pumpCount = 0;
        tracker.lastPumpHour = currentHour;
      }
      tracker.pumpCount++;
      
      console.log(`[PUMP] 🔥 ${symbol}: price=${priceChangePct.toFixed(2)}%, volume=${volumeRatio.toFixed(2)}x (${tracker.pumpCount}/hour)`);
    }
    
    return { isPump, volumeRatio };
  }, []);

  // 🔧 FIX #5: TREND START - SIKLAŞTIRILMIŞ
  const checkTrendStart = useCallback((
    symbol: string,
    currentPrice: number,
    candleChangePct: number
  ): { isTrendStart: boolean; details: any } => {
    const candles = candleHistoryRef.current[symbol] || [];
    
    if (candles.length < SYSTEM_CONFIG.TREND.MIN_CANDLES) {
      return { isTrendStart: false, details: { reason: 'INSUFFICIENT_DATA', candleCount: candles.length } };
    }

    // 1. KONSOLİDASYON KONTROLÜ
    const last20Candles = candles.slice(-20);
    const closes = last20Candles.map(c => c.close);
    const priceRange = Math.max(...closes) - Math.min(...closes);
    const avgPrice = closes.reduce((a, b) => a + b) / closes.length;
    const rangePercent = (priceRange / avgPrice) * 100;
    
    const isConsolidating = rangePercent < SYSTEM_CONFIG.TREND.CONSOLIDATION_MAX;
    
    if (!isConsolidating) {
      return { isTrendStart: false, details: { reason: 'NO_CONSOLIDATION', range: rangePercent.toFixed(2) } };
    }

    // 2. BREAKOUT KONTROLÜ
    const isBreakout = Math.abs(candleChangePct) >= SYSTEM_CONFIG.TREND.BREAKOUT_MIN;
    
    if (!isBreakout) {
      return { isTrendStart: false, details: { reason: 'NO_BREAKOUT', change: candleChangePct.toFixed(2) } };
    }

    // 3. TREND TEYİT
    const last3Candles = candles.slice(-SYSTEM_CONFIG.TREND.TREND_CONFIRM_CANDLES - 1);
    const isBullish = candleChangePct > 0;
    const trendConfirmed = isBullish 
      ? last3Candles.every(c => c.close >= c.open * 0.999)
      : last3Candles.every(c => c.close <= c.open * 1.001);
    
    // 4. HACİM KONTROLÜ
    const pumpCheck = checkPumpStart(symbol, currentPrice, 0, candleChangePct);
    const hasVolumeSpike = pumpCheck.volumeRatio >= 1.5;

    // 5. CONTEXT
    let contextOK = true;
    if (candles.length >= 15) {
      const sma7 = candles.slice(-7).reduce((sum, c) => sum + c.close, 0) / 7;
      const sma15 = candles.slice(-15).reduce((sum, c) => sum + c.close, 0) / 15;
      
      if (isBullish && sma7 < sma15 * 0.98) contextOK = false;
      if (!isBullish && sma7 > sma15 * 1.02) contextOK = false;
    }

    // 🔧 FIX: EN AZ 2 KOŞUL GEREKLİ
    const conditions = [
      isBreakout,      // Her zaman var
      trendConfirmed,
      hasVolumeSpike,
      contextOK
    ];
    const meetsMinimum = conditions.filter(Boolean).length >= 2;
    const isTrendStart = isConsolidating && meetsMinimum;

    return { 
      isTrendStart, 
      details: {
        consolidationRange: rangePercent.toFixed(2),
        breakoutPercent: candleChangePct.toFixed(2),
        volumeRatio: pumpCheck.volumeRatio.toFixed(2),
        trendConfirmed,
        hasVolumeSpike,
        context: isBullish ? 'BULLISH' : 'BEARISH',
        contextOK,
        conditionsMet: conditions.filter(Boolean).length
      }
    };
  }, [checkPumpStart]);

  // 🔧 DEEP ANALYSIS: PUMP tespit edilen coinler için detaylı analiz
  const analyzePumpCandidate = useCallback(async (
    symbol: string,
    price: number,
    candleChangePct: number,
    volumeRatio: number,
    referencePrice: number,
    timestamp: number
  ): Promise<{ alert: TradingAlert } | null> => {
    try {
      console.log(`[ANALYSIS] 🔍 Analyzing ${symbol}...`);
      
      // 🔧 PHASE 2: Manipulation check (sadece WARNING)
      const manipulationCheck = await checkManipulationRisk(symbol);
      if (manipulationCheck.isRisky) {
        console.warn(`[ANALYSIS] ⚠️ ${symbol} - Manipulation warning: ${manipulationCheck.reason}`);
        // ⚠️ Sadece uyarı ver, alert'i engelleme!
        // İstersen manuel blacklist ekleyebilirsin
      }
      
      // 1. Detaylı veri çek
      const candidateData = await fetchCandidateData(symbol);
      if (!candidateData) {
        console.log(`[ANALYSIS] ❌ ${symbol} - No candidate data`);
        return null;
      }
      
      // 2. Whale score hesapla
      const whaleScore = calculateWhaleScore(candidateData);
      console.log(`[ANALYSIS] 🐋 ${symbol} Whale Score: ${whaleScore}/100`);
      
      // 3. Trend analizi yap (candidate data ile)
      const trendCheck = checkTrendStartWithData(candidateData, candleChangePct);
      console.log(`[ANALYSIS] 📊 ${symbol} Trend: ${trendCheck.isTrendStart ? 'YES' : 'NO'} (${trendCheck.details.conditionsMet}/4 conditions)`);
      
      // 4. Alert tipi ve autoTrade belirle
      let eliteType: TradingAlert['eliteType'];
      let reason: string;
      let autoTrade: boolean;
      
      // 🔧 FIX: Config'ten threshold'ları al (hardcoded değil!)
      if (whaleScore >= SYSTEM_CONFIG.WHALE.MIN_SCORE_WHALE) {
        eliteType = 'WHALE_ACCUMULATION';
        reason = '🐋 WHALE ACCUMULATION';
        autoTrade = config.whaleDetectionEnabled;
      } else if (whaleScore >= SYSTEM_CONFIG.WHALE.MIN_SCORE_INST) {
        eliteType = 'INSTITUTION_ENTRY';
        reason = '🏛️ INSTITUTIONAL ENTRY';
        autoTrade = config.whaleDetectionEnabled;
      } else if (trendCheck.isTrendStart && whaleScore >= SYSTEM_CONFIG.WHALE.MIN_SCORE_TREND) {
        eliteType = 'TREND_START';
        reason = '🚀 TREND START';
        autoTrade = true;
      } else {
        eliteType = 'PUMP_START';
        reason = '🔥 PUMP DETECTED';
        autoTrade = false; // Manuel onay gerekli
      }
      
      console.log(`[ANALYSIS] ✅ ${symbol} → ${eliteType} (autoTrade: ${autoTrade}, score: ${whaleScore})`);
      
      // 🔧 FIX: UI direction check (alert oluşturmadan önce!)
      const alertSide: Side = candleChangePct > 0 ? 'LONG' : 'SHORT';
      const isDirectionAllowed = alertSide === 'LONG' ? config.longEnabled : config.shortEnabled;
      
      if (!isDirectionAllowed) {
        console.log(`[ANALYSIS] ⚠️ ${symbol} - ${alertSide} direction disabled in UI, skipping alert`);
        return null;
      }
      
      // 5. Alert oluştur
      const alert: TradingAlert = {
        id: `${eliteType?.toLowerCase()}-${symbol}-${timestamp}`,
        symbol,
        side: alertSide,
        reason,
        change: candleChangePct,
        price,
        previousPrice: referencePrice,
        timestamp,
        executed: false,
        isElite: true,
        eliteType,
        volumeMultiplier: volumeRatio,
        autoTrade,
        supportLevel: candidateData.support,
        resistanceLevel: candidateData.resistance,
        whaleDetails: {
          score: whaleScore,
          largeOrders: candidateData.largeOrderCount,
          orderBookImbalance: 0, // TODO: Order book entegrasyonu
          volatilitySpike: true,
          supportLevel: candidateData.support,
          resistanceLevel: candidateData.resistance,
          description: `Buy: ${(candidateData.buyPressure*100).toFixed(1)}% | Large Orders: ${candidateData.largeOrderCount} | Avg Size: $${candidateData.avgTradeSize.toFixed(0)}`
        },
        trendDetails: trendCheck.isTrendStart ? {
          consolidationRange: trendCheck.details.consolidationRange,
          breakoutPercent: trendCheck.details.breakoutPercent,
          volumeRatio: trendCheck.details.volumeRatio,
          trendConfirmed: trendCheck.details.trendConfirmed,
          context: trendCheck.details.context,
          conditionsMet: trendCheck.details.conditionsMet
        } : undefined
      };
      
      return { alert };
    } catch (error) {
      console.error(`[ANALYSIS] ❌ ${symbol} analysis failed:`, error);
      return null;
    }
  }, [fetchCandidateData, calculateWhaleScore, config.whaleDetectionEnabled, config.longEnabled, config.shortEnabled]);

  // 🔧 TREND ANALYSIS (Candidate data ile)
  const checkTrendStartWithData = useCallback((
    candidateData: CandidateData,
    candleChangePct: number
  ): { isTrendStart: boolean; details: any } => {
    const candles = candidateData.klines5m;
    
    if (candles.length < SYSTEM_CONFIG.TREND.MIN_CANDLES) {
      return { isTrendStart: false, details: { reason: 'INSUFFICIENT_DATA', conditionsMet: 0 } };
    }

    // 1. KONSOLİDASYON
    const closes = candles.map(k => k.close);
    const priceRange = Math.max(...closes) - Math.min(...closes);
    const avgPrice = closes.reduce((a, b) => a + b) / closes.length;
    const rangePercent = (priceRange / avgPrice) * 100;
    const isConsolidating = rangePercent < SYSTEM_CONFIG.TREND.CONSOLIDATION_MAX;
    
    // 2. BREAKOUT
    const isBreakout = Math.abs(candleChangePct) >= SYSTEM_CONFIG.TREND.BREAKOUT_MIN;
    
    // 3. TREND TEYİT
    const last3Candles = candles.slice(-3);
    const isBullish = candleChangePct > 0;
    const trendConfirmed = isBullish 
      ? last3Candles.every(c => c.close >= c.open * 0.999)
      : last3Candles.every(c => c.close <= c.open * 1.001);
    
    // 4. HACİM
    const hasVolumeSpike = candidateData.largeOrderCount >= 3;
    
    // 5. CONTEXT
    let contextOK = true;
    if (candles.length >= 15) {
      const sma7 = candles.slice(-7).reduce((sum, c) => sum + c.close, 0) / 7;
      const sma15 = candles.slice(-15).reduce((sum, c) => sum + c.close, 0) / 15;
      
      if (isBullish && sma7 < sma15 * 0.98) contextOK = false;
      if (!isBullish && sma7 > sma15 * 1.02) contextOK = false;
    }

    const conditions = [isBreakout, trendConfirmed, hasVolumeSpike, contextOK];
    const conditionsMet = conditions.filter(Boolean).length;
    const isTrendStart = isConsolidating && conditionsMet >= 2;

    return { 
      isTrendStart, 
      details: {
        consolidationRange: rangePercent.toFixed(2),
        breakoutPercent: candleChangePct.toFixed(2),
        volumeRatio: '0', // Placeholder
        trendConfirmed,
        hasVolumeSpike,
        context: isBullish ? 'BULLISH' : 'BEARISH',
        contextOK,
        conditionsMet
      }
    };
  }, []);

  // Ana WebSocket bağlantısı
  useEffect(() => {
    const ws = new WebSocket('wss://fstream.binance.com/ws/!ticker@arr');
    
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (!Array.isArray(data)) return;

      const now = Date.now();
      const currentMinute = Math.floor(now / 60000);
      const nextMarketData: Record<string, SymbolData> = {};
      const newAlertsFound: TradingAlert[] = [];
      const updatedTrends: Record<string, 'up' | 'down' | null> = {};

      data.forEach((item: any) => {
        const symbol = item.s;
        if (!symbol.endsWith('USDT')) return;
        
        const price = parseFloat(item.c);
        const currentQuoteVolume = parseFloat(item.q);
        
        // 🔧 FIX #2: TICK VOLUME HESAPLAMA
        const lastQuoteVolume = lastQuoteVolumeRef.current[symbol] || currentQuoteVolume;
        const tickVolume = Math.max(0, currentQuoteVolume - lastQuoteVolume);
        lastQuoteVolumeRef.current[symbol] = currentQuoteVolume;

        nextMarketData[symbol] = { 
          symbol, 
          price, 
          change24h: parseFloat(item.P), 
          volume: currentQuoteVolume 
        };

        // Rolling history (max 30)
        if (!rollingHistoryRef.current[symbol]) {
          rollingHistoryRef.current[symbol] = { prices: [], volumes: [] };
        }
        const hist = rollingHistoryRef.current[symbol];
        hist.prices.push(price);
        hist.volumes.push(currentQuoteVolume);
        if (hist.prices.length > 30) { 
          hist.prices.shift(); 
          hist.volumes.shift(); 
        }

        // 🔧 FIX #1: CANDLE TRACKING - DOĞRU MANTIK
        if (!minuteTicksRef.current[symbol]) {
          // İlk tick
          minuteTicksRef.current[symbol] = {
            open: price,
            high: price,
            low: price,
            close: price,
            volume: tickVolume,
            minute: currentMinute
          };
        } else if (minuteTicksRef.current[symbol].minute !== currentMinute) {
          // Dakika değişti - eski dakikayı kapat
          const completedCandle = minuteTicksRef.current[symbol];
          
          if (!candleHistoryRef.current[symbol]) {
            candleHistoryRef.current[symbol] = [];
          }
          
          candleHistoryRef.current[symbol].push(completedCandle);
          
          // Max 60 candle tut
          if (candleHistoryRef.current[symbol].length > 60) {
            candleHistoryRef.current[symbol].shift();
          }
          
          // Yeni dakika başlat
          minuteTicksRef.current[symbol] = {
            open: price,
            high: price,
            low: price,
            close: price,
            volume: tickVolume,
            minute: currentMinute
          };
        } else {
          // Aynı dakika içi - güncelle
          const tick = minuteTicksRef.current[symbol];
          tick.high = Math.max(tick.high, price);
          tick.low = Math.min(tick.low, price);
          tick.close = price;
          tick.volume += tickVolume;
        }

        // Şu anki dakikanın değişimi
        const currentCandle = minuteTicksRef.current[symbol];
        const candleChangePct = ((currentCandle.close - currentCandle.open) / currentCandle.open) * 100;
        const absChange = Math.abs(candleChangePct);

        if (isBlacklisted(symbol)) return;

        // 1. MOMENTUM - BASİT: Sadece %1+ fiyat (hacimden BAĞIMSIZ)
        if (absChange >= 1.0) {  // Hard-coded %1 (config'ten bağımsız)
          const cooldownPassed = !lastMomentumAlertRef.current[symbol] || 
            (now - lastMomentumAlertRef.current[symbol] > 10000); // 10 saniye cooldown
          
          if (cooldownPassed) {
            console.log(`[MOMENTUM] ⚡ ${symbol}: ${candleChangePct.toFixed(2)}% (ref: ${currentCandle.open.toFixed(6)})`);
            
            const momentumAlert: TradingAlert = { 
              id: `momentum-${symbol}-${now}`, 
              symbol, 
              side: candleChangePct > 0 ? 'LONG' : 'SHORT',
              reason: 'PULSE MOMENTUM',
              change: candleChangePct, 
              price, 
              previousPrice: currentCandle.open, // Referans: son mumun open
              timestamp: now, 
              executed: false,
              isElite: false,  // Momentum elite değil
              volumeMultiplier: 1,
              autoTrade: false  // Momentum otomatik trade açmaz
            };
            
            newAlertsFound.push(momentumAlert);
            lastMomentumAlertRef.current[symbol] = now;
          }
        }

        // 2. PUMP TESPİTİ → DEEP ANALYSIS (ADAY belirleme)
        if (config.pumpDetectionEnabled) {
          const pumpCheck = checkPumpStart(symbol, price, tickVolume, candleChangePct);
          
          if (pumpCheck.isPump) {
            const pumpCooldownPassed = !lastPumpAlertRef.current[symbol] || 
              (now - lastPumpAlertRef.current[symbol] > SYSTEM_CONFIG.PUMP.COOLDOWN_MS);
            
            if (pumpCooldownPassed) {
              console.log(`[PUMP] 🔥 ${symbol} DETECTED → Starting deep analysis...`);
              
              lastPumpAlertRef.current[symbol] = now;
              
              // 🔧 ASYNC DEEP ANALYSIS (arka planda çalışır)
              analyzePumpCandidate(
                symbol, 
                price, 
                candleChangePct, 
                pumpCheck.volumeRatio,
                currentCandle.open,
                now
              ).then(analysisResult => {
                if (analysisResult) {
                  // Alert oluştur
                  setAlerts(prev => [analysisResult.alert, ...prev].slice(0, MAX_ALERTS));
                  
                  // Trend animasyonu
                  setTempTrends(p => ({...p, [symbol]: candleChangePct > 0 ? 'up' : 'down'}));
                  if (trendTimeoutsRef.current[symbol]) clearTimeout(trendTimeoutsRef.current[symbol]);
                  trendTimeoutsRef.current[symbol] = setTimeout(() => 
                    setTempTrends(p => ({...p, [symbol]: null})), 
                    SYSTEM_CONFIG.ALERTS.TREND_HIGHLIGHT_DURATION
                  );
                }
              });
            }
          }
        }

        // 3. TREND START - KALDIRILDI
        // Artık sadece PUMP tespit edilen coinler için trend analizi yapılıyor
        // analyzePumpCandidate() fonksiyonunda kontrol ediliyor
      });
      
      setMarketData(prev => ({ ...prev, ...nextMarketData }));
      if (Object.keys(updatedTrends).length > 0) setTempTrends(p => ({...p, ...updatedTrends}));
      if (newAlertsFound.length > 0) setAlerts(prev => [...newAlertsFound, ...prev].slice(0, MAX_ALERTS));
    };
    
    ws.onerror = (error) => console.error('[WebSocket] Error:', error);
    ws.onclose = () => console.log('[WebSocket] Disconnected');
    
    return () => ws.close();
  }, [
    isBlacklisted, 
    config.pumpDetectionEnabled,
    config.whaleDetectionEnabled,
    checkPumpStart, 
    analyzePumpCandidate
  ]);

  const closeTrade = useCallback((pos: Position, currentPrice: number, reason: string) => {
    const isLong = pos.side === 'LONG';
    const priceDiff = isLong ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
    const pnlAtExit = priceDiff * pos.quantity;
    const closingFee = (pos.quantity * currentPrice) * FEE_RATE;
    const finalPnl = pnlAtExit - closingFee;
    
    // 🔧 DEBUG LOG
    const remainingMargin = pos.margin * (pos.quantity / pos.initialQuantity);
    const netChange = remainingMargin + finalPnl;
    console.log(`[CloseTrade] 💰 ${pos.symbol} ${reason}:`, {
      side: pos.side,
      entry: pos.entryPrice.toFixed(6),
      exit: currentPrice.toFixed(6),
      priceDiff: priceDiff.toFixed(6),
      quantity: pos.quantity.toFixed(4),
      pnlBeforeFee: pnlAtExit.toFixed(2),
      closingFee: closingFee.toFixed(2),
      finalPnl: finalPnl.toFixed(2),
      remainingMargin: remainingMargin.toFixed(2),
      netBalanceChange: netChange.toFixed(2),
      currentBalance: account.balance.toFixed(2),
      newBalance: (account.balance + netChange).toFixed(2)
    });
    
    const historyItem: TradeHistoryItem = {
      id: pos.id, symbol: pos.symbol, side: pos.side, leverage: pos.leverage, quantity: pos.quantity,
      entryPrice: pos.entryPrice, exitPrice: currentPrice, stopLoss: pos.stopLoss, tp1: pos.tp1, tp2: pos.tp2,
      pnl: finalPnl, pnlPercent: (finalPnl / pos.margin) * 100, maxPnlPercent: pos.maxPnlPercent,
      timestamp: pos.timestamp, closedAt: Date.now(), duration: Date.now() - pos.timestamp,
      balanceAfter: account.balance + (pos.margin * (pos.quantity / pos.initialQuantity)) + finalPnl, 
      reason, 
      efficiency: finalPnl > 0 ? 'PERFECT' : 'LOSS', 
      details: reason,
      totalFees: pos.fees + closingFee, 
      minPriceDuringTrade: pos.minPrice, 
      maxPriceDuringTrade: pos.maxPrice,
      initialMargin: pos.margin, 
      source: pos.source,
      alertType: pos.alertType  // 🔧 Alert type'ı ekle
    };
    
    return { 
      netBalanceChange: (pos.margin * (pos.quantity / pos.initialQuantity)) + finalPnl, 
      historyItem 
    };
  }, [account.balance]);

  // 🔧 FIX #6: POSITION MANAGEMENT - Optimized
  useEffect(() => {
    if (positions.length === 0) return;
    
    const interval = setInterval(() => {
      let needsStateUpdate = false;
      let balanceAdjustment = 0;
      let newHistory: TradeHistoryItem[] = [];
      
      const nextPositions = positions.map(pos => {
        const market = marketData[pos.symbol];
        if (!market) return pos;
        
        const currentPrice = market.price;
        const isLong = pos.side === 'LONG';
        
        // Hızlı check: Kritik seviyeler yakın mı?
        const nearSL = Math.abs((currentPrice - pos.stopLoss) / pos.stopLoss) < 0.01;
        const nearTP1 = !pos.tp1Hit && Math.abs((currentPrice - pos.tp1) / pos.tp1) < 0.01;
        const nearTP2 = pos.tp1Hit && !pos.tp2Hit && Math.abs((currentPrice - pos.tp2) / pos.tp2) < 0.01;
        
        // Kritik seviyelerden uzaksa ve trailing aktif değilse skip
        if (!nearSL && !nearTP1 && !nearTP2 && !pos.trailingStopActive) {
          // Sadece min/max price güncelle
          const nextMax = Math.max(pos.maxPrice, currentPrice);
          const nextMin = Math.min(pos.minPrice, currentPrice);
          if (nextMax !== pos.maxPrice || nextMin !== pos.minPrice) {
            needsStateUpdate = true;
            return { ...pos, maxPrice: nextMax, minPrice: nextMin };
          }
          return pos;
        }
        
        // SL kontrolü
        const slHit = isLong ? currentPrice <= pos.stopLoss : currentPrice >= pos.stopLoss;
        if (slHit) {
          const reason = pos.trailingStopActive ? 'TRAILING SL' : (pos.tp1Hit ? 'SL (BE)' : 'STOP LOSS');
          const { netBalanceChange, historyItem } = closeTrade(pos, currentPrice, reason);
          balanceAdjustment += netBalanceChange;
          newHistory.push(historyItem);
          needsStateUpdate = true;
          return null;
        }

        // TP1 kontrolü
        const tp1Reached = isLong ? currentPrice >= pos.tp1 : currentPrice <= pos.tp1;
        if (tp1Reached && !pos.tp1Hit) {
          const closeQuantity = pos.initialQuantity * 0.40;
          const keepQuantity = pos.quantity - closeQuantity;
          const priceDiff = isLong ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
          const netPnl = (priceDiff * closeQuantity) - ((closeQuantity * currentPrice) * FEE_RATE);
          
          balanceAdjustment += netPnl;
          newHistory.push({
            ...pos, 
            id: `${pos.id}-tp1`, 
            quantity: closeQuantity, 
            exitPrice: currentPrice,
            pnl: netPnl, 
            pnlPercent: (netPnl / (pos.margin * 0.4)) * 100, 
            closedAt: Date.now(),
            reason: 'TP1 (40%)', 
            balanceAfter: account.balance + balanceAdjustment, 
            efficiency: 'PARTIAL',
            details: 'TP1 hit. 40% closed. SL → Entry.'
          } as any);

          needsStateUpdate = true;
          return { 
            ...pos, 
            tp1Hit: true, 
            quantity: keepQuantity, 
            stopLoss: pos.entryPrice,
            partialCloses: { ...pos.partialCloses, tp1: closeQuantity } 
          };
        }

        // TP2 kontrolü
        const tp2Reached = isLong ? currentPrice >= pos.tp2 : currentPrice <= pos.tp2;
        if (tp2Reached && pos.tp1Hit && !pos.tp2Hit) {
          const closeQuantity = pos.quantity * 0.50;
          const keepQuantity = pos.quantity - closeQuantity;
          const priceDiff = isLong ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
          const netPnl = (priceDiff * closeQuantity) - ((closeQuantity * currentPrice) * FEE_RATE);

          balanceAdjustment += netPnl;
          newHistory.push({
            ...pos, 
            id: `${pos.id}-tp2`, 
            quantity: closeQuantity, 
            exitPrice: currentPrice,
            pnl: netPnl, 
            pnlPercent: (netPnl / (pos.margin * 0.3)) * 100, 
            closedAt: Date.now(),
            reason: 'TP2 (30%)', 
            balanceAfter: account.balance + balanceAdjustment, 
            efficiency: 'PARTIAL',
            details: 'TP2 hit. 30% closed. Trailing active.'
          } as any);

          needsStateUpdate = true;
          return { 
            ...pos, 
            tp2Hit: true, 
            trailingStopActive: true, 
            quantity: keepQuantity, 
            stopLoss: pos.tp1,
            partialCloses: { ...pos.partialCloses, tp2: closeQuantity } 
          };
        }

        // Trailing SL güncelleme
        let updatedPos = { ...pos };
        if (pos.trailingStopActive) {
          const newMax = Math.max(pos.maxPrice, currentPrice);
          const newMin = Math.min(pos.minPrice, currentPrice);
          let newTrailingSL = pos.stopLoss;
          
          if (isLong) {
            const calcSL = newMax * (1 - SYSTEM_CONFIG.TRADING.TRAILING_SL_PERCENT / 100);
            if (calcSL > pos.stopLoss) newTrailingSL = calcSL;
          } else {
            const calcSL = newMin * (1 + SYSTEM_CONFIG.TRADING.TRAILING_SL_PERCENT / 100);
            if (calcSL < pos.stopLoss) newTrailingSL = calcSL;
          }
          
          if (newTrailingSL !== pos.stopLoss || newMax !== pos.maxPrice || newMin !== pos.minPrice) {
            updatedPos = { ...updatedPos, stopLoss: newTrailingSL, maxPrice: newMax, minPrice: newMin };
            needsStateUpdate = true;
          }
        } else {
          // Min/max update
          const nextMax = Math.max(pos.maxPrice, currentPrice);
          const nextMin = Math.min(pos.minPrice, currentPrice);
          if (nextMax !== pos.maxPrice || nextMin !== pos.minPrice) {
            updatedPos = { ...updatedPos, maxPrice: nextMax, minPrice: nextMin };
            needsStateUpdate = true;
          }
        }
        
        return updatedPos;
      }).filter(p => p !== null) as Position[];

      if (needsStateUpdate) {
        if (balanceAdjustment !== 0) {
          setAccount(prev => ({ ...prev, balance: prev.balance + balanceAdjustment }));
        }
        if (newHistory.length > 0) {
          setTradeHistory(prev => [...newHistory, ...prev].slice(0, MAX_HISTORY));
        }
        setPositions(nextPositions);
      }
    }, 1000);
    
    return () => clearInterval(interval);
  }, [positions, marketData, closeTrade, account.balance]);

  // Auto trade processing
  useEffect(() => {
    if (!config.autoTrading || alerts.length === 0) return;
    
    const unProcessedAlerts = alerts.filter(a => !processedAlertIds.current.has(a.id));
    if (unProcessedAlerts.length === 0) return;
    
    let tempBalance = account.balance;
    let tempPositions = [...positions];
    let addedAny = false;
    
    for (const alert of unProcessedAlerts) {
      // 🔧 DEBUG LOG
      console.log(`[AutoTrade] 🔍 Checking ${alert.symbol} (${alert.eliteType})...`);
      
      if (tempPositions.length >= config.maxConcurrentTrades) {
        console.log(`[AutoTrade] ⚠️ ${alert.symbol} - Max trades reached (${config.maxConcurrentTrades})`);
        break;
      }
      
      if (tempPositions.some(p => p.symbol === alert.symbol)) { 
        console.log(`[AutoTrade] ⚠️ ${alert.symbol} - Position already exists`);
        processedAlertIds.current.add(alert.id); 
        continue; 
      }
      
      const isDirectionEnabled = alert.side === 'LONG' ? config.longEnabled : config.shortEnabled;
      const isEliteCheckPassed = config.eliteMode ? alert.isElite : true;
      const isAutoTradeAlert = alert.autoTrade !== false;

      // 🔧 DEBUG LOG
      console.log(`[AutoTrade] 📊 ${alert.symbol} checks:`, {
        direction: isDirectionEnabled ? '✅' : '❌',
        elite: isEliteCheckPassed ? '✅' : '❌',
        autoTrade: isAutoTradeAlert ? '✅' : '❌',
        side: alert.side,
        isElite: alert.isElite,
        autoTradeFlag: alert.autoTrade
      });

      if (isDirectionEnabled && isEliteCheckPassed && isAutoTradeAlert) {
        processedAlertIds.current.add(alert.id);
        
        const riskUSD = tempBalance * (config.riskPerTrade / 100);
        const slDist = alert.price * (config.stopLossPercent / 100);
        const quantity = riskUSD / slDist;
        const margin = (quantity * alert.price) / config.leverage;
        const fee = (quantity * alert.price) * FEE_RATE;
        
        if (margin + fee <= tempBalance) {
          // Dynamic SL kullan (eğer varsa)
          let finalSL = alert.side === 'LONG' 
            ? alert.price - slDist 
            : alert.price + slDist;
          
          if (config.useDynamicStopLoss && alert.supportLevel && alert.resistanceLevel) {
            if (alert.side === 'LONG' && alert.supportLevel < alert.price) {
              finalSL = alert.supportLevel * 0.998; // Support'un %0.2 altı
            } else if (alert.side === 'SHORT' && alert.resistanceLevel > alert.price) {
              finalSL = alert.resistanceLevel * 1.002; // Resistance'ın %0.2 üstü
            }
          }
          
          const newPos: Position = {
            id: alert.id, 
            symbol: alert.symbol, 
            side: alert.side, 
            entryPrice: alert.price,
            quantity, 
            leverage: config.leverage, 
            margin, 
            fees: fee,
            stopLoss: finalSL,
            tp1: alert.side === 'LONG' 
              ? alert.price * (1 + config.tp1Percent / 100) 
              : alert.price * (1 - config.tp1Percent / 100),
            tp2: alert.side === 'LONG' 
              ? alert.price * (1 + config.tp2Percent / 100) 
              : alert.price * (1 - config.tp2Percent / 100),
            tp1Hit: false, 
            tp2Hit: false, 
            trailingStopActive: false, 
            initialQuantity: quantity, 
            partialCloses: { tp1: 0, tp2: 0 },
            pnl: 0, 
            pnlPercent: 0, 
            maxPnlPercent: 0, 
            timestamp: Date.now(),
            minPrice: alert.price, 
            maxPrice: alert.price, 
            source: 'AUTO',
            alertType: alert.eliteType,
            supportLevel: alert.supportLevel,
            resistanceLevel: alert.resistanceLevel
          };
          
          // 🔧 DEBUG LOG
          console.log(`[AutoTrade] ✅ ${alert.symbol} - Opening position:`, {
            side: alert.side,
            entry: alert.price.toFixed(6),
            quantity: quantity.toFixed(4),
            margin: `$${margin.toFixed(2)}`,
            leverage: `${config.leverage}x`,
            sl: finalSL.toFixed(6),
            tp1: newPos.tp1.toFixed(6),
            tp2: newPos.tp2.toFixed(6)
          });
          
          tempPositions.push(newPos);
          tempBalance -= (margin + fee);
          addedAny = true;
        } else {
          console.log(`[AutoTrade] ⚠️ ${alert.symbol} - Insufficient balance (need: $${(margin + fee).toFixed(2)}, have: $${tempBalance.toFixed(2)})`);
        }
      } else {
        console.log(`[AutoTrade] ❌ ${alert.symbol} - Skipped (checks failed)`);
      }
    }
    
    if (addedAny) {
      setAccount(prev => ({ ...prev, balance: tempBalance }));
      setPositions(tempPositions);
      
      // localStorage'a kaydet
      try {
        localStorage.setItem(
          'processedAlerts', 
          JSON.stringify([...processedAlertIds.current].slice(-1000))
        );
      } catch (e) {
        console.warn('[Storage] Failed to save processed alerts:', e);
      }
    }
  }, [alerts, config, positions, account.balance]);

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
    let totalBalanceChange = 0;
    const history: TradeHistoryItem[] = [];
    
    positions.forEach(pos => {
      const price = marketData[pos.symbol]?.price || pos.entryPrice;
      const { netBalanceChange, historyItem } = closeTrade(pos, price, 'EMERGENCY STOP');
      totalBalanceChange += netBalanceChange;
      history.push(historyItem);
    });
    
    setPositions([]);
    setAccount(prev => ({ ...prev, balance: prev.balance + totalBalanceChange }));
    setTradeHistory(prev => [...history, ...prev].slice(0, MAX_HISTORY));
  }, [positions, marketData, closeTrade]);

  const openManualTrade = useCallback((params: any) => {
    let symbol = (params.symbol || '').toUpperCase().trim();
    if (!symbol) symbol = selectedSymbol;
    if (symbol && !symbol.endsWith('USDT')) symbol += 'USDT';
    
    const market = marketData[symbol];
    if (!market) return;
    
    const entryPrice = market.price;
    const riskValue = params.riskValue || config.riskPerTrade;
    const leverage = params.leverage || config.leverage;
    const slPct = params.sl || config.stopLossPercent;
    const slDist = entryPrice * (slPct / 100);
    const riskUSD = account.balance * (riskValue / 100);
    const quantity = riskUSD / slDist;
    const margin = (quantity * entryPrice) / leverage;
    const fee = (quantity * entryPrice) * FEE_RATE;
    
    if (margin + fee > account.balance) return;
    
    const newPos: Position = {
      id: `man-${Date.now()}`, 
      symbol, 
      side: params.side, 
      entryPrice, 
      quantity, 
      leverage, 
      margin, 
      fees: fee,
      stopLoss: params.side === 'LONG' ? entryPrice - slDist : entryPrice + slDist,
      tp1: params.side === 'LONG' 
        ? entryPrice * (1 + params.tp1 / 100) 
        : entryPrice * (1 - params.tp1 / 100),
      tp2: params.side === 'LONG' 
        ? entryPrice * (1 + params.tp2 / 100) 
        : entryPrice * (1 - params.tp2 / 100),
      tp1Hit: false, 
      tp2Hit: false, 
      trailingStopActive: false, 
      initialQuantity: quantity, 
      partialCloses: { tp1: 0, tp2: 0 },
      pnl: 0, 
      pnlPercent: 0, 
      maxPnlPercent: 0, 
      timestamp: Date.now(), 
      minPrice: entryPrice, 
      maxPrice: entryPrice, 
      source: 'MANUAL'
    };
    
    setPositions(prev => [...prev, newPos]);
    setAccount(prev => ({ ...prev, balance: prev.balance - margin - fee }));
    setSelectedSymbol(symbol);
  }, [marketData, account.balance, selectedSymbol, config]);

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
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [handleMouseMove]);

  return (
    <div className="flex flex-col h-screen w-full bg-[#0b0e11] text-[#eaecef] overflow-hidden font-sans">
      <div className="flex-1 flex overflow-hidden">
        <div className={`shrink-0 relative border-r border-[#2b3139] ${mobileTab === 'market' ? 'flex flex-1' : 'hidden lg:flex'}`} style={window.innerWidth >= 1024 ? { width: `${leftWidth}px` } : {}}>
          <MarketOverview data={marketData} selected={selectedSymbol} onSelect={(s) => { setSelectedSymbol(s); if(window.innerWidth < 1024) setMobileTab('chart'); }} trends={tempTrends} />
          <div className="hidden lg:block absolute right-[-2px] top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#fcd535]/50 z-50 transition-colors" onMouseDown={() => { isResizing.current = 'left'; document.body.style.cursor = 'col-resize'; }}></div>
        </div>
        
        <div className={`flex-1 min-0 flex-col ${mobileTab === 'chart' || mobileTab === 'positions' ? 'flex' : 'hidden lg:flex'}`}>
          <div className={`flex-1 relative bg-black border-b border-[#2b3139] ${mobileTab === 'positions' ? 'hidden lg:block' : 'block'}`}>
            <TradingChart key={selectedSymbol} symbol={selectedSymbol} />
          </div>
          <div className="hidden lg:block h-1 cursor-row-resize hover:bg-[#fcd535]/50 z-50 transition-colors bg-[#2b3139]/30" onMouseDown={() => { isResizing.current = 'bottom'; document.body.style.cursor = 'row-resize'; }}></div>
          <div className={`overflow-hidden shrink-0 ${mobileTab === 'chart' ? 'hidden lg:block' : 'block flex-1'}`} style={window.innerWidth >= 1024 ? { height: `${bottomHeight}px` } : {}}>
            <PositionsPanel positions={positions} history={tradeHistory} onManualClose={handleManualClose} marketData={marketData} onSelectSymbol={(s) => { setSelectedSymbol(s); if(window.innerWidth < 1024) setMobileTab('chart'); }} />
          </div>
        </div>
        
        <div className={`bg-[#0b0e11] border-l border-[#2b3139] flex-col shrink-0 relative ${mobileTab === 'alerts' ? 'flex flex-1' : 'hidden lg:flex'}`} style={window.innerWidth >= 1024 ? { width: `${rightWidth1}px` } : {}}>
          <div className="hidden lg:block absolute left-[-2px] top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#fcd535]/50 z-50 transition-colors" onMouseDown={() => { isResizing.current = 'right1'; document.body.style.cursor = 'col-resize'; }}></div>
          <AlertsPanel 
            alerts={alerts} 
            onSelect={(s) => { setSelectedSymbol(s); if(window.innerWidth < 1024) setMobileTab('chart'); }} 
            activePositions={positions} 
            marketData={marketData} 
            eliteMode={config.eliteMode}
            onQuickTrade={(a) => openManualTrade({ 
              symbol: a.symbol, 
              side: a.side, 
              leverage: config.leverage, 
              riskValue: config.riskPerTrade, 
              sl: config.stopLossPercent, 
              tp1: config.tp1Percent, 
              tp2: config.tp2Percent 
            })} 
          />
        </div>
        
        <div className={`shrink-0 border-l border-[#2b3139] p-4 bg-[#0b0e11] overflow-y-auto custom-scrollbar relative ${mobileTab === 'controls' ? 'block flex-1' : 'hidden lg:block'}`} style={window.innerWidth >= 1024 ? { width: `${rightWidth2}px` } : {}}>
          <div className="hidden lg:block absolute left-[-2px] top-0 bottom-0 w-1 cursor-col-resize hover:bg-[#fcd535]/50 z-50 transition-colors" onMouseDown={() => { isResizing.current = 'right2'; document.body.style.cursor = 'col-resize'; }}></div>
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
        ].map((t) => (
          <button 
            key={t.id} 
            onClick={() => setMobileTab(t.id as MobileTab)} 
            className={`flex flex-col items-center justify-center gap-1 transition-all ${mobileTab === t.id ? 'text-[#fcd535] scale-110' : 'text-[#848e9c]'}`}
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