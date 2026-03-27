import { memo } from 'react'
import type { EdgeType } from '@synapse/shared'
import { EDGE_TYPE_STYLES } from '../../constants/node-categories'

interface EdgeTypePickerProps {
  onSelect: (type: EdgeType) => void
  onDismiss: () => void
  x: number
  y: number
}

const EDGE_TYPES: { type: EdgeType; label: string; description: string }[] = [
  { type: 'dependency', label: 'Dependency',  description: 'This must complete before that' },
  { type: 'blocks',     label: 'Blocks',       description: 'This is blocking that' },
  { type: 'triggers',   label: 'Triggers',     description: 'This causes that to start' },
  { type: 'related',    label: 'Related',      description: 'These are related' },
  { type: 'informs',    label: 'Informs',      description: 'This provides context for that' },
]

function EdgeTypePicker({ onSelect, onDismiss, x, y }: EdgeTypePickerProps) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onDismiss} />

      {/* Picker popover */}
      <div
        className="fixed z-50 bg-white rounded-xl border border-gray-200 shadow-xl p-1 w-52"
        style={{ left: x, top: y }}
      >
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-2 py-1">
          Connection type
        </p>
        {EDGE_TYPES.map(({ type, label, description }) => {
          const style = EDGE_TYPE_STYLES[type]
          return (
            <button
              key={type}
              onClick={() => onSelect(type)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors"
            >
              <div className="w-6 flex items-center">
                <div
                  className="h-0.5 w-5"
                  style={{
                    backgroundColor: style.color,
                    borderTop: style.strokeDasharray ? `2px dashed ${style.color}` : undefined,
                    height: style.strokeDasharray ? 0 : 2,
                  }}
                />
              </div>
              <div>
                <div className="text-xs font-medium text-gray-800">{label}</div>
                <div className="text-[10px] text-gray-400">{description}</div>
              </div>
            </button>
          )
        })}
      </div>
    </>
  )
}

export default memo(EdgeTypePicker)
