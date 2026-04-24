import { useState, useEffect, useMemo } from 'react'
import TradesTable from './components/TradesTable'
import Filters from './components/Filters'
import StatsBar from './components/StatsBar'
import './App.css'

export default function App() {
  const [data, setData] = useState({ trades: [], last_updated: null, count: 0 })
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [party, setParty] = useState('all')
  const [chamber, setChamber] = useState('all')
  const [txType, setTxType] = useState('all')

  useEffect(() => {
    fetch('/api/trades')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return data.trades.filter(t => {
      const rep = (t.representative || t.Name || '').toLowerCase()
      const ticker = (t.Ticker || '').toLowerCase()
      const q = search.toLowerCase()
      if (q && !rep.includes(q) && !ticker.includes(q)) return false
      if (party !== 'all' && t.Party !== party) return false
      if (chamber !== 'all' && t.Chamber !== chamber) return false
      if (txType !== 'all') {
        const isBuy = (t.Transaction || '').toLowerCase().includes('purchase')
        if (txType === 'buy' && !isBuy) return false
        if (txType === 'sell' && isBuy) return false
      }
      return true
    })
  }, [data.trades, search, party, chamber, txType])

  const lastUpdated = data.last_updated
    ? new Date(data.last_updated).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="app">
      <header className="header">
        <div className="header-left">
          <h1>POLYBOTT</h1>
          <span className="subtitle">Congress Trading Dashboard</span>
        </div>
        <div className="header-right">
          <span className="live-badge">● LIVE</span>
          {lastUpdated && <span className="last-updated">Updated {lastUpdated}</span>}
        </div>
      </header>

      {!loading && <StatsBar trades={data.trades} filtered={filtered} />}

      <div className="main-content">
        <Filters
          search={search} setSearch={setSearch}
          party={party} setParty={setParty}
          chamber={chamber} setChamber={setChamber}
          txType={txType} setTxType={setTxType}
          count={filtered.length}
        />
        {loading
          ? <div className="loading">Loading trades...</div>
          : <TradesTable trades={filtered} />
        }
      </div>
    </div>
  )
}
