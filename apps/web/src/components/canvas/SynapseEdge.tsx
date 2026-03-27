import { memo } from 'react'
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from '@xyflow/react'
import type { EdgeType } from '@synapse/shared'
import type { SynapseEdgeData } from '../../types/canvas.types'
import { EDGE_TYPE_STYLES } from '../../constants/node-categories'

type SynapseEdgeProps = EdgeProps & { data?: SynapseEdgeData }

function SynapseEdge({
  id,
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  data,
  markerEnd,
  selected,
}: SynapseEdgeProps) {
  const edgeType = (data?.edge_type as EdgeType | undefined) ?? 'related'
  const style = EDGE_TYPE_STYLES[edgeType] ?? EDGE_TYPE_STYLES.related

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition,
    targetX, targetY, targetPosition,
  })

  const edgeStyle: React.CSSProperties = {
    stroke: style.color,
    strokeWidth: style.strokeWidth,
    strokeDasharray: style.strokeDasharray,
    opacity: selected ? 1 : 0.75,
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={edgeStyle}
        markerEnd={style.markerEnd ? markerEnd : undefined}
      />

      {data?.label && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
            className="nodrag nopan bg-white text-[11px] text-gray-500 px-1.5 py-0.5 rounded-full border border-gray-200 shadow-sm whitespace-nowrap"
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}

export default memo(SynapseEdge)
