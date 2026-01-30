import { Link, useLocation } from 'react-router-dom';
import { Menu, Search, Wallet, Swords, User } from 'lucide-react';

interface MobileBottomNavProps {
  onMenuClick?: () => void;
}

const navItems = [
  { icon: Menu, label: 'Menu', path: null, isMenu: true },
  { icon: Search, label: 'Search', path: '/search', isMenu: false },
  { icon: Wallet, label: 'Wallet', path: '/deposit', isMenu: false },
  { icon: Swords, label: 'Compete', path: '/compete', isMenu: false },
  { icon: User, label: 'Stats', path: '/stats', isMenu: false },
];

export const MobileBottomNav = ({ onMenuClick }: MobileBottomNavProps) => {
  const location = useLocation();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item, index) => {
          const isActive = item.path ? location.pathname === item.path : false;
          
          if (item.isMenu) {
            return (
              <button
                key={index}
                onClick={onMenuClick}
                className="flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-colors duration-200 text-muted-foreground active:text-primary"
              >
                <item.icon className="w-5 h-5" />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          }
          
          return (
            <Link
              key={item.path}
              to={item.path!}
              className={`
                flex flex-col items-center justify-center gap-0.5 flex-1 h-full
                transition-colors duration-200
                ${isActive ? 'text-primary' : 'text-muted-foreground'}
              `}
            >
              <item.icon className={`w-5 h-5 ${isActive ? 'text-primary' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
