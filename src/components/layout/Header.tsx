import { Link, useLocation } from 'react-router';
import { useEffect, useState } from 'react';
import { BrandLogo } from './BrandLogo';

export function Header() {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      const storedTheme = localStorage.getItem('theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      return storedTheme ? storedTheme === 'dark' : prefersDark;
    } catch {
      return false;
    }
  });
  const [scrolled, setScrolled] = useState(false);

  const navLinks = [
    { to: '/', label: 'Home' },
    { to: '/reports', label: 'Coverage' },
    { to: '/methodology', label: 'Methodology' },
    { to: '/about', label: 'About' },
    { to: '/disclosure', label: 'Disclosure' },
  ];

  const isActive = (path: string) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  useEffect(() => {
    const storedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = storedTheme ? storedTheme === 'dark' : prefersDark;
    setIsDarkMode(shouldUseDark);
    document.documentElement.classList.toggle('dark', shouldUseDark);
  }, []);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  const toggleDarkMode = () => {
    const nextMode = !isDarkMode;
    setIsDarkMode(nextMode);
    localStorage.setItem('theme', nextMode ? 'dark' : 'light');
    document.documentElement.classList.toggle('dark', nextMode);
  };

  return (
    <header className={`sticky top-0 z-40 transition-all duration-300 ${
      scrolled || !isHome
        ? 'bg-white/85 dark:bg-gray-950/85 backdrop-blur-2xl border-b border-gray-200/60 dark:border-gray-800/60 shadow-[0_1px_3px_rgba(0,0,0,0.05)]'
        : 'bg-transparent border-b border-transparent'
    }`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 overflow-hidden group">
            <BrandLogo
              eager
              wrapperClassName="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden shadow-lg shadow-brand-600/20 ring-1 ring-gray-200/70 dark:ring-gray-700/70 group-hover:shadow-brand-500/35 transition-shadow duration-300"
            />
            <span className="font-bold text-lg tracking-tight text-gray-900 dark:text-white whitespace-nowrap truncate">
              Sustainability<span className="text-brand-600 dark:text-brand-400">Signals</span>
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-0.5 p-1 rounded-full bg-gray-100/70 dark:bg-gray-800/50 backdrop-blur-sm">
            {navLinks.map(link => (
              <Link
                key={link.to}
                to={link.to}
                className={`relative px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 ${isActive(link.to)
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white'
                  }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right Actions */}
          <div className="hidden md:flex items-center gap-2.5">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-200 focus-ring"
              aria-label="Toggle dark mode"
              aria-pressed={isDarkMode}
              title={isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {isDarkMode ? (
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-8.66h-1M4.34 12.34h-1m14.14 6.32l-.71-.71M6.34 6.34l-.71-.71m12.02.71l-.71.71M6.34 17.66l-.71.71M12 7a5 5 0 100 10 5 5 0 000-10z" />
                </svg>
              ) : (
                <svg className="w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
            <Link
              to="/reports"
              className="group relative px-5 py-2 bg-gradient-to-r from-brand-600 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:from-brand-700 hover:to-emerald-700 shadow-md shadow-brand-600/20 hover:shadow-lg hover:shadow-brand-600/30 transition-all duration-300 hover:-translate-y-px active:translate-y-0"
            >
              <span className="relative z-10">Explore Disclosure Quality</span>
            </Link>
          </div>

          {/* Mobile Actions */}
          <div className="md:hidden flex items-center gap-1.5">
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all"
              aria-label="Toggle dark mode"
              aria-pressed={isDarkMode}
            >
              {isDarkMode ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m8.66-8.66h-1M4.34 12.34h-1m14.14 6.32l-.71-.71M6.34 6.34l-.71-.71m12.02.71l-.71.71M6.34 17.66l-.71.71M12 7a5 5 0 100 10 5 5 0 000-10z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-xl text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800 transition-all"
              aria-label="Toggle menu"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                {mobileMenuOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <div className={`md:hidden overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}`}>
          <nav className="py-3 border-t border-gray-200/60 dark:border-gray-800/60">
            <div className="flex flex-col gap-1 px-1">
              {navLinks.map(link => (
                <Link
                  key={link.to}
                  to={link.to}
                  className={`px-4 py-2.5 rounded-xl text-[15px] font-medium transition-all ${isActive(link.to)
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-400 dark:hover:text-white dark:hover:bg-gray-800/50'
                    }`}
                >
                  {link.label}
                </Link>
              ))}
              <div className="pt-2 mt-1 border-t border-gray-100 dark:border-gray-800">
                <Link
                  to="/reports"
                  className="flex items-center justify-center w-full px-4 py-2.5 bg-gradient-to-r from-brand-600 to-emerald-600 text-white text-[15px] font-semibold rounded-xl hover:from-brand-700 hover:to-emerald-700 shadow-md shadow-brand-600/20 transition-all active:scale-[0.98]"
                >
                  Explore Disclosure Quality
                </Link>
              </div>
            </div>
          </nav>
        </div>
      </div>
    </header>
  );
}
