export type Side = 'LONG' | 'SHORT';

export interface SymbolData {
  symbol: string;
  price: number;
  open1m?: number;
  change1m?: number;
  change24h: number; 
  volume: number;    
}

export interface Position {
  id: string;
  symbol: string;
  side: Side;
  entryPrice: number;
  quantity: number;
  leverage: number;
  stopLoss: number;
  tp1: number;
  tp2: number;
  tp1Hit: boolean;
  tp2Hit: boolean;
  trailingStopActive: boolean;
  initialQuantity: number;
  partialCloses: { tp1: number; tp2: number };
  pnl: number;
  pnlPercent: number;
  maxPnlPercent: number; 
  timestamp: number;
  margin: number;
  fees: number;
  minPrice: number; 
  maxPrice: number;
  highestPrice?: number;   // 🔧 YENİ: Trailing için en yüksek fiyat tracking
  source: 'AUTO' | 'MANUAL';
  alertType?: string;
  dynamicSLBase?: number;
  supportLevel?: number;
  resistanceLevel?: number;
}

export interface TradeHistoryItem {
  id: string; symbol: string; side: Side; leverage: number; quantity: number;
  entryPrice: number; exitPrice: number; stopLoss: number; tp1: number; tp2: number;
  pnl: number; pnlPercent: number; maxPnlPercent: number; timestamp: number; closedAt: number;
  duration: number; balanceAfter: number; reason: string; efficiency: 'PERFECT' | 'PARTIAL' | 'LOSS' | 'BE';
  details: string; totalFees: number; minPriceDuringTrade: number; maxPriceDuringTrade: number;
  initialMargin: number; source: 'AUTO' | 'MANUAL'; alertType?: string;
}

export interface TradingAlert {
  id: string; symbol: string; side: Side; reason: string; price: number; previousPrice: number;
  change: number; timestamp: number; executed: boolean; insight?: string; isElite?: boolean;
  eliteType?: 'STAIRCASE' | 'INSTITUTIONAL' | 'PARABOLIC' | 'PUMP_START' | 'TREND_START' | 
              'WHALE_ACCUMULATION' | 'INSTITUTION_ENTRY' | 'SMART_MONEY_FLOW';
  volumeMultiplier?: number; autoTrade?: boolean;
  supportLevel?: number; resistanceLevel?: number;  // 🔧 YENİ: S/R levels
  trendDetails?: { consolidationRange?: string; breakoutPercent?: string; volumeRatio?: string; trendConfirmed?: boolean; context?: string; conditionsMet?: number };
  whaleDetails?: { score: number; largeOrders: number; orderBookImbalance: number; volatilitySpike: boolean; 
                   supportLevel?: number; resistanceLevel?: number; description: string };
}

export interface StrategyConfig {
  autoTrading: boolean; eliteMode: boolean; pumpDetectionEnabled: boolean; whaleDetectionEnabled: boolean;
  longEnabled: boolean; shortEnabled: boolean; leverage: number; riskPerTrade: number; priceChangeThreshold: number;
  stopLossPercent: number; tp1Percent: number; tp2Percent: number; cooldownMinutes: number; maxConcurrentTrades: number;
  blacklist: string[]; whaleMinScore: number; useDynamicStopLoss: boolean; ringEnabled: boolean;
  tp3Enabled?: boolean; trailingPercent?: number; tp1ClosePercent?: number; tp2ClosePercent?: number; // 🔧 YENİ: 3-stage exit
}

export interface AccountState {
  balance: number; equity: number; dailyLoss: number; lastTradeTimestamp: number; initialBalance: number;
}

// HİBRİT SİSTEM TİPLERİ
export interface Kline {
  openTime: number; open: number; high: number; low: number; close: number;
  volume: number; closeTime: number; quoteVolume: number; trades: number;
}

export interface RecentTrade {
  id: number; price: number; qty: number; quoteQty: number; time: number; isBuyerMaker: boolean;
}

export interface ActiveTrack {
  symbol: string; startTime: number;
  pumpData: { price: number; change: number; volumeRatio: number; side: Side };
  baseline: { price: number; volume: number; openInterest?: number; fundingRate?: number };
  klines: { m1: Kline[]; m5: Kline[]; m15: Kline[] };
  recentTrades: RecentTrade[];
  sr: { support: number; resistance: number; pivots: Array<{ price: number; type: 'support' | 'resistance'; strength: number }> };
  streams: { aggTrade?: WebSocket; bookTicker?: WebSocket };
  score: { whale: number; trend: number; momentum: number };
  conditions: { consolidation: boolean; breakout: boolean; volumeConfirm: boolean; trendAlignment: boolean;
                largeOrders: boolean; imbalance: boolean; supportResistance: boolean; volatilitySpike: boolean };
  tradeData: { avgSize: number; largeTradeCount: number; buyPressure: number; sellPressure: number; recentLargeSize: number };
  orderBook: { bidQty: number; askQty: number; imbalance: number; lastUpdate: number };
  alerts: { whaleGenerated: boolean; trendGenerated: boolean };
  stage: 'INITIALIZING' | 'FETCHING_DATA' | 'STREAMING' | 'ANALYZING' | 'TRACKING' | 'ALERT_READY' | 'COMPLETED' | 'EXPIRED';
  stageHistory: Array<{ stage: string; timestamp: number; data?: any }>;
  lastUpdate: number;
}

// Binance API types
export interface BinanceKlineResponse {
  openTime: number; open: string; high: string; low: string; close: string; volume: string;
  closeTime: number; quoteVolume: string; trades: number; takerBuyBaseVolume: string;
  takerBuyQuoteVolume: string; ignore: string;
}

export interface BinanceTradeResponse {
  id: number; price: string; qty: string; quoteQty: string; time: number; isBuyerMaker: boolean; isBestMatch: boolean;
}

export interface BinanceOIResponse { symbol: string; openInterest: string; time: number; }
export interface BinanceFundingResponse { symbol: string; markPrice: string; indexPrice: string; lastFundingRate: string; time: number; }