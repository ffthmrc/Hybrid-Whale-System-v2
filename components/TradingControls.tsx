import React, { useState, useMemo } from 'react';
import { StrategyConfig, AccountState, Position, Side, SymbolData } from '../types';

interface Props {
  config: StrategyConfig;
  setConfig: React.Dispatch<React.SetStateAction<StrategyConfig>>;
  account: AccountState;
  marketData: Record<string, SymbolData>;
  positions: Position[];
  emergencyStop: () => void;
  onManualTrade: (params: any) => void;
  onRemoveBlacklist?: (symbol: string) => void;
}

const TradingControls: React.FC<Props> = ({ config, setConfig, account, marketData, positions, emergencyStop, onManualTrade, onRemoveBlacklist }) => {
  const [isBotSettingsExpanded, setIsBotSettingsExpanded] = useState(false);
  const [isManualExpanded, setIsManualExpanded] = useState(false);
  const [isBlacklistExpanded, setIsBlacklistExpanded] = useState(false);
  const [isWhaleConfigExpanded, setIsWhaleConfigExpanded] = useState(false); // 🔧 YENİ: Whale iç daraltma
  const [manualSymbol, setManualSymbol] = useState('');
  const [manualSide, setManualSide] = useState<Side>('LONG');
  const [newBlacklistSymbol, setNewBlacklistSymbol] = useState('');

  const handleChange = (key: keyof StrategyConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const FEE_RATE = 0.0005; 

  const { sessionProfit, sessionGrowthPct } = useMemo(() => {
    let liveUnrealizedPnl = 0;
    let totalMarginInTrades = 0;
    let estimatedExitFees = 0;

    positions.forEach(pos => {
      const market = marketData[pos.symbol];
      if (market) {
        const priceDiff = pos.side === 'LONG' ? market.price - pos.entryPrice : pos.entryPrice - market.price;
        liveUnrealizedPnl += priceDiff * pos.quantity;
        totalMarginInTrades += pos.margin;
        estimatedExitFees += (pos.quantity * market.price) * FEE_RATE;
      } else {
        totalMarginInTrades += pos.margin;
      }
    });

    const netLiveUnrealized = liveUnrealizedPnl - estimatedExitFees;
    const currentEquity = account.balance + totalMarginInTrades + netLiveUnrealized;
    const profit = currentEquity - account.initialBalance;
    const growthPct = (profit / account.initialBalance) * 100;

    return { sessionProfit: profit, sessionGrowthPct: growthPct };
  }, [account, positions, marketData]);

  const isProfitable = sessionProfit >= 0;

  return (
    <div className="space-y-4 select-none">
      <div className="grid grid-cols-2 gap-2">
        <div className="bg-[#1e2329] p-3 rounded-lg border border-[#2b3139] shadow-sm flex flex-col justify-center">
          <div className="text-[9px] text-[#848e9c] font-black uppercase tracking-widest mb-1">Available Wallet</div>
          <div className="text-[16px] font-black text-[#fcd535] truncate font-mono">
            ${account.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        </div>
        
        <div className={`p-3 rounded-lg border shadow-lg transition-all duration-300 flex flex-col justify-center ${
          isProfitable 
            ? 'bg-[#00c076]/10 border-[#00c076]/40 shadow-[0_0_20px_rgba(0,192,118,0.2)]' 
            : 'bg-[#f84960]/10 border-[#f84960]/40 shadow-[0_0_20px_rgba(248,73,96,0.2)]'
        }`}>
          <div className="text-[9px] text-[#848e9c] font-black uppercase tracking-widest mb-1 text-right">Live Growth</div>
          <div className={`text-right transition-colors flex flex-col items-end`}>
            <span className={`text-[22px] font-black leading-none font-mono ${isProfitable ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
              {isProfitable ? '+' : ''}{sessionGrowthPct.toFixed(2)}%
            </span>
            <span className={`text-[13px] font-black mt-1 py-0.5 px-1.5 rounded bg-black/50 font-mono ${isProfitable ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
              {isProfitable ? '+$' : '-$'}{Math.abs(sessionProfit).toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2">
        <button 
          onClick={() => handleChange('autoTrading', !config.autoTrading)}
          className={`w-full py-3 rounded-lg font-black text-[10px] transition-all border-b-4 ${
            config.autoTrading ? 'bg-[#f84960] text-white border-[#b91c1c]' : 'bg-[#fcd535] text-black border-[#d97706]'
          }`}
        >
          {config.autoTrading ? 'HALT AUTO SYSTEM' : 'ENGAGE AUTO TRADING'}
        </button>
        
        <div className="grid grid-cols-3 gap-2">
           <button 
             onClick={() => handleChange('eliteMode', !config.eliteMode)}
             className={`w-full py-2.5 rounded-lg font-black text-[9px] transition-all border border-purple-500/50 flex items-center justify-center gap-1 ${
               config.eliteMode ? 'bg-purple-600 text-white shadow-[0_0_15px_rgba(168,85,247,0.4)]' : 'bg-[#0b0e11] text-purple-400'
             }`}
           >
             <span className="text-[12px]">{config.eliteMode ? '🛡️' : '⚪'}</span>
             <span className="hidden xl:inline">ELITE</span>
             <span className="xl:hidden">ELT</span>
           </button>

           <button 
             onClick={() => handleChange('pumpDetectionEnabled', !config.pumpDetectionEnabled)}
             className={`w-full py-2.5 rounded-lg font-black text-[9px] transition-all border border-orange-500/50 flex items-center justify-center gap-1 ${
               config.pumpDetectionEnabled ? 'bg-orange-600 text-white shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-pulse' : 'bg-[#0b0e11] text-orange-400'
             }`}
           >
             <span className="text-[12px]">{config.pumpDetectionEnabled ? '🚀' : '⚪'}</span>
             <span className="hidden xl:inline">PUMP</span>
             <span className="xl:hidden">PMP</span>
           </button>

           <button 
             onClick={() => handleChange('whaleDetectionEnabled', !config.whaleDetectionEnabled)}
             className={`w-full py-2.5 rounded-lg font-black text-[9px] transition-all border border-pink-500/50 flex items-center justify-center gap-1 ${
               config.whaleDetectionEnabled ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-[0_0_15px_rgba(219,39,119,0.4)]' : 'bg-[#0b0e11] text-pink-400'
             }`}
           >
             <span className="text-[12px]">{config.whaleDetectionEnabled ? '🐋' : '⚪'}</span>
             <span className="hidden xl:inline">WHALE</span>
             <span className="xl:hidden">WHL</span>
           </button>
        </div>
        
        {config.pumpDetectionEnabled && (
           <div className="mt-1 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded text-[9px] font-bold text-orange-500 flex items-center gap-2">
              <span className="animate-bounce">⚠️</span>
              PUMP MODE AKTİF: %1+ ARTALAN VE 2.5X HACİM PATLAMASI TAKİP EDİLİYOR.
           </div>
        )}
        
        {config.whaleDetectionEnabled && (
           <div className="px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded text-[9px] font-bold text-purple-400 flex items-center gap-2 mt-1">
             <span>🐋</span>
             WHALE MODE: Büyük emirler ve order book dengesizliği takip ediliyor.
           </div>
        )}
      </div>

      <div className="bg-[#1e2329]/50 rounded-xl border border-[#2b3139] overflow-hidden transition-all">
        <button 
          onClick={() => setIsBotSettingsExpanded(!isBotSettingsExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-white/5 transition-colors border-b border-[#2b3139]/30"
        >
          <div className="text-[10px] font-black text-[#fcd535] uppercase tracking-widest">
            Bot Settings
          </div>
          <span className="text-[#848e9c] text-[10px]">
            {isBotSettingsExpanded ? '▲' : '▼'}
          </span>
        </button>

        {isBotSettingsExpanded && (
          <div className="p-4 space-y-3 animate-in slide-in-from-top-2 duration-300">
            {/* 🔧 YENİ: Whale Params (Collapsible inside Bot Settings) */}
            <div className="border border-purple-500/20 rounded-lg overflow-hidden bg-purple-500/5">
              <button 
                onClick={() => setIsWhaleConfigExpanded(!isWhaleConfigExpanded)}
                className="w-full px-3 py-2 flex items-center justify-between hover:bg-purple-500/10 transition-colors"
              >
                <div className="text-[8px] font-black text-purple-400 uppercase flex items-center gap-2">
                  <span>🐋</span> Whale Mode Parameters
                </div>
                <span className="text-purple-400 text-[8px]">{isWhaleConfigExpanded ? '▲' : '▼'}</span>
              </button>
              
              {isWhaleConfigExpanded && (
                <div className="px-3 pb-3 grid grid-cols-3 gap-2 animate-in fade-in duration-200">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-purple-400 uppercase">🎯 Min</label>
                    <input 
                      type="number" min="0" max="100" step="5"
                      value={config.whaleMinScore} 
                      onChange={(e) => handleChange('whaleMinScore', parseFloat(e.target.value))} 
                      className="w-full bg-[#0b0e11] border border-purple-500/30 rounded px-2 py-1 text-[10px] font-black text-purple-300 outline-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-pink-400 uppercase">🎯 SL</label>
                    <button 
                      onClick={() => handleChange('useDynamicStopLoss', !config.useDynamicStopLoss)}
                      className={`w-full py-1 rounded text-[8px] font-black border transition-all ${config.useDynamicStopLoss ? 'bg-pink-600/20 border-pink-500 text-pink-300' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'}`}
                    >
                      {config.useDynamicStopLoss ? 'DYNAMIC' : 'STATIC'}
                    </button>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black text-yellow-400 uppercase">🔔 Ring</label>
                    <button 
                      onClick={() => handleChange('ringEnabled', !config.ringEnabled)}
                      className={`w-full py-1 rounded text-[8px] font-black border transition-all ${config.ringEnabled ? 'bg-yellow-600/20 border-yellow-500 text-yellow-300' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'}`}
                    >
                      {config.ringEnabled ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => handleChange('longEnabled', !config.longEnabled)} className={`py-2 rounded text-[10px] font-black border transition-all ${config.longEnabled ? 'bg-[#00c076]/20 border-[#00c076] text-[#00c076]' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'}`}>LONG {config.longEnabled ? 'ON' : 'OFF'}</button>
              <button onClick={() => handleChange('shortEnabled', !config.shortEnabled)} className={`py-2 rounded text-[10px] font-black border transition-all ${config.shortEnabled ? 'bg-[#f84960]/20 border-[#f84960] text-[#f84960]' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'}`}>SHORT {config.shortEnabled ? 'ON' : 'OFF'}</button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#848e9c] uppercase">Risk / Trade (%)</label>
                <input type="number" step="0.1" value={config.riskPerTrade} onChange={(e) => handleChange('riskPerTrade', parseFloat(e.target.value))} className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-xs font-black text-white outline-none"/>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#848e9c] uppercase">Leverage (X)</label>
                <input type="number" value={config.leverage} onChange={(e) => handleChange('leverage', parseInt(e.target.value))} className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-xs font-black text-white outline-none"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#848e9c] uppercase">Stop Loss (%)</label>
                <input type="number" step="0.1" value={config.stopLossPercent} onChange={(e) => handleChange('stopLossPercent', parseFloat(e.target.value))} className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-xs font-black text-white outline-none"/>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#848e9c] uppercase">TP 1 (%)</label>
                <input type="number" step="0.1" value={config.tp1Percent} onChange={(e) => handleChange('tp1Percent', parseFloat(e.target.value))} className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-xs font-black text-white outline-none"/>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#848e9c] uppercase">TP 2 (%)</label>
                <input type="number" step="0.1" value={config.tp2Percent} onChange={(e) => handleChange('tp2Percent', parseFloat(e.target.value))} className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-xs font-black text-white outline-none"/>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-[#848e9c] uppercase">Max Trades</label>
                <input type="number" value={config.maxConcurrentTrades} onChange={(e) => handleChange('maxConcurrentTrades', parseInt(e.target.value))} className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1 text-xs font-black text-white outline-none"/>
              </div>
            </div>

            <div className="mt-4 pt-2 border-t border-[#2b3139]">
              <button 
                onClick={() => setIsManualExpanded(!isManualExpanded)} 
                className="w-full py-1 text-[9px] font-black text-[#848e9c] uppercase hover:text-white flex items-center justify-center gap-1"
              >
                {isManualExpanded ? '▲ HIDE MANUAL ENTRY' : '▼ SHOW MANUAL ENTRY'}
              </button>
              {isManualExpanded && (
                <div className="mt-2 space-y-2">
                  <input 
                    type="text" placeholder="SYMBOL (E.G. SOL)" value={manualSymbol} 
                    onChange={(e) => setManualSymbol(e.target.value.toUpperCase())} 
                    className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1.5 text-[10px] font-black text-white uppercase outline-none focus:border-[#fcd535]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => setManualSide('LONG')} className={`py-1.5 rounded text-[9px] font-black border transition-all ${manualSide === 'LONG' ? 'bg-[#00c076] text-black border-[#00c076]' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'}`}>LONG</button>
                    <button onClick={() => setManualSide('SHORT')} className={`py-1.5 rounded text-[9px] font-black border transition-all ${manualSide === 'SHORT' ? 'bg-[#f84960] text-black border-[#f84960]' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'}`}>SHORT</button>
                  </div>
                  <button 
                    onClick={() => {
                      if(!manualSymbol) return;
                      onManualTrade({ symbol: manualSymbol, side: manualSide, leverage: config.leverage, riskValue: config.riskPerTrade, sl: config.stopLossPercent, tp1: config.tp1Percent, tp2: config.tp2Percent });
                      setManualSymbol('');
                    }} 
                    className="w-full py-2 bg-[#fcd535] text-black rounded text-[10px] font-black uppercase hover:bg-white transition-all shadow-lg active:scale-95"
                  >
                    OPEN MANUAL POSITION
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="bg-[#1e2329]/50 rounded-xl border border-[#2b3139] overflow-hidden transition-all">
        <button 
          onClick={() => setIsBlacklistExpanded(!isBlacklistExpanded)}
          className="w-full px-3 py-2 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="text-[9px] font-black text-[#fcd535] uppercase tracking-widest">
            Blacklist ({config.blacklist.length})
          </div>
          <span className="text-[#848e9c] text-[10px]">{isBlacklistExpanded ? '▲' : '▼'}</span>
        </button>
        
        {isBlacklistExpanded && (
          <div className="p-3 pt-0 space-y-2 border-t border-[#2b3139]/50 animate-in slide-in-from-top-2">
            <div className="space-y-1 max-h-24 overflow-y-auto custom-scrollbar mt-2">
              {config.blacklist.length === 0 ? (
                <div className="text-center py-2 text-[#848e9c] text-[9px] font-bold opacity-50">No blacklisted coins</div>
              ) : (
                config.blacklist.map(symbol => (
                  <div key={symbol} className="flex items-center justify-between bg-[#0b0e11] px-2 py-1.5 rounded border border-[#2b3139] hover:border-[#f84960]/50 transition-all group">
                    <span className="text-[10px] font-black text-white uppercase">{symbol}</span>
                    <button
                      onClick={() => handleChange('blacklist', config.blacklist.filter(s => s !== symbol))}
                      className="text-[#848e9c] hover:text-[#f84960] text-[11px] font-black transition-all"
                    >✕</button>
                  </div>
                ))
              )}
            </div>
            
            <div className="flex gap-2 pt-1">
              <input
                type="text" placeholder="SYMBOL (e.g. DOGE)" value={newBlacklistSymbol}
                onChange={(e) => setNewBlacklistSymbol(e.target.value.toUpperCase().replace('USDT', ''))}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && newBlacklistSymbol && !config.blacklist.includes(newBlacklistSymbol)) {
                    handleChange('blacklist', [...config.blacklist, newBlacklistSymbol]);
                    setNewBlacklistSymbol('');
                  }
                }}
                className="flex-1 bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1.5 text-[10px] font-black text-white uppercase outline-none focus:border-[#fcd535]"
              />
              <button
                onClick={() => {
                  if (newBlacklistSymbol && !config.blacklist.includes(newBlacklistSymbol)) {
                    handleChange('blacklist', [...config.blacklist, newBlacklistSymbol]);
                    setNewBlacklistSymbol('');
                  }
                }}
                className="bg-[#fcd535] text-black px-3 py-1.5 rounded text-[10px] font-black hover:bg-white transition-all shadow-md active:scale-95"
              >ADD</button>
            </div>
          </div>
        )}
      </div>

      <button onClick={emergencyStop} className="w-full py-2 border border-[#f84960]/50 text-[#f84960] text-[9px] font-black uppercase rounded-lg hover:bg-[#f84960] hover:text-white transition-all">Emergency Liquidate All</button>
    </div>
  );
};
export default TradingControls;