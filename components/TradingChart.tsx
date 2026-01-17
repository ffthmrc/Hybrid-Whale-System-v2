import React, { useEffect, useRef } from 'react';

interface Props {
  symbol: string;
}

declare const TradingView: any;

const TradingChart: React.FC<Props> = ({ symbol }) => {
  const containerId = `tv_chart_${symbol.toLowerCase()}_${Math.floor(Math.random() * 1000)}`;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let tvWidget: any = null;

    const initChart = () => {
      if (typeof TradingView !== 'undefined' && containerRef.current) {
        containerRef.current.innerHTML = '';
        const widgetDiv = document.createElement('div');
        widgetDiv.id = containerId;
        widgetDiv.style.height = '100%';
        widgetDiv.style.width = '100%';
        containerRef.current.appendChild(widgetDiv);

        const systemTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        tvWidget = new TradingView.widget({
          autosize: true,
          symbol: `BINANCE:${symbol}.P`,
          interval: '1',               // intraday is required for countdown[web:17]
          timezone: systemTimezone,
          theme: 'dark',
          style: '1',
          locale: 'en',
          toolbar_bg: '#0b0e11',
          enable_publishing: false,
          hide_top_toolbar: false,
          hide_legend: false,
          save_image: true,
          container_id: containerId,
          backgroundColor: '#0b0e11',
          gridColor: 'rgba(43, 49, 57, 0.5)',
          withdateranges: false,
          allow_symbol_change: true,
          details: false,
          hotkeys: false,
          calendar: false,
          stocktools: false,
          hide_side_toolbar: false,
          studies: ['EMA@tv-basicstudies'],
          studies_overrides: {
            'EMA@tv-basicstudies.length': 200,
          },
          overrides: {
            'mainSeriesProperties.showCountdown': true, // enable countdown on price scale[web:14][web:17]
          },
          
          show_popup_button: false,
          popup_width: '1000',
          popup_height: '650',
        });
      }
    };

    const timer = setTimeout(initChart, 200);

    return () => {
      clearTimeout(timer);
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
    };
  }, [symbol]);

  return (
    <div ref={containerRef} className="w-full h-full bg-[#0b0e11]" />
  );
};

export default TradingChart;
