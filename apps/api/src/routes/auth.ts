import { Router } from 'express'
import bcrypt from "bcryptjs"
import { z } from 'zod'
import { prisma } from '../db/client'
import { validateBody } from '../middleware/validate'
import { generateToken } from '../middleware/auth'
import { ApiError } from '../middleware/errors'

const router = Router()

const registerSchema = z.object({
  email: z.string().email('Invalid email address').toLowerCase(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
})

const loginSchema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1, 'Password is required'),
})

// POST /api/auth/register
router.post('/register', validateBody(registerSchema), async (req, res, next) => {
  try {
    const { email, password, name } = req.body

    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      throw new ApiError('DUPLICATE', 409, 'An account with this email already exists')
    }

    const password_hash = await bcrypt.hash(password, 12)
    const user = await prisma.user.create({
      data: { email, password_hash, name },
      select: { id: true, email: true, name: true, avatar_url: true, created_at: true, updated_at: true },
    })

    const token = generateToken(user.id)
    res.status(201).json({ data: { token, user } })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', validateBody(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body

    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, name: true, avatar_url: true, password_hash: true, created_at: true, updated_at: true },
    })

    // Constant-time comparison to prevent user enumeration
    const validPassword = user
      ? await bcrypt.compare(password, user.password_hash)
      : await bcrypt.compare(password, '$2b$12$invalidhashfortimingattackprevention')

    if (!user || !validPassword) {
      throw new ApiError('AUTH_INVALID', 401, 'Invalid email or password')
    }

    const { password_hash: _, ...safeUser } = user
    const token = generateToken(user.id)
    res.json({ data: { token, user: safeUser } })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/me
router.get('/me', async (req, res, next) => {
  try {
    // requireAuth is applied globally to /api routes
    // but /api/auth is public — so userId may not be set here
    // This endpoint is only useful when called from authenticated context
    if (!req.userId) {
      throw new ApiError('AUTH_REQUIRED', 401)
    }
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: { id: true, email: true, name: true, avatar_url: true, created_at: true, updated_at: true },
    })
    if (!user) throw new ApiError('NOT_FOUND', 404, 'User not found')
    res.json({ data: { user } })
  } catch (err) {
    next(err)
  }
})

export default router
