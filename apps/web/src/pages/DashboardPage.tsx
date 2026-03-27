import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { mapsApi, projectsApi } from '../services/api.client'
import { useAuthStore } from '../store/auth.store'
import { useUIStore } from '../store/ui.store'
import type { Map as SynapseMap, Project } from '@synapse/shared'

export default function DashboardPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore(s => s.user)
  const clearAuth = useAuthStore(s => s.clearAuth)
  const addToast = useUIStore(s => s.addToast)

  const [newMapName, setNewMapName] = useState('')
  const [showNewMap, setShowNewMap] = useState(false)
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>()

  const { data: maps = [], isLoading: mapsLoading } = useQuery({
    queryKey: ['maps'],
    queryFn: mapsApi.list,
  })

  const { data: projects = [] } = useQuery({
    queryKey: ['projects'],
    queryFn: projectsApi.list,
  })

  const { mutate: createMap, isPending: creating } = useMutation({
    mutationFn: () => mapsApi.create({
      name: newMapName.trim() || 'Untitled Map',
      project_id: selectedProjectId,
    }),
    onSuccess: (map) => {
      queryClient.invalidateQueries({ queryKey: ['maps'] })
      setShowNewMap(false)
      setNewMapName('')
      navigate(`/maps/${map.id}`)
    },
    onError: (err: Error) => addToast({ type: 'error', message: err.message }),
  })

  const { mutate: deleteMap } = useMutation({
    mutationFn: (id: string) => mapsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['maps'] })
      addToast({ type: 'success', message: 'Map deleted' })
    },
    onError: (err: Error) => addToast({ type: 'error', message: err.message }),
  })


  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Synapse</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.name}</span>
            <button
              onClick={() => { clearAuth(); navigate('/login') }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Your maps</h2>
            <p className="text-gray-500 text-sm mt-1">
              {maps.length} map{maps.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => setShowNewMap(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-sm transition-colors"
          >
            <span>+</span> New map
          </button>
        </div>

        {/* New map form */}
        {showNewMap && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Create new map</h3>
            <div className="flex gap-3">
              <input
                autoFocus
                type="text"
                value={newMapName}
                onChange={e => setNewMapName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') createMap()
                  if (e.key === 'Escape') setShowNewMap(false)
                }}
                placeholder="Map name"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {projects.length > 0 && (
                <select
                  value={selectedProjectId ?? ''}
                  onChange={e => setSelectedProjectId(e.target.value || undefined)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">No project</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              )}
              <button
                onClick={() => createMap()}
                disabled={creating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg text-sm transition-colors"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
              <button
                onClick={() => setShowNewMap(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-lg text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Maps grid */}
        {mapsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 h-36 animate-pulse" />
            ))}
          </div>
        ) : maps.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <p className="text-lg font-medium">No maps yet</p>
            <p className="text-sm mt-1">Create your first map to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {maps.map(map => (
              <MapCard
                key={map.id}
                map={map}
                project={projects.find(p => p.id === map.project_id)}
                onOpen={() => navigate(`/maps/${map.id}`)}
                onDelete={() => {
                  if (confirm(`Delete "${map.name}"?`)) deleteMap(map.id)
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

interface MapCardProps {
  map: SynapseMap
  project?: Project
  onOpen: () => void
  onDelete: () => void
}

function MapCard({ map, project, onOpen, onDelete }: MapCardProps) {
  const updatedAt = new Date(map.updated_at)
  const timeAgo = formatTimeAgo(updatedAt)

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow cursor-pointer group"
      onClick={onOpen}
    >
      {/* Thumbnail placeholder */}
      <div className="w-full h-24 bg-gray-50 rounded-lg mb-4 flex items-center justify-center">
        {map.thumbnail_svg ? (
          <div dangerouslySetInnerHTML={{ __html: map.thumbnail_svg }} className="w-full h-full" />
        ) : (
          <svg className="w-8 h-8 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
          </svg>
        )}
      </div>

      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <h3 className="font-medium text-gray-900 truncate">{map.name}</h3>
          <p className="text-xs text-gray-400 mt-1">
            {project?.name ?? 'No project'} · {timeAgo}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete() }}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all ml-2 shrink-0"
          aria-label="Delete map"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  )
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)
  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString()
}
