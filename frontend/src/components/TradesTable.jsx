import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
} from '@tanstack/react-table'
import { useState, useMemo } from 'react'

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function lagDays(traded, filed) {
  if (!traded || !filed) return null
  return Math.round((new Date(filed) - new Date(traded)) / 86400000)
}

function txLabel(tx) {
  const t = (tx || '').toLowerCase()
  if (t.includes('purchase')) return ['BUY', 'buy']
  if (t.includes('sale') || t.includes('sell')) return ['SELL', 'sell']
  return [tx || '—', 'other']
}

const columns = [
  {
    id: 'representative',
    header: 'Representative',
    accessorFn: r => r.representative || r.Name || '',
    cell: ({ row, getValue }) => {
      const p = row.original.Party || ''
      const cls = p.includes('Democrat') ? 'dem' : p.includes('Republican') ? 'rep' : 'ind'
      return (
        <div className="rep-cell">
          <span className={`party-dot ${cls}`} />
          <span>{getValue()}</span>
        </div>
      )
    },
  },
  {
    accessorKey: 'Chamber',
    header: 'Chamber',
    cell: ({ getValue }) => {
      const v = getValue() || ''
      return <span className={`badge chamber-${v.toLowerCase()}`}>{v || '—'}</span>
    },
  },
  {
    accessorKey: 'Ticker',
    header: 'Ticker',
    cell: ({ getValue }) => <strong className="ticker">{getValue() || '—'}</strong>,
  },
  {
    accessorKey: 'Transaction',
    header: 'Type',
    cell: ({ getValue }) => {
      const [label, cls] = txLabel(getValue())
      return <span className={`badge tx-${cls}`}>{label}</span>
    },
  },
  {
    accessorKey: 'Trade_Size_USD',
    header: 'Amount',
    cell: ({ getValue }) => <span className="amount">{getValue() || '—'}</span>,
  },
  {
    accessorKey: 'Traded',
    header: 'Trade Date',
    cell: ({ getValue }) => fmtDate(getValue()),
    sortingFn: 'datetime',
  },
  {
    accessorKey: 'Filed',
    header: 'Filed',
    cell: ({ getValue }) => fmtDate(getValue()),
    sortingFn: 'datetime',
  },
  {
    id: 'lag',
    header: 'Lag',
    accessorFn: r => lagDays(r.Traded, r.Filed),
    cell: ({ getValue }) => {
      const d = getValue()
      if (d === null) return '—'
      const cls = d > 30 ? 'lag-high' : d > 14 ? 'lag-mid' : 'lag-ok'
      return <span className={cls}>{d}d</span>
    },
    sortingFn: 'basic',
  },
  {
    accessorKey: 'Party',
    header: 'Party',
    cell: ({ getValue }) => {
      const p = getValue() || ''
      const short = p.includes('Democrat') ? 'D' : p.includes('Republican') ? 'R' : p.charAt(0) || '—'
      const cls = p.includes('Democrat') ? 'dem' : p.includes('Republican') ? 'rep' : 'ind'
      return <span style={{ color: cls === 'dem' ? '#4493f8' : cls === 'rep' ? 'var(--red)' : 'var(--yellow)', fontWeight: 600 }}>{short}</span>
    },
  },
  {
    accessorKey: 'State',
    header: 'State',
    cell: ({ getValue }) => getValue() || '—',
  },
  {
    accessorKey: 'Company',
    header: 'Company',
    cell: ({ getValue }) => <span className="muted">{getValue() || '—'}</span>,
  },
]

const PAGE_SIZES = [25, 50, 100]

export default function TradesTable({ trades }) {
  const [sorting, setSorting] = useState([{ id: 'Traded', desc: true }])
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 50 })

  const table = useReactTable({
    data: trades,
    columns,
    state: { sorting, pagination },
    onSortingChange: setSorting,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  })

  return (
    <div className="table-wrapper">
      <table className="trades-table">
        <thead>
          {table.getHeaderGroups().map(hg => (
            <tr key={hg.id}>
              {hg.headers.map(h => (
                <th
                  key={h.id}
                  className={h.column.getCanSort() ? 'sortable' : ''}
                  onClick={h.column.getToggleSortingHandler()}
                >
                  {flexRender(h.column.columnDef.header, h.getContext())}
                  {h.column.getIsSorted() === 'asc' ? ' ↑' : h.column.getIsSorted() === 'desc' ? ' ↓' : ''}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map(row => (
            <tr key={row.id}>
              {row.getVisibleCells().map(cell => (
                <td key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="pagination">
        <button onClick={() => table.firstPage()} disabled={!table.getCanPreviousPage()}>«</button>
        <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()}>‹</button>
        <span>Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}</span>
        <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()}>›</button>
        <button onClick={() => table.lastPage()} disabled={!table.getCanNextPage()}>»</button>
        <select
          value={table.getState().pagination.pageSize}
          onChange={e => table.setPageSize(Number(e.target.value))}
        >
          {PAGE_SIZES.map(s => <option key={s} value={s}>{s} / page</option>)}
        </select>
      </div>
    </div>
  )
}
