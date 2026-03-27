import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { useAuthStore } from '../auth.store'

// jsdom provides a real localStorage — no mock needed in this environment

const mockUser = {
  id: 'user_auth_001',
  email: 'test@example.com',
  name: 'Test User',
  avatar_url: null,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
}

beforeEach(() => {
  localStorage.clear()
  act(() => {
    useAuthStore.setState({ token: null, user: null })
  })
})

describe('setAuth', () => {
  it('stores token in state', () => {
    act(() => { useAuthStore.getState().setAuth('my-jwt-token', mockUser as any) })
    expect(useAuthStore.getState().token).toBe('my-jwt-token')
  })

  it('stores user in state', () => {
    act(() => { useAuthStore.getState().setAuth('my-jwt-token', mockUser as any) })
    const user = useAuthStore.getState().user
    expect(user).not.toBeNull()
    expect(user!.id).toBe('user_auth_001')
    expect(user!.email).toBe('test@example.com')
  })

  it('overwrites previous auth state', () => {
    const secondUser = { ...mockUser, id: 'user_auth_002', email: 'second@example.com' }
    act(() => { useAuthStore.getState().setAuth('first-token', mockUser as any) })
    act(() => { useAuthStore.getState().setAuth('second-token', secondUser as any) })
    expect(useAuthStore.getState().token).toBe('second-token')
    expect(useAuthStore.getState().user!.id).toBe('user_auth_002')
  })
})

describe('clearAuth', () => {
  it('resets token to null', () => {
    act(() => { useAuthStore.getState().setAuth('some-token', mockUser as any) })
    act(() => { useAuthStore.getState().clearAuth() })
    expect(useAuthStore.getState().token).toBeNull()
  })

  it('resets user to null', () => {
    act(() => { useAuthStore.getState().setAuth('some-token', mockUser as any) })
    act(() => { useAuthStore.getState().clearAuth() })
    expect(useAuthStore.getState().user).toBeNull()
  })

  it('does not throw when already cleared', () => {
    expect(() => {
      act(() => { useAuthStore.getState().clearAuth() })
    }).not.toThrow()
    expect(useAuthStore.getState().token).toBeNull()
  })
})

describe('localStorage persistence', () => {
  it('persists token to localStorage under "synapse-auth" key', () => {
    act(() => { useAuthStore.getState().setAuth('persisted-token', mockUser as any) })
    const raw = localStorage.getItem('synapse-auth')
    expect(raw).not.toBeNull()
    const stored = JSON.parse(raw!)
    expect(stored.state.token).toBe('persisted-token')
  })

  it('persists user to localStorage', () => {
    act(() => { useAuthStore.getState().setAuth('my-token', mockUser as any) })
    const stored = JSON.parse(localStorage.getItem('synapse-auth')!)
    expect(stored.state.user.email).toBe('test@example.com')
  })

  it('writes null values to localStorage after clearAuth', () => {
    act(() => { useAuthStore.getState().setAuth('my-token', mockUser as any) })
    act(() => { useAuthStore.getState().clearAuth() })
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    // If persist wrote to storage, token should be null there too
    const raw = localStorage.getItem('synapse-auth')
    if (raw) {
      const stored = JSON.parse(raw)
      expect(stored.state.token).toBeNull()
    }
  })
})
