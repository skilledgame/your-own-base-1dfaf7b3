import { Link } from 'react-router-dom';
import { useState } from 'react';
import { ChevronDown, Mail } from 'lucide-react';
import { useLanguage, SUPPORTED_LANGUAGES } from '@/contexts/LanguageContext';
import skilledLogo from '@/assets/skilled-logo.png';

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-label="X">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-label="Instagram">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" />
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" aria-label="TikTok">
    <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
  </svg>
);

const cryptoIcons = [
  { name: 'Bitcoin', logo: 'https://cryptologos.cc/logos/bitcoin-btc-logo.svg' },
  { name: 'Ethereum', logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.svg' },
  { name: 'Litecoin', logo: 'https://cryptologos.cc/logos/litecoin-ltc-logo.svg' },
  { name: 'Solana', logo: 'https://cryptologos.cc/logos/solana-sol-logo.svg' },
  { name: 'USDT', logo: 'https://cryptologos.cc/logos/tether-usdt-logo.svg' },
  { name: 'USDC', logo: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.svg' },
];

export const SiteFooterLinks = () => {
  const { t, lang, setLanguage, localePath } = useLanguage();
  const [langOpen, setLangOpen] = useState(false);
  const currentLang = SUPPORTED_LANGUAGES.find(l => l.code === lang);

  const columns = [
    {
      title: t('footer.games'),
      links: [
        { label: t('nav.chess'), path: localePath('/chess') },
        { label: t('nav.rewards'), path: localePath('/rewards') },
      ],
    },
    {
      title: t('footer.policies'),
      links: [
        { label: t('footer.terms_of_service'), path: localePath('/terms') },
        { label: t('footer.privacy_policy'), path: localePath('/privacy') },
      ],
    },
    {
      title: t('footer.promos'),
      links: [
        { label: t('footer.vip_club'), path: localePath('/vip') },
        { label: t('footer.affiliate_program'), path: localePath('/affiliate') },
      ],
    },
    {
      title: t('footer.support'),
      links: [
        { label: t('footer.help_center'), path: localePath('/#faq') },
        { label: t('footer.contact_us'), path: localePath('/contact') },
      ],
    },
  ];

  const socialLinks = [
    { icon: XIcon, href: 'https://x.com/playskilled', label: 'X' },
    { icon: InstagramIcon, href: 'https://www.instagram.com/skilledgame/', label: 'Instagram' },
    { icon: TikTokIcon, href: 'https://www.tiktok.com/@playskilled', label: 'TikTok' },
  ];

  return (
    <footer className="mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {/* Top section: logo/description + link columns */}
        <div className="py-12 sm:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-12 lg:gap-16">
            {/* Left: logo, description, contact, socials */}
            <div className="max-w-sm">
              <img src={skilledLogo} alt="Skilled" className="h-14 w-auto mb-5" />
              <p className="text-sm text-white/40 leading-relaxed mb-6">
                Skilled is a skill-based competitive gaming platform. Compete against real players in chess and other strategy games to earn rewards based on your performance.
              </p>
              <a
                href="mailto:support@playskilled.com"
                className="flex items-center gap-2 text-sm text-white/50 hover:text-white/70 transition-colors mb-6"
              >
                <Mail className="w-4 h-4" />
                support@playskilled.com
              </a>
            </div>

            {/* Right: link columns */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12">
              {columns.map((col) => (
                <div key={col.title}>
                  <h4 className="font-semibold text-white/70 mb-4 text-xs uppercase tracking-wider">
                    {col.title}
                  </h4>
                  <ul className="space-y-2.5">
                    {col.links.map((link) => (
                      <li key={link.label}>
                        <Link
                          to={link.path}
                          className="text-sm text-white/40 hover:text-white/70 transition-colors"
                        >
                          {link.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Crypto icons row */}
        <div className="py-8">
          <div className="flex flex-wrap items-center justify-center gap-5 sm:gap-8">
            {cryptoIcons.map((crypto, index) => (
              <div
                key={index}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center bg-white/[0.06] p-2 hover:bg-white/[0.1] transition-colors"
                title={crypto.name}
              >
                <img
                  src={crypto.logo}
                  alt={crypto.name}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
            <span className="text-xs text-white/30 font-medium">&amp; more...</span>
          </div>
        </div>

        {/* Language selector, social icons, copyright — all centered */}
        <div className="py-8 flex flex-col items-center gap-5">
          {/* Language Selector */}
          <div className="relative">
            <button
              onClick={() => setLangOpen(!langOpen)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] text-sm text-white/40 hover:bg-white/[0.08] hover:text-white/60 transition-colors"
            >
              {currentLang?.nativeName || 'English'}
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${langOpen ? 'rotate-180' : ''}`} />
            </button>
            {langOpen && (
              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-[#141b2d] rounded-lg overflow-hidden shadow-xl min-w-[140px] z-50">
                {SUPPORTED_LANGUAGES.map(l => (
                  <button
                    key={l.code}
                    onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/[0.08] transition-colors ${l.code === lang ? 'text-white bg-white/[0.05]' : 'text-white/40'}`}
                  >
                    {l.nativeName}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Social icons */}
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => {
              const Icon = social.icon;
              return (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full bg-white/[0.06] hover:bg-white/[0.12] flex items-center justify-center text-white/40 hover:text-white/70 transition-colors"
                  aria-label={social.label}
                >
                  <Icon />
                </a>
              );
            })}
          </div>

          {/* Copyright */}
          <p className="text-xs text-white/25">
            Copyright &copy; 2026 Skilled. All Rights Reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};
