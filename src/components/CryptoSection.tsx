const cryptoIcons = [
  { name: 'Bitcoin', color: '#F7931A', symbol: '₿' },
  { name: 'Ethereum', color: '#627EEA', symbol: 'Ξ' },
  { name: 'Litecoin', color: '#BFBBBB', symbol: 'Ł' },
  { name: 'Solana', color: '#00FFA3', symbol: '◎' },
  { name: 'USDT', color: '#26A17B', symbol: '₮' },
  { name: 'USDC', color: '#2775CA', symbol: '$' },
];

export const CryptoSection = () => {
  return (
    <section className="relative py-12 px-4 overflow-hidden">
      {/* Background matching VIP section */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900" />
      
      {/* Subtle decorative lines */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-[15%] w-px h-full bg-gradient-to-b from-transparent via-white/[0.03] to-transparent transform rotate-6" />
        <div className="absolute top-0 right-[20%] w-px h-full bg-gradient-to-b from-transparent via-white/[0.04] to-transparent transform -rotate-8" />
      </div>
      
      <div className="relative max-w-7xl mx-auto">
        <p className="text-center text-sm text-slate-400 mb-8 uppercase tracking-wider font-medium">
          Supported Cryptocurrencies
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {cryptoIcons.map((crypto, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2 group"
            >
              <div
                className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center text-xl sm:text-2xl font-bold transition-transform group-hover:scale-110"
                style={{ backgroundColor: crypto.color + '20', color: crypto.color }}
              >
                {crypto.symbol}
              </div>
              <span className="text-xs text-slate-400">{crypto.name}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-slate-700/50 text-slate-400 text-sm font-medium">
              +more
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
