import { Router } from 'express'
import { z } from 'zod'
import { randomUUID } from 'crypto'
import { prisma } from '../db/client'
import { validateBody } from '../middleware/validate'
import { forbidden } from '../middleware/errors'
import { detectConflicts } from '../services/conflict.service'
import { calculateCriticalPath } from '../services/critical-path.service'

const router = Router()

const createSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  description: z.string().max(500).trim().optional(),
  project_id: z.string().optional(),
})

const updateSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(500).trim().optional().nullable(),
  project_id: z.string().optional().nullable(),
  viewport_state: z.record(z.unknown()).optional(),
})

// GET /api/maps
router.get('/', async (req, res, next) => {
  try {
    const maps = await prisma.map.findMany({
      where: { user_id: req.userId, archived_at: null },
      orderBy: { updated_at: 'desc' },
    })
    res.json({ data: maps, pagination: { total: maps.length, page: 1, per_page: 100, total_pages: 1 } })
  } catch (err) { next(err) }
})

// POST /api/maps
router.post('/', validateBody(createSchema), async (req, res, next) => {
  try {
    // Verify project ownership if provided
    if (req.body.project_id) {
      const project = await prisma.project.findFirst({
        where: { id: req.body.project_id, user_id: req.userId },
      })
      if (!project) throw forbidden()
    }
    const map = await prisma.map.create({
      data: { ...req.body, user_id: req.userId },
    })
    res.status(201).json({ data: map })
  } catch (err) { next(err) }
})

// GET /api/maps/:id — returns full map with nodes, edges, conflicts, critical path
router.get('/:id', async (req, res, next) => {
  try {
    const map = await prisma.map.findFirst({
      where: { id: req.params.id, user_id: req.userId },
      include: {
        nodes: { orderBy: { created_at: 'asc' } },
        edges: true,
      },
    })
    if (!map) throw forbidden()

    const [conflicts, critical_path] = await Promise.all([
      detectConflicts(map.id),
      calculateCriticalPath(map.id),
    ])

    const { nodes, edges, ...mapData } = map
    res.json({ data: { map: mapData, nodes, edges, conflicts, critical_path } })
  } catch (err) { next(err) }
})

// PATCH /api/maps/:id
router.patch('/:id', validateBody(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.map.findFirst({
      where: { id: req.params.id, user_id: req.userId },
    })
    if (!existing) throw forbidden()
    const updated = await prisma.map.update({
      where: { id: req.params.id },
      data: req.body,
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// DELETE /api/maps/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.map.findFirst({
      where: { id: req.params.id, user_id: req.userId },
    })
    if (!existing) throw forbidden()
    await prisma.map.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})

// POST /api/maps/:id/share
router.post('/:id/share', async (req, res, next) => {
  try {
    const map = await prisma.map.findFirst({
      where: { id: req.params.id, user_id: req.userId },
    })
    if (!map) throw forbidden()

    const share_token = randomUUID()
    const updated = await prisma.map.update({
      where: { id: req.params.id },
      data: { share_token, share_config: req.body?.config ?? null },
    })
    const share_url = `${process.env.WEB_URL}/s/${share_token}`
    res.json({ data: { share_url, share_token: updated.share_token } })
  } catch (err) { next(err) }
})

// DELETE /api/maps/:id/share
router.delete('/:id/share', async (req, res, next) => {
  try {
    const map = await prisma.map.findFirst({
      where: { id: req.params.id, user_id: req.userId },
    })
    if (!map) throw forbidden()
    await prisma.map.update({ where: { id: req.params.id }, data: { share_token: null } })
    res.status(204).send()
  } catch (err) { next(err) }
})

// POST /api/maps/:id/archive
router.post('/:id/archive', async (req, res, next) => {
  try {
    const map = await prisma.map.findFirst({
      where: { id: req.params.id, user_id: req.userId },
    })
    if (!map) throw forbidden()
    const updated = await prisma.map.update({
      where: { id: req.params.id },
      data: { archived_at: new Date() },
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

export default router
