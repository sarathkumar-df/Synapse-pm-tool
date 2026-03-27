import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { mapsApi } from '../services/api.client'
import { useCanvasStore } from '../store/canvas.store'
import { useEffect } from 'react'
import SynapseCanvas from '../components/canvas/SynapseCanvas'
import NodeDetailPanel from '../components/panels/NodeDetailPanel'

export default function MapEditorPage() {
  const { mapId } = useParams<{ mapId: string }>()
  const navigate = useNavigate()
  const initCanvas = useCanvasStore(s => s.initCanvas)

  const { data, isLoading, error } = useQuery({
    queryKey: ['map', mapId],
    queryFn: () => mapsApi.get(mapId!),
    enabled: !!mapId,
  })

  useEffect(() => {
    if (data) {
      initCanvas(data.nodes, data.edges, data.conflicts, data.critical_path)
    }
  }, [data, initCanvas])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading map…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center text-red-500">
          <p className="font-medium">Failed to load map</p>
          <p className="text-sm text-gray-400 mt-1">{(error as Error).message}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Top bar */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Back to dashboard"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <span className="font-medium text-gray-900 text-sm">{data?.map.name}</span>

        <div className="flex items-center gap-1 text-[10px] text-gray-400 ml-auto">
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 font-mono">N</kbd>
          <span>new node</span>
          <span className="mx-1.5">·</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 font-mono">double-click</kbd>
          <span>canvas</span>
          <span className="mx-1.5">·</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 font-mono">⌘Z</kbd>
          <span>undo</span>
          <span className="mx-1.5">·</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-100 font-mono">⌘K</kbd>
          <span>search</span>
        </div>
      </div>

      {/* Main area: canvas + side panel */}
      <div className="flex-1 flex overflow-hidden">
        {mapId && (
          <div className="flex-1 overflow-hidden">
            <SynapseCanvas mapId={mapId} />
          </div>
        )}
        {mapId && <NodeDetailPanel mapId={mapId} />}
      </div>
    </div>
  )
}
