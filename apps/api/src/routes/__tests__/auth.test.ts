import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from '../../index'

// Mock Prisma and bcrypt for unit tests
// Integration tests against real DB are in tests/integration/
vi.mock('../../db/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$12$hashedpassword'),
    compare: vi.fn(),
  },
}))

import { prisma } from '../../db/client'
import bcrypt from "bcryptjs"

const mockPrisma = vi.mocked(prisma)
const mockBcrypt = vi.mocked(bcrypt)

describe('POST /api/auth/register', () => {
  it('creates user and returns token', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockPrisma.user.create.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as any)

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123', name: 'Test User' })

    expect(res.status).toBe(201)
    expect(res.body.data.token).toBeTruthy()
    expect(res.body.data.user.email).toBe('test@example.com')
    expect(res.body.data.user).not.toHaveProperty('password_hash')
  })

  it('returns 409 when email already exists', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ id: 'existing' } as any)

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'taken@example.com', password: 'password123', name: 'User' })

    expect(res.status).toBe(409)
    expect(res.body.error.code).toBe('DUPLICATE')
  })

  it('returns 422 for invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-an-email', password: 'password123', name: 'User' })

    expect(res.status).toBe(422)
    expect(res.body.error.code).toBe('VALIDATION_ERROR')
    expect(res.body.error.details.email).toBeDefined()
  })

  it('returns 422 for short password', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'short', name: 'User' })

    expect(res.status).toBe(422)
    expect(res.body.error.details.password).toBeDefined()
  })

  it('returns 422 for missing name', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' })

    expect(res.status).toBe(422)
  })
})

describe('POST /api/auth/login', () => {
  it('returns token for valid credentials', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      name: 'Test User',
      avatar_url: null,
      password_hash: '$2b$12$hashedpassword',
      created_at: new Date(),
      updated_at: new Date(),
    } as any)
    mockBcrypt.compare.mockResolvedValue(true as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'password123' })

    expect(res.status).toBe(200)
    expect(res.body.data.token).toBeTruthy()
    expect(res.body.data.user).not.toHaveProperty('password_hash')
  })

  it('returns 401 for wrong password', async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      id: 'user_1',
      email: 'test@example.com',
      password_hash: '$2b$12$hash',
    } as any)
    mockBcrypt.compare.mockResolvedValue(false as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@example.com', password: 'wrongpassword' })

    expect(res.status).toBe(401)
    expect(res.body.error.code).toBe('AUTH_INVALID')
  })

  it('returns 401 for non-existent user (same message as wrong password)', async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockBcrypt.compare.mockResolvedValue(false as never)

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nonexistent@example.com', password: 'password123' })

    expect(res.status).toBe(401)
    // Must use same message — prevent user enumeration
    expect(res.body.error.message).toBe('Invalid email or password')
  })
})
