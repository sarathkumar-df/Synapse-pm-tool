# Synapse Error Handling Patterns

## Backend Error Class
```typescript
// apps/api/src/middleware/errors.ts
export class ApiError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message?: string,
    public details?: Record<string, string[]>
  ) {
    super(message ?? code)
  }
}

// Common factory functions
export const forbidden = () => new ApiError('FORBIDDEN', 403)
export const notFound = (resource: string) =>
  new ApiError('NOT_FOUND', 404, `${resource} not found`)
export const validationError = (details: Record<string, string[]>) =>
  new ApiError('VALIDATION_ERROR', 422, 'Invalid request', details)
```

## Express Error Handler
```typescript
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      error: { code: err.code, message: err.message, details: err.details }
    })
  }
  // Unknown errors — log but don't expose internals
  logger.error('Unhandled error', { err })
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } })
})
```

## Frontend Error Handling
- API errors: show toast with user-friendly message
- Validation errors: show inline field errors
- Canvas errors: show toast, never crash the canvas
- AI errors: show "AI is unavailable" toast, degrade gracefully

## User-Facing Error Messages
Map technical errors to friendly messages in `apps/web/src/services/api.client.ts`:
```typescript
const ERROR_MESSAGES: Record<string, string> = {
  AUTH_REQUIRED:    'Please sign in to continue',
  FORBIDDEN:        'You don\'t have access to this',
  NOT_FOUND:        'This item no longer exists',
  RATE_LIMITED:     'You\'re doing that too quickly. Please wait a moment.',
  AI_ERROR:         'AI features are temporarily unavailable',
  INTERNAL_ERROR:   'Something went wrong. Please try again.',
}
```

## AI Error Degradation
If any AI feature fails, the app must continue working:
- Node suggestion fails → hide ghost nodes silently, show toast only on explicit trigger
- Auto-categorization fails → keep default category, show uncertainty badge
- NL-to-map fails → show error in modal, let user try again
- Conflict resolution fails → show "Unable to generate suggestions" in Conflicts Panel

## Canvas Error Boundary
```typescript
// Wrap the canvas in an error boundary
// If canvas crashes, show a "Reload canvas" fallback instead of blank screen
class CanvasErrorBoundary extends React.Component { ... }
```

## Validation (Backend — Zod)
```typescript
// Every route has a Zod schema
const createNodeSchema = z.object({
  label: z.string().min(1).max(200),
  category: z.enum(['feature', 'risk', 'blocker', ...]).optional().default('feature'),
  position_x: z.number(),
  position_y: z.number(),
  deadline: z.string().datetime().optional(),
  effort_value: z.number().positive().optional(),
  effort_unit: z.enum(['hours', 'days', 'story_points']).optional(),
}).refine(
  data => !(data.effort_value && !data.effort_unit),
  { message: 'effort_unit is required when effort_value is set', path: ['effort_unit'] }
)
```

## Logging
- Use structured logging (pino or winston)
- Log level: error for unhandled exceptions, warn for expected failures, info for key actions
- Never log: passwords, tokens, PII, full request bodies from auth endpoints
- Always include: `userId`, `mapId`, request method + path, duration
