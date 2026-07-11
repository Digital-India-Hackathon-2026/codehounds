import React, { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, TrendingUp, Users, Radio, Activity, Cpu, 
  Clock, Database, Network, ChevronRight, RefreshCw, Layers 
} from 'lucide-react';
import { 
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';
import { fetchAPI } from '../lib/api';
import { useNavigate } from 'react-router-dom';

const COLORS = ['#ffffff', '#e5e2e1', '#c6c6c6', '#b8b8b8', '#8e9192', '#ffb4ab'];
const RISK_COLORS = {
  Critical: '#ffb4ab',
  High: '#e5e2e1',
  Medium: '#c6c6c6',
  Low: '#8e9192',
  Safe: '#454747'
};

export default function Dashboard() {
  const navigate = useNavigate();
  
  // Filters state
  const [timeframe, setTimeframe] = useState('7d');
  const [sourceType, setSourceType] = useState('all');
  const [riskLevel, setRiskLevel] = useState('all');
  
  // Data state
  const [stats, setStats] = useState<any>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('JUST NOW');

  async function loadDashboardData(showIndicator = true) {
    if (showIndicator) setRefreshing(true);
    try {
      setError(null);
      const statsUrl = `/dashboard/stats?timeframe=${timeframe}&source_type=${sourceType}&risk_level=${riskLevel}`;
      const reportsUrl = `/dashboard/reports?limit=10&source_type=${sourceType}&risk_level=${riskLevel}`;
      
      const [statsRes, reportsRes] = await Promise.all([
        fetchAPI(statsUrl),
        fetchAPI(reportsUrl)
      ]);
      
      setStats(statsRes);
      setReports(reportsRes);
      setLastUpdated(new Date().toLocaleTimeString());
    } catch (err: any) {
      console.error("Failed to load dashboard data", err);
      setError("Failed to synchronize with Live API. Retrying...");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  // Load on filter change or mount
  useEffect(() => {
    loadDashboardData(true);
  }, [timeframe, sourceType, riskLevel]);

  // Polling every 30 seconds for live updates
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData(false);
    }, 30000);
    return () => clearInterval(interval);
  }, [timeframe, sourceType, riskLevel]);

  const topScamData = stats?.threat_distribution || [];
  
  const riskDistributionData = stats?.risk_distribution 
    ? Object.keys(stats.risk_distribution).map(key => ({
        name: key,
        value: stats.risk_distribution[key]
      }))
    : [];

  // Heatmap rendering helpers
  const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const heatmapHours = Array.from({ length: 24 }, (_, i) => i);
  const getHeatmapCount = (day: string, hour: number) => {
    if (!stats?.heatmap) return 0;
    const match = stats.heatmap.find((h: any) => h.day === day && h.hour === hour);
    return match ? match.count : 0;
  };
  const getHeatmapColor = (count: number) => {
    if (count === 0) return 'bg-white/5';
    if (count < 3) return 'bg-white/20';
    if (count < 6) return 'bg-white/40';
    if (count < 10) return 'bg-white/70';
    return 'bg-white';
  };

  return (
    <div className="space-y-6">
      {/* Header and API Status */}
      <header className="flex flex-col md:flex-row md:justify-between md:items-end gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Threat Intelligence</h1>
          <p className="text-secondary font-mono text-sm uppercase">
            SYSTEM STATUS: <span className={stats?.system_status === 'OFFLINE' ? 'text-error' : 'text-primary'}>
              {stats?.system_status || 'NOMINAL'}
            </span> • LAST UPDATE: {lastUpdated}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => loadDashboardData(true)} 
            disabled={refreshing}
            className="glass-card p-2 text-secondary hover:text-white transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <div className="glass-card px-4 py-2 flex items-center gap-3">
            <div className={`w-2 h-2 rounded-full animate-pulse ${
              stats?.system_status === 'ONLINE' ? 'bg-primary' : 
              stats?.system_status === 'DEGRADED' ? 'bg-yellow-400' : 'bg-error'
            }`}></div>
            <span className="font-mono text-xs uppercase">
              {stats?.system_status === 'ONLINE' ? 'LIVE API CONNECTED' : 
               stats?.system_status === 'DEGRADED' ? 'API DEGRADED' : 'API DISCONNECTED'}
            </span>
          </div>
        </div>
      </header>

      {/* Global Filter Bar */}
      <div className="glass-panel p-4 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-secondary uppercase">Timeframe:</span>
            <select 
              value={timeframe} 
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-charcoal border border-white/10 text-white font-mono text-xs rounded-lg px-2 py-1.5 focus:border-white focus:outline-none"
            >
              <option value="24h">24 Hours</option>
              <option value="7d">7 Days</option>
              <option value="30d">30 Days</option>
              <option value="90d">90 Days</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-secondary uppercase">Source:</span>
            <select 
              value={sourceType} 
              onChange={(e) => setSourceType(e.target.value)}
              className="bg-charcoal border border-white/10 text-white font-mono text-xs rounded-lg px-2 py-1.5 focus:border-white focus:outline-none"
            >
              <option value="all">All Sources</option>
              <option value="audio">Audio Analysis</option>
              <option value="text">Text Analysis</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-secondary uppercase">Severity:</span>
            <select 
              value={riskLevel} 
              onChange={(e) => setRiskLevel(e.target.value)}
              className="bg-charcoal border border-white/10 text-white font-mono text-xs rounded-lg px-2 py-1.5 focus:border-white focus:outline-none"
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical Only</option>
              <option value="high">High Risk</option>
              <option value="medium">Medium Risk</option>
              <option value="low">Low Risk</option>
            </select>
          </div>
        </div>
        {error && <span className="text-xs text-error font-mono font-bold animate-pulse">{error}</span>}
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Reports */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-white/10 p-3 rounded-xl">
              <Shield className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-mono text-secondary uppercase">Filtered</span>
          </div>
          <h3 className="text-secondary text-sm font-medium mb-1">Total Reports</h3>
          <p className="text-3xl font-bold text-white font-mono mb-2">
            {loading ? '-' : stats?.total_reports}
          </p>
          <div className="flex justify-between text-[10px] font-mono text-secondary border-t border-white/5 pt-2">
            <span>TODAY: {stats?.reports_today || 0}</span>
            <span>WEEK: {stats?.reports_this_week || 0}</span>
          </div>
        </div>

        {/* Critical Alerts */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-white/10 p-3 rounded-xl border border-error/30">
              <AlertTriangle className="w-6 h-6 text-error" />
            </div>
            <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border ${
              (stats?.alert_pct_change || 0) >= 0 
                ? 'border-error/30 text-error bg-error/10' 
                : 'border-white/20 text-white bg-white/10'
            }`}>
              {(stats?.alert_pct_change || 0) >= 0 ? '+' : ''}{stats?.alert_pct_change}%
            </span>
          </div>
          <h3 className="text-secondary text-sm font-medium mb-1">Critical Alerts</h3>
          <p className="text-3xl font-bold text-white font-mono mb-2">
            {loading ? '-' : stats?.critical_alerts}
          </p>
          <div className="flex justify-between text-[10px] font-mono text-secondary border-t border-white/5 pt-2">
            <span>CRIT: {stats?.critical_count || 0}</span>
            <span>HIGH: {stats?.high_count || 0}</span>
          </div>
        </div>

        {/* Active Campaigns */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-white/10 p-3 rounded-xl">
              <Users className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-mono text-secondary uppercase">RAG Matches</span>
          </div>
          <h3 className="text-secondary text-sm font-medium mb-1">Active Campaigns</h3>
          <p className="text-3xl font-bold text-white font-mono mb-2">
            {loading ? '-' : stats?.active_campaigns}
          </p>
          <div className="text-[10px] font-mono text-secondary border-t border-white/5 pt-2 truncate">
            {stats?.unique_campaign_names?.length > 0 
              ? `TOP: ${stats.unique_campaign_names.join(', ')}` 
              : 'NO ACTIVE CAMPAIGNS'}
          </div>
        </div>

        {/* Detection Rate */}
        <div className="glass-panel p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="bg-white/10 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <span className="text-[10px] font-mono text-secondary uppercase">Avg Conf</span>
          </div>
          <h3 className="text-secondary text-sm font-medium mb-1">Detection Rate</h3>
          <p className="text-3xl font-bold text-white font-mono mb-2">
            {loading ? '-' : stats?.detection_rate}
          </p>
          <div className="flex justify-between text-[10px] font-mono text-secondary border-t border-white/5 pt-2">
            <span>SUCCESS: {stats?.success_rate_pct || 0}%</span>
            <span>HEALTH: NOMINAL</span>
          </div>
        </div>
      </div>

      {/* Main Charts & Feed Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
        {/* Threat Volume Trends */}
        <div className="glass-panel p-6 lg:col-span-2 flex flex-col">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">Threat Volume Trends</h2>
            <span className="font-mono text-xs text-secondary uppercase">
              Grouping: {timeframe === '24h' ? 'Hourly' : 'Daily'}
            </span>
          </div>
          <div className="h-80 w-full">
            {loading ? (
              <div className="w-full h-full bg-white/5 animate-pulse rounded-2xl"></div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={stats?.timeline_trends || []}>
                  <defs>
                    <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffffff" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ffffff" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="colorScams" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ffb4ab" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#ffb4ab" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#B8B8B8" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="#B8B8B8" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '12px' }}
                  />
                  <Area type="monotone" name="Total Scans" dataKey="total_scans" stroke="#ffffff" fillOpacity={1} fill="url(#colorTotal)" strokeWidth={1.5} />
                  <Area type="monotone" name="Scam Detections" dataKey="scam_detections" stroke="#ffb4ab" fillOpacity={1} fill="url(#colorScams)" strokeWidth={1.5} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Recent Intercepts Feed */}
        <div className="glass-panel p-6 flex flex-col max-h-[420px]">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-lg font-bold text-white">Recent Intercepts</h2>
            <button 
              onClick={() => navigate('/history')}
              className="text-xs text-secondary hover:text-white font-mono transition-colors"
            >
              VIEW ALL
            </button>
          </div>
          
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="w-full h-20 bg-white/5 animate-pulse rounded-xl"></div>
              ))
            ) : reports.length === 0 ? (
              <div className="flex items-center justify-center h-full text-secondary font-mono text-sm">
                No active threats intercepted.
              </div>
            ) : (
              reports.slice(0, 5).map((scam, i) => (
                <div 
                  key={i} 
                  onClick={() => navigate(`/reports?id=${scam.id}`)}
                  className="glass-card p-4 hover:bg-white/5 transition-colors cursor-pointer group relative border border-white/5 hover:border-white/10"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-mono text-xs text-secondary group-hover:text-white transition-colors">
                      RPT-{scam.id}
                    </span>
                    <span className="text-[10px] font-mono text-secondary">
                      {new Date(scam.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <h3 className="font-medium text-white mb-2 truncate text-sm">{scam.scam_type}</h3>
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-white" 
                          style={{ width: `${scam.risk_score}%` }}
                        ></div>
                      </div>
                      <span className="font-mono text-[10px] font-bold text-secondary">
                        {scam.risk_score.toFixed(0)}% RISK
                      </span>
                    </div>
                    <span className={`text-[9px] font-mono px-2 py-0.5 rounded border uppercase ${
                      scam.risk_level === 'CRITICAL' ? 'border-error/50 text-error bg-error/10' : 
                      scam.risk_level === 'HIGH' || scam.risk_level === 'HIGH_RISK' ? 'border-orange-500/50 text-orange-400 bg-orange-500/10' :
                      'border-white/20 text-white bg-white/10'
                    }`}>
                      {scam.risk_level === 'HIGH_RISK' ? 'HIGH' : scam.risk_level}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Network Summary, Scam Distribution, and Risk Donut */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Network Graph Summary */}
        <div 
          onClick={() => navigate('/network')}
          className="glass-panel p-6 hover:bg-white/[0.02] cursor-pointer transition-all border border-white/10 hover:border-white/20 group flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-secondary" /> Network Summary
              </h3>
              <ChevronRight className="w-5 h-5 text-secondary group-hover:translate-x-1 transition-transform" />
            </div>
            <div className="space-y-3 font-mono text-sm text-secondary">
              <div className="flex justify-between">
                <span>TOTAL CORRELATED NODES:</span>
                <span className="text-white font-bold">{stats?.network_summary?.total_nodes || 0}</span>
              </div>
              <div className="flex justify-between">
                <span>ACTIVE CONNECTIONS:</span>
                <span className="text-white font-bold">{stats?.network_summary?.total_connections || 0}</span>
              </div>
              <div className="flex flex-col mt-2 pt-2 border-t border-white/5">
                <span className="text-[10px] text-secondary">MOST CONNECTED ENTITY:</span>
                <span className="text-white text-xs font-bold truncate mt-1">
                  {stats?.network_summary?.most_connected_entity || 'N/A'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] text-secondary">LARGEST CAMPAIGN:</span>
                <span className="text-white text-xs font-bold truncate mt-1">
                  {stats?.network_summary?.largest_campaign || 'N/A'}
                </span>
              </div>
            </div>
          </div>
          <span className="text-xs text-secondary group-hover:text-white font-mono mt-4 block">
            OPEN FULL CORRELATION GRAPH &rarr;
          </span>
        </div>

        {/* Top Scam Types Pie Chart */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-secondary" /> Top Scam Types
          </h3>
          <div className="h-48 w-full flex items-center justify-center">
            {loading ? (
              <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-white animate-spin"></div>
            ) : topScamData.length === 0 ? (
              <span className="text-secondary font-mono text-xs">No classification data</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={topScamData}
                    cx="50%"
                    cy="50%"
                    innerRadius={0}
                    outerRadius={65}
                    paddingAngle={2}
                    dataKey="value"
                  >
                    {topScamData.map((entry: any, index: number) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-3 gap-1 mt-2 text-[9px] font-mono text-secondary">
            {topScamData.slice(0, 6).map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-1 truncate">
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></span>
                <span className="truncate uppercase">{item.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Risk Distribution Donut Chart */}
        <div className="glass-panel p-6 flex flex-col justify-between">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-secondary" /> Risk Distribution
          </h3>
          <div className="h-48 w-full flex items-center justify-center">
            {loading ? (
              <div className="w-24 h-24 rounded-full border-4 border-white/10 border-t-white animate-spin"></div>
            ) : riskDistributionData.length === 0 ? (
              <span className="text-secondary font-mono text-xs">No distribution data</span>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={riskDistributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={45}
                    outerRadius={65}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {riskDistributionData.map((entry: any, index: number) => {
                      const color = RISK_COLORS[entry.name as keyof typeof RISK_COLORS] || '#ffffff';
                      return <Cell key={`cell-${index}`} fill={color} />;
                    })}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#111111', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                    itemStyle={{ color: '#fff', fontSize: '11px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-5 gap-1 mt-2 text-[9px] font-mono text-secondary text-center">
            {riskDistributionData.map((item: any, i: number) => {
              const color = RISK_COLORS[item.name as keyof typeof RISK_COLORS] || '#ffffff';
              return (
                <div key={i} className="flex flex-col items-center">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }}></span>
                    <span className="font-bold text-white">{item.value}</span>
                  </div>
                  <span className="uppercase text-[8px] mt-0.5 text-secondary">{item.name}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Threat Heatmap Grid (Peak attack hours) */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
          <Clock className="w-5 h-5 text-secondary" /> Threat Heatmap (Peak Attack Hours)
        </h3>
        <div className="overflow-x-auto">
          <div className="min-w-[640px] space-y-2">
            {heatmapDays.map((day) => (
              <div key={day} className="flex items-center gap-2">
                <span className="w-10 font-mono text-xs text-secondary text-right pr-2">{day}</span>
                <div className="flex-1 gap-1.5" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                  {heatmapHours.map((hour) => {
                    const count = getHeatmapCount(day, hour);
                    return (
                      <div 
                        key={hour} 
                        title={`${day} @ ${hour}:00 - ${count} scans`}
                        className={`h-6 rounded-md transition-all ${getHeatmapColor(count)} hover:scale-110 cursor-pointer`}
                      ></div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t border-white/5">
              <span className="w-10"></span>
              <div className="flex-1 gap-1.5 text-[9px] font-mono text-secondary" style={{ display: 'grid', gridTemplateColumns: 'repeat(24, minmax(0, 1fr))' }}>
                {heatmapHours.map((hour) => (
                  <span key={hour} className="text-center">
                    {hour === 0 ? '12A' : hour === 12 ? '12P' : hour % 12}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Live Activity & Quick Insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Live Activity Feed */}
        <div className="glass-panel p-6 lg:col-span-2 flex flex-col max-h-[380px]">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-secondary animate-pulse" /> Live Activity Feed
          </h3>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 custom-scrollbar font-mono text-xs">
            {stats?.live_activity?.map((act: any, idx: number) => (
              <div key={idx} className="flex gap-4 border-b border-white/5 pb-3 last:border-b-0">
                <span className="text-primary font-bold">{act.time}</span>
                <div className="flex-1">
                  <span className="text-white font-bold uppercase mr-2 bg-white/10 px-1.5 py-0.5 rounded text-[10px]">
                    {act.event}
                  </span>
                  <span className="text-secondary">{act.description}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Insights */}
        <div className="glass-panel p-6">
          <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
            <Clock className="w-5 h-5 text-secondary" /> Quick Insights
          </h3>
          <div className="space-y-4 font-mono text-xs text-secondary">
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span>MOST COMMON THREAT:</span>
              <span className="text-white font-bold uppercase">{stats?.quick_insights?.most_common_type || 'None'}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span>PEAK RISK LEVEL:</span>
              <span className="text-white font-bold">{stats?.quick_insights?.highest_risk || '0%'}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span>AVERAGE THREAT RISK:</span>
              <span className="text-white font-bold">{stats?.quick_insights?.avg_risk || '0%'}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span>AVERAGE INFERENCE TIME:</span>
              <span className="text-white font-bold">{stats?.quick_insights?.avg_processing_time || '125ms'}</span>
            </div>
            <div className="flex justify-between border-b border-white/5 pb-2">
              <span>MOST TARGETED BANK:</span>
              <span className="text-white font-bold">{stats?.quick_insights?.most_targeted_bank || 'SBI'}</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] text-secondary mb-1">MOST DETECTED THREAT KEYWORDS:</span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {stats?.quick_insights?.most_detected_keywords?.map((kw: string, i: number) => (
                  <span key={i} className="bg-white/10 text-white px-2 py-0.5 rounded border border-white/5 uppercase text-[9px]">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Scans Table */}
      <div className="glass-panel p-6 mt-6">
        <h2 className="text-lg font-bold text-white mb-6">Recent Threat Scans & Intercepts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs text-secondary border-collapse">
            <thead>
              <tr className="border-b border-white/10 pb-3 text-white uppercase text-[10px]">
                <th className="py-3 px-4">Scan ID</th>
                <th className="py-3 px-4">Time</th>
                <th className="py-3 px-4">Classification</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Risk Score</th>
                <th className="py-3 px-4">Processing Time</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-white/5 animate-pulse">
                    <td colSpan={8} className="py-4 h-12 bg-white/5"></td>
                  </tr>
                ))
              ) : reports.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-secondary">
                    No threat logs found.
                  </td>
                </tr>
              ) : (
                reports.map((report) => (
                  <tr 
                    key={report.id} 
                    className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                    onClick={() => navigate(`/reports?id=${report.id}`)}
                  >
                    <td className="py-3 px-4 text-white font-bold">RPT-{report.id}</td>
                    <td className="py-3 px-4">{new Date(report.created_at).toLocaleString()}</td>
                    <td className="py-3 px-4 uppercase font-bold text-white">{report.scam_type}</td>
                    <td className="py-3 px-4">
                      <span className="bg-white/10 text-white px-2 py-0.5 rounded border border-white/5 uppercase text-[10px]">
                        {report.source_type}
                      </span>
                    </td>
                    <td className="py-3 px-4">{report.confidence.toFixed(1)}%</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-12 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-white" 
                            style={{ width: `${report.risk_score}%` }}
                          ></div>
                        </div>
                        <span className="font-bold text-white">{report.risk_score.toFixed(0)}%</span>
                      </div>
                    </td>
                    <td className="py-3 px-4">{report.processing_time}</td>
                    <td className="py-3 px-4 text-right">
                      <ChevronRight className="w-4 h-4 inline-block text-secondary" />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
