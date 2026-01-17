
import React, { useState } from 'react';
import { SymbolData } from '../types';

interface Props {
  data: Record<string, SymbolData>;
  selected: string;
  onSelect: (s: string) => void;
  trends: Record<string, 'up' | 'down' | null>;
}

type Tab = 'gainers' | 'losers' | 'volume';

const MarketOverview: React.FC<Props> = ({ data, selected, onSelect, trends }) => {
  const [tab, setTab] = useState<Tab>('gainers');
  
  const allSymbols = Object.values(data) as SymbolData[];

  const filtered = [...allSymbols].sort((a, b) => {
    if (tab === 'gainers') return b.change24h - a.change24h;
    if (tab === 'losers') return a.change24h - b.change24h;
    if (tab === 'volume') return b.volume - a.volume;
    return 0;
  }).slice(0, 30);

  const formatPrice = (p: number) => {
    return p.toFixed(8).replace(/\.?0+$/, '');
  };

  return (
    <div className="flex flex-col h-full w-full bg-[#0b0e11] select-none">
      <div className="p-3 bg-[#0b0e11] sticky top-0 z-10 border-b border-[#2b3139]/50">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-1 h-4 bg-[#fcd535] rounded-full"></div>
          <h1 className="text-white font-black tracking-widest text-[11px] uppercase">Market Dashboard</h1>
        </div>
        <div className="flex bg-white/5 p-0.5 rounded-md">
          {(['gainers', 'losers', 'volume'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`flex-1 py-1 text-[9px] font-black uppercase rounded transition-all ${tab === t ? 'bg-[#fcd535] text-black shadow-inner' : 'text-[#848e9c] hover:text-white hover:bg-white/5'}`}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.map((s, idx) => {
          const isSelected = selected === s.symbol;
          const isBullish = s.change24h >= 0;
          const currentTrend = trends[s.symbol];
          return (
            <div key={s.symbol} onClick={() => onSelect(s.symbol)} className={`px-2.5 py-2.5 cursor-pointer hover:bg-white/5 border-b border-white/5 transition-colors flex items-center group relative ${isSelected ? 'bg-[#fcd535]/10 border-l-4 border-l-[#fcd535]' : ''}`}>
              <div className="flex-none w-5 text-[9px] font-black text-[#474d57] shrink-0">{idx + 1}</div>
              <div className="flex-1 min-w-0 pr-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[12px] font-black text-white group-hover:text-[#fcd535] transition-colors leading-none uppercase">{s.symbol.replace('USDT', '')}</span>
                  {currentTrend && (
                    <div className={`shrink-0 animate-bounce`}>
                      {currentTrend === 'up' ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-[#00c076]"><path d="M12 19V5M12 5L5 12M12 5L19 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" className="text-[#f84960]"><path d="M12 5V19M12 19L5 12M12 19L19 12" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </div>
                  )}
                  <div className="shrink-0 h-4 flex items-center ml-auto opacity-40">
                    {isBullish ? (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-[#00c076]"><path d="M7 17L17 7M17 7H7M17 7V17" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    ) : (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-[#f84960]"><path d="M7 7L17 17M17 17V7M17 17H7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </div>
                </div>
                <div className="text-[11px] font-black text-[#eaecef] font-mono mt-0.5">${formatPrice(s.price)}</div>
              </div>
              <div className="flex flex-col items-end shrink-0 ml-2">
                <div className={`text-[12px] font-black leading-none ${isBullish ? 'text-[#00c076]' : 'text-[#f84960]'}`}>{isBullish ? '+' : ''}{s.change24h.toFixed(1)}%</div>
                <div className="text-[7px] text-[#474d57] font-black uppercase mt-1">VOL: {(s.volume / 1000000).toFixed(1)}M</div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
export default MarketOverview;
