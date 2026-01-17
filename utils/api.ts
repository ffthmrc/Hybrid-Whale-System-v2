// Binance API Response Types
interface Kline {
  openTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  closeTime: number;
  quoteVolume: number;
  trades: number;
}

interface RecentTrade {
  id: number;
  price: number;
  qty: number;
  quoteQty: number;
  time: number;
  isBuyerMaker: boolean;
}

interface BinanceTradeResponse {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
}

interface BinanceOIResponse {
  openInterest: string;
  symbol: string;
  time: number;
}

interface BinanceFundingResponse {
  symbol: string;
  markPrice: string;
  indexPrice: string;
  estimatedSettlePrice: string;
  lastFundingRate: string;
  nextFundingTime: number;
  interestRate: string;
  time: number;
}

// Proxy üzerinden Binance API'ye erişim (CORS sorunu yok)
const SPOT_API = '/binance-spot';      // -> https://api.binance.com
const FUTURES_API = '/binance-futures'; // -> https://fapi.binance.com

/**
 * Kline (mum) verilerini çeker
 * @param symbol - BTCUSDT, ETHUSDT vb.
 * @param interval - 1m, 5m, 15m, 1h vb.
 * @param limit - Kaç adet mum (max 1000)
 */
export async function fetchKlines(
  symbol: string,
  interval: '1m' | '5m' | '15m' | '1h',
  limit: number = 50
): Promise<Kline[]> {
  const startTime = Date.now();

  try {
    console.log(`[API] 📊 Fetching ${limit} ${interval} klines for ${symbol}...`);

    // Futures klines kullan (daha fazla veri)
    const url = `${FUTURES_API}/fapi/v1/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: number[][] = await response.json();

    const klines: Kline[] = data.map((k) => ({
      openTime: k[0],
      open: parseFloat(String(k[1])),
      high: parseFloat(String(k[2])),
      low: parseFloat(String(k[3])),
      close: parseFloat(String(k[4])),
      volume: parseFloat(String(k[5])),
      closeTime: k[6],
      quoteVolume: parseFloat(String(k[7])),
      trades: parseInt(String(k[8]))
    }));

    const duration = Date.now() - startTime;
    console.log(`[API] ✅ ${symbol} ${interval} klines fetched: ${klines.length} candles (${duration}ms)`);

    return klines;
  } catch (error) {
    console.error(`[API] ❌ Failed to fetch klines for ${symbol}:`, error);
    return [];
  }
}

/**
 * Son işlemleri çeker (recent trades)
 * @param symbol - BTCUSDT, ETHUSDT vb.
 * @param limit - Kaç adet trade (max 1000)
 */
export async function fetchRecentTrades(
  symbol: string,
  limit: number = 100
): Promise<RecentTrade[]> {
  const startTime = Date.now();

  try {
    console.log(`[API] 💰 Fetching ${limit} recent trades for ${symbol}...`);

    const url = `${FUTURES_API}/fapi/v1/trades?symbol=${symbol}&limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: BinanceTradeResponse[] = await response.json();

    const trades: RecentTrade[] = data.map((t) => ({
      id: t.id,
      price: parseFloat(t.price),
      qty: parseFloat(t.qty),
      quoteQty: parseFloat(t.quoteQty),
      time: t.time,
      isBuyerMaker: t.isBuyerMaker
    }));
    
    const duration = Date.now() - startTime;
    console.log(`[API] ✅ ${symbol} recent trades fetched: ${trades.length} trades (${duration}ms)`);

    return trades;
  } catch (error) {
    console.error(`[API] ❌ Failed to fetch recent trades for ${symbol}:`, error);
    return [];
  }
}

/**
 * Open Interest verilerini çeker
 * @param symbol - BTCUSDT, ETHUSDT vb.
 */
export async function fetchOpenInterest(
  symbol: string
): Promise<{ openInterest: number; time: number } | null> {
  try {
    console.log(`[API] 📈 Fetching Open Interest for ${symbol}...`);

    const url = `${FUTURES_API}/fapi/v1/openInterest?symbol=${symbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: BinanceOIResponse = await response.json();

    const result = {
      openInterest: parseFloat(data.openInterest),
      time: data.time
    };

    console.log(`[API] ✅ ${symbol} OI: ${result.openInterest.toFixed(2)}`);

    return result;
  } catch (error) {
    console.error(`[API] ❌ Failed to fetch Open Interest for ${symbol}:`, error);
    return null;
  }
}

/**
 * Funding Rate verilerini çeker
 * @param symbol - BTCUSDT, ETHUSDT vb.
 */
export async function fetchFundingRate(
  symbol: string
): Promise<{ fundingRate: number; nextFundingTime: number } | null> {
  try {
    console.log(`[API] 💸 Fetching Funding Rate for ${symbol}...`);

    const url = `${FUTURES_API}/fapi/v1/premiumIndex?symbol=${symbol}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data: BinanceFundingResponse = await response.json();

    const result = {
      fundingRate: parseFloat(data.lastFundingRate),
      nextFundingTime: data.nextFundingTime
    };

    const fundingPct = (result.fundingRate * 100).toFixed(4);
    console.log(`[API] ✅ ${symbol} Funding Rate: ${fundingPct}%`);

    return result;
  } catch (error) {
    console.error(`[API] ❌ Failed to fetch Funding Rate for ${symbol}:`, error);
    return null;
  }
}

/**
 * Aggregate trades - Büyük işlemleri tespit etmek için
 * @param symbol - BTCUSDT, ETHUSDT vb.
 * @param limit - Kaç adet trade (max 1000)
 */
export async function fetchAggTrades(
  symbol: string,
  limit: number = 500
): Promise<Array<{
  aggTradeId: number;
  price: number;
  quantity: number;
  firstTradeId: number;
  lastTradeId: number;
  timestamp: number;
  isBuyerMaker: boolean;
  quoteQty: number;
}>> {
  const startTime = Date.now();

  try {
    console.log(`[API] 🐋 Fetching ${limit} aggregate trades for ${symbol}...`);

    const url = `${FUTURES_API}/fapi/v1/aggTrades?symbol=${symbol}&limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    const trades = data.map((t: any) => ({
      aggTradeId: t.a,
      price: parseFloat(t.p),
      quantity: parseFloat(t.q),
      firstTradeId: t.f,
      lastTradeId: t.l,
      timestamp: t.T,
      isBuyerMaker: t.m,
      quoteQty: parseFloat(t.p) * parseFloat(t.q)
    }));

    const duration = Date.now() - startTime;
    
    // Büyük işlemleri tespit et
    const avgSize = trades.reduce((sum: number, t: any) => sum + t.quoteQty, 0) / trades.length;
    const largeTrades = trades.filter((t: any) => t.quoteQty > avgSize * 5);
    
    console.log(`[API] ✅ ${symbol} aggTrades: ${trades.length} trades, ${largeTrades.length} large (${duration}ms)`);

    return trades;
  } catch (error) {
    console.error(`[API] ❌ Failed to fetch aggregate trades for ${symbol}:`, error);
    return [];
  }
}

/**
 * Order Book Depth - Bid/Ask imbalance için
 * @param symbol - BTCUSDT, ETHUSDT vb.
 * @param limit - Derinlik (5, 10, 20, 50, 100, 500, 1000)
 */
export async function fetchOrderBook(
  symbol: string,
  limit: number = 20
): Promise<{
  bids: Array<{ price: number; qty: number }>;
  asks: Array<{ price: number; qty: number }>;
  bidTotal: number;
  askTotal: number;
  imbalance: number;
} | null> {
  try {
    console.log(`[API] 📚 Fetching order book for ${symbol} (depth: ${limit})...`);

    const url = `${FUTURES_API}/fapi/v1/depth?symbol=${symbol}&limit=${limit}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    const bids = data.bids.map((b: string[]) => ({
      price: parseFloat(b[0]),
      qty: parseFloat(b[1])
    }));

    const asks = data.asks.map((a: string[]) => ({
      price: parseFloat(a[0]),
      qty: parseFloat(a[1])
    }));

    const bidTotal = bids.reduce((sum: number, b: any) => sum + b.qty, 0);
    const askTotal = asks.reduce((sum: number, a: any) => sum + a.qty, 0);
    const imbalance = bidTotal / (askTotal || 1);

    console.log(`[API] ✅ ${symbol} Order Book - Bid: ${bidTotal.toFixed(2)}, Ask: ${askTotal.toFixed(2)}, Imbalance: ${imbalance.toFixed(2)}x`);

    return { bids, asks, bidTotal, askTotal, imbalance };
  } catch (error) {
    console.error(`[API] ❌ Failed to fetch order book for ${symbol}:`, error);
    return null;
  }
}

/**
 * Tüm verileri paralel olarak çeker (optimize edilmiş)
 * @param symbol - BTCUSDT, ETHUSDT vb.
 */
export async function fetchAllData(symbol: string): Promise<{
  klines1m: Kline[];
  klines5m: Kline[];
  klines15m: Kline[];
  recentTrades: RecentTrade[];
  aggTrades: any[];
  orderBook: any;
  openInterest: number | null;
  fundingRate: number | null;
  fetchTime: number;
  isValid: boolean;
}> {
  const startTime = Date.now();
  console.log(`[API] 🚀 Fetching ALL data for ${symbol} (parallel)...`);

  try {
    // Tüm API çağrılarını paralel yap
    const [klines1m, klines5m, klines15m, recentTrades, aggTrades, orderBook, oiData, fundingData] = await Promise.all([
      fetchKlines(symbol, '1m', 60),   // Son 60 dakika
      fetchKlines(symbol, '5m', 24),   // Son 2 saat
      fetchKlines(symbol, '15m', 16),  // Son 4 saat
      fetchRecentTrades(symbol, 200),
      fetchAggTrades(symbol, 500),
      fetchOrderBook(symbol, 20),
      fetchOpenInterest(symbol),
      fetchFundingRate(symbol)
    ]);

    const fetchTime = Date.now() - startTime;
    
    // Veri geçerli mi kontrol et (en az kline verisi olmalı)
    const isValid = klines1m.length >= 10 && klines5m.length >= 5;
    
    if (!isValid) {
      console.warn(`[API] ⚠️ ${symbol} - Insufficient data (possibly restricted or not available on Futures)`);
    } else {
      console.log(`[API] ✅ ${symbol} ALL data fetched in ${fetchTime}ms`);
      console.log(`[API] 📊 Data summary:`);
      console.log(`  - 1m klines: ${klines1m.length}`);
      console.log(`  - 5m klines: ${klines5m.length}`);
      console.log(`  - 15m klines: ${klines15m.length}`);
      console.log(`  - Recent trades: ${recentTrades.length}`);
      console.log(`  - Aggregate trades: ${aggTrades.length}`);
      console.log(`  - Order book imbalance: ${orderBook?.imbalance?.toFixed(2) || 'N/A'}x`);
      console.log(`  - Open Interest: ${oiData?.openInterest?.toFixed(2) || 'N/A'}`);
      console.log(`  - Funding Rate: ${fundingData?.fundingRate ? (fundingData.fundingRate * 100).toFixed(4) + '%' : 'N/A'}`);
    }

    return {
      klines1m,
      klines5m,
      klines15m,
      recentTrades,
      aggTrades,
      orderBook,
      openInterest: oiData?.openInterest || null,
      fundingRate: fundingData?.fundingRate || null,
      fetchTime,
      isValid
    };
  } catch (error) {
    console.error(`[API] ❌ Failed to fetch all data for ${symbol}:`, error);
    // Hata durumunda boş ama geçerli bir yapı döndür
    return {
      klines1m: [],
      klines5m: [],
      klines15m: [],
      recentTrades: [],
      aggTrades: [],
      orderBook: null,
      openInterest: null,
      fundingRate: null,
      fetchTime: Date.now() - startTime,
      isValid: false
    };
  }
}

/**
 * Hızlı veri çekme (sadece kritik veriler)
 * @param symbol - BTCUSDT, ETHUSDT vb.
 */
export async function fetchQuickData(symbol: string): Promise<{
  klines1m: Kline[];
  orderBook: any;
  fetchTime: number;
} | null> {
  const startTime = Date.now();
  
  try {
    console.log(`[API] ⚡ Quick fetch for ${symbol}...`);

    const [klines1m, orderBook] = await Promise.all([
      fetchKlines(symbol, '1m', 30),
      fetchOrderBook(symbol, 10)
    ]);

    const fetchTime = Date.now() - startTime;
    console.log(`[API] ⚡ ${symbol} quick data in ${fetchTime}ms`);

    return { klines1m, orderBook, fetchTime };
  } catch (error) {
    console.error(`[API] ❌ Quick fetch failed for ${symbol}:`, error);
    return null;
  }
}

/**
 * API rate limit kontrolü (weight tracking)
 */
let apiCallCount = 0;
let lastResetTime = Date.now();

export function checkRateLimit(): boolean {
  const now = Date.now();

  // Her dakika reset
  if (now - lastResetTime > 60000) {
    apiCallCount = 0;
    lastResetTime = now;
  }

  // Binance limit: 2400 weight/minute
  // fetchAllData ~25 weight (tüm endpointler toplamı)
  // Güvenli limit: 50 call/minute (1250 weight)
  if (apiCallCount >= 50) {
    console.warn('[API] ⚠️ Rate limit approaching! Pausing API calls...');
    return false;
  }

  apiCallCount++;
  return true;
}

/**
 * WebSocket helper: AggTrade stream oluştur
 */
export function createAggTradeStream(symbol: string): WebSocket {
  const stream = symbol.toLowerCase();
  const ws = new WebSocket(`wss://fstream.binance.com/ws/${stream}@aggTrade`);

  ws.onopen = () => {
    console.log(`[Stream] ✅ AggTrade connected: ${symbol}`);
  };

  ws.onerror = (error) => {
    console.error(`[Stream] ❌ AggTrade error for ${symbol}:`, error);
  };

  ws.onclose = () => {
    console.log(`[Stream] 🔌 AggTrade disconnected: ${symbol}`);
  };

  return ws;
}

/**
 * WebSocket helper: BookTicker stream oluştur
 */
export function createBookTickerStream(symbol: string): WebSocket {
  const stream = symbol.toLowerCase();
  const ws = new WebSocket(`wss://fstream.binance.com/ws/${stream}@bookTicker`);

  ws.onopen = () => {
    console.log(`[Stream] ✅ BookTicker connected: ${symbol}`);
  };

  ws.onerror = (error) => {
    console.error(`[Stream] ❌ BookTicker error for ${symbol}:`, error);
  };

  ws.onclose = () => {
    console.log(`[Stream] 🔌 BookTicker disconnected: ${symbol}`);
  };

  return ws;
}

/**
 * WebSocket helper: Kline stream oluştur
 */
export function createKlineStream(symbol: string, interval: string = '1m'): WebSocket {
  const stream = symbol.toLowerCase();
  const ws = new WebSocket(`wss://fstream.binance.com/ws/${stream}@kline_${interval}`);

  ws.onopen = () => {
    console.log(`[Stream] ✅ Kline ${interval} connected: ${symbol}`);
  };

  ws.onerror = (error) => {
    console.error(`[Stream] ❌ Kline error for ${symbol}:`, error);
  };

  ws.onclose = () => {
    console.log(`[Stream] 🔌 Kline disconnected: ${symbol}`);
  };

  return ws;
}