import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { LayoutDashboard, Radio, FileAudio, FileText, Network, Settings as SettingsIcon, ShieldAlert } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import LiveMonitor from './pages/LiveMonitor';

function Sidebar() {
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
    { icon: Radio, label: 'Live Monitor', path: '/monitor' },
    { icon: FileAudio, label: 'Audio Analysis', path: '/audio' },
    { icon: FileText, label: 'Text Analysis', path: '/text' },
    { icon: Network, label: 'Network Graph', path: '/network' },
    { icon: SettingsIcon, label: 'Settings', path: '/settings' },
  ];

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
          <div className="w-10 h-10 rounded-full bg-surface border border-white/10 flex items-center justify-center">
            <span className="font-bold text-white">AR</span>
          </div>
          <div>
            <p className="text-sm font-medium text-white">Akshith Reddy</p>
            <p className="text-xs text-secondary">Lead Analyst</p>
          </div>
        </div>
      </div>
    </aside>
  );
}

import AudioAnalysis from './pages/AudioAnalysis';
import TextAnalysis from './pages/TextAnalysis';
import NetworkGraph from './pages/NetworkGraph';
import Settings from './pages/Settings';

function App() {
  return (
    <Router>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <main className="flex-1 ml-64 p-8">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/monitor" element={<LiveMonitor />} />
            <Route path="/audio" element={<AudioAnalysis />} />
            <Route path="/text" element={<TextAnalysis />} />
            <Route path="/network" element={<NetworkGraph />} />
            <Route path="/settings" element={<Settings />} />
            {/* Placeholder routes for others */}
            <Route path="*" element={<div className="p-12 text-secondary flex items-center justify-center h-full glass-panel"><p>Module coming soon.</p></div>} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
