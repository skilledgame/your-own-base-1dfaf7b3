import { useLanguage } from '@/contexts/LanguageContext';

const cryptoIcons = [
  { name: 'Bitcoin', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg' },
  { name: 'Ethereum', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg' },
  { name: 'Litecoin', logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.svg' },
  { name: 'Solana', logo: 'https://cryptologos.cc/logos/solana-sol-logo.svg' },
  { name: 'USDT', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
  { name: 'USDC', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg' },
];

export const CryptoSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative py-12 px-4 overflow-hidden bg-background">
      <div className="relative max-w-7xl mx-auto">
        <p className="text-center text-sm text-muted-foreground mb-8 uppercase tracking-wider font-medium">
          {t('footer.supported_crypto')}
        </p>
        <div className="flex flex-wrap items-center justify-center gap-6 sm:gap-10">
          {cryptoIcons.map((crypto, index) => (
            <div
              key={index}
              className="flex flex-col items-center gap-2 group"
            >
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center bg-white/10 transition-transform group-hover:scale-110 p-2.5">
                <img
                  src={crypto.logo}
                  alt={`${crypto.name} logo`}
                  className="w-full h-full object-contain"
                />
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
