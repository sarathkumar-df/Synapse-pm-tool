import rateLimit from 'express-rate-limit'

// 100 requests/min per user for standard endpoints
export const standardRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId ?? req.ip ?? 'unknown',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many requests. Please wait a moment.' } },
})

// 10 requests/min per user for AI endpoints
export const aiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.userId ?? req.ip ?? 'unknown',
  message: { error: { code: 'RATE_LIMITED', message: 'AI rate limit reached. Please wait a moment.' } },
})
