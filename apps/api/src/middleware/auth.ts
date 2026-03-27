import type { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { ApiError } from './errors'

declare global {
  namespace Express {
    interface Request {
      userId: string
    }
  }
}

interface JwtPayload {
  userId: string
  iat: number
  exp: number
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    throw new ApiError('AUTH_REQUIRED', 401, 'Authentication required')
  }

  const token = authHeader.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload
    req.userId = payload.userId
    next()
  } catch {
    throw new ApiError('AUTH_INVALID', 401, 'Invalid or expired token')
  }
}

export function generateToken(userId: string): string {
  return jwt.sign({ userId }, process.env.JWT_SECRET!, { expiresIn: '30d' })
}
