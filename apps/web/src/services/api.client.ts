/**
 * Typed API client — all backend calls go through here.
 * Never call fetch() directly in components or hooks.
 */

import { useAuthStore } from '../store/auth.store'
import type {
  AuthResponse, RegisterRequest, LoginRequest,
  Project, CreateProjectRequest, UpdateProjectRequest,
  Map, CreateMapRequest, UpdateMapRequest, MapDetailResponse,
  Node, CreateNodeRequest, UpdateNodeRequest, NodeMutationResponse,
  Edge, CreateEdgeRequest, UpdateEdgeRequest, Conflict, CriticalPathResult,
  Snapshot, CreateSnapshotRequest, SnapshotDiff,
  SharedMapResponse,
  ChangeLog,
  CategorizationRequest, CategorizationResponse,
  SuggestionRequest, SuggestionResponse,
  NlToMapRequest, NlToMapResponse,
  ConflictResolutionRequest, ConflictResolutionResponse,
  ExportPdfRequest, ExportImageRequest,
} from '@synapse/shared'

const BASE_URL = '/api'

// ─── Error handling ───────────────────────────────────────────────────────────

export class ApiClientError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public details?: Record<string, string[]>
  ) {
    super(message)
  }
}

const USER_FACING_ERRORS: Record<string, string> = {
  AUTH_REQUIRED:  'Please sign in to continue',
  AUTH_INVALID:   'Invalid email or password',
  FORBIDDEN:      "You don't have access to this",
  NOT_FOUND:      'This item no longer exists',
  DUPLICATE:      'This already exists',
  RATE_LIMITED:   'Too many requests. Please wait a moment.',
  AI_ERROR:       'AI features are temporarily unavailable',
  INTERNAL_ERROR: 'Something went wrong. Please try again.',
}

// ─── Core fetch wrapper ───────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const token = useAuthStore.getState().token

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const json = await res.json()

  if (!res.ok) {
    const code = json?.error?.code ?? 'INTERNAL_ERROR'
    const message = USER_FACING_ERRORS[code] ?? json?.error?.message ?? 'Something went wrong'
    throw new ApiClientError(code, message, res.status, json?.error?.details)
  }

  return json.data as T
}

const get  = <T>(path: string) => request<T>('GET', path)
const post = <T>(path: string, body?: unknown) => request<T>('POST', path, body)
const patch = <T>(path: string, body?: unknown) => request<T>('PATCH', path, body)
const del  = (path: string) => request<void>('DELETE', path)

// ─── Auth ─────────────────────────────────────────────────────────────────────

export const authApi = {
  register: (data: RegisterRequest) => post<AuthResponse>('/auth/register', data),
  login:    (data: LoginRequest) => post<AuthResponse>('/auth/login', data),
  me:       () => get<{ user: import('@synapse/shared').User }>('/auth/me'),
}

// ─── Projects ─────────────────────────────────────────────────────────────────

export const projectsApi = {
  list:    () => get<Project[]>('/projects'),
  create:  (data: CreateProjectRequest) => post<Project>('/projects', data),
  get:     (id: string) => get<Project>(`/projects/${id}`),
  update:  (id: string, data: UpdateProjectRequest) => patch<Project>(`/projects/${id}`, data),
  delete:  (id: string) => del(`/projects/${id}`),
  archive: (id: string) => post<Project>(`/projects/${id}/archive`),
}

// ─── Maps ─────────────────────────────────────────────────────────────────────

export const mapsApi = {
  list:    () => get<Map[]>('/maps'),
  create:  (data: CreateMapRequest) => post<Map>('/maps', data),
  get:     (id: string) => get<MapDetailResponse>(`/maps/${id}`),
  update:  (id: string, data: UpdateMapRequest) => patch<Map>(`/maps/${id}`, data),
  delete:  (id: string) => del(`/maps/${id}`),
  archive: (id: string) => post<Map>(`/maps/${id}/archive`),
  share:   (id: string, config?: unknown) => post<{ share_url: string; share_token: string }>(`/maps/${id}/share`, config),
  unshare: (id: string) => del(`/maps/${id}/share`),
  getShared: (token: string) => get<SharedMapResponse>(`/shared/${token}`),
}

// ─── Nodes ────────────────────────────────────────────────────────────────────

export const nodesApi = {
  create: (mapId: string, data: CreateNodeRequest) =>
    post<NodeMutationResponse>(`/maps/${mapId}/nodes`, data),
  update: (mapId: string, nodeId: string, data: UpdateNodeRequest) =>
    patch<NodeMutationResponse>(`/maps/${mapId}/nodes/${nodeId}`, data),
  delete: (mapId: string, nodeId: string) =>
    request<{ conflicts: Conflict[]; critical_path: CriticalPathResult }>('DELETE', `/maps/${mapId}/nodes/${nodeId}`),
  bulkUpdate: (mapId: string, updates: Array<{ id: string } & UpdateNodeRequest>) =>
    patch<{ nodes: Node[]; conflicts: Conflict[]; critical_path: CriticalPathResult }>(`/maps/${mapId}/nodes/bulk`, { updates }),
}

// ─── Edges ────────────────────────────────────────────────────────────────────

export const edgesApi = {
  create: (mapId: string, data: CreateEdgeRequest) =>
    post<{ edge: Edge; conflicts: Conflict[]; critical_path: CriticalPathResult }>(`/maps/${mapId}/edges`, data),
  update: (mapId: string, edgeId: string, data: UpdateEdgeRequest) =>
    patch<Edge>(`/maps/${mapId}/edges/${edgeId}`, data),
  delete: (mapId: string, edgeId: string) =>
    request<{ conflicts: Conflict[]; critical_path: CriticalPathResult }>('DELETE', `/maps/${mapId}/edges/${edgeId}`),
}

// ─── Change History ───────────────────────────────────────────────────────────

export const changeLogsApi = {
  nodeHistory: (mapId: string, nodeId: string) =>
    get<{ history: ChangeLog[] }>(`/maps/${mapId}/nodes/${nodeId}/history`),
}

// ─── Snapshots ────────────────────────────────────────────────────────────────

export const snapshotsApi = {
  list:    (mapId: string) => get<Snapshot[]>(`/maps/${mapId}/snapshots`),
  create:  (mapId: string, data: CreateSnapshotRequest) => post<Snapshot>(`/maps/${mapId}/snapshots`, data),
  delete:  (mapId: string, snapshotId: string) => del(`/maps/${mapId}/snapshots/${snapshotId}`),
  rename:  (mapId: string, snapshotId: string, name: string) =>
    patch<Snapshot>(`/maps/${mapId}/snapshots/${snapshotId}`, { name }),
  diff:    (mapId: string, a: string, b: string) =>
    get<SnapshotDiff>(`/maps/${mapId}/snapshots/diff?a=${a}&b=${b}`),
}

// ─── AI ───────────────────────────────────────────────────────────────────────

export const aiApi = {
  categorize:       (data: CategorizationRequest) => post<CategorizationResponse>('/ai/categorize', data),
  suggest:          (data: SuggestionRequest) => post<SuggestionResponse>('/ai/suggest', data),
  nlToMap:          (data: NlToMapRequest) => post<NlToMapResponse>('/ai/nl-to-map', data),
  resolveConflict:  (data: ConflictResolutionRequest) => post<ConflictResolutionResponse>('/ai/resolve-conflict', data),
}

// ─── Export ───────────────────────────────────────────────────────────────────

export const exportApi = {
  pdf:   (mapId: string, options: ExportPdfRequest) =>
    fetch(`${BASE_URL}/maps/${mapId}/export/pdf`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${useAuthStore.getState().token}`,
      },
      body: JSON.stringify(options),
    }),
  image: (mapId: string, options: ExportImageRequest) =>
    fetch(`${BASE_URL}/maps/${mapId}/export/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${useAuthStore.getState().token}`,
      },
      body: JSON.stringify(options),
    }),
}
