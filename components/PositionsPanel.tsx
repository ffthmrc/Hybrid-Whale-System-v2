import React, { useState, useEffect, useMemo } from 'react';
import { Position, TradeHistoryItem, SymbolData } from '../types';

interface Props {
  positions: Position[];
  history: TradeHistoryItem[];
  onManualClose: (id: string) => void;
  marketData: Record<string, SymbolData>;
  onSelectSymbol?: (symbol: string) => void;
}

interface GroupedTrade {
  tradeId: string;
  symbol: string;
  side: 'LONG' | 'SHORT';
  leverage: number;
  entryPrice: number;
  finalExitPrice: number;
  totalPnl: number;
  totalRoi: number;
  status: string;
  partials: TradeHistoryItem[];
  timestamp: number;
  closedAt: number;
  source: 'AUTO' | 'MANUAL';
}

const PositionsPanel: React.FC<Props> = ({ positions, history, onManualClose, marketData, onSelectSymbol }) => {
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  const [now, setNow] = useState(Date.now());
  const [searchQuery, setSearchQuery] = useState('');
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [expandedTrades, setExpandedTrades] = useState<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const formatPrice = (p: number) => p.toFixed(p < 0.01 ? 8 : p < 1 ? 6 : 4).replace(/\.?0+$/, '');
  
  const FEE_RATE = 0.0005;

  const toggleExpand = (tradeId: string) => {
    setExpandedTrades(prev => {
      const newSet = new Set(prev);
      if (newSet.has(tradeId)) newSet.delete(tradeId);
      else newSet.add(tradeId);
      return newSet;
    });
  };

  const groupedTrades = useMemo(() => {
    const query = searchQuery.toLowerCase();
    const filtered = history.filter(item => 
      item.symbol.toLowerCase().includes(query) || 
      item.reason.toLowerCase().includes(query)
    );

    const groups: Record<string, GroupedTrade> = {};

    filtered.forEach(item => {
      const baseId = item.id.replace(/-tp1|-tp2$/g, '');
      
      if (!groups[baseId]) {
        groups[baseId] = {
          tradeId: baseId,
          symbol: item.symbol,
          side: item.side,
          leverage: item.leverage,
          entryPrice: item.entryPrice,
          finalExitPrice: item.exitPrice,
          totalPnl: 0,
          totalRoi: 0,
          status: item.reason,
          partials: [],
          timestamp: item.timestamp,
          closedAt: item.closedAt,
          source: item.source
        };
      }
      
      groups[baseId].partials.push(item);
      groups[baseId].totalPnl += item.pnl;
      if (item.closedAt >= groups[baseId].closedAt) {
        groups[baseId].finalExitPrice = item.exitPrice;
        groups[baseId].closedAt = item.closedAt;
        groups[baseId].status = item.reason;
      }
    });

    return Object.values(groups).map(group => {
      const totalMargin = group.partials.reduce((sum, p) => sum + (p.initialMargin || 0), 0);
      group.totalRoi = totalMargin > 0 ? (group.totalPnl / totalMargin) * 100 : 0;
      group.partials.sort((a, b) => a.closedAt - b.closedAt);
      return group;
    }).sort((a, b) => b.closedAt - a.closedAt);
  }, [history, searchQuery]);

  const exportToCSV = () => {
    const headers = ["Asset", "Type", "Side", "Leverage", "Entry", "Final Exit", "Total PNL (USDT)", "Total ROI (%)", "Status", "Date"];
    const rows = groupedTrades.map(trade => [
      trade.symbol,
      trade.source,
      trade.side,
      trade.leverage,
      trade.entryPrice,
      trade.finalExitPrice,
      trade.totalPnl.toFixed(2),
      trade.totalRoi.toFixed(2),
      trade.status,
      new Date(trade.closedAt).toLocaleString()
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `PulseTrade_GroupedHistory_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMenuOpen(false);
  };

  const exportToPDF = () => {
    setExportMenuOpen(false);
    window.print();
  };

  const renderReasonBadges = (reason: string) => {
    const parts = reason.split(' ');
    return (
      <div className="flex flex-wrap gap-1">
        {parts.map((part, i) => {
          let style = "bg-[#fcd535]/10 text-[#fcd535] border border-[#fcd535]/20";
          if (part.includes('TP1') || part.includes('TP2') || part === 'PERFECT') style = "bg-[#00c076]/10 text-[#00c076] border border-[#00c076]/20";
          else if (part === 'SL' || part === 'LOSS') style = "bg-[#f84960]/10 text-[#f84960] border border-[#f84960]/20";
          return <span key={i} className={`text-[8px] px-1.5 py-0.5 rounded font-black whitespace-nowrap uppercase ${style}`}>{part}</span>;
        })}
      </div>
    );
  };

  const getRiskBar = (pos: Position) => {
    const currentPrice = marketData[pos.symbol]?.price || pos.entryPrice;
    const isLong = pos.side === 'LONG';

    if (pos.trailingStopActive) {
      const trailingRange = Math.abs(pos.maxPrice - pos.stopLoss);
      const currentDist = isLong ? currentPrice - pos.stopLoss : pos.stopLoss - currentPrice;
      const currentPercent = trailingRange > 0 ? (Math.abs(currentDist) / trailingRange) * 100 : 0;

      return (
        <div className="relative w-full h-3 bg-[#0b0e11] rounded-lg overflow-hidden shadow-inner border border-[#2b3139]">
          <div className="absolute h-full bg-gradient-to-r from-green-600 via-green-400 to-[#fcd535] transition-all duration-500" style={{ width: `${Math.min(100, currentPercent)}%` }} />
          <div className="absolute h-full w-1 bg-white shadow-lg z-10" style={{ left: `${Math.min(100, currentPercent)}%` }} />
          <div className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-white mix-blend-difference">TRAILING {currentPercent.toFixed(0)}%</div>
          <div className="absolute right-0 h-full w-0.5 bg-yellow-300 opacity-50" />
        </div>
      );
    }

    const totalRange = Math.abs(pos.tp2 - pos.stopLoss);
    const slToEntry = Math.abs(pos.entryPrice - pos.stopLoss);
    const entryToTP1 = Math.abs(pos.tp1 - pos.entryPrice);
    const tp1ToTP2 = Math.abs(pos.tp2 - pos.tp1);

    const slPercent = totalRange > 0 ? (slToEntry / totalRange) * 100 : 0;
    const tp1Percent = totalRange > 0 ? (entryToTP1 / totalRange) * 100 : 0;
    const tp2Percent = totalRange > 0 ? (tp1ToTP2 / totalRange) * 100 : 0;

    const currentDist = isLong ? currentPrice - pos.stopLoss : pos.stopLoss - currentPrice;
    const currentPercent = totalRange > 0 ? (Math.abs(currentDist) / totalRange) * 100 : 0;

    return (
      <div className="relative w-full h-3 bg-[#0b0e11] rounded-lg overflow-hidden shadow-inner border border-[#2b3139]">
        <div className="absolute h-full bg-gradient-to-r from-red-600 to-red-500" style={{ width: `${slPercent}%` }} />
        <div className="absolute h-full bg-gradient-to-r from-yellow-500 to-yellow-400" style={{ left: `${slPercent}%`, width: `${tp1Percent}%` }} />
        <div className="absolute h-full bg-gradient-to-r from-green-500 to-green-400" style={{ left: `${slPercent + tp1Percent}%`, width: `${tp2Percent}%` }} />
        <div className="absolute h-full w-1 bg-white shadow-lg z-20" style={{ left: `${Math.min(100, currentPercent)}%` }} />
        {pos.tp1Hit && <div className="absolute top-0 bottom-0 w-0.5 bg-white/50 z-10" style={{ left: `${slPercent + tp1Percent}%` }} />}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#0b0e11] select-none font-sans overflow-hidden">
      <div className="hidden print:block p-8 border-b border-black mb-6">
          <h1 className="text-2xl font-bold text-black uppercase">Pulse Trading System - Trade History Report</h1>
          <p className="text-gray-600 mt-2">Export Date: {new Date().toLocaleString()}</p>
          <p className="text-gray-600">Total Grouped Trades: {groupedTrades.length}</p>
      </div>

      <div className="bg-[#1e2329] flex items-center border-b border-[#2b3139] shrink-0 print:hidden relative">
        <button onClick={() => setActiveTab('active')} className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'active' ? 'text-[#fcd535]' : 'text-[#848e9c]'}`}>
          Active Trades ({positions.length}) {activeTab === 'active' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fcd535]"></div>}
        </button>
        <button onClick={() => setActiveTab('history')} className={`px-6 py-3 text-[11px] font-black uppercase tracking-widest transition-all relative ${activeTab === 'history' ? 'text-[#fcd535]' : 'text-[#848e9c]'}`}>
          Trade History ({groupedTrades.length}) {activeTab === 'history' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#fcd535]"></div>}
        </button>

        {activeTab === 'history' && (
          <div className="ml-auto flex items-center gap-3 pr-4">
            <div className="relative">
              <input 
                type="text" 
                placeholder="Search Asset..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-[#0b0e11] border border-[#2b3139] rounded px-3 py-1 text-[10px] text-white focus:border-[#fcd535] outline-none w-32 md:w-48 transition-all"
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1.5 text-[#848e9c] hover:text-white">×</button>}
            </div>

            <div className="relative">
              <button 
                onClick={() => setExportMenuOpen(!exportMenuOpen)}
                className="bg-[#fcd535] text-black px-3 py-1 rounded text-[10px] font-black uppercase flex items-center gap-1 hover:bg-white transition-colors"
              >
                <span>Export</span>
                <span className="text-[8px]">{exportMenuOpen ? '▲' : '▼'}</span>
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-[#1e2329] border border-[#2b3139] rounded shadow-2xl z-[200]">
                  <button onClick={exportToCSV} className="w-full text-left px-4 py-2 text-[10px] text-white hover:bg-white/5 font-bold border-b border-white/5 uppercase">CSV (.csv)</button>
                  <button onClick={exportToPDF} className="w-full text-left px-4 py-2 text-[10px] text-white hover:bg-white/5 font-bold uppercase">PDF / Print</button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="flex-1 overflow-y-auto custom-scrollbar bg-[#0b0e11] print:bg-white">
        {activeTab === 'active' ? (
          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 print:hidden">
            {positions.length === 0 && (
              <div className="col-span-full py-12 flex flex-col items-center justify-center opacity-30">
                <span className="text-4xl mb-4">⚓</span>
                <span className="text-[10px] font-black uppercase tracking-widest">No active positions</span>
              </div>
            )}
            {positions.map(pos => {
              const market = marketData[pos.symbol];
              const currentPrice = market?.price || pos.entryPrice;
              const priceDiff = pos.side === 'LONG' ? currentPrice - pos.entryPrice : pos.entryPrice - currentPrice;
              const estExitFee = (pos.quantity * currentPrice) * FEE_RATE;
              const livePnlNet = (priceDiff * pos.quantity) - estExitFee;
              const liveRoi = (livePnlNet / (pos.margin * (pos.quantity / pos.initialQuantity))) * 100;
              const isProfit = livePnlNet >= 0;
              const isLong = pos.side === 'LONG';

              return (
                <div key={pos.id} onClick={() => onSelectSymbol?.(pos.symbol)} className={`bg-[#1e2329]/40 border ${pos.trailingStopActive ? 'border-[#fcd535]/40 shadow-[0_0_20px_rgba(252,213,53,0.1)]' : pos.tp1Hit ? 'border-[#00c076]/40 shadow-[0_0_20px_rgba(0,192,118,0.1)]' : isProfit ? 'border-[#00c076]/20' : 'border-[#f84960]/20'} rounded-xl p-3 hover:border-[#fcd535]/40 transition-all cursor-pointer group relative overflow-hidden`}>
                  
                  {/* HEADER: Symbol, Side, PNL */}
                  <div className="flex justify-between items-start mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-black text-white group-hover:text-[#fcd535] transition-colors leading-none uppercase">
                        {pos.symbol.replace('USDT','')}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded leading-none ${
                          isLong ? 'bg-[#00c076]/20 text-[#00c076]' : 'bg-[#f84960]/20 text-[#f84960]'
                        }`}>
                          {pos.side} {pos.leverage}X
                        </span>
                        <span className={`text-[7px] font-black px-1 py-0.25 rounded text-center border leading-none ${
                          pos.source === 'AUTO' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-orange-500/10 text-orange-400 border-orange-500/20'
                        }`}>
                          {pos.source}
                        </span>
                        {pos.alertType && (
                          <span className="text-[6px] font-black px-1 py-0.25 rounded text-center bg-[#fcd535]/10 text-[#fcd535] border border-[#fcd535]/20 leading-none truncate max-w-[80px]">
                            {pos.alertType === 'WHALE_ACCUMULATION' && '🐋 WHALE'}
                            {pos.alertType === 'INSTITUTION_ENTRY' && '🏛️ INST'}
                            {pos.alertType === 'TREND_START' && '🚀 TREND'}
                            {pos.alertType === 'PUMP_START' && '🔥 PUMP'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-lg font-mono font-black ${isProfit ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
                        {isProfit ? '+' : ''}{livePnlNet.toFixed(2)}
                      </div>
                      <div className={`text-[9px] font-black leading-none ${isProfit ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
                        {liveRoi.toFixed(2)}% ROI
                      </div>
                      <div className="text-[8px] text-[#848e9c] font-mono mt-0.5">
                        Entry: ${formatPrice(pos.entryPrice)} · {new Date(pos.timestamp).toLocaleTimeString('en-US', { hour12: false })}
                      </div>
                    </div>
                  </div>

                  {/* TP STATUS BADGES */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${pos.tp1Hit ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      <span>{pos.tp1Hit ? '✓' : '○'}</span>
                      <span>TP1</span>
                    </div>
                    <div className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded font-black uppercase ${pos.tp2Hit ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                      <span>{pos.tp2Hit ? '✓' : '○'}</span>
                      <span>TP2</span>
                    </div>
                    {pos.trailingStopActive && (
                      <div className="flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded bg-[#fcd535]/20 text-[#fcd535] font-black uppercase animate-pulse border border-[#fcd535]/30">
                        <span>🎯</span>
                        <span>TRAIL</span>
                      </div>
                    )}
                  </div>

                  {/* QUANTITY INFO */}
                  <div className="text-[9px] text-gray-400 mb-2 space-y-0.5">
                    <div className="flex justify-between text-[9px] font-black uppercase">
                      <span className="text-[#848e9c]">QUANTITY:</span>
                      <span className="text-green-400 font-mono">
                        ({((pos.quantity / pos.initialQuantity) * 100).toFixed(0)}%)
                      </span>
                    </div>
                    
                    {pos.partialCloses.tp1 > 0 && (
                      <div className="flex justify-between text-[8px] text-gray-500 font-bold uppercase italic">
                        <span>Closed at TP1:</span>
                        <span>{pos.partialCloses.tp1.toFixed(4)} (-40%)</span>
                      </div>
                    )}
                    {pos.partialCloses.tp2 > 0 && (
                      <div className="flex justify-between text-[8px] text-gray-500 font-bold uppercase italic">
                        <span>Closed at TP2:</span>
                        <span>{pos.partialCloses.tp2.toFixed(4)} (-30%)</span>
                      </div>
                    )}
                  </div>

                  {/* STOP LOSS & TP INFO */}
                  <div className="space-y-1 mb-2">
                    <div className="flex items-center gap-2 text-[9px] font-black uppercase">
                      <span className="text-[#848e9c]">CURRENT STOP:</span>
                      <span className="text-[#f84960] font-mono flex items-center gap-1">
                        ${formatPrice(pos.stopLoss)}
                        {pos.trailingStopActive && <span className="text-[#fcd535] animate-bounce">↗️</span>}
                      </span>
                    </div>

                    {!pos.trailingStopActive && (
                      <div className="flex items-center gap-2 text-[9px] font-black uppercase">
                        <span className="text-[#848e9c]">TP2 TARGET:</span>
                        <span className="text-[#00c076] font-mono">
                          ${formatPrice(pos.tp2)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* RISK BAR */}
                  <div className="mb-2">
                    {getRiskBar(pos)}
                  </div>

                  {/* CLOSE BUTTON */}
                  <button onClick={(e) => { e.stopPropagation(); onManualClose(pos.id); }} className="w-full py-1.5 bg-[#f84960]/10 border border-[#f84960]/30 rounded-lg text-[#f84960] text-[9px] font-black uppercase hover:bg-[#f84960] hover:text-white transition-all">Liquidate Remainder</button>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="p-4 print:p-0">
            {groupedTrades.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center opacity-30 print:hidden">
                <span className="text-4xl mb-4">📜</span>
                <span className="text-[10px] font-black uppercase tracking-widest">No trade records found</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-4 px-4 py-2 text-[9px] font-black text-[#848e9c] uppercase border-b border-[#2b3139] print:hidden">
                  <div className="col-span-1">Asset / Type</div>
                  <div className="col-span-1">Side / Lev</div>
                  <div className="col-span-1">Entry → Exit</div>
                  <div className="col-span-1">Total PNL</div>
                  <div className="col-span-1">Total ROI</div>
                  <div className="col-span-1">Final Status</div>
                  <div className="col-span-1 text-right">Last Update</div>
                </div>

                {groupedTrades.map(trade => {
                  const isExpanded = expandedTrades.has(trade.tradeId);
                  const isProfit = trade.totalPnl >= 0;
                  
                  return (
                    <div key={trade.tradeId} className="bg-[#1e2329]/30 border border-[#2b3139] rounded-lg overflow-hidden transition-all hover:border-[#474d57] print:border-black print:text-black">
                      <div 
                        className="grid grid-cols-7 gap-4 px-4 py-3 items-center cursor-pointer select-none group"
                        onClick={() => toggleExpand(trade.tradeId)}
                      >
                        <div className="col-span-1 flex items-center gap-3">
                          <span className={`text-[#fcd535] transition-transform ${isExpanded ? 'rotate-90' : 'rotate-0'}`}>▶</span>
                          <div className="flex flex-col">
                            <span 
                              onClick={(e) => { e.stopPropagation(); onSelectSymbol?.(trade.symbol); }}
                              className="text-white font-black text-[12px] group-hover:text-[#fcd535] transition-colors uppercase print:text-black"
                            >
                              {trade.symbol.replace('USDT','')}
                            </span>
                            <span className="text-[8px] font-black text-blue-400 uppercase">{trade.source}</span>
                            {trade.partials[0]?.alertType && (
                              <span className="text-[6px] font-black px-1 py-0.25 rounded bg-[#fcd535]/10 text-[#fcd535] border border-[#fcd535]/20 leading-none mt-0.5 truncate max-w-[70px]">
                                {trade.partials[0].alertType === 'WHALE_ACCUMULATION' && '🐋 WHALE'}
                                {trade.partials[0].alertType === 'INSTITUTION_ENTRY' && '🏛️ INST'}
                                {trade.partials[0].alertType === 'TREND_START' && '🚀 TREND'}
                                {trade.partials[0].alertType === 'PUMP_START' && '🔥 PUMP'}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="col-span-1">
                          <span className={`text-[10px] font-black uppercase ${trade.side === 'LONG' ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
                            {trade.side} {trade.leverage}X
                          </span>
                        </div>

                        <div className="col-span-1 font-mono text-[10px] text-[#848e9c] print:text-gray-600">
                          ${formatPrice(trade.entryPrice)} → ${formatPrice(trade.finalExitPrice)}
                        </div>

                        <div className={`col-span-1 font-black text-[11px] font-mono ${isProfit ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
                          {isProfit ? '+' : ''}{trade.totalPnl.toFixed(2)}
                        </div>

                        <div className={`col-span-1 font-black text-[10px] ${isProfit ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
                          {isProfit ? '+' : ''}{trade.totalRoi.toFixed(2)}%
                        </div>

                        <div className="col-span-1">
                          {renderReasonBadges(trade.status)}
                        </div>

                        <div className="col-span-1 text-right text-[9px] text-[#474d57] font-sans">
                          {new Date(trade.closedAt).toLocaleTimeString('en-US', { hour12: false })}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="bg-black/20 border-t border-white/5 p-4 space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                          <div className="space-y-2">
                            {trade.partials.map((p, idx) => (
                              <div key={p.id} className="flex items-center gap-4 text-[10px] text-[#848e9c] font-medium border-l-2 border-white/5 pl-4 py-1 hover:bg-white/5 rounded transition-colors">
                                <span className="w-24 font-black uppercase text-[#fcd535]">{p.reason}</span>
                                <span className="w-40 font-mono">${formatPrice(p.entryPrice)} → ${formatPrice(p.exitPrice)}</span>
                                <span className={`w-20 font-black font-mono ${p.pnl >= 0 ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
                                  {p.pnl >= 0 ? '+' : ''}{p.pnl.toFixed(2)}
                                </span>
                                <span className="w-32">QTY: {p.quantity.toFixed(4)}</span>
                                <span className={`w-20 font-black ${p.pnl >= 0 ? 'text-[#00c076]' : 'text-[#f84960]'}`}>{p.pnlPercent.toFixed(2)}% ROI</span>
                                <span className="ml-auto text-[8px] opacity-60 font-sans">{new Date(p.closedAt).toLocaleTimeString()}</span>
                              </div>
                            ))}
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-white/5 mt-2 bg-white/5 p-3 rounded-lg">
                            <div className="flex items-center gap-4">
                              <span className="text-[10px] font-black uppercase text-[#848e9c]">Trade Summary:</span>
                              <div className="flex items-center gap-2">
                                <span className={`text-[12px] font-black font-mono ${isProfit ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
                                  {isProfit ? '+' : ''}{trade.totalPnl.toFixed(2)} USDT
                                </span>
                                <span className={`text-[11px] font-black ${isProfit ? 'text-[#00c076]' : 'text-[#f84960]'}`}>
                                  ({isProfit ? '+' : ''}{trade.totalRoi.toFixed(2)}% ROI)
                                </span>
                              </div>
                            </div>
                            <div className="text-[8px] text-[#474d57] font-black uppercase tracking-widest">
                              Duration: {Math.floor((trade.closedAt - trade.timestamp) / 60000)} min
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print\\:block, .print\\:block * { visibility: visible; }
          .print\\:block { 
            position: absolute; 
            left: 0; 
            top: 0; 
            width: 100%; 
            background: white !important;
            color: black !important;
          }
          .print\\:hidden { display: none !important; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border-bottom: 1px solid #ddd !important; padding: 12px 8px !important; }
          .custom-scrollbar { overflow: visible !important; }
        }
      `}</style>
    </div>
  );
};

export default PositionsPanel;