import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../db/client'
import { validateBody } from '../middleware/validate'
import { forbidden, notFound } from '../middleware/errors'

const router = Router()

const createSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#6366F1'),
})

const updateSchema = createSchema.partial()

// GET /api/projects
router.get('/', async (req, res, next) => {
  try {
    const projects = await prisma.project.findMany({
      where: { user_id: req.userId, archived_at: null },
      orderBy: { updated_at: 'desc' },
    })
    res.json({ data: projects, pagination: { total: projects.length, page: 1, per_page: 100, total_pages: 1 } })
  } catch (err) { next(err) }
})

// POST /api/projects
router.post('/', validateBody(createSchema), async (req, res, next) => {
  try {
    const project = await prisma.project.create({
      data: { ...req.body, user_id: req.userId },
    })
    res.status(201).json({ data: project })
  } catch (err) { next(err) }
})

// GET /api/projects/:id
router.get('/:id', async (req, res, next) => {
  try {
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, user_id: req.userId },
    })
    if (!project) throw forbidden()
    res.json({ data: project })
  } catch (err) { next(err) }
})

// PATCH /api/projects/:id
router.patch('/:id', validateBody(updateSchema), async (req, res, next) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, user_id: req.userId },
    })
    if (!existing) throw forbidden()
    const updated = await prisma.project.update({ where: { id: req.params.id }, data: req.body })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

// DELETE /api/projects/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, user_id: req.userId },
    })
    if (!existing) throw forbidden()
    await prisma.project.delete({ where: { id: req.params.id } })
    res.status(204).send()
  } catch (err) { next(err) }
})

// POST /api/projects/:id/archive
router.post('/:id/archive', async (req, res, next) => {
  try {
    const existing = await prisma.project.findFirst({
      where: { id: req.params.id, user_id: req.userId },
    })
    if (!existing) throw forbidden()
    const updated = await prisma.project.update({
      where: { id: req.params.id },
      data: { archived_at: new Date() },
    })
    res.json({ data: updated })
  } catch (err) { next(err) }
})

export default router
