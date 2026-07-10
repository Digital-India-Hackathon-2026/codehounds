import { BrowserRouter as Router, Routes, Route, NavLink, Navigate, Outlet } from 'react-router-dom';
import { LayoutDashboard, Radio, FileAudio, FileText, Network, Settings as SettingsIcon, ShieldAlert, LogOut } from 'lucide-react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import LiveMonitor from './pages/LiveMonitor';
import AudioAnalysis from './pages/AudioAnalysis';
import TextAnalysis from './pages/TextAnalysis';
import NetworkGraph from './pages/NetworkGraph';
import Settings from './pages/Settings';
import Login from './pages/Auth/Login';
import Register from './pages/Auth/Register';

// Guard: redirect to /login if not authenticated
function PrivateRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <ShieldAlert className="w-10 h-10 text-white animate-pulse" />
          <p className="text-secondary font-mono text-sm tracking-widest">INITIALIZING ASTRA...</p>
        </div>
      </div>
    );
  }
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function Sidebar() {
  const { user, logout } = useAuth();

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Radio, label: 'Live Monitor', path: '/monitor' },
    { icon: FileAudio, label: 'Audio Analysis', path: '/audio' },
    { icon: FileText, label: 'Text Analysis', path: '/text' },
    { icon: Network, label: 'Network Graph', path: '/network' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

  const initials = user?.username
    ? user.username.slice(0, 2).toUpperCase()
    : 'AR';

  return (
    <aside className="w-64 h-screen fixed left-0 top-0 glass-panel border-l-0 border-y-0 rounded-none rounded-r-3xl flex flex-col p-6 z-50">
      <div className="flex items-center gap-3 mb-12">
        <div className="bg-white/10 p-2 rounded-xl border border-white/20">
          <ShieldAlert className="text-white w-6 h-6" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-wide text-white">ASTR<span className="text-error">A</span></h1>
          <p className="text-[10px] font-mono text-secondary tracking-widest uppercase">Scam Intelligence</p>
        </div>
      </div>

      <nav className="flex-1 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            end={item.path === '/'}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                isActive
                  ? 'bg-white/10 text-white border border-white/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]'
                  : 'text-secondary hover:text-white hover:bg-white/5'
              }`
            }
          >
            <item.icon className="w-5 h-5" />
            <span className="font-medium text-sm">{item.label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto pt-6 border-t border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center flex-shrink-0">
            <span className="font-bold text-white text-sm">{initials}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">{user?.username || 'Analyst'}</p>
            <p className="text-xs text-secondary capitalize">{user?.role || 'analyst'}</p>
          </div>
          <button
            onClick={logout}
            title="Sign out"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-secondary hover:text-white hover:bg-white/10 transition-all flex-shrink-0"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

function AppLayout() {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-64 p-8">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public auth routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Protected app routes */}
          <Route element={<PrivateRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/monitor" element={<LiveMonitor />} />
              <Route path="/audio" element={<AudioAnalysis />} />
              <Route path="/text" element={<TextAnalysis />} />
              <Route path="/network" element={<NetworkGraph />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<div className="p-12 text-secondary flex items-center justify-center h-full glass-panel"><p>Module coming soon.</p></div>} />
            </Route>
          </Route>
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
