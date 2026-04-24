export default function Filters({ search, setSearch, party, setParty, chamber, setChamber, txType, setTxType, count }) {
  return (
    <div className="filters">
      <input
        className="search-input"
        type="text"
        placeholder="Search representative or ticker..."
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      <select value={party} onChange={e => setParty(e.target.value)}>
        <option value="all">All Parties</option>
        <option value="Democrat">Democrat</option>
        <option value="Republican">Republican</option>
        <option value="Independent">Independent</option>
      </select>
      <select value={chamber} onChange={e => setChamber(e.target.value)}>
        <option value="all">All Chambers</option>
        <option value="House">House</option>
        <option value="Senate">Senate</option>
      </select>
      <select value={txType} onChange={e => setTxType(e.target.value)}>
        <option value="all">All Types</option>
        <option value="buy">Buy</option>
        <option value="sell">Sell</option>
      </select>
      <span className="result-count">{count.toLocaleString()} trades</span>
    </div>
  )
}
