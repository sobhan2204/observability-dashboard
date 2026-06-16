'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/services/api';
import styles from './dashboard.module.css';
import { Trash2, LogOut, Wallet as WalletIcon, TrendingUp, Shield, Activity, PieChart, AlertCircle } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Wallet {
  id: string;
  address: string;
  network: string;
}

interface Portfolio {
  totalValueUSD: number;
  wallets: any[];
}

interface Insights {
  risk: string;
  diversificationScore: number;
  concentrationRisk: string;
  stablecoinExposure: number;
  assetAllocation: { asset: string; percentage: number }[];
  insights: string[];
}

export default function DashboardPage() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [insights, setInsights] = useState<Insights | null>(null);
  const [newAddress, setNewAddress] = useState('');
  const [newNetwork, setNewNetwork] = useState('ethereum');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setIsMounted(true);
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }
    fetchData();
  }, [router]);

  useEffect(() => {
    if (selectedWalletId) {
      fetchWalletDetails(selectedWalletId);
    }
  }, [selectedWalletId]);

  const fetchData = async () => {
    try {
      const [walletData, portfolioData] = await Promise.all([
        api.get('/wallets'),
        api.get('/portfolio'),
      ]);
      setWallets(walletData);
      setPortfolio(portfolioData);
      if (walletData.length > 0 && !selectedWalletId) {
        setSelectedWalletId(walletData[0].id);
      }
    } catch (err) {
      console.error(err);
      localStorage.removeItem('token');
      router.push('/login');
    } finally {
      setLoading(false);
    }
  };

  const fetchWalletDetails = async (id: string) => {
    try {
      const [historyData, insightsData] = await Promise.all([
        api.get(`/portfolio/history/${id}`),
        api.get(`/portfolio/insights/${id}`),
      ]);
      setHistory(historyData.map((h: any) => ({
        time: new Date(h.createdAt).toLocaleTimeString(),
        value: h.valueUsd
      })));
      setInsights(insightsData);
    } catch (err: any) {
      console.error(err);
      if (err.message.includes('Forbidden') || err.message.includes('Unauthorized')) {
        localStorage.removeItem('token');
        router.push('/login');
      }
    }
  };

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post('/wallets', { address: newAddress, network: newNetwork });
      setNewAddress('');
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteWallet = async (id: string) => {
    if (!confirm('Are you sure you want to remove this wallet?')) return;
    try {
      await api.delete(`/wallets/${id}`);
      if (selectedWalletId === id) setSelectedWalletId(null);
      await fetchData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    router.push('/login');
  };

  if (loading) return <div className="container mono">System loading...</div>;

  const selectedWalletInfo = portfolio?.wallets.find(w => w.walletId === selectedWalletId);

  return (
    <div className={`${styles.dashboard} container fade-in`}>
      <header className={styles.header}>
        <div className={styles.brand}>Crypto Analytics // Pro</div>
        <button onClick={handleLogout} className={styles.logout}>
          <LogOut size={16} style={{ marginRight: '8px' }} />
          Terminate Session
        </button>
      </header>

      <div className={styles.grid}>
        <div className={styles.main}>
          <section className={styles.heroSection}>
            <div className={styles.portfolioCard}>
              <div className={styles.cardHeader}>
                <TrendingUp size={20} className={styles.icon} />
                <h2 className={styles.sectionTitle}>Global Portfolio Value</h2>
              </div>
              <div className={`${styles.portfolioValue} mono`}>
                ${portfolio?.totalValueUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </div>
              <div className={styles.portfolioLabel}>Aggregated Net Worth (Real-time)</div>
            </div>

            {selectedWalletId && isMounted && (
              <div className={styles.historyCard}>
                <h2 className={styles.sectionTitle}>Performance History</h2>
                <div style={{ width: '100%', height: 200 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff41" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#00ff41" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                      <XAxis dataKey="time" stroke="#666" fontSize={10} />
                      <YAxis stroke="#666" fontSize={10} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#0a0a0a', border: '1px solid #333' }}
                        itemStyle={{ color: '#00ff41' }}
                      />
                      <Area type="monotone" dataKey="value" stroke="#00ff41" fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </section>

          <div className={styles.detailsGrid}>
            <section className={styles.walletsSection}>
              <h2 className={styles.sectionTitle}>Tracked Targets</h2>
              <div className={styles.walletList}>
                {wallets.map((wallet) => (
                  <div 
                    key={wallet.id} 
                    className={`${styles.walletItem} ${selectedWalletId === wallet.id ? styles.selected : ''}`}
                    onClick={() => setSelectedWalletId(wallet.id)}
                  >
                    <div className={styles.walletInfo}>
                      <h3 className="mono">{wallet.address.slice(0, 10)}...{wallet.address.slice(-8)}</h3>
                      <div className={styles.walletMeta}>{wallet.network}</div>
                    </div>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDeleteWallet(wallet.id); }} 
                      className={styles.deleteBtn}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            {insights && (
              <section className={styles.aiSection}>
                <h2 className={styles.sectionTitle}>AI Analytics & Insights</h2>
                <div className={styles.insightsGrid}>
                  <div className={styles.insightStat}>
                    <Shield size={16} />
                    <span>Risk: <b className="mono">{insights.risk}</b></span>
                  </div>
                  <div className={styles.insightStat}>
                    <PieChart size={16} />
                    <span>Diversification: <b className="mono">{insights.diversificationScore}/100</b></span>
                  </div>
                  <div className={styles.insightStat}>
                    <Activity size={16} />
                    <span>Concentration: <b className="mono">{insights.concentrationRisk}</b></span>
                  </div>
                </div>
                <ul className={styles.insightsList}>
                  {insights.insights.map((insight, i) => (
                    <li key={i} className="mono">
                      <AlertCircle size={14} style={{ marginRight: '8px', color: '#00ff41' }} />
                      {insight}
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>

        <aside>
          <div className={styles.sideCard}>
            <h2 className={styles.sectionTitle}>Add New Target</h2>
            <form onSubmit={handleAddWallet}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Wallet Address</label>
                <input
                  className={styles.input}
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  placeholder="0x..."
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Network</label>
                <select
                  className={styles.select}
                  value={newNetwork}
                  onChange={(e) => setNewNetwork(e.target.value)}
                >
                  <option value="ethereum">Ethereum</option>
                  <option value="bitcoin">Bitcoin</option>
                </select>
              </div>
              <button type="submit" className={styles.submitBtn} disabled={submitting}>
                {submitting ? 'Updating...' : 'Track Asset'}
              </button>
            </form>
          </div>

          {selectedWalletInfo && (
            <div className={styles.sideCard}>
              <h2 className={styles.sectionTitle}>Wallet Breakdown</h2>
              <div className={styles.breakdownItem}>
                <span>ETH Balance</span>
                <span className="mono">{selectedWalletInfo.balance.toFixed(4)}</span>
              </div>
              {selectedWalletInfo.tokens.map((token: any) => (
                <div key={token.symbol} className={styles.breakdownItem}>
                  <span>{token.symbol}</span>
                  <span className="mono">{token.balance.toFixed(2)}</span>
                </div>
              ))}
              <div className={styles.breakdownTotal}>
                <span>Total Value</span>
                <span className="mono">${selectedWalletInfo.valueUSD.toLocaleString()}</span>
              </div>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
