import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCanvasStore } from '../../store/canvas.store'
import { useUIStore } from '../../store/ui.store'
import { NODE_CATEGORY_COLORS } from '../../constants/node-categories'
import type { Node } from '@synapse/shared'

interface Props {
  onSelectNode: (node: Node) => void
}

// ── Status badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  todo:        { bg: 'bg-gray-100',   text: 'text-gray-600',  label: 'Todo' },
  in_progress: { bg: 'bg-blue-100',   text: 'text-blue-700',  label: 'In progress' },
  done:        { bg: 'bg-green-100',  text: 'text-green-700', label: 'Done' },
  blocked:     { bg: 'bg-red-100',    text: 'text-red-700',   label: 'Blocked' },
  cancelled:   { bg: 'bg-gray-100',   text: 'text-gray-400',  label: 'Cancelled' },
}

// ── Search scoring ──────────────────────────────────────────────────────────

function scoreNode(node: Node, query: string): number {
  if (!query) return 1
  const q = query.toLowerCase()
  const label = node.label.toLowerCase()
  const desc  = (node.description ?? '').toLowerCase()

  if (label === q)            return 4
  if (label.startsWith(q))    return 3
  if (label.includes(q))      return 2
  if (desc.includes(q))       return 1
  return 0
}

// ── Main component ──────────────────────────────────────────────────────────

function CommandPalette({ onSelectNode }: Props) {
  const nodes              = useCanvasStore(s => s.nodes)
  const setCommandPaletteOpen = useUIStore(s => s.setCommandPaletteOpen)

  const [query, setQuery]       = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef    = useRef<HTMLInputElement>(null)
  const listRef     = useRef<HTMLUListElement>(null)

  const onClose = useCallback(() => {
    setCommandPaletteOpen(false)
  }, [setCommandPaletteOpen])

  // Auto-focus input on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Reset active index when results change
  const results = useMemo(() => {
    const scored = nodes
      .map(n => ({ node: n, score: scoreNode(n, query) }))
      .filter(x => x.score > 0)
      .sort((a, b) => b.score - a.score)
    return scored.map(x => x.node)
  }, [nodes, query])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx])

  // Keyboard navigation
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx(i => Math.min(i + 1, results.length - 1))
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx(i => Math.max(i - 1, 0))
      } else if (e.key === 'Enter') {
        e.preventDefault()
        const node = results[activeIdx]
        if (node) { onSelectNode(node); onClose() }
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [results, activeIdx, onSelectNode, onClose])

  const handleSelect = useCallback((node: Node) => {
    onSelectNode(node)
    onClose()
  }, [onSelectNode, onClose])

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      style={{ background: 'rgba(0,0,0,0.35)' }}
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      {/* Panel */}
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">

        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search nodes…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 outline-none bg-transparent"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          <kbd className="text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 font-mono flex-shrink-0">
            esc
          </kbd>
        </div>

        {/* Results */}
        <ul
          ref={listRef}
          className="max-h-80 overflow-y-auto py-1"
          role="listbox"
        >
          {results.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-gray-400">
              {query ? `No nodes matching "${query}"` : 'No nodes in this map'}
            </li>
          )}
          {results.map((node, idx) => {
            const { border, bg } = NODE_CATEGORY_COLORS[node.category]
            const status = STATUS_STYLES[node.status] ?? STATUS_STYLES.todo
            const isActive = idx === activeIdx

            return (
              <li
                key={node.id}
                role="option"
                aria-selected={isActive}
                onMouseEnter={() => setActiveIdx(idx)}
                onClick={() => handleSelect(node)}
                className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors ${
                  isActive ? 'bg-blue-50' : 'hover:bg-gray-50'
                }`}
              >
                {/* Category color strip */}
                <div
                  className="w-1 h-8 rounded-full flex-shrink-0"
                  style={{ background: border }}
                />

                {/* Label + description */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-medium text-gray-900 truncate"
                      style={isActive ? { color: border } : undefined}
                    >
                      {node.label}
                    </span>
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0"
                      style={{ background: bg, color: border }}
                    >
                      {node.category}
                    </span>
                  </div>
                  {node.description && (
                    <p className="text-xs text-gray-400 truncate mt-0.5">
                      {node.description}
                    </p>
                  )}
                </div>

                {/* Status badge */}
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${status.bg} ${status.text}`}>
                  {status.label}
                </span>

                {/* Enter hint on active */}
                {isActive && (
                  <kbd className="text-[10px] text-gray-400 bg-gray-100 rounded px-1.5 py-0.5 font-mono flex-shrink-0">
                    ↵
                  </kbd>
                )}
              </li>
            )
          })}
        </ul>

        {/* Footer hint */}
        {results.length > 0 && (
          <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
            <span><kbd className="bg-gray-100 rounded px-1 font-mono">↑↓</kbd> navigate</span>
            <span><kbd className="bg-gray-100 rounded px-1 font-mono">↵</kbd> jump to node</span>
            <span className="ml-auto">{results.length} result{results.length !== 1 ? 's' : ''}</span>
          </div>
        )}
      </div>
    </div>
  )
}

export default memo(CommandPalette)
