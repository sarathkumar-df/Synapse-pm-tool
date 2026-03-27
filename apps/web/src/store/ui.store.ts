/**
 * UI Store — transient UI state
 * Panels, toasts, modals, filters, command palette.
 */

import { create } from 'zustand'
import type { NodeFilterState } from '@synapse/shared'

type ActivePanel = 'node-detail' | 'conflicts' | 'snapshots' | null
type ToastType = 'success' | 'error' | 'warning' | 'info'

interface Toast {
  id: string
  type: ToastType
  message: string
  duration?: number // ms, default 4000
}

interface UIState {
  // Panels
  activePanel: ActivePanel
  setActivePanel: (panel: ActivePanel) => void

  // Toasts
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void

  // Modals
  nlToMapModalOpen: boolean
  exportModalOpen: boolean
  shareModalOpen: boolean
  snapshotModalOpen: boolean
  setModalOpen: (modal: 'nlToMap' | 'export' | 'share' | 'snapshot', open: boolean) => void

  // Command Palette
  commandPaletteOpen: boolean
  setCommandPaletteOpen: (open: boolean) => void

  // Canvas settings
  snapToGrid: boolean
  setSnapToGrid: (snap: boolean) => void

  // Filter State
  filters: NodeFilterState
  setFilters: (filters: NodeFilterState) => void
  clearFilters: () => void
  isFiltersActive: () => boolean
}

export const useUIStore = create<UIState>((set, get) => ({
  activePanel: null,
  toasts: [],
  nlToMapModalOpen: false,
  exportModalOpen: false,
  shareModalOpen: false,
  snapshotModalOpen: false,
  commandPaletteOpen: false,
  snapToGrid: false,
  filters: {},

  setActivePanel: (panel) => set({ activePanel: panel }),

  addToast: (toast) => {
    const id = Math.random().toString(36).slice(2)
    const newToast = { ...toast, id }
    set(state => ({ toasts: [...state.toasts, newToast] }))
    setTimeout(() => get().removeToast(id), toast.duration ?? 4000)
  },

  removeToast: (id) =>
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),

  setModalOpen: (modal, open) => {
    const key = {
      nlToMap: 'nlToMapModalOpen',
      export: 'exportModalOpen',
      share: 'shareModalOpen',
      snapshot: 'snapshotModalOpen',
    }[modal] as keyof UIState
    set({ [key]: open } as Partial<UIState>)
  },

  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  setSnapToGrid: (snap) => set({ snapToGrid: snap }),

  setFilters: (filters) => set({ filters }),

  clearFilters: () => set({ filters: {} }),

  isFiltersActive: () => {
    const { filters } = get()
    return !!(
      filters.categories?.length ||
      filters.statuses?.length ||
      filters.priorities?.length ||
      filters.has_deadline !== undefined ||
      filters.has_effort !== undefined ||
      filters.has_conflicts !== undefined
    )
  },
}))
