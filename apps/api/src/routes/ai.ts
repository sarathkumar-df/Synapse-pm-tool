/**
 * AI routes — Sprint 9-11
 * Stubs registered so the app compiles. Full implementation in Phase 3.
 */
import { Router } from 'express'

const router = Router()

router.post('/categorize', (_req, res) => res.json({ data: { results: [] } }))
router.post('/suggest', (_req, res) => res.json({ data: { suggestions: [] } }))
router.post('/nl-to-map', (_req, res) => res.json({ data: { nodes: [], edges: [] } }))
router.post('/resolve-conflict', (_req, res) => res.json({ data: { strategies: [] } }))

export default router
