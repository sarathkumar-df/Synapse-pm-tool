import { memo } from 'react'

interface Props {
  count: number
  onDelete: () => void
  onDeselect: () => void
  isDeleting: boolean
}

function MultiSelectToolbar({ count, onDelete, onDeselect, isDeleting }: Props) {
  return (
    <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm pointer-events-auto">
      <span className="text-gray-600 font-medium">{count} nodes selected</span>

      <div className="w-px h-4 bg-gray-200" />

      <button
        onClick={onDelete}
        disabled={isDeleting}
        className="flex items-center gap-1.5 text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-0.5 rounded transition-colors disabled:opacity-50"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        {isDeleting ? 'Deleting…' : 'Delete all'}
      </button>

      <div className="w-px h-4 bg-gray-200" />

      <button
        onClick={onDeselect}
        title="Deselect all (Escape)"
        className="text-gray-400 hover:text-gray-600 hover:bg-gray-100 p-0.5 rounded transition-colors"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export default memo(MultiSelectToolbar)
