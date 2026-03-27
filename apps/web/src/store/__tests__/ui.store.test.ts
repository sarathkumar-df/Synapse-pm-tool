import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { act } from '@testing-library/react'
import { useUIStore } from '../ui.store'

const initialState = {
  activePanel: null,
  toasts: [],
  nlToMapModalOpen: false,
  exportModalOpen: false,
  shareModalOpen: false,
  snapshotModalOpen: false,
  commandPaletteOpen: false,
  filters: {},
}

beforeEach(() => {
  act(() => {
    useUIStore.setState(initialState)
  })
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('addToast', () => {
  it('adds a toast to the queue', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'success', message: 'Saved!' })
    })

    expect(useUIStore.getState().toasts).toHaveLength(1)
    expect(useUIStore.getState().toasts[0].message).toBe('Saved!')
    expect(useUIStore.getState().toasts[0].type).toBe('success')
  })

  it('generates a unique id for each toast', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'info', message: 'First' })
      useUIStore.getState().addToast({ type: 'info', message: 'Second' })
    })

    const toasts = useUIStore.getState().toasts
    expect(toasts).toHaveLength(2)
    expect(toasts[0].id).toBeDefined()
    expect(toasts[1].id).toBeDefined()
    expect(toasts[0].id).not.toBe(toasts[1].id)
  })

  it('auto-removes toast after the default 4000ms', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'success', message: 'Temporary' })
    })
    expect(useUIStore.getState().toasts).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(4001)
    })

    expect(useUIStore.getState().toasts).toHaveLength(0)
  })

  it('auto-removes toast after custom duration', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'info', message: 'Quick', duration: 1000 })
    })
    expect(useUIStore.getState().toasts).toHaveLength(1)

    act(() => {
      vi.advanceTimersByTime(1001)
    })

    expect(useUIStore.getState().toasts).toHaveLength(0)
  })
})

describe('removeToast', () => {
  it('removes the correct toast by id', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'error', message: 'Error one' })
      useUIStore.getState().addToast({ type: 'error', message: 'Error two' })
    })

    const toasts = useUIStore.getState().toasts
    expect(toasts).toHaveLength(2)

    const idToRemove = toasts[0].id

    act(() => {
      useUIStore.getState().removeToast(idToRemove)
    })

    const remaining = useUIStore.getState().toasts
    expect(remaining).toHaveLength(1)
    expect(remaining[0].message).toBe('Error two')
  })

  it('does nothing when given an id that does not exist', () => {
    act(() => {
      useUIStore.getState().addToast({ type: 'info', message: 'Keep me' })
    })
    expect(useUIStore.getState().toasts).toHaveLength(1)

    act(() => {
      useUIStore.getState().removeToast('nonexistent-id')
    })

    expect(useUIStore.getState().toasts).toHaveLength(1)
  })
})

describe('setActivePanel', () => {
  it('changes active panel to node-detail', () => {
    act(() => {
      useUIStore.getState().setActivePanel('node-detail')
    })
    expect(useUIStore.getState().activePanel).toBe('node-detail')
  })

  it('changes active panel to conflicts', () => {
    act(() => {
      useUIStore.getState().setActivePanel('conflicts')
    })
    expect(useUIStore.getState().activePanel).toBe('conflicts')
  })

  it('sets active panel to null (closes panel)', () => {
    act(() => {
      useUIStore.getState().setActivePanel('snapshots')
    })
    act(() => {
      useUIStore.getState().setActivePanel(null)
    })
    expect(useUIStore.getState().activePanel).toBeNull()
  })
})

describe('setModalOpen', () => {
  it('opens the nlToMap modal', () => {
    act(() => {
      useUIStore.getState().setModalOpen('nlToMap', true)
    })
    expect(useUIStore.getState().nlToMapModalOpen).toBe(true)
  })

  it('closes the nlToMap modal', () => {
    act(() => {
      useUIStore.getState().setModalOpen('nlToMap', true)
    })
    act(() => {
      useUIStore.getState().setModalOpen('nlToMap', false)
    })
    expect(useUIStore.getState().nlToMapModalOpen).toBe(false)
  })

  it('opens the export modal', () => {
    act(() => {
      useUIStore.getState().setModalOpen('export', true)
    })
    expect(useUIStore.getState().exportModalOpen).toBe(true)
  })

  it('opens the share modal', () => {
    act(() => {
      useUIStore.getState().setModalOpen('share', true)
    })
    expect(useUIStore.getState().shareModalOpen).toBe(true)
  })

  it('opens the snapshot modal', () => {
    act(() => {
      useUIStore.getState().setModalOpen('snapshot', true)
    })
    expect(useUIStore.getState().snapshotModalOpen).toBe(true)
  })

  it('does not affect other modals when toggling one', () => {
    act(() => {
      useUIStore.getState().setModalOpen('nlToMap', true)
    })

    expect(useUIStore.getState().exportModalOpen).toBe(false)
    expect(useUIStore.getState().shareModalOpen).toBe(false)
    expect(useUIStore.getState().snapshotModalOpen).toBe(false)
  })
})

describe('clearFilters', () => {
  it('resets filters to empty object', () => {
    act(() => {
      useUIStore.getState().setFilters({
        categories: ['risk', 'blocker'],
        statuses: ['done'],
        priorities: ['critical'],
      })
    })
    expect(useUIStore.getState().filters.categories).toHaveLength(2)

    act(() => {
      useUIStore.getState().clearFilters()
    })

    expect(useUIStore.getState().filters).toEqual({})
  })
})

describe('isFiltersActive', () => {
  it('returns false for empty filters', () => {
    expect(useUIStore.getState().isFiltersActive()).toBe(false)
  })

  it('returns false when filters object has no populated fields', () => {
    act(() => {
      useUIStore.getState().setFilters({})
    })
    expect(useUIStore.getState().isFiltersActive()).toBe(false)
  })

  it('returns true when categories filter is set', () => {
    act(() => {
      useUIStore.getState().setFilters({ categories: ['risk'] })
    })
    expect(useUIStore.getState().isFiltersActive()).toBe(true)
  })

  it('returns true when statuses filter is set', () => {
    act(() => {
      useUIStore.getState().setFilters({ statuses: ['done'] })
    })
    expect(useUIStore.getState().isFiltersActive()).toBe(true)
  })

  it('returns true when priorities filter is set', () => {
    act(() => {
      useUIStore.getState().setFilters({ priorities: ['critical'] })
    })
    expect(useUIStore.getState().isFiltersActive()).toBe(true)
  })

  it('returns true when has_deadline filter is set', () => {
    act(() => {
      useUIStore.getState().setFilters({ has_deadline: true })
    })
    expect(useUIStore.getState().isFiltersActive()).toBe(true)
  })

  it('returns true when has_effort filter is set', () => {
    act(() => {
      useUIStore.getState().setFilters({ has_effort: false })
    })
    expect(useUIStore.getState().isFiltersActive()).toBe(true)
  })

  it('returns false after clearFilters is called', () => {
    act(() => {
      useUIStore.getState().setFilters({ categories: ['blocker'] })
    })
    expect(useUIStore.getState().isFiltersActive()).toBe(true)

    act(() => {
      useUIStore.getState().clearFilters()
    })
    expect(useUIStore.getState().isFiltersActive()).toBe(false)
  })
})
