import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import {
  HomeIcon,
  MagnifyingGlassIcon,
  ClockIcon,
  DocumentTextIcon,
  ArrowRightOnRectangleIcon,
  GlobeAltIcon,
  SunIcon,
  MoonIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline';

const Layout = () => {
  const { logout, user }       = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location               = useLocation();
  const navigate               = useNavigate();

  const handleLogout = () => { logout(); navigate('/login'); };

  const nav = [
    { name: 'Dashboard', href: '/',        icon: HomeIcon },
    { name: 'New Scan',  href: '/scan',    icon: MagnifyingGlassIcon },
    { name: 'History',   href: '/history', icon: ClockIcon },
    { name: 'Targets',   href: '/targets', icon: GlobeAltIcon },
    { name: 'Reports',   href: '/reports', icon: DocumentTextIcon },
  ];

  const isActive = (href) =>
    href === '/' ? location.pathname === '/' : location.pathname.startsWith(href);

  return (
    <div style={{ minHeight: '100vh', backgroundColor: 'var(--bg-primary)' }}>

      {/* ── Navbar ── */}
      <nav style={{
        backgroundColor: 'var(--nav-bg)',
        borderBottom:    '1px solid var(--nav-border)',
        position:        'sticky',
        top:             0,
        zIndex:          40,
        boxShadow:       '0 1px 3px rgba(0,0,0,0.15)',
      }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">

            {/* Logo + links */}
            <div className="flex items-center">
              <div className="flex items-center gap-2 mr-8">
                <ShieldCheckIcon className="w-7 h-7" style={{ color: 'var(--accent)' }} />
                <span className="text-xl font-bold tracking-tight" style={{ color: 'var(--accent)' }}>
                  ThreatLens
                </span>
              </div>

              <div className="hidden sm:flex sm:items-center sm:space-x-1">
                {nav.map(({ name, href, icon: Icon }) => (
                  <Link
                    key={name}
                    to={href}
                    className="nav-link"
                    style={isActive(href)
                      ? { borderBottomColor: 'var(--accent)', color: 'var(--accent)' }
                      : { borderBottomColor: 'transparent', color: 'var(--nav-text)' }
                    }
                    onMouseEnter={(e) => {
                      if (!isActive(href)) e.currentTarget.style.color = 'var(--text-primary)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive(href)) e.currentTarget.style.color = 'var(--nav-text)';
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {name}
                  </Link>
                ))}
              </div>
            </div>

            {/* Right side */}
            <div className="flex items-center gap-2">

              {/* Theme toggle */}
              <button
                onClick={toggleTheme}
                title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="p-2 rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--nav-hover-bg)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                {theme === 'dark'
                  ? <SunIcon  className="w-5 h-5" />
                  : <MoonIcon className="w-5 h-5" />
                }
              </button>

              {/* User name */}
              {user && (
                <span className="hidden md:block text-sm" style={{ color: 'var(--text-muted)' }}>
                  {user.firstName || user.email}
                </span>
              )}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition-colors"
                style={{ color: 'var(--text-muted)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--nav-hover-bg)';
                  e.currentTarget.style.color = 'var(--text-primary)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Page content ── */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
