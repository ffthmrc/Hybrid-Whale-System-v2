import React, { useState, useMemo } from 'react';
import { TradingAlert, Position, SymbolData } from '../types';

interface Props {
  alerts: TradingAlert[];
  onSelect?: (symbol: string) => void;
  activePositions: Position[];
  marketData: Record<string, SymbolData>;
  onQuickTrade?: (alert: TradingAlert) => void;
  eliteMode?: boolean;
}

const AlertsPanel: React.FC<Props> = ({ 
  alerts, onSelect, activePositions, marketData, onQuickTrade, eliteMode
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const formatPrice = (p: number) => p.toFixed(p < 0.01 ? 8 : p < 1 ? 6 : 4).replace(/\.?0+$/, '');
  const formatTime = (ts: number) => new Date(ts).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const filteredAlerts = useMemo(() => {
    if (!searchTerm.trim()) return alerts;
    const query = searchTerm.toLowerCase().trim();
    return alerts.filter(alert => {
      const variants = [
        alert.symbol.toLowerCase(),
        alert.symbol.toLowerCase().replace('usdt', ''),
        alert.symbol.toLowerCase().replace('usdt', '/usdt'),
      ];

      return variants.some(v => v.includes(query));
    });
  }, [alerts, searchTerm]);

  return (
    <div className="flex flex-col w-full font-sans select-none h-full overflow-hidden bg-[#0b0e11]">
      {/* HEADER SECTION */}
      <div className="px-3 py-3 border-b border-[#2b3139] flex flex-wrap items-center justify-between gap-2 bg-[#1e2329]/30 shrink-0">
        <div className="flex items-center gap-2">
          <span className="font-black text-[10px] uppercase tracking-widest text-[#fcd535]">Pulse Alerts</span>
        </div>
        
        <div className="relative flex-1 min-w-[120px] max-w-[180px]">
          {/* Search Icon */}
          <div className="absolute left-2 top-1/2 -translate-y-1/2 text-[#848e9c] opacity-50 pointer-events-none">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"></circle>
              <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
            </svg>
          </div>

          <input 
            type="text"
            placeholder="Search Symbol..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape') setSearchTerm('');
            }}
            // px-7 ensures text doesn't overlap with icons on either side
            className="w-full bg-[#0b0e11]/80 border border-[#2b3139] rounded px-7 py-1 text-[10px] text-white placeholder-[#474d57] focus:border-[#fcd535]/50 outline-none transition-all font-black uppercase tracking-wider"
          />

          {/* NEW FEATURE: Clear Button (X) */}
          {searchTerm && (
            <button 
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[#848e9c] hover:text-[#fcd535] transition-colors p-0.5"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </button>
          )}
        </div>

        <span className={`text-[8px] px-1.5 py-0.5 rounded font-black transition-all ${eliteMode ? 'bg-purple-500 text-white shadow-[0_0_8px_rgba(168,85,247,0.3)]' : 'bg-[#00c076] text-black'}`}>
          {eliteMode ? 'ELITE ON' : 'LIVE'}
        </span>
      </div>

      {/* ALERTS LIST */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 flex flex-col gap-1.5">
        {filteredAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-[#848e9c] py-12 opacity-40 text-center">
            <span className="text-[10px] font-black uppercase tracking-widest">No momentum detected</span>
          </div>
        ) : (
          filteredAlerts.map(alert => {
            const isExpanded = expandedIds.has(alert.id);
            const isBullish = alert.change >= 0;
            const isPositionActive = activePositions.some(p => p.symbol === alert.symbol);
            const isPumpAlert = alert.eliteType === 'PUMP_START';
            const isTrendStartAlert = alert.eliteType === 'TREND_START';
            const isWhaleAlert = alert.eliteType === 'WHALE_ACCUMULATION' || alert.eliteType === 'INSTITUTION_ENTRY' || alert.eliteType === 'SMART_MONEY_FLOW';

            return (
              <div 
                key={alert.id} 
                onClick={(e) => toggleExpand(alert.id, e)}
                className={`
                  relative transition-all duration-300 group overflow-hidden border rounded-xl cursor-pointer shrink-0
                  ${isWhaleAlert
                    ? 'bg-gradient-to-br from-purple-500/20 via-pink-500/20 to-purple-500/20 border-purple-500/50 shadow-lg shadow-purple-500/10 animate-pulse'
                    : isTrendStartAlert
                      ? 'bg-gradient-to-br from-cyan-500/20 via-blue-500/20 to-purple-500/20 border-cyan-500/50 shadow-lg shadow-cyan-500/10 animate-pulse'
                      : isPumpAlert 
                        ? 'bg-[#1e2329] border-yellow-500/50 shadow-lg shadow-yellow-500/10' 
                        : alert.isElite 
                          ? 'bg-[#1e2329] border-purple-500/40' 
                          : 'bg-[#1e2329] border-[#2b3139] hover:border-[#474d57]'
                  }
                  ${isPositionActive ? 'ring-1 ring-[#00c076]/40' : ''}
                  ${isExpanded ? 'mb-2' : ''}
                `}
              >
                {/* COMPACT VIEW */}
                <div className={`flex items-center justify-between px-3 h-10 shrink-0 transition-colors ${isExpanded ? 'bg-white/5' : ''}`}>
                  <div className="flex items-center gap-3">
                    <span className="text-white font-black text-[12px] uppercase tracking-tighter">{alert.symbol.replace('USDT', '')}</span>
                    <span className={`text-[8px] px-1.5 py-0.5 rounded font-black leading-none ${alert.side === 'LONG' ? 'bg-[#00c076]/20 text-[#00c076]' : 'bg-[#f6465d]/20 text-[#f6465d]'}`}>
                      {alert.side}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className={`text-[11px] font-black font-mono ${isBullish ? 'text-[#00c076]' : 'text-[#f6465d]'}`}>
                      {isBullish ? '+' : ''}{alert.change.toFixed(2)}%
                    </span>

                    {isTrendStartAlert ? (
                      <div className="bg-cyan-500 text-black text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1">
                        ⚡ TREND
                      </div>
                    ) : isWhaleAlert ? (
                      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shadow-lg shadow-purple-500/30">
                        🐋 {alert.whaleDetails?.score?.toFixed(0) ?? 'N/A'}
                      </div>
                    ) : isPumpAlert && (
                      <div className="bg-[#fcd535] text-black text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 animate-pulse">
                        🚀 {alert.volumeMultiplier?.toFixed(1)}x
                      </div>
                    )}
                    
                    {isPositionActive && (
                      <div className="flex items-center gap-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-[#00c076] animate-pulse"></div>
                      </div>
                    )}
                    
                    <div className={`text-[#474d57] transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                    </div>
                  </div>
                </div>

                {/* EXPANDED CONTENT */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 animate-in slide-in-from-top-2 duration-300 border-t border-white/5 shrink-0">
                    
                    {/* TREND DETAILS PANEL */}
                    {isTrendStartAlert && alert.trendDetails && (
                      <div className="mt-2 bg-cyan-500/5 rounded-lg p-2 border border-cyan-500/20 space-y-1 mb-2">
                        <div className="text-[9px] font-black text-cyan-400 uppercase border-b border-cyan-500/10 pb-1 mb-1">Trend Başlangıcı Tespit Edildi</div>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <div className="flex justify-between text-[8px] font-black uppercase"><span className="text-[#848e9c]">Konsolidasyon:</span><span className="text-white">✅ {alert.trendDetails?.consolidationRange ?? 'N/A'}%</span></div>
                          <div className="flex justify-between text-[8px] font-black uppercase"><span className="text-[#848e9c]">Breakout:</span><span className="text-white">✅ {alert.trendDetails?.breakoutPercent ?? 'N/A'}%</span></div>
                          <div className="flex justify-between text-[8px] font-black uppercase"><span className="text-[#848e9c]">Hacim:</span><span className="text-white">✅ {alert.trendDetails?.volumeRatio ?? 'N/A'}x</span></div>
                          <div className="flex justify-between text-[8px] font-black uppercase"><span className="text-[#848e9c]">Trend:</span><span className="text-white">✅ {alert.trendDetails?.context ?? 'N/A'}</span></div>
                        </div>
                      </div>
                    )}

                    {isPumpAlert && (
                      <div className="mt-2 bg-black/40 rounded-lg p-2 border border-white/5 space-y-1 mb-2">
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                            <span className="text-[#848e9c]">Hacim Patlaması:</span>
                            <span className="text-yellow-500">{alert.volumeMultiplier?.toFixed(2)}x</span>
                        </div>
                        <div className="flex justify-between items-center text-[9px] font-black uppercase">
                            <span className="text-[#848e9c]">Tespit:</span>
                            <span className="text-white opacity-60 font-mono">{formatTime(alert.timestamp)}</span>
                        </div>
                      </div>
                    )}

                    {/* WHALE DETAILS PANEL */}
                    {isWhaleAlert && alert.whaleDetails && (
                      <div className="mt-2 bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-purple-500/10 rounded-lg p-2 border border-purple-500/30 space-y-2 mb-2 shadow-lg shadow-purple-500/5">
                        <div className="text-[9px] font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 uppercase border-b border-purple-500/20 pb-1 mb-1">
                          🐋 {alert.eliteType?.replace('_', ' ') || 'WHALE SIGNAL'}
                        </div>
                        
                        {/* Whale Score Progress Bar */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[8px] font-black uppercase">
                            <span className="text-[#848e9c]">Whale Score:</span>
                            <span className="text-purple-400">{alert.whaleDetails.score.toFixed(0)}/100</span>
                          </div>
                          <div className="w-full bg-black/50 rounded-full h-1.5 overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500"
                              style={{ width: `${alert.whaleDetails.score}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Description */}
                        <div className="text-[8px] text-white/70 font-medium leading-relaxed bg-black/20 rounded px-2 py-1">
                          {alert.whaleDetails?.description ?? 'No description available'}
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 pt-1">
                          {alert.whaleDetails.largeOrders > 0 && (
                            <div className="flex justify-between text-[8px] font-black uppercase">
                              <span className="text-[#848e9c]">Big Orders:</span>
                              <span className="text-purple-400">✅ {alert.whaleDetails.largeOrders}</span>
                            </div>
                          )}
                          {alert.whaleDetails.orderBookImbalance > 0 && (
                            <div className="flex justify-between text-[8px] font-black uppercase">
                              <span className="text-[#848e9c]">Imbalance:</span>
                              <span className="text-pink-400">✅ {alert.whaleDetails.orderBookImbalance.toFixed(2)}x</span>
                            </div>
                          )}
                          {alert.whaleDetails.volatilitySpike && (
                            <div className="flex justify-between text-[8px] font-black uppercase">
                              <span className="text-[#848e9c]">Volatility:</span>
                              <span className="text-yellow-400">⚡ SPIKE</span>
                            </div>
                          )}
                          {alert.whaleDetails.supportLevel && (
                            <div className="flex justify-between text-[8px] font-black uppercase">
                              <span className="text-[#848e9c]">Support:</span>
                              <span className="text-green-400 font-mono">${alert.whaleDetails.supportLevel.toFixed(6)}</span>
                            </div>
                          )}
                          {alert.whaleDetails.resistanceLevel && (
                            <div className="flex justify-between text-[8px] font-black uppercase">
                              <span className="text-[#848e9c]">Resistance:</span>
                              <span className="text-red-400 font-mono">${alert.whaleDetails.resistanceLevel.toFixed(6)}</span>
                            </div>
                          )}
                        </div>

                        {/* Dynamic SL Note */}
                        {(alert.whaleDetails.supportLevel || alert.whaleDetails.resistanceLevel) && (
                          <div className="text-[7px] text-purple-300/60 font-bold uppercase tracking-wide bg-purple-500/5 rounded px-2 py-1 border border-purple-500/10">
                            🎯 Dynamic SL will use {alert.side === 'LONG' ? 'support' : 'resistance'} level
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex items-center justify-between py-2">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-[#848e9c] uppercase tracking-tight mb-1">{alert.reason}</span>
                          <span className="font-mono text-[14px] font-black text-white/90">${formatPrice(alert.price)}</span>
                        </div>
                        {(!isPumpAlert && !isTrendStartAlert) && (
                          <div className="text-[#474d57] font-mono text-[10px] font-black">{formatTime(alert.timestamp)}</div>
                        )}
                    </div>

                    <div className="mt-2 flex gap-2">
                      {isPositionActive ? (
                        <button 
                          disabled
                          className="flex-1 bg-[#00c076]/10 border border-[#00c076]/30 text-[#00c076] text-[10px] font-black py-1.5 rounded-lg uppercase cursor-not-allowed flex items-center justify-center"
                        >
                          {(() => {
                            const position = activePositions.find(
                              p => p.symbol === alert.symbol
                            );

                            if (!position) return 'İŞLEM AKTİF';

                            return position.source === 'AUTO'
                              ? 'OTOMATİK İŞLEM AÇILDI'
                              : 'MANUEL İŞLEM AKTİF';
                          })()}
                        </button>
                      ) : (

                        <>
                          {isWhaleAlert ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onQuickTrade?.(alert); }}
                              className="flex-1 bg-gradient-to-r from-purple-500 via-pink-500 to-purple-600 text-white font-black py-2 rounded-lg text-[10px] uppercase shadow-lg shadow-purple-500/30 active:scale-95 transition-all"
                            >
                              🐋 WHALE ENTRY
                            </button>
                          ) : isTrendStartAlert ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onQuickTrade?.(alert); }}
                              className="flex-1 bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-black py-2 rounded-lg text-[10px] uppercase shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                            >
                              ⚡ TRENDİ YAKALA
                            </button>
                          ) : isPumpAlert ? (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onQuickTrade?.(alert); }}
                              className="flex-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-black font-black py-2 rounded-lg text-[10px] uppercase shadow-lg shadow-yellow-500/10 active:scale-95 transition-all"
                            >
                              ⚡ HIZLI GİRİŞ YAP
                            </button>
                          ) : (
                            <button 
                              onClick={(e) => { e.stopPropagation(); onQuickTrade?.(alert); }} 
                              className="flex-1 bg-[#2b3139] hover:bg-[#3b4149] text-white text-[10px] font-black py-1.5 rounded-lg transition-colors uppercase"
                            >
                              Quick Trade
                            </button>
                          )}
                        </>
                      )}
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); onSelect?.(alert.symbol); }}
                        className="px-3 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black rounded-lg uppercase transition-colors"
                      >
                        Chart
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
export default AlertsPanel;