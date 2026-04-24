import { useMemo } from 'react'

export default function StatsBar({ trades, filtered }) {
  const stats = useMemo(() => {
    const buys = filtered.filter(t => (t.Transaction || '').toLowerCase().includes('purchase')).length
    const sells = filtered.length - buys

    const repCounts = {}
    filtered.forEach(t => {
      const name = t.representative || t.Name || 'Unknown'
      repCounts[name] = (repCounts[name] || 0) + 1
    })
    const topRep = Object.entries(repCounts).sort((a, b) => b[1] - a[1])[0]

    const tickerCounts = {}
    filtered.forEach(t => {
      if (t.Ticker) tickerCounts[t.Ticker] = (tickerCounts[t.Ticker] || 0) + 1
    })
    const topTicker = Object.entries(tickerCounts).sort((a, b) => b[1] - a[1])[0]

    const lags = filtered
      .map(t => t.Traded && t.Filed
        ? Math.round((new Date(t.Filed) - new Date(t.Traded)) / 86400000)
        : null)
      .filter(d => d !== null)
    const avgLag = lags.length ? Math.round(lags.reduce((a, b) => a + b, 0) / lags.length) : 0

    return { buys, sells, topRep, topTicker, avgLag }
  }, [filtered])

  return (
    <div className="stats-bar">
      <div className="stat">
        <div className="stat-label">Total</div>
        <div className="stat-value">{filtered.length.toLocaleString()}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Buys</div>
        <div className="stat-value buy">{stats.buys.toLocaleString()}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Sells</div>
        <div className="stat-value sell">{stats.sells.toLocaleString()}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Top Member</div>
        <div className="stat-value sm">{stats.topRep ? `${stats.topRep[0]} (${stats.topRep[1]})` : '—'}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Top Ticker</div>
        <div className="stat-value accent">{stats.topTicker ? `${stats.topTicker[0]} (${stats.topTicker[1]})` : '—'}</div>
      </div>
      <div className="stat">
        <div className="stat-label">Avg Lag</div>
        <div className="stat-value">{stats.avgLag}d</div>
      </div>
    </div>
  )
}
