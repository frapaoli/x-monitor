interface Props {
  selectedCount: number
  totalCount: number
  disabled: boolean
  onSelectAll: () => void
  onDeselectAll: () => void
  onMarkRead: () => void
  onMarkUnread: () => void
  onArchive: () => void
}

export default function BulkActionBar({
  selectedCount,
  totalCount,
  disabled,
  onSelectAll,
  onDeselectAll,
  onMarkRead,
  onMarkUnread,
  onArchive,
}: Props) {
  if (selectedCount === 0) return null

  const allSelected = selectedCount === totalCount

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[80] animate-slide-in-up">
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl glass-card border border-cyan-glow/20 shadow-lg shadow-cyan-glow/10">
        {/* Count */}
        <span className="text-xs font-mono text-cyan-glow tabular-nums whitespace-nowrap">
          {selectedCount}/{totalCount}
        </span>

        <div className="w-px h-5 bg-slate-mid/40" />

        {/* Select all / Deselect all */}
        <button
          onClick={allSelected ? onDeselectAll : onSelectAll}
          disabled={disabled}
          className="text-xs font-mono text-fog hover:text-ghost px-2.5 py-1.5 rounded-lg hover:bg-slate-mid/20 transition-all disabled:opacity-40 whitespace-nowrap"
        >
          {allSelected ? 'Deselect all' : 'Select all'}
        </button>

        <div className="w-px h-5 bg-slate-mid/40" />

        {/* Mark Read */}
        <button
          onClick={onMarkRead}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-fog hover:text-ghost px-2.5 py-1.5 rounded-lg hover:bg-slate-mid/20 transition-all disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
          Read
        </button>

        {/* Mark Unread */}
        <button
          onClick={onMarkUnread}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-fog hover:text-ghost px-2.5 py-1.5 rounded-lg hover:bg-slate-mid/20 transition-all disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 19v-8.93a2 2 0 01.89-1.664l7-4.666a2 2 0 012.22 0l7 4.666A2 2 0 0121 10.07V19M3 19a2 2 0 002 2h14a2 2 0 002-2M3 19l6.75-4.5M21 19l-6.75-4.5M3 10l6.75 4.5M21 10l-6.75 4.5m0 0l-1.14.76a2 2 0 01-2.22 0l-1.14-.76" />
          </svg>
          Unread
        </button>

        {/* Archive */}
        <button
          onClick={onArchive}
          disabled={disabled}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-ash hover:text-rose px-2.5 py-1.5 rounded-lg hover:bg-rose/5 transition-all disabled:opacity-40"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
          </svg>
          Archive
        </button>

        <div className="w-px h-5 bg-slate-mid/40" />

        {/* Dismiss */}
        <button
          onClick={onDeselectAll}
          disabled={disabled}
          className="p-1.5 rounded-lg text-ash hover:text-fog hover:bg-slate-mid/20 transition-all disabled:opacity-40"
          title="Clear selection"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}
