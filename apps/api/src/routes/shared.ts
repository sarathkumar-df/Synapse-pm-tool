import { Router } from 'express'
import { prisma } from '../db/client'
import { notFound } from '../middleware/errors'

const router = Router()

// GET /api/shared/:token — public, no auth required
router.get('/:token', async (req, res, next) => {
  try {
    const map = await prisma.map.findFirst({
      where: { share_token: req.params.token },
      include: {
        nodes: { orderBy: { created_at: 'asc' } },
        edges: true,
      },
    })
    if (!map) throw notFound('Map')

    const shareConfig = map.share_config as Record<string, unknown> | null
    const hideCategories: string[] = (shareConfig?.hide_categories as string[]) ?? []

    // Filter nodes by share config visibility settings
    let nodes = map.nodes
    if (hideCategories.length) {
      nodes = nodes.filter(n => !hideCategories.includes(n.category))
    }

    // Filter edges to only include those between visible nodes
    const visibleNodeIds = new Set(nodes.map(n => n.id))
    const edges = map.edges.filter(
      e => visibleNodeIds.has(e.source_node_id) && visibleNodeIds.has(e.target_node_id)
    )

    // Strip effort if configured
    if (shareConfig?.hide_effort) {
      nodes = nodes.map(n => ({ ...n, effort_value: null, effort_unit: null }))
    }

    res.json({
      data: {
        map: { id: map.id, name: map.name, share_config: map.share_config },
        nodes,
        edges,
      },
    })
  } catch (err) { next(err) }
})

export default router
