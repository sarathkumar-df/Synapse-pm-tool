/**
 * Snapshot routes — Sprint 7
 * Stub registered so the app compiles. Full implementation in Sprint 7.
 */
import { Router } from 'express'

const router = Router({ mergeParams: true })

router.get('/:mapId/snapshots', (_req, res) => res.json({ data: [] }))
router.post('/:mapId/snapshots', (_req, res) => res.status(201).json({ data: null }))
router.delete('/:mapId/snapshots/:snapshotId', (_req, res) => res.status(204).send())
router.patch('/:mapId/snapshots/:snapshotId', (_req, res) => res.json({ data: null }))
router.get('/:mapId/snapshots/diff', (_req, res) => res.json({ data: null }))

export default router
