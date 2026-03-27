import { memo, useCallback, useRef, useEffect, useState } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import type { SynapseNodeData } from '../../types/canvas.types'
import { NODE_CATEGORY_COLORS } from '../../constants/node-categories'
import { useCanvasStore } from '../../store/canvas.store'

type SynapseNodeProps = NodeProps & { data: SynapseNodeData }

function SynapseNode({ id, data, selected }: SynapseNodeProps) {
  const updateNode = useCanvasStore(s => s.updateNode)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(data.label)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const colors = NODE_CATEGORY_COLORS[data.category]

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isEditing])

  const commitEdit = useCallback(() => {
    const trimmed = editValue.trim()
    if (trimmed && trimmed !== data.label) {
      updateNode(id, { label: trimmed })
    } else {
      setEditValue(data.label) // revert if empty
    }
    setIsEditing(false)
  }, [editValue, data.label, id, updateNode])

  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setIsEditing(true)
  }, [])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    e.stopPropagation() // prevent canvas shortcuts firing while editing
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      commitEdit()
    }
    if (e.key === 'Escape') {
      setEditValue(data.label)
      setIsEditing(false)
    }
  }, [commitEdit, data.label])

  // Conflict / critical path styling
  const conflictClass = data.isConflictCritical
    ? 'shadow-[0_0_0_2px_#C62828,0_0_8px_rgba(198,40,40,0.3)]'
    : data.isConflictWarning
    ? 'shadow-[0_0_0_2px_#F9A825,0_0_8px_rgba(249,168,37,0.3)]'
    : data.isOnCriticalPath
    ? 'shadow-[0_0_0_3px_#F57C00,0_0_12px_rgba(245,124,0,0.35)]'
    : selected
    ? 'shadow-[0_0_0_2px_#2E75B6]'
    : 'shadow-[0_2px_4px_rgba(0,0,0,0.08)]'

  const isOverdue = data.deadline
    && data.status !== 'done'
    && new Date(data.deadline) < new Date()

  const effortLabel = data.effort_value != null && data.effort_unit
    ? `${data.effort_value}${data.effort_unit === 'hours' ? 'h' : data.effort_unit === 'days' ? 'd' : 'sp'}`
    : null

  const deadlineLabel = data.deadline
    ? new Date(data.deadline).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : null

  return (
    <div
      className={`relative bg-white rounded-lg border border-[#D0D0D0] min-w-[200px] max-w-[200px] min-h-[80px] overflow-visible cursor-pointer select-none ${conflictClass}`}
      style={{ opacity: data.isRippleDimmed ? 0.3 : 1, transition: 'opacity 200ms ease' }}
      onDoubleClick={handleDoubleClick}
    >
      {/* Category left border strip */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 rounded-l-lg"
        style={{ backgroundColor: colors.border }}
      />

      {/* Category icon */}
      <div
        className="absolute top-1.5 left-3 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full"
        style={{ color: colors.border }}
        title={data.category}
      >
        {colors.icon}
      </div>

      {/* Label */}
      <div className="pl-8 pr-3 pt-2 pb-2">
        {isEditing ? (
          <textarea
            ref={inputRef}
            value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onBlur={commitEdit}
            onKeyDown={handleKeyDown}
            rows={2}
            className="w-full text-sm text-[#333] font-normal resize-none border-none outline-none bg-transparent leading-snug"
          />
        ) : (
          <p className="text-sm text-[#333] leading-snug line-clamp-3 break-words">
            {data.label}
          </p>
        )}
      </div>

      {/* Badges row */}
      {(effortLabel || deadlineLabel) && (
        <div className="flex items-center gap-1.5 px-3 pb-2 pl-8">
          {effortLabel && (
            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">
              {effortLabel}
            </span>
          )}
          {deadlineLabel && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${
                isOverdue
                  ? 'bg-red-50 text-red-600 animate-pulse'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              📅 {deadlineLabel}
            </span>
          )}
        </div>
      )}

      {/* React Flow connection handles — visible on hover */}
      {(['top', 'right', 'bottom', 'left'] as const).map(pos => (
        <Handle
          key={pos}
          type="source"
          position={
            pos === 'top' ? Position.Top
            : pos === 'right' ? Position.Right
            : pos === 'bottom' ? Position.Bottom
            : Position.Left
          }
          className="!w-3 !h-3 !bg-white !border-2 !rounded-full opacity-0 hover:opacity-100 group-hover:opacity-100 transition-opacity"
          style={{ borderColor: colors.border }}
        />
      ))}
      {/* Make handles visible when node is hovered */}
      <style>{`
        .react-flow__node:hover .react-flow__handle { opacity: 1 !important; }
      `}</style>
    </div>
  )
}

export default memo(SynapseNode)
