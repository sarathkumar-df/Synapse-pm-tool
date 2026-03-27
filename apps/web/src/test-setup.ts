import '@testing-library/jest-dom'

// Provide a working localStorage for all tests (jsdom's storage is unreliable across versions)
const localStorageData: Record<string, string> = {}
const localStorageMock = {
  getItem: (key: string) => localStorageData[key] ?? null,
  setItem: (key: string, value: string) => { localStorageData[key] = value },
  removeItem: (key: string) => { delete localStorageData[key] },
  clear: () => { Object.keys(localStorageData).forEach(k => delete localStorageData[k]) },
  get length() { return Object.keys(localStorageData).length },
  key: (i: number) => Object.keys(localStorageData)[i] ?? null,
}
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true })
