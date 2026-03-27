import type { Request, Response, NextFunction } from 'express'
import type { ZodSchema } from 'zod'
import { ApiError } from './errors'

/** Validates req.body against a Zod schema. Throws 422 on failure. */
export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const details: Record<string, string[]> = {}
      result.error.errors.forEach(err => {
        const key = err.path.join('.') || 'body'
        if (!details[key]) details[key] = []
        details[key].push(err.message)
      })
      throw new ApiError('VALIDATION_ERROR', 422, 'Invalid request', details)
    }
    req.body = result.data
    next()
  }
}
