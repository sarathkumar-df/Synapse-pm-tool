/**
 * Node routes — Sprint 2
 * Full implementation with canvas CRUD, validation, and conflict recalculation.
 */
import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/client'
import { validateBody } from '../middleware/validate'
import { forbidden } from '../middleware/errors'
import { detectConflicts } from '../services/conflict.service'
import { calculateCriticalPath } from '../services/critical-path.service'

const router = Router({ mergeParams: true })

const nodeCategories = ['feature', 'risk', 'blocker', 'dependency', 'question', 'assumption', 'milestone', 'note'] as const
const nodeStatuses = ['todo', 'in_progress', 'done', 'blocked', 'cancelled'] as const
const nodePriorities = ['critical', 'high', 'medium', 'low'] as const
const effortUnits = ['hours', 'days', 'story_points'] as const

const nodeBaseSchema = z.object({
  label: z.string().min(1).max(200).trim(),
  description: z.string().max(5000).optional(),
  category: z.enum(nodeCategories).optional().default('feature'),
  status: z.enum(nodeStatuses).optional().default('todo'),
  priority: z.enum(nodePriorities).optional().default('medium'),
  position_x: z.number(),
  position_y: z.number(),
  parent_id: z.string().optional(),
  effort_value: z.number().positive().optional(),
  effort_unit: z.enum(effortUnits).optional(),
  deadline: z.string().datetime().optional(),
  color_override: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  metadata: z.record(z.string()).optional(),
})

const createSchema = nodeBaseSchema.refine(
  d => !(d.effort_value && !d.effort_unit),
  { message: 'effort_unit required when effort_value is set', path: ['effort_unit'] }
)

const updateSchema = nodeBaseSchema.partial().extend({
  deadline: z.string().datetime().optional().nullable(),
  effort_value: z.number().positive().optional().nullable(),
  effort_unit: z.enum(effortUnits).optional().nullable(),
  color_override: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().nullable(),
})

async function assertMapOwnership(mapId: string, userId: string) {
  const map = await prisma.map.findFirst({ where: { id: mapId, user_id: userId } })
  if (!map) throw forbidden()
  return map
}

// GET /api/maps/:mapId/nodes/:nodeId/history
router.get('/:mapId/nodes/:nodeId/history', async (req, res, next) => {
  try {
    await assertMapOwnership(req.params.mapId, req.userId)
    const history = await prisma.changeLog.findMany({
      where: { map_id: req.params.mapId, node_id: req.params.nodeId },
      orderBy: { created_at: 'desc' },
      take: 50,
    })
    res.json({ data: { history } })
  } catch (err) { next(err) }
})

// POST /api/maps/:mapId/nodes
router.post('/:mapId/nodes', validateBody(createSchema), async (req, res, next) => {
  try {
    await assertMapOwnership(req.params.mapId, req.userId)
    const node = await prisma.node.create({
      data: { ...req.body, map_id: req.params.mapId },
    })
    await prisma.changeLog.create({
      data: {
        map_id: req.params.mapId,
        node_id: node.id,
        user_id: req.userId,
        action: 'create',
        entity_type: 'node',
        new_value: node as any,
      },
    })
    const [conflicts, critical_path] = await Promise.all([
      detectConflicts(req.params.mapId),
      calculateCriticalPath(req.params.mapId),
    ])
    res.status(201).json({ data: { node, conflicts, critical_path } })
  } catch (err) { next(err) }
})

// PATCH /api/maps/:mapId/nodes/bulk  ← must be before /:nodeId to avoid 'bulk' matching as a nodeId
router.patch('/:mapId/nodes/bulk', async (req, res, next) => {
  try {
    await assertMapOwnership(req.params.mapId, req.userId)
    const { updates } = req.body as { updates: Array<{ id: string; [key: string]: unknown }> }
    const nodes = await Promise.all(
      updates.map(({ id, ...data }) =>
        prisma.node.update({ where: { id, map_id: req.params.mapId }, data })
      )
    )
    const [conflicts, critical_path] = await Promise.all([
      detectConflicts(req.params.mapId),
      calculateCriticalPath(req.params.mapId),
    ])
    res.json({ data: { nodes, conflicts, critical_path } })
  } catch (err) { next(err) }
})

// PATCH /api/maps/:mapId/nodes/:nodeId
router.patch('/:mapId/nodes/:nodeId', validateBody(updateSchema), async (req, res, next) => {
  try {
    await assertMapOwnership(req.params.mapId, req.userId)
    // Only log changelog for meaningful field changes (not position-only auto-saves)
    const POSITION_ONLY = new Set(['position_x', 'position_y'])
    const isMeaningfulChange = Object.keys(req.body).some(k => !POSITION_ONLY.has(k))
    const before = isMeaningfulChange
      ? await prisma.node.findUnique({ where: { id: req.params.nodeId } })
      : null
    const node = await prisma.node.update({
      where: { id: req.params.nodeId, map_id: req.params.mapId },
      data: req.body,
    })
    if (isMeaningfulChange) {
      await prisma.changeLog.create({
        data: {
          map_id: req.params.mapId,
          node_id: node.id,
          user_id: req.userId,
          action: 'update',
          entity_type: 'node',
          old_value: before as any,
          new_value: node as any,
        },
      })
    }
    const [conflicts, critical_path] = await Promise.all([
      detectConflicts(req.params.mapId),
      calculateCriticalPath(req.params.mapId),
    ])
    res.json({ data: { node, conflicts, critical_path } })
  } catch (err) { next(err) }
})

// DELETE /api/maps/:mapId/nodes/:nodeId
router.delete('/:mapId/nodes/:nodeId', async (req, res, next) => {
  try {
    await assertMapOwnership(req.params.mapId, req.userId)
    const before = await prisma.node.findUnique({ where: { id: req.params.nodeId } })
    await prisma.node.delete({
      where: { id: req.params.nodeId, map_id: req.params.mapId },
    })
    if (before) {
      await prisma.changeLog.create({
        data: {
          map_id: req.params.mapId,
          node_id: req.params.nodeId,
          user_id: req.userId,
          action: 'delete',
          entity_type: 'node',
          old_value: before as any,
        },
      })
    }
    const [conflicts, critical_path] = await Promise.all([
      detectConflicts(req.params.mapId),
      calculateCriticalPath(req.params.mapId),
    ])
    res.json({ data: { conflicts, critical_path } })
  } catch (err) { next(err) }
})

export default router
