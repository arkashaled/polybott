import { useMemo } from 'react'

function parseMidpoint(s) {
  if (!s) return 0
  const clean = s.replace(/[$,]/g, '').toLowerCase()
  if (clean.includes('over')) return parseFloat(clean.replace('over', '').trim()) * 1.5
  const parts = clean.split(/[-–]/).map(p => parseFloat(p.trim())).filter(n => !isNaN(n))
  return parts.length === 2 ? (parts[0] + parts[1]) / 2 : parts[0] || 0
}

function fmtVolume(n) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`
  return `$${n.toFixed(0)}`
}

export default function StatsBar({ trades, filtered }) {
  const stats = useMemo(() => {
    const filings = new Set(
      filtered.map(t => `${t.BioGuideID || t.representative}_${t.Filed}`).filter(Boolean)
    ).size

    const issuers = new Set(filtered.map(t => t.Ticker).filter(Boolean)).size

    const volume = filtered.reduce((sum, t) => sum + parseMidpoint(t.Trade_Size_USD), 0)

    return { trades: filtered.length, filings, volume, issuers }
  }, [filtered])

  return (
    <div className="stats-bar">
      <div className="stat-counter">
        <div className="stat-counter-value">{stats.trades.toLocaleString()}</div>
        <div className="stat-counter-label">TRADES</div>
      </div>
      <div className="stat-counter">
        <div className="stat-counter-value">{stats.filings.toLocaleString()}</div>
        <div className="stat-counter-label">FILINGS</div>
      </div>
      <div className="stat-counter">
        <div className="stat-counter-value">{fmtVolume(stats.volume)}</div>
        <div className="stat-counter-label">VOLUME</div>
      </div>
      <div className="stat-counter">
        <div className="stat-counter-value">{stats.issuers.toLocaleString()}</div>
        <div className="stat-counter-label">ISSUERS</div>
      </div>
    </div>
  )
}
