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
  'nav.rewards': 'Rewards',
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
  'footer.games': 'Games',
  'footer.policies': 'Policies',
  'footer.terms_of_service': 'Terms of Service',
  'footer.privacy_policy': 'Privacy Policy',
  'footer.game_policy': 'Game Policy',
  'footer.promos': 'Promos',
  'footer.vip_club': 'VIP Club',
  'footer.affiliate_program': 'Affiliate Program',
  'footer.support': 'Support',
  'footer.help_center': 'Help Center',
  'footer.contact_us': 'Contact Us',
  'footer.community': 'Community',
  'footer.supported_crypto': 'Supported Cryptocurrencies',

  // Sections
  'sections.live_wins': 'Live Wins',
  'sections.weekly_leaderboard': 'Weekly Leaderboard',
  'sections.faq': 'Frequently Asked Questions',
  'sections.still_have_questions': 'Still Have Questions?',

  // FAQ
  'faq.q1': 'Is Skilled gambling?',
  'faq.a1': 'No. Skilled is a skill-based gaming platform. Unlike gambling, outcomes are determined entirely by player skill and strategy, not luck or chance. Every game relies on your abilities, practice, and decision-making.',
  'faq.q2': 'How do Skilled Coins work?',
  'faq.a2': 'Skilled Coins are in-platform tokens used to participate in games, matches, and tournaments on Skilled. Players can acquire Skilled Coins by purchasing them on the platform or through other available methods, and may also sell or withdraw them where supported. Coins are used to access skill-based competitions and features, but they do not influence game outcomes, which are determined entirely by player skill and performance. Skilled Coins are used within the Skilled ecosystem and are designed to support competitive play, progression, and rewards.',
  'faq.q3': 'How is Skilled different from gambling sites?',
  'faq.a3': 'Skilled is fundamentally different from gambling sites because all outcomes are determined solely by player skill, strategy, and decision-making—not luck or chance. Unlike gambling, where random chance and betting against the house or other players are central, Skilled offers games where success depends entirely on your abilities and performance. There is no house edge or games of chance involved. Skilled focuses on competitive, fair play—much like esports or traditional skill-based games such as chess—ensuring that the best player wins based on merit alone.',
  'faq.q4': 'How do you prevent cheating or abuse?',
  'faq.a4': 'At Skilled, maintaining a fair and competitive environment is our top priority. We use a combination of automated anti-cheat systems, real-time monitoring, and player reporting to detect and prevent cheating or abusive behavior. Our platform continuously analyzes gameplay patterns to identify suspicious activity, and any confirmed violations result in penalties, including warnings, temporary suspensions, or permanent bans. We also regularly update our security measures to stay ahead of new threats, ensuring all players can compete on a level playing field based solely on skill.',
  'faq.q5': 'What happens if a player disconnects?',
  'faq.a5': 'If a player disconnects during a game, Skilled\'s system will try to reconnect them automatically within a short time. If the player cannot rejoin, the match may be paused briefly or ended according to the specific game\'s rules. In many cases, the disconnected player may forfeit the match, and the opponent will be declared the winner based on skill and progress at the time of disconnection. This approach helps keep gameplay fair and ensures a good experience for all players.',
  'faq.q6': 'Can I play against friends?',
  'faq.a6': 'Yes! Skilled lets you challenge your friends to one-on-one matches and compete in tournaments together. You can invite friends directly through the platform and set up games with custom rules. Playing against people you know is a great way to practice, improve your skills, and enjoy competitive fun in a trusted environment.',

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

  // Rewards
  'rewards.title': 'Rewards',
  'rewards.description': 'Earn rewards by playing games, completing challenges, and climbing the leaderboard.',
  'rewards.daily': 'Daily Rewards',
  'rewards.daily_desc': 'Log in every day to claim your daily Skilled Coins bonus. The longer your streak, the bigger the reward!',
  'rewards.challenges': 'Challenges',
  'rewards.challenges_desc': 'Complete skill-based challenges to earn bonus SC. New challenges are added regularly.',
  'rewards.referral': 'Referral Bonus',
  'rewards.referral_desc': 'Invite friends to Skilled and earn SC when they sign up and play their first game.',
  'rewards.leaderboard': 'Leaderboard Prizes',
  'rewards.leaderboard_desc': 'Top players on the weekly leaderboard receive bonus SC prizes at the end of each week.',
};

const es: TranslationDict = {
  'nav.menu': 'Menú',
  'nav.games': 'Juegos',
  'nav.chess': 'Ajedrez',
  'nav.rewards': 'Recompensas',
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
  'footer.games': 'Juegos',
  'footer.policies': 'Políticas',
  'footer.terms_of_service': 'Términos de Servicio',
  'footer.privacy_policy': 'Política de Privacidad',
  'footer.game_policy': 'Política de Juego',
  'footer.promos': 'Promociones',
  'footer.vip_club': 'Club VIP',
  'footer.affiliate_program': 'Programa de Afiliados',
  'footer.support': 'Soporte',
  'footer.help_center': 'Centro de Ayuda',
  'footer.contact_us': 'Contáctanos',
  'footer.community': 'Comunidad',
  'footer.supported_crypto': 'Criptomonedas Soportadas',

  'sections.live_wins': 'Victorias en Vivo',
  'sections.weekly_leaderboard': 'Tabla Semanal',
  'sections.faq': 'Preguntas Frecuentes',
  'sections.still_have_questions': '¿Aún Tienes Preguntas?',

  'faq.q1': '¿Skilled es un juego de azar?',
  'faq.a1': 'No. Skilled es una plataforma de juegos basada en habilidad. A diferencia de los juegos de azar, los resultados se determinan completamente por la habilidad y estrategia del jugador, no por suerte o azar. Cada juego depende de tus habilidades, práctica y toma de decisiones.',
  'faq.q2': '¿Cómo funcionan las Skilled Coins?',
  'faq.a2': 'Las Skilled Coins son tokens dentro de la plataforma que se utilizan para participar en juegos, partidas y torneos en Skilled. Los jugadores pueden adquirir Skilled Coins comprándolas en la plataforma o por otros métodos disponibles, y también pueden venderlas o retirarlas donde sea compatible. Las monedas se usan para acceder a competencias y funciones basadas en habilidad, pero no influyen en los resultados del juego, que se determinan completamente por la habilidad y el rendimiento del jugador.',
  'faq.q3': '¿En qué se diferencia Skilled de los sitios de apuestas?',
  'faq.a3': 'Skilled es fundamentalmente diferente de los sitios de apuestas porque todos los resultados se determinan únicamente por la habilidad, estrategia y toma de decisiones del jugador, no por suerte o azar. No hay ventaja de la casa ni juegos de azar involucrados. Skilled se enfoca en el juego competitivo y justo, similar a los esports o juegos tradicionales basados en habilidad como el ajedrez.',
  'faq.q4': '¿Cómo previenen las trampas o el abuso?',
  'faq.a4': 'En Skilled, mantener un entorno justo y competitivo es nuestra máxima prioridad. Utilizamos una combinación de sistemas anti-trampas automatizados, monitoreo en tiempo real y reportes de jugadores para detectar y prevenir trampas o comportamiento abusivo. Nuestra plataforma analiza continuamente los patrones de juego para identificar actividad sospechosa.',
  'faq.q5': '¿Qué pasa si un jugador se desconecta?',
  'faq.a5': 'Si un jugador se desconecta durante un juego, el sistema de Skilled intentará reconectarlo automáticamente en poco tiempo. Si el jugador no puede volver a unirse, la partida puede pausarse brevemente o terminar según las reglas del juego específico. En muchos casos, el jugador desconectado puede perder la partida y el oponente será declarado ganador.',
  'faq.q6': '¿Puedo jugar contra amigos?',
  'faq.a6': '¡Sí! Skilled te permite desafiar a tus amigos a partidas uno contra uno y competir en torneos juntos. Puedes invitar amigos directamente a través de la plataforma y configurar juegos con reglas personalizadas.',

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

  'rewards.title': 'Recompensas',
  'rewards.description': 'Gana recompensas jugando, completando desafíos y subiendo en la clasificación.',
  'rewards.daily': 'Recompensas Diarias',
  'rewards.daily_desc': '¡Inicia sesión todos los días para reclamar tu bonificación diaria de Skilled Coins. Cuanto más larga sea tu racha, mayor será la recompensa!',
  'rewards.challenges': 'Desafíos',
  'rewards.challenges_desc': 'Completa desafíos basados en habilidad para ganar SC extra. Se agregan nuevos desafíos regularmente.',
  'rewards.referral': 'Bono por Referido',
  'rewards.referral_desc': 'Invita amigos a Skilled y gana SC cuando se registren y jueguen su primera partida.',
  'rewards.leaderboard': 'Premios del Ranking',
  'rewards.leaderboard_desc': 'Los mejores jugadores del ranking semanal reciben premios de SC extra al final de cada semana.',
};

const hi: TranslationDict = {
  'nav.menu': 'मेनू',
  'nav.games': 'खेल',
  'nav.chess': 'शतरंज',
  'nav.rewards': 'पुरस्कार',
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
  'footer.games': 'खेल',
  'footer.policies': 'नीतियां',
  'footer.terms_of_service': 'सेवा की शर्तें',
  'footer.privacy_policy': 'गोपनीयता नीति',
  'footer.game_policy': 'खेल नीति',
  'footer.promos': 'प्रचार',
  'footer.vip_club': 'VIP क्लब',
  'footer.affiliate_program': 'सहबद्ध कार्यक्रम',
  'footer.support': 'सहायता',
  'footer.help_center': 'सहायता केंद्र',
  'footer.contact_us': 'संपर्क करें',
  'footer.community': 'समुदाय',
  'footer.supported_crypto': 'समर्थित क्रिप्टोकरेंसी',

  'sections.live_wins': 'लाइव जीत',
  'sections.weekly_leaderboard': 'साप्ताहिक लीडरबोर्ड',
  'sections.faq': 'अक्सर पूछे जाने वाले प्रश्न',
  'sections.still_have_questions': 'अभी भी प्रश्न हैं?',

  'faq.q1': 'क्या Skilled जुआ है?',
  'faq.a1': 'नहीं। Skilled एक कौशल-आधारित गेमिंग प्लेटफॉर्म है। जुआ के विपरीत, परिणाम पूरी तरह से खिलाड़ी के कौशल और रणनीति से निर्धारित होते हैं, भाग्य या संयोग से नहीं। हर खेल आपकी क्षमताओं, अभ्यास और निर्णय लेने पर निर्भर करता है।',
  'faq.q2': 'Skilled Coins कैसे काम करते हैं?',
  'faq.a2': 'Skilled Coins प्लेटफॉर्म के भीतर के टोकन हैं जो Skilled पर खेलों, मैचों और टूर्नामेंट में भाग लेने के लिए उपयोग किए जाते हैं। खिलाड़ी प्लेटफॉर्म पर खरीदकर या अन्य उपलब्ध तरीकों से Skilled Coins प्राप्त कर सकते हैं। सिक्के कौशल-आधारित प्रतियोगिताओं तक पहुंचने के लिए उपयोग किए जाते हैं लेकिन खेल के परिणामों को प्रभावित नहीं करते।',
  'faq.q3': 'Skilled जुआ साइटों से कैसे अलग है?',
  'faq.a3': 'Skilled जुआ साइटों से मौलिक रूप से अलग है क्योंकि सभी परिणाम केवल खिलाड़ी के कौशल, रणनीति और निर्णय लेने से निर्धारित होते हैं। कोई हाउस एज या संयोग के खेल शामिल नहीं हैं। Skilled प्रतिस्पर्धी, निष्पक्ष खेल पर केंद्रित है।',
  'faq.q4': 'आप धोखाधड़ी या दुरुपयोग को कैसे रोकते हैं?',
  'faq.a4': 'Skilled में, एक निष्पक्ष और प्रतिस्पर्धी वातावरण बनाए रखना हमारी सर्वोच्च प्राथमिकता है। हम धोखाधड़ी या अपमानजनक व्यवहार का पता लगाने और रोकने के लिए स्वचालित एंटी-चीट सिस्टम, रीयल-टाइम मॉनिटरिंग और खिलाड़ी रिपोर्टिंग के संयोजन का उपयोग करते हैं।',
  'faq.q5': 'अगर कोई खिलाड़ी डिस्कनेक्ट हो जाता है तो क्या होता है?',
  'faq.a5': 'यदि कोई खिलाड़ी खेल के दौरान डिस्कनेक्ट हो जाता है, तो Skilled का सिस्टम उन्हें थोड़े समय में स्वचालित रूप से फिर से कनेक्ट करने का प्रयास करेगा। यदि खिलाड़ी फिर से शामिल नहीं हो सकता, तो मैच को संक्षेप में रोका जा सकता है या खेल के नियमों के अनुसार समाप्त किया जा सकता है।',
  'faq.q6': 'क्या मैं दोस्तों के खिलाफ खेल सकता हूं?',
  'faq.a6': 'हां! Skilled आपको अपने दोस्तों को एक-एक मैच के लिए चुनौती देने और एक साथ टूर्नामेंट में प्रतिस्पर्धा करने की अनुमति देता है। आप प्लेटफॉर्म के माध्यम से सीधे दोस्तों को आमंत्रित कर सकते हैं और कस्टम नियमों के साथ गेम सेट कर सकते हैं।',

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

  'rewards.title': 'पुरस्कार',
  'rewards.description': 'खेल खेलकर, चुनौतियां पूरी करके और लीडरबोर्ड पर चढ़कर पुरस्कार अर्जित करें।',
  'rewards.daily': 'दैनिक पुरस्कार',
  'rewards.daily_desc': 'अपना दैनिक Skilled Coins बोनस पाने के लिए हर दिन लॉग इन करें। जितनी लंबी आपकी स्ट्रीक, उतना बड़ा इनाम!',
  'rewards.challenges': 'चुनौतियां',
  'rewards.challenges_desc': 'बोनस SC अर्जित करने के लिए कौशल-आधारित चुनौतियां पूरी करें। नियमित रूप से नई चुनौतियां जोड़ी जाती हैं।',
  'rewards.referral': 'रेफरल बोनस',
  'rewards.referral_desc': 'दोस्तों को Skilled पर आमंत्रित करें और जब वे साइन अप करें और अपना पहला गेम खेलें तो SC अर्जित करें।',
  'rewards.leaderboard': 'लीडरबोर्ड पुरस्कार',
  'rewards.leaderboard_desc': 'साप्ताहिक लीडरबोर्ड पर शीर्ष खिलाड़ियों को प्रत्येक सप्ताह के अंत में बोनस SC पुरस्कार मिलते हैं।',
};

export const translations: Record<Language, TranslationDict> = { en, es, hi };
