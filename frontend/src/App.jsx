import { useState, useEffect, useMemo } from 'react'
import TradesTable from './components/TradesTable'
import Filters from './components/Filters'
import StatsBar from './components/StatsBar'
import './App.css'

export default function App() {
  const [data, setData] = useState({ trades: [], last_updated: null, count: 0 })
  const [loading, setLoading] = useState(true)
  const [repSearch, setRepSearch] = useState('')
  const [tickerSearch, setTickerSearch] = useState('')
  const [party, setParty] = useState('all')
  const [chamber, setChamber] = useState('all')
  const [txType, setTxType] = useState('all')
  const [polState, setPolState] = useState('all')
  const [tradeSize, setTradeSize] = useState('all')

  useEffect(() => {
    fetch('/api/trades')
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    return data.trades.filter(t => {
      if (repSearch) {
        const rep = (t.representative || t.Name || '').toLowerCase()
        if (!rep.includes(repSearch.toLowerCase())) return false
      }
      if (tickerSearch) {
        const ticker = (t.Ticker || '').toLowerCase()
        const company = (t.Company || '').toLowerCase()
        if (!ticker.includes(tickerSearch.toLowerCase()) && !company.includes(tickerSearch.toLowerCase())) return false
      }
      if (party !== 'all' && t.Party !== party) return false
      if (chamber !== 'all' && t.Chamber !== chamber) return false
      if (polState !== 'all' && t.State !== polState) return false
      if (tradeSize !== 'all' && t.Trade_Size_USD !== tradeSize) return false
      if (txType !== 'all') {
        const isBuy = (t.Transaction || '').toLowerCase().includes('purchase')
        if (txType === 'buy' && !isBuy) return false
        if (txType === 'sell' && isBuy) return false
      }
      return true
    })
  }, [data.trades, repSearch, tickerSearch, party, chamber, txType, polState, tradeSize])

  const states = useMemo(() => {
    const s = new Set(data.trades.map(t => t.State).filter(Boolean))
    return [...s].sort()
  }, [data.trades])

  const tradeSizes = useMemo(() => {
    const s = new Set(data.trades.map(t => t.Trade_Size_USD).filter(Boolean))
    return [...s].sort((a, b) => parseLow(a) - parseLow(b))
  }, [data.trades])

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

      <div className="main-content">
        <Filters
          repSearch={repSearch} setRepSearch={setRepSearch}
          tickerSearch={tickerSearch} setTickerSearch={setTickerSearch}
          party={party} setParty={setParty}
          chamber={chamber} setChamber={setChamber}
          txType={txType} setTxType={setTxType}
          polState={polState} setPolState={setPolState}
          tradeSize={tradeSize} setTradeSize={setTradeSize}
          states={states}
          tradeSizes={tradeSizes}
        />
        {!loading && <StatsBar trades={data.trades} filtered={filtered} />}
        {loading
          ? <div className="loading">Loading trades...</div>
          : <TradesTable trades={filtered} />
        }
      </div>
    </div>
  )
}

function parseLow(s) {
  if (!s) return 0
  const n = s.replace(/[$,]/g, '').split(/[-–]/)[0].trim()
  return parseFloat(n) || 0
}
