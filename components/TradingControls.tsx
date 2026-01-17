
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
  const [isManualExpanded, setIsManualExpanded] = useState(false);
  const [manualSymbol, setManualSymbol] = useState('');
  const [manualSide, setManualSide] = useState<Side>('LONG');

  const handleChange = (key: keyof StrategyConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const FEE_RATE = 0.0005; 

  const { totalEquity, sessionProfit, sessionGrowthPct } = useMemo(() => {
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

    // 🔹 Equity hesaplama: balance + pozisyonlar + net PnL
    const currentEquity = account.balance + totalMarginInTrades + netLiveUnrealized;

    // 🔹 Session profit ve live growth
    const profit = currentEquity - account.initialBalance;
    const growthPct = (profit / account.initialBalance) * 100;

    return { totalEquity: currentEquity, sessionProfit: profit, sessionGrowthPct: growthPct };
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
           <div className="space-y-2 mt-1">
             <div className="px-3 py-1.5 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded text-[9px] font-bold text-purple-400 flex items-center gap-2">
                <span>🐋</span>
                WHALE MODE: Büyük emirler ve order book dengesizliği takip ediliyor.
             </div>
             
             {/* Whale Settings */}
             <div className="grid grid-cols-3 gap-2 px-2">
               <div className="space-y-1">
                 <label className="text-[8px] font-black text-purple-400 uppercase flex items-center gap-1">
                   🎯 Min
                 </label>
                 <input 
                   type="number" 
                   min="0" 
                   max="100" 
                   step="5"
                   value={config.whaleMinScore} 
                   onChange={(e) => handleChange('whaleMinScore', parseFloat(e.target.value))} 
                   className="w-full bg-[#0b0e11] border border-purple-500/30 rounded px-2 py-1 text-xs font-black text-purple-300 outline-none focus:border-purple-500"
                 />
                 <div className="text-[7px] text-[#848e9c] font-bold">Score</div>
               </div>
               
               <div className="space-y-1">
                 <label className="text-[8px] font-black text-pink-400 uppercase flex items-center gap-1">
                   🎯 SL
                 </label>
                 <button 
                   onClick={() => handleChange('useDynamicStopLoss', !config.useDynamicStopLoss)}
                   className={`w-full py-1.5 rounded text-[9px] font-black border transition-all ${
                     config.useDynamicStopLoss 
                       ? 'bg-pink-600/20 border-pink-500 text-pink-300' 
                       : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'
                   }`}
                 >
                   {config.useDynamicStopLoss ? 'ON' : 'OFF'}
                 </button>
                 <div className="text-[7px] text-[#848e9c] font-bold">Dynamic</div>
               </div>

               <div className="space-y-1">
                 <label className="text-[8px] font-black text-yellow-400 uppercase flex items-center gap-1">
                   🔔 Ring
                 </label>
                 <button 
                   onClick={() => handleChange('ringEnabled', !config.ringEnabled)}
                   className={`w-full py-1.5 rounded text-[9px] font-black border transition-all ${
                     config.ringEnabled 
                       ? 'bg-yellow-600/20 border-yellow-500 text-yellow-300 animate-pulse' 
                       : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'
                   }`}
                 >
                   {config.ringEnabled ? 'ON' : 'OFF'}
                 </button>
                 <div className="text-[7px] text-[#848e9c] font-bold">Sound</div>
               </div>
             </div>
           </div>
        )}
      </div>

      <div className="space-y-3 bg-[#1e2329]/50 p-4 rounded-xl border border-[#2b3139]">
        <div className="text-[10px] font-black text-[#fcd535] uppercase tracking-widest border-b border-[#2b3139] pb-2 mb-2">Bot Settings</div>
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
                type="text" 
                placeholder="SYMBOL (E.G. SOL)" 
                value={manualSymbol} 
                onChange={(e) => setManualSymbol(e.target.value.toUpperCase())} 
                className="w-full bg-[#0b0e11] border border-[#2b3139] rounded px-2 py-1.5 text-[10px] font-black text-white uppercase outline-none focus:border-[#fcd535]"
              />
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => setManualSide('LONG')} 
                  className={`py-1.5 rounded text-[9px] font-black border transition-all ${manualSide === 'LONG' ? 'bg-[#00c076] text-black border-[#00c076]' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'}`}
                >
                  LONG
                </button>
                <button 
                  onClick={() => setManualSide('SHORT')} 
                  className={`py-1.5 rounded text-[9px] font-black border transition-all ${manualSide === 'SHORT' ? 'bg-[#f84960] text-black border-[#f84960]' : 'bg-[#0b0e11] border-[#2b3139] text-[#848e9c]'}`}
                >
                  SHORT
                </button>
              </div>
              <button 
                onClick={() => {
                  if(!manualSymbol) return;
                  onManualTrade({ 
                    symbol: manualSymbol, 
                    side: manualSide, 
                    leverage: config.leverage, 
                    riskValue: config.riskPerTrade, 
                    sl: config.stopLossPercent, 
                    tp1: config.tp1Percent, 
                    tp2: config.tp2Percent 
                  });
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

      <button onClick={emergencyStop} className="w-full py-2 border border-[#f84960]/50 text-[#f84960] text-[9px] font-black uppercase rounded-lg hover:bg-[#f84960] hover:text-white transition-all">Emergency Liquidate All</button>
    </div>
  );
};
export default TradingControls;
