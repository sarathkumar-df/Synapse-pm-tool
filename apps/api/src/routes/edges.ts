import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/client'
import { validateBody } from '../middleware/validate'
import { forbidden, ApiError } from '../middleware/errors'
import { detectConflicts } from '../services/conflict.service'
import { calculateCriticalPath } from '../services/critical-path.service'

const router = Router({ mergeParams: true })

const edgeTypes = ['dependency', 'related', 'blocks', 'triggers', 'informs'] as const

const createSchema = z.object({
  source_node_id: z.string(),
  target_node_id: z.string(),
  edge_type: z.enum(edgeTypes),
  label: z.string().max(100).trim().optional(),
}).refine(d => d.source_node_id !== d.target_node_id, {
  message: 'Self-referencing edges are not allowed',
  path: ['target_node_id'],
})

const updateSchema = z.object({
  edge_type: z.enum(edgeTypes).optional(),
  label: z.string().max(100).trim().optional().nullable(),
})

async function assertMapOwnership(mapId: string, userId: string) {
  const map = await prisma.map.findFirst({ where: { id: mapId, user_id: userId } })
  if (!map) throw forbidden()
  return map
}

// POST /api/maps/:mapId/edges
router.post('/:mapId/edges', validateBody(createSchema), async (req, res, next) => {
  try {
    await assertMapOwnership(req.params.mapId, req.userId)

    // Check for duplicate edge
    const existing = await prisma.edge.findFirst({
      where: {
        map_id: req.params.mapId,
        source_node_id: req.body.source_node_id,
        target_node_id: req.body.target_node_id,
        edge_type: req.body.edge_type,
      },
    })
    if (existing) {
      throw new ApiError('DUPLICATE', 409, 'Connection already exists')
    }

    const edge = await prisma.edge.create({
      data: { ...req.body, map_id: req.params.mapId },
    })
    const [conflicts, critical_path] = await Promise.all([
      detectConflicts(req.params.mapId),
      calculateCriticalPath(req.params.mapId),
    ])
    res.status(201).json({ data: { edge, conflicts, critical_path } })
  } catch (err) { next(err) }
})

// PATCH /api/maps/:mapId/edges/:edgeId
router.patch('/:mapId/edges/:edgeId', validateBody(updateSchema), async (req, res, next) => {
  try {
    await assertMapOwnership(req.params.mapId, req.userId)
    const edge = await prisma.edge.update({
      where: { id: req.params.edgeId, map_id: req.params.mapId },
      data: req.body,
    })
    res.json({ data: edge })
  } catch (err) { next(err) }
})

// DELETE /api/maps/:mapId/edges/:edgeId
router.delete('/:mapId/edges/:edgeId', async (req, res, next) => {
  try {
    await assertMapOwnership(req.params.mapId, req.userId)
    await prisma.edge.delete({
      where: { id: req.params.edgeId, map_id: req.params.mapId },
    })
    const [conflicts, critical_path] = await Promise.all([
      detectConflicts(req.params.mapId),
      calculateCriticalPath(req.params.mapId),
    ])
    res.json({ data: { conflicts, critical_path } })
  } catch (err) { next(err) }
})

export default router
