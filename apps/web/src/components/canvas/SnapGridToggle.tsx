import { memo } from 'react'

interface Props {
  active: boolean
  onToggle: () => void
}

function SnapGridToggle({ active, onToggle }: Props) {
  return (
    <button
      onClick={onToggle}
      title={`${active ? 'Disable' : 'Enable'} snap to grid (G)`}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors shadow-sm ${
        active
          ? 'bg-blue-600 border-blue-600 text-white hover:bg-blue-700'
          : 'bg-white border-gray-200 text-gray-500 hover:text-gray-800 hover:border-gray-300'
      }`}
    >
      {/* Grid icon */}
      <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
        <line x1="5" y1="0" x2="5" y2="16" />
        <line x1="11" y1="0" x2="11" y2="16" />
        <line x1="0" y1="5" x2="16" y2="5" />
        <line x1="0" y1="11" x2="16" y2="11" />
      </svg>
      Snap
    </button>
  )
}

export default memo(SnapGridToggle)
