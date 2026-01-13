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
    <section className="py-12 px-4 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <p className="text-center text-sm text-muted-foreground mb-8 uppercase tracking-wider font-medium">
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
              <span className="text-xs text-muted-foreground">{crypto.name}</span>
            </div>
          ))}
          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-muted text-muted-foreground text-sm font-medium">
              +more
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
