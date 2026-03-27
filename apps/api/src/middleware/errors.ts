import type { Request, Response, NextFunction } from 'express'

export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message?: string,
    public details?: Record<string, string[]>
  ) {
    super(message ?? code)
    this.name = 'ApiError'
  }
}

export const forbidden = () => new ApiError('FORBIDDEN', 403, 'Access denied')
export const notFound = (resource = 'Resource') =>
  new ApiError('NOT_FOUND', 404, `${resource} not found`)
export const validationError = (details: Record<string, string[]>) =>
  new ApiError('VALIDATION_ERROR', 422, 'Invalid request', details)
export const aiError = () =>
  new ApiError('AI_ERROR', 503, 'AI service temporarily unavailable')

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details }
    })
    return
  }

  // Prisma unique constraint violation
  if ((err as any).code === 'P2002') {
    res.status(409).json({ error: { code: 'DUPLICATE', message: 'Resource already exists' } })
    return
  }

  console.error('Unhandled error:', err)
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
}
