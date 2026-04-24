export default function Filters({
  repSearch, setRepSearch,
  tickerSearch, setTickerSearch,
  party, setParty,
  chamber, setChamber,
  txType, setTxType,
  polState, setPolState,
  tradeSize, setTradeSize,
  states, tradeSizes,
}) {
  return (
    <div className="filters-panel">
      <div className="filters-grid">
        <div className="filter-item search-item">
          <span className="filter-icon">🔍</span>
          <input
            type="text"
            placeholder="Find by politician..."
            value={repSearch}
            onChange={e => setRepSearch(e.target.value)}
          />
        </div>

        <div className="filter-item">
          <select value={chamber} onChange={e => setChamber(e.target.value)}>
            <option value="all">Congress Chamber</option>
            <option value="House">House</option>
            <option value="Senate">Senate</option>
          </select>
        </div>

        <div className="filter-item search-item">
          <span className="filter-icon">🔍</span>
          <input
            type="text"
            placeholder="Find by issuer..."
            value={tickerSearch}
            onChange={e => setTickerSearch(e.target.value)}
          />
        </div>

        <div className="filter-item">
          <select value={polState} onChange={e => setPolState(e.target.value)}>
            <option value="all">Politician State</option>
            {states.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div className="filter-item">
          <select value={txType} onChange={e => setTxType(e.target.value)}>
            <option value="all">Transaction Type</option>
            <option value="buy">Buy / Purchase</option>
            <option value="sell">Sell / Sale</option>
          </select>
        </div>

        <div className="filter-item">
          <select value={party} onChange={e => setParty(e.target.value)}>
            <option value="all">Political Party</option>
            <option value="Democrat">Democrat</option>
            <option value="Republican">Republican</option>
            <option value="Independent">Independent</option>
          </select>
        </div>

        <div className="filter-item">
          <select value={tradeSize} onChange={e => setTradeSize(e.target.value)}>
            <option value="all">Trade Size</option>
            {tradeSizes.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
    </div>
  )
}
