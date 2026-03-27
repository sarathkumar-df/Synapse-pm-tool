/**
 * Auth Store — persisted to localStorage
 * Stores JWT token and user profile.
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '@synapse/shared'

interface AuthState {
  token: string | null
  user: User | null
  setAuth: (token: string, user: User) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      setAuth: (token, user) => set({ token, user }),
      clearAuth: () => set({ token: null, user: null }),
    }),
    { name: 'synapse-auth' }
  )
)
