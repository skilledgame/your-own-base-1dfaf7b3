import { Link, useNavigate } from 'react-router-dom';
import skilledLogo from '@/assets/skilled-logo.png';

interface LogoLinkProps {
  className?: string;
  onClick?: () => void;
}

export const LogoLink = ({ className = "h-8", onClick }: LogoLinkProps) => {
  const navigate = useNavigate();

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onClick?.();
    navigate('/');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <a href="/" onClick={handleClick} className="cursor-pointer">
      <img src={skilledLogo} alt="Skilled" className={`${className} w-auto`} />
    </a>
  );
};
