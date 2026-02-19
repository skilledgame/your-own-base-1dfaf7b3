export type Language = 'en' | 'es' | 'hi';

export const SUPPORTED_LANGUAGES: { code: Language; nativeName: string }[] = [
  { code: 'en', nativeName: 'English' },
  { code: 'es', nativeName: 'Español' },
  { code: 'hi', nativeName: 'हिन्दी' },
];

export const LANG_CODES = ['es', 'hi'] as const;

type TranslationDict = Record<string, string>;

const en: TranslationDict = {
  // Sidebar navigation
  'nav.menu': 'Menu',
  'nav.games': 'Games',
  'nav.chess': 'Chess',
  'nav.clan': 'Clan',
  'nav.legal': 'Legal & Support',
  'nav.terms': 'Terms & Conditions',
  'nav.privacy': 'Privacy Policy',
  'nav.help': 'Help & FAQ',
  'nav.contact': 'Contact Us',
  'nav.account': 'Account',
  'nav.settings': 'Settings',
  'nav.dark_mode': 'Dark Mode',
  'nav.sign_out': 'Sign Out',
  'nav.get_started': 'Get Started',
  'nav.total_sc_earned': 'Total SC Earned',
  'nav.coming_soon': 'Coming Soon',

  // Hero section
  'hero.title1': 'Win Real Money',
  'hero.title2': 'With Your Skills',
  'hero.description': 'Not gambling. Beat real opponents in skill-based games and cash out your winnings. Your skill = your earnings.',
  'hero.register': 'Register',
  'hero.or': 'Or',

  // Common
  'common.sign_in': 'Sign In',
  'common.get_started': 'Get Started',
  'common.admin': 'Admin',
  'common.search': 'Search',
  'common.loading': 'Loading...',

  // Games
  'games.skilled_originals': 'Skilled Originals',
  'games.live': 'LIVE',
  'games.coming_soon': 'Coming Soon',

  // Footer
  'footer.terms': 'Terms',
  'footer.privacy': 'Privacy',
  'footer.copyright': '© 2025 Skilled. Skill-based competition only.',

  // Sections
  'sections.live_wins': 'Live Wins',
  'sections.weekly_leaderboard': 'Weekly Leaderboard',
  'sections.faq': 'Frequently Asked Questions',

  // VIP
  'vip.progress': 'VIP Progress',

  // Friends
  'friends.title': 'Friends',
  'friends.add': 'Add Friend',

  // Stats
  'stats.title': 'Statistics',

  // Settings
  'settings.title': 'Settings',

  // Deposit
  'deposit.title': 'Deposit',

  // Withdraw
  'withdraw.title': 'Withdraw',

  // Auth
  'auth.sign_in': 'Sign In',
  'auth.sign_up': 'Sign Up',
  'auth.email': 'Email',
  'auth.password': 'Password',

  // How it works
  'how_it_works.title': 'How It Works',

  // Leaderboard
  'leaderboard.title': 'Leaderboard',
  'leaderboard.weekly': 'Weekly Leaderboard',

  // Game history
  'game_history.title': 'Game History',

  // Affiliate
  'affiliate.title': 'Affiliate',
};

const es: TranslationDict = {
  'nav.menu': 'Menú',
  'nav.games': 'Juegos',
  'nav.chess': 'Ajedrez',
  'nav.clan': 'Clan',
  'nav.legal': 'Legal y Soporte',
  'nav.terms': 'Términos y Condiciones',
  'nav.privacy': 'Política de Privacidad',
  'nav.help': 'Ayuda y FAQ',
  'nav.contact': 'Contáctanos',
  'nav.account': 'Cuenta',
  'nav.settings': 'Configuración',
  'nav.dark_mode': 'Modo Oscuro',
  'nav.sign_out': 'Cerrar Sesión',
  'nav.get_started': 'Comenzar',
  'nav.total_sc_earned': 'Total SC Ganados',
  'nav.coming_soon': 'Próximamente',

  'hero.title1': 'Gana Dinero Real',
  'hero.title2': 'Con Tus Habilidades',
  'hero.description': 'No es azar. Vence a oponentes reales en juegos de habilidad y retira tus ganancias. Tu habilidad = tus ganancias.',
  'hero.register': 'Registrarse',
  'hero.or': 'O',

  'common.sign_in': 'Iniciar Sesión',
  'common.get_started': 'Comenzar',
  'common.admin': 'Admin',
  'common.search': 'Buscar',
  'common.loading': 'Cargando...',

  'games.skilled_originals': 'Originales de Skilled',
  'games.live': 'EN VIVO',
  'games.coming_soon': 'Próximamente',

  'footer.terms': 'Términos',
  'footer.privacy': 'Privacidad',
  'footer.copyright': '© 2025 Skilled. Solo competencia basada en habilidad.',

  'sections.live_wins': 'Victorias en Vivo',
  'sections.weekly_leaderboard': 'Tabla Semanal',
  'sections.faq': 'Preguntas Frecuentes',

  'vip.progress': 'Progreso VIP',

  'friends.title': 'Amigos',
  'friends.add': 'Agregar Amigo',

  'stats.title': 'Estadísticas',
  'settings.title': 'Configuración',
  'deposit.title': 'Depositar',
  'withdraw.title': 'Retirar',

  'auth.sign_in': 'Iniciar Sesión',
  'auth.sign_up': 'Registrarse',
  'auth.email': 'Correo electrónico',
  'auth.password': 'Contraseña',

  'how_it_works.title': 'Cómo Funciona',
  'leaderboard.title': 'Clasificación',
  'leaderboard.weekly': 'Clasificación Semanal',
  'game_history.title': 'Historial de Juegos',
  'affiliate.title': 'Afiliado',
};

const hi: TranslationDict = {
  'nav.menu': 'मेनू',
  'nav.games': 'खेल',
  'nav.chess': 'शतरंज',
  'nav.clan': 'कुल',
  'nav.legal': 'कानूनी और सहायता',
  'nav.terms': 'नियम और शर्तें',
  'nav.privacy': 'गोपनीयता नीति',
  'nav.help': 'सहायता और FAQ',
  'nav.contact': 'संपर्क करें',
  'nav.account': 'खाता',
  'nav.settings': 'सेटिंग्स',
  'nav.dark_mode': 'डार्क मोड',
  'nav.sign_out': 'साइन आउट',
  'nav.get_started': 'शुरू करें',
  'nav.total_sc_earned': 'कुल SC अर्जित',
  'nav.coming_soon': 'जल्द आ रहा है',

  'hero.title1': 'असली पैसे जीतें',
  'hero.title2': 'अपने कौशल से',
  'hero.description': 'जुआ नहीं। कौशल-आधारित खेलों में असली प्रतिद्वंद्वियों को हराएं और अपनी जीत निकालें। आपका कौशल = आपकी कमाई।',
  'hero.register': 'रजिस्टर करें',
  'hero.or': 'या',

  'common.sign_in': 'साइन इन',
  'common.get_started': 'शुरू करें',
  'common.admin': 'एडमिन',
  'common.search': 'खोजें',
  'common.loading': 'लोड हो रहा है...',

  'games.skilled_originals': 'स्किल्ड ओरिजिनल्स',
  'games.live': 'लाइव',
  'games.coming_soon': 'जल्द आ रहा है',

  'footer.terms': 'नियम',
  'footer.privacy': 'गोपनीयता',
  'footer.copyright': '© 2025 Skilled. केवल कौशल-आधारित प्रतियोगिता।',

  'sections.live_wins': 'लाइव जीत',
  'sections.weekly_leaderboard': 'साप्ताहिक लीडरबोर्ड',
  'sections.faq': 'अक्सर पूछे जाने वाले प्रश्न',

  'vip.progress': 'VIP प्रगति',

  'friends.title': 'दोस्त',
  'friends.add': 'दोस्त जोड़ें',

  'stats.title': 'आंकड़े',
  'settings.title': 'सेटिंग्स',
  'deposit.title': 'जमा करें',
  'withdraw.title': 'निकासी',

  'auth.sign_in': 'साइन इन',
  'auth.sign_up': 'साइन अप',
  'auth.email': 'ईमेल',
  'auth.password': 'पासवर्ड',

  'how_it_works.title': 'यह कैसे काम करता है',
  'leaderboard.title': 'लीडरबोर्ड',
  'leaderboard.weekly': 'साप्ताहिक लीडरबोर्ड',
  'game_history.title': 'खेल इतिहास',
  'affiliate.title': 'सहबद्ध',
};

export const translations: Record<Language, TranslationDict> = { en, es, hi };
