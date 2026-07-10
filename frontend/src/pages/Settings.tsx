import React, { useState, useEffect } from 'react';
import { 
  UserCircle, Shield, Radar, Cpu, Download, Trash2, 
  Copy, Bell, HardDrive, ShieldAlert, KeyRound, LogOut, CheckCircle2 
} from 'lucide-react';
import { fetchAPI } from '../lib/api';

export default function Settings() {
  // Profile state
  const [profile, setProfile] = useState<any>({ username: '', email: '', role: '', created_at: '' });
  const [editUsername, setEditUsername] = useState('');
  const [editEmail, setEditEmail] = useState('');
  
  // Detection preferences state
  const [settings, setSettings] = useState<any>({
    alert_threshold: 80.0,
    sound_alerts: true,
    auto_save: true,
    language: 'en',
    whisper_language: 'en',
    min_confidence: 0.40,
    threat_threshold: 0.70,
    risk_threshold: 0.50,
    rag_similarity_threshold: 0.60,
    auto_save_reports: true,
    auto_export: false,
    realtime_notifications: true
  });

  // Password state
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Statuses & Health state
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [keyVisible, setKeyVisible] = useState(false);

  async function loadSettingsData() {
    try {
      const [profileRes, settingsRes, statsRes] = await Promise.all([
        fetchAPI('/settings/profile'),
        fetchAPI('/settings/me'),
        fetchAPI('/dashboard/stats')
      ]);
      setProfile(profileRes);
      setEditUsername(profileRes.username);
      setEditEmail(profileRes.email);
      setSettings(settingsRes);
      setHealth(statsRes.system_health);
    } catch (err: any) {
      console.error("Failed to load settings data", err);
      setErrorMsg("Failed to synchronize with configuration API.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettingsData();
  }, []);

  const handleSaveConfig = async () => {
    setSaving(true);
    setSuccessMsg(null);
    setErrorMsg(null);
    try {
      // Save profile updates first
      if (editUsername !== profile.username || editEmail !== profile.email) {
        const profileRes = await fetchAPI('/settings/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: editUsername, email: editEmail })
        });
        setProfile(profileRes);
      }
      
      // Save configuration settings
      const settingsRes = await fetchAPI('/settings/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings)
      });
      setSettings(settingsRes);
      
      setSuccessMsg("System configuration deployed successfully!");
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to deploy configuration.");
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);
    try {
      await fetchAPI('/settings/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword })
      });
      setPasswordSuccess("Operator credentials updated successfully.");
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: any) {
      setPasswordError(err.message || "Credential update failed.");
    }
  };

  const handleLogoutAll = async () => {
    if (!confirm("Are you sure you want to invalidate all active sessions for this operator?")) return;
    try {
      await fetchAPI('/settings/logout-all', { method: 'POST' });
      alert("All other sessions revoked successfully. Please re-login.");
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/';
    } catch (err: any) {
      alert("Failed to invalidate sessions: " + err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm("WARNING: This will permanently delete your operator credentials. This action is IRREVERSIBLE. Proceed?")) return;
    try {
      await fetchAPI('/settings/delete-account', { method: 'DELETE' });
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      window.location.href = '/';
    } catch (err: any) {
      alert("Failed to delete account: " + err.message);
    }
  };

  const handleExportLogs = () => {
    // Generate a downloadable text log of settings
    const blob = new Blob([JSON.stringify({ profile, settings, health }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `astra_audit_config_${profile.username}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)] text-secondary font-mono text-sm animate-pulse">
        LOAD-CONFIG SEQUENCE IN PROGRESS...
      </div>
    );
  }

  return (
    <main className="max-w-container-max mx-auto pb-stack-lg">
      <header className="mb-stack-lg flex justify-between items-end">
        <div>
          <h1 className="text-display-lg font-display-lg text-primary mb-2">System Configuration</h1>
          <p className="text-on-surface-variant text-body-md font-body-md max-w-2xl">
            Manage operator credentials, algorithmic thresholds, and neural core endpoints.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
        {/* Left Column: Profile & Security */}
        <div className="lg:col-span-5 flex flex-col gap-gutter">
          {/* Profile Section */}
          <section className="bg-matte-black border border-border-subtle rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-6">
              <UserCircle className="w-5 h-5 text-silver-gray" />
              <h2 className="text-label-caps font-label-caps text-primary">OPERATOR PROFILE</h2>
            </div>
            
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-border-subtle">
              <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-border-subtle flex items-center justify-center bg-white/10 font-bold text-white text-xl">
                {profile.username.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <div className="text-body-md font-body-md text-primary font-medium">{profile.username}</div>
                <div className="text-label-mono font-label-mono text-on-surface-variant mt-1">{profile.email}</div>
                <div className="mt-2 inline-block px-2 py-1 bg-surface-container-high rounded text-[10px] text-silver-gray uppercase tracking-wider font-mono">
                  Clearance: {profile.role.toUpperCase()}
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-label-caps font-label-caps text-silver-gray mb-2">Display Name</label>
                <input 
                  className="bg-charcoal border border-border-subtle rounded-lg text-primary w-full px-3 py-2 text-body-sm font-body-sm focus:border-white focus:outline-none focus:shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-all" 
                  type="text" 
                  value={editUsername}
                  onChange={(e) => setEditUsername(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-label-caps font-label-caps text-silver-gray mb-2">Email Address</label>
                <input 
                  className="bg-charcoal border border-border-subtle rounded-lg text-primary w-full px-3 py-2 text-body-sm font-body-sm focus:border-white focus:outline-none focus:shadow-[0_0_10px_rgba(255,255,255,0.1)] transition-all" 
                  type="email" 
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div className="mt-6 pt-6 border-t border-border-subtle grid grid-cols-2 gap-4">
              <div>
                <div className="text-label-caps font-label-caps text-silver-gray mb-1">Clearance Date</div>
                <div className="text-label-mono font-label-mono text-primary">{profile.created_at}</div>
              </div>
              <div>
                <div className="text-label-caps font-label-caps text-silver-gray mb-1">Telemetry Nodes</div>
                <div className="text-label-mono font-label-mono text-primary">ONLINE</div>
              </div>
            </div>
          </section>

          {/* Security Credentials Section */}
          <section className="bg-matte-black border border-border-subtle rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-6">
              <KeyRound className="w-5 h-5 text-silver-gray" />
              <h2 className="text-label-caps font-label-caps text-primary">SECURITY CREDENTIALS</h2>
            </div>
            
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-label-caps font-label-caps text-silver-gray mb-2">Current Password</label>
                <input 
                  className="bg-charcoal border border-border-subtle rounded-lg text-primary w-full px-3 py-2 text-body-sm font-body-sm focus:border-white focus:outline-none" 
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="block text-label-caps font-label-caps text-silver-gray mb-2">New Secure Password</label>
                <input 
                  className="bg-charcoal border border-border-subtle rounded-lg text-primary w-full px-3 py-2 text-body-sm font-body-sm focus:border-white focus:outline-none" 
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              {passwordError && <p className="text-error text-xs font-mono">{passwordError}</p>}
              {passwordSuccess && <p className="text-green-400 text-xs font-mono">{passwordSuccess}</p>}
              <button 
                type="submit"
                className="w-full py-2 bg-white text-black font-medium text-xs rounded-lg hover:bg-white/90 transition-all font-mono uppercase tracking-wider"
              >
                Update Password
              </button>
            </form>

            <div className="mt-6 pt-6 border-t border-border-subtle space-y-3">
              <button 
                onClick={handleLogoutAll}
                className="w-full py-2 bg-transparent border border-white/10 text-white font-mono text-xs rounded-lg hover:border-white transition-all flex items-center justify-between px-4"
              >
                <span>LOGOUT ALL DEVICES</span>
                <LogOut className="w-4 h-4 text-secondary" />
              </button>
              <button 
                onClick={handleDeleteAccount}
                className="w-full py-2 bg-transparent border border-error/20 text-error font-mono text-xs rounded-lg hover:border-error transition-all flex items-center justify-between px-4 hover:bg-error/5"
              >
                <span>DELETE ACCOUNT</span>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* Privacy & Data */}
          <section className="bg-matte-black border border-border-subtle rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-6">
              <Shield className="w-5 h-5 text-silver-gray" />
              <h2 className="text-label-caps font-label-caps text-primary">PRIVACY & TELEMETRY</h2>
            </div>
            <p className="text-body-sm font-body-sm text-on-surface-variant mb-6">
              Export system settings payload or purge temporary local cache indices.
            </p>
            <div className="space-y-4">
              <button 
                onClick={handleExportLogs}
                className="w-full py-2 px-4 bg-transparent border border-silver-gray text-primary rounded-lg hover:border-white hover:shadow-[inset_0_0_10px_rgba(255,255,255,0.05)] transition-all flex items-center justify-between group"
              >
                <span className="text-body-sm font-body-sm">Export Configuration Log</span>
                <Download className="w-4 h-4 text-silver-gray group-hover:text-primary transition-colors" />
              </button>
            </div>
          </section>
        </div>

        {/* Right Column: Settings Preferences & API status */}
        <div className="lg:col-span-7 flex flex-col gap-gutter">
          {/* Detection Preferences */}
          <section className="bg-matte-black border border-border-subtle rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-6">
              <Radar className="w-5 h-5 text-silver-gray" />
              <h2 className="text-label-caps font-label-caps text-primary">DETECTION PREFERENCES</h2>
            </div>
            
            <div className="space-y-6">
              {/* Alert Sensitivity Threshold */}
              <div>
                <label className="block text-label-caps font-label-caps text-silver-gray mb-3 flex justify-between">
                  <span>Alert Sensitivity Threshold</span>
                  <span className="text-primary">{settings.alert_threshold}%</span>
                </label>
                <input 
                  className="w-full h-1 bg-surface-container-high rounded-lg appearance-none cursor-pointer accent-white" 
                  max="100" 
                  min="0" 
                  onChange={(e) => setSettings({ ...settings, alert_threshold: Number(e.target.value) })} 
                  type="range" 
                  value={settings.alert_threshold}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/5">
                {/* Whisper Transcription Language */}
                <div>
                  <label className="block text-label-caps font-label-caps text-silver-gray mb-2">Whisper Language</label>
                  <select 
                    value={settings.whisper_language}
                    onChange={(e) => setSettings({ ...settings, whisper_language: e.target.value })}
                    className="bg-charcoal border border-border-subtle rounded-lg text-primary w-full px-3 py-2 text-body-sm font-body-sm appearance-none focus:border-white focus:outline-none"
                  >
                    <option value="en">English (default)</option>
                    <option value="es">Spanish</option>
                    <option value="hi">Hindi</option>
                    <option value="ta">Tamil</option>
                    <option value="te">Telugu</option>
                  </select>
                </div>
                {/* Minimum Confidence Level */}
                <div>
                  <label className="block text-label-caps font-label-caps text-silver-gray mb-2">Minimum Confidence Threshold</label>
                  <select 
                    value={settings.min_confidence}
                    onChange={(e) => setSettings({ ...settings, min_confidence: Number(e.target.value) })}
                    className="bg-charcoal border border-border-subtle rounded-lg text-primary w-full px-3 py-2 text-body-sm font-body-sm appearance-none focus:border-white focus:outline-none"
                  >
                    <option value="0.2">Low (20%)</option>
                    <option value="0.4">Moderate (40%)</option>
                    <option value="0.6">High (60%)</option>
                    <option value="0.8">Strict (80%)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/5 font-mono text-[10px]">
                {/* Threat Threshold */}
                <div>
                  <label className="block text-silver-gray uppercase mb-1">Threat Threshold</label>
                  <input 
                    type="number" step="0.05" max="1" min="0"
                    value={settings.threat_threshold}
                    onChange={(e) => setSettings({ ...settings, threat_threshold: Number(e.target.value) })}
                    className="bg-charcoal border border-border-subtle rounded px-2 py-1 w-full text-white"
                  />
                </div>
                {/* Risk Threshold */}
                <div>
                  <label className="block text-silver-gray uppercase mb-1">Risk Threshold</label>
                  <input 
                    type="number" step="0.05" max="1" min="0"
                    value={settings.risk_threshold}
                    onChange={(e) => setSettings({ ...settings, risk_threshold: Number(e.target.value) })}
                    className="bg-charcoal border border-border-subtle rounded px-2 py-1 w-full text-white"
                  />
                </div>
                {/* RAG Similarity Threshold */}
                <div>
                  <label className="block text-silver-gray uppercase mb-1">RAG Similarity</label>
                  <input 
                    type="number" step="0.05" max="1" min="0"
                    value={settings.rag_similarity_threshold}
                    onChange={(e) => setSettings({ ...settings, rag_similarity_threshold: Number(e.target.value) })}
                    className="bg-charcoal border border-border-subtle rounded px-2 py-1 w-full text-white"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-6 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-body-sm font-body-sm text-primary">Audio Alarms</div>
                    <div className="text-[12px] text-on-surface-variant mt-0.5">Play dynamic warning tone for critical events</div>
                  </div>
                  <button 
                    onClick={() => setSettings({ ...settings, sound_alerts: !settings.sound_alerts })}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${settings.sound_alerts ? 'bg-white' : 'bg-surface-container-high'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-charcoal border-2 border-border-subtle transition-transform ${settings.sound_alerts ? 'translate-x-5 border-white' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-body-sm font-body-sm text-primary">Auto-Save Telemetry Reports</div>
                    <div className="text-[12px] text-on-surface-variant mt-0.5">Save transcript analysis to database instantly</div>
                  </div>
                  <button 
                    onClick={() => setSettings({ ...settings, auto_save_reports: !settings.auto_save_reports })}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${settings.auto_save_reports ? 'bg-white' : 'bg-surface-container-high'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-charcoal border-2 border-border-subtle transition-transform ${settings.auto_save_reports ? 'translate-x-5 border-white' : 'translate-x-0'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-body-sm font-body-sm text-primary">Real-time Desk Notifications</div>
                    <div className="text-[12px] text-on-surface-variant mt-0.5">Display push alerts for syndicates/campaign events</div>
                  </div>
                  <button 
                    onClick={() => setSettings({ ...settings, realtime_notifications: !settings.realtime_notifications })}
                    className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${settings.realtime_notifications ? 'bg-white' : 'bg-surface-container-high'}`}
                  >
                    <span className={`inline-block h-5 w-5 transform rounded-full bg-charcoal border-2 border-border-subtle transition-transform ${settings.realtime_notifications ? 'translate-x-5 border-white' : 'translate-x-0'}`} />
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* System API Configurations */}
          <section className="bg-matte-black border border-border-subtle rounded-3xl p-6 backdrop-blur-xl">
            <div className="flex items-center gap-4 mb-6">
              <Cpu className="w-5 h-5 text-silver-gray" />
              <h2 className="text-label-caps font-label-caps text-primary">NEURAL CORE & API STATUS</h2>
            </div>
            
            <div className="space-y-4 font-mono text-[11px] text-secondary">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="glass-card p-3 flex flex-col justify-center">
                  <span className="opacity-70 text-[9px] uppercase">Whisper Core</span>
                  <span className={`font-bold mt-1 text-xs ${health?.whisper_status === 'ONLINE' ? 'text-primary' : 'text-error'}`}>
                    {health?.whisper_status || 'OFFLINE'}
                  </span>
                </div>
                <div className="glass-card p-3 flex flex-col justify-center">
                  <span className="opacity-70 text-[9px] uppercase">MiniLM Classification</span>
                  <span className={`font-bold mt-1 text-xs ${health?.minilm_status === 'ONLINE' ? 'text-primary' : 'text-error'}`}>
                    {health?.minilm_status || 'OFFLINE'}
                  </span>
                </div>
                <div className="glass-card p-3 flex flex-col justify-center">
                  <span className="opacity-70 text-[9px] uppercase">BiLSTM Estimator</span>
                  <span className={`font-bold mt-1 text-xs ${health?.bilstm_status === 'ONLINE' ? 'text-primary' : 'text-error'}`}>
                    {health?.bilstm_status || 'OFFLINE'}
                  </span>
                </div>
                <div className="glass-card p-3 flex flex-col justify-center">
                  <span className="opacity-70 text-[9px] uppercase">RAG Engine</span>
                  <span className={`font-bold mt-1 text-xs ${health?.rag_status === 'ONLINE' ? 'text-primary' : 'text-error'}`}>
                    {health?.rag_status || 'OFFLINE'}
                  </span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>NeonDB Connection:</span>
                  <span className={health?.neondb_status === 'ONLINE' ? 'text-primary font-bold' : 'text-error font-bold'}>
                    {health?.neondb_status || 'OFFLINE'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>Groq API:</span>
                  <span className={health?.groq_status === 'ONLINE' ? 'text-primary font-bold' : 'text-error font-bold'}>
                    {health?.groq_status || 'OFFLINE'}
                  </span>
                </div>
                <div className="flex justify-between border-b border-white/5 pb-2">
                  <span>JWT Authenticator:</span>
                  <span className="text-primary font-bold">ONLINE</span>
                </div>
              </div>
            </div>
          </section>

          {/* Action Bar */}
          <div className="flex flex-col-reverse md:flex-row justify-between items-center gap-4 mt-4">
            <div className="flex items-center gap-4 text-label-mono font-label-mono text-[10px] text-on-surface-variant uppercase tracking-widest">
              <span>ASTRA Config Engine v2.5</span>
              {successMsg && <span className="text-green-400 font-bold animate-pulse">{successMsg}</span>}
              {errorMsg && <span className="text-error font-bold animate-pulse">{errorMsg}</span>}
            </div>
            <div className="flex gap-4 w-full md:w-auto">
              <button 
                onClick={loadSettingsData}
                className="bg-transparent border border-silver-gray text-primary rounded-lg px-6 py-2 text-body-sm font-body-sm hover:border-white transition-all flex-1 md:flex-none"
              >
                Discard Changes
              </button>
              <button 
                onClick={handleSaveConfig}
                disabled={saving}
                className="bg-white text-black rounded-lg px-6 py-2 text-body-sm font-body-sm font-bold hover:bg-white/90 transition-all flex-1 md:flex-none disabled:opacity-50"
              >
                {saving ? "Deploying..." : "Deploy Config"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
