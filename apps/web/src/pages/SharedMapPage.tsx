import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { mapsApi } from '../services/api.client'

export default function SharedMapPage() {
  const { token } = useParams<{ token: string }>()

  const { data, isLoading, error } = useQuery({
    queryKey: ['shared-map', token],
    queryFn: () => mapsApi.getShared(token!),
    enabled: !!token,
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-500">Loading shared map…</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <p className="font-medium text-gray-900">Map not found</p>
          <p className="text-sm text-gray-400 mt-1">This link may have been deactivated.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {/* Minimal header — no editing controls */}
      <div className="h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4 shrink-0">
        <span className="font-medium text-gray-900 text-sm">{data?.map.name}</span>
        <span className="text-xs text-gray-400">Powered by Synapse</span>
      </div>

      {/* Read-only canvas — Sprint 2 */}
      <div className="flex-1 flex items-center justify-center text-gray-400">
        <p className="text-sm">Read-only canvas — Sprint 2</p>
      </div>
    </div>
  )
}
