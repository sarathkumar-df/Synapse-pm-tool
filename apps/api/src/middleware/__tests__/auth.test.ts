import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { requireAuth, generateToken } from '../auth'
import { ApiError } from '../errors'

const JWT_SECRET = process.env.JWT_SECRET!

// Helper to build a minimal mock Request
function makeReq(authHeader?: string): Request {
  return {
    headers: {
      ...(authHeader !== undefined ? { authorization: authHeader } : {}),
    },
    userId: undefined,
  } as unknown as Request
}

function makeRes(): Response {
  return {} as Response
}

describe('generateToken', () => {
  it('creates a JWT that can be verified with the JWT_SECRET', () => {
    const token = generateToken('user_abc')
    const payload = jwt.verify(token, JWT_SECRET) as any
    expect(payload.userId).toBe('user_abc')
  })

  it('includes an expiry in the token payload', () => {
    const token = generateToken('user_exp_test')
    const payload = jwt.verify(token, JWT_SECRET) as any
    expect(payload.exp).toBeDefined()
    expect(typeof payload.exp).toBe('number')
  })

  it('produces different tokens for different user IDs', () => {
    const t1 = generateToken('user_1')
    const t2 = generateToken('user_2')
    expect(t1).not.toBe(t2)
  })
})

describe('requireAuth', () => {
  let next: ReturnType<typeof vi.fn>

  beforeEach(() => {
    next = vi.fn()
  })

  it('passes and sets req.userId for a valid Bearer token', () => {
    const token = generateToken('user_valid_001')
    const req = makeReq(`Bearer ${token}`)

    requireAuth(req, makeRes(), next as NextFunction)

    expect(next).toHaveBeenCalledWith()
    expect(next).not.toHaveBeenCalledWith(expect.any(Error))
    expect(req.userId).toBe('user_valid_001')
  })

  it('sets req.userId to the correct userId from the token payload', () => {
    const token = generateToken('user_xyz_789')
    const req = makeReq(`Bearer ${token}`)

    requireAuth(req, makeRes(), next as NextFunction)

    expect(req.userId).toBe('user_xyz_789')
  })

  it('throws 401 ApiError with AUTH_REQUIRED when no Authorization header', () => {
    const req = makeReq()

    expect(() => requireAuth(req, makeRes(), next as NextFunction)).toThrow(ApiError)

    try {
      requireAuth(req, makeRes(), next as NextFunction)
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).statusCode).toBe(401)
      expect((err as ApiError).code).toBe('AUTH_REQUIRED')
    }
  })

  it('throws 401 when Authorization header does not start with "Bearer "', () => {
    const req = makeReq('Basic dXNlcjpwYXNz')

    expect(() => requireAuth(req, makeRes(), next as NextFunction)).toThrow(ApiError)

    try {
      requireAuth(req, makeRes(), next as NextFunction)
    } catch (err) {
      expect((err as ApiError).statusCode).toBe(401)
      expect((err as ApiError).code).toBe('AUTH_REQUIRED')
    }
  })

  it('throws 401 when token is expired', () => {
    // Sign a token that expired 1 second ago
    const expiredToken = jwt.sign(
      { userId: 'user_expired' },
      JWT_SECRET,
      { expiresIn: -1 }
    )
    const req = makeReq(`Bearer ${expiredToken}`)

    expect(() => requireAuth(req, makeRes(), next as NextFunction)).toThrow(ApiError)

    try {
      requireAuth(req, makeRes(), next as NextFunction)
    } catch (err) {
      expect((err as ApiError).statusCode).toBe(401)
      expect((err as ApiError).code).toBe('AUTH_INVALID')
    }
  })

  it('throws 401 when token has an invalid signature', () => {
    const wrongSecretToken = jwt.sign({ userId: 'user_tampered' }, 'completely-wrong-secret-key-here')
    const req = makeReq(`Bearer ${wrongSecretToken}`)

    expect(() => requireAuth(req, makeRes(), next as NextFunction)).toThrow(ApiError)

    try {
      requireAuth(req, makeRes(), next as NextFunction)
    } catch (err) {
      expect((err as ApiError).statusCode).toBe(401)
      expect((err as ApiError).code).toBe('AUTH_INVALID')
    }
  })

  it('throws 401 for a completely malformed token string', () => {
    const req = makeReq('Bearer not.a.valid.jwt.token.at.all')

    expect(() => requireAuth(req, makeRes(), next as NextFunction)).toThrow(ApiError)

    try {
      requireAuth(req, makeRes(), next as NextFunction)
    } catch (err) {
      expect((err as ApiError).statusCode).toBe(401)
    }
  })

  it('does not call next when authentication fails', () => {
    const req = makeReq()

    try {
      requireAuth(req, makeRes(), next as NextFunction)
    } catch {
      // expected
    }

    expect(next).not.toHaveBeenCalled()
  })
})
