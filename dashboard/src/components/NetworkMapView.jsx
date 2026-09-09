// NetworkMapView — D3 force-directed network with traveling data packets
// D3 fully owns the SVG DOM so the simulation stays smooth across live data updates.
import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import { Globe, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import { getTrustScore } from '../utils.js'

const STATUS_COLOR = {
  HEALTHY:    '#22c55e',
  SUSPICIOUS: '#f59e0b',
  QUARANTINED:'#ef4444',
  OFFLINE:    '#64748b',
}

const resolveColor = n => STATUS_COLOR[n.status] ?? '#64748b'

function typeAbbr(type) {
  if (!type) return 'NODE'
  const t = type.toLowerCase()
  if (t.includes('cam')) return 'CAM'
  if (t.includes('temp')) return 'TMP'
  if (t.includes('hum')) return 'HUM'
  if (t.includes('sensor')) return 'SEN'
  if (t.includes('gateway')) return 'GW'
  return type.slice(0, 3).toUpperCase()
}

export default function NetworkMapView({ nodes, onSelectNode, selectedNodeId }) {
  const svgRef = useRef(null)
  const containerRef = useRef(null)
  const [zoom, setZoom] = useState(1)
  const simRef = useRef(null)
  const selectRef = useRef(onSelectNode)

  useEffect(() => { selectRef.current = onSelectNode })

  const list = Object.values(nodes)
  // Rebuild the simulation only when the node set or statuses actually change
  // (a fresh-array list would otherwise restart the force sim on every live update).
  const simKey = list.map(n => `${n.node_id}:${n.status}`).join('|')

  const graph = useMemo(() => {
    const data = list.map(n => ({ id: n.node_id, node: n, status: n.status }))
    const gateway = list.find(n => n.node_id?.toLowerCase().includes('gw') || n.node_id?.toLowerCase().includes('gateway'))
    const hub = gateway ?? list[0]

    const nodesD3 = []
    const nodeIndex = new Map()
    if (list.length > 0) {
      nodesD3.push({ id: '__internet__', node: null, status: 'HEALTHY', root: true })
      nodeIndex.set('__internet__', 0)
    }
    data.forEach(d => {
      nodeIndex.set(d.id, nodesD3.length)
      nodesD3.push(d)
    })

    const linksD3 = []
    if (nodeIndex.has('__internet__') && hub) {
      linksD3.push({ source: 0, target: nodeIndex.get(hub.node_id), kind: 'internet' })
    }
    data.forEach(d => {
      if (d.node.node_id !== hub.node_id) {
        linksD3.push({
          source: nodeIndex.get(hub.node_id),
          target: nodeIndex.get(d.node.node_id),
          kind: d.node.status === 'QUARANTINED' ? 'quarantine' : 'data',
        })
      }
    })

    return { nodesD3, linksD3 }
  }, [simKey])

  useEffect(() => {
    const svg = svgRef.current
    const container = containerRef.current
    if (!svg || !container) return

    const W = container.clientWidth || 520
    const H = container.clientHeight || 260

    const { nodesD3, linksD3 } = graph
    // Clone so the force simulation's mutations never touch the memoized graph
    const simNodes = nodesD3.map(n => ({ ...n }))
    const simLinks = linksD3.map(l => ({ ...l }))

    // ── Clear previous rendering ───────────────────────────────────────────
    d3.select(svg).selectAll('*').remove()
    if (simRef.current) simRef.current.stop()

    const svgRoot = d3.select(svg)
      .attr('viewBox', `0 0 ${W} ${H}`)
      .attr('width', W)
      .attr('height', H)

    // Internet cloud glyph
    const cloud = svgRoot.append('g')
      .attr('class', 'map-cloud')
      .style('pointer-events', 'none')
    cloud.append('ellipse')
      .attr('rx', 30).attr('ry', 20)
      .attr('fill', 'var(--surface-raised)')
      .attr('stroke', 'var(--border)')
      .attr('stroke-width', 1)
    cloud.append('text')
      .attr('x', 0).attr('y', 4)
      .attr('text-anchor', 'middle')
      .attr('fill', 'var(--text-muted)').attr('font-size', 9).attr('font-family', 'var(--font-mono)')
      .text('Internet')

    // Links layer
    const linkSel = svgRoot.append('g').attr('class', 'map-links')
      .selectAll('line')
      .data(simLinks, d => `${d.source}-${d.target}`)
      .join('line')
      .attr('class', 'map-link')
      .attr('stroke-width', d => d.kind === 'quarantine' ? 2 : 1.5)
      .attr('stroke-dasharray', d => d.kind === 'quarantine' ? '4 3' : undefined)
      .attr('opacity', d => {
        const t = simNodes[d.target]
        return t?.node?.status === 'OFFLINE' ? 0.3 : 0.7
      })

  // Nodes layer
    const nodeSel = svgRoot.append('g').attr('class', 'map-nodes')
      .selectAll('g')
      .data(simNodes, d => d.id)
      .join('g')
      .attr('class', d => `map-node-group${d.node?.status === 'QUARANTINED' ? ' quarantined' : ''}`)
      .style('cursor', d => (d.root || !d.node) ? 'default' : 'pointer')
      .on('click', (_, d) => { if (d.node && !d.root) selectRef.current?.(d.node) })
      .on('mousemove', function (event, d) {
        // lightweight title tooltip
        d3.select(this).select('.map-node-title').text(
          d.root ? 'Internet Gateway' : `${d.node.node_id} · ${d.node.status} · Trust ${Math.round(getTrustScore(d.node.anomaly_score ?? 0) * 100)}%`
        ).attr('visibility', 'visible')
      })
      .on('mouseleave', function () {
        d3.select(this).select('.map-node-title').attr('visibility', 'hidden')
      })

    // Root / gateway node
    nodeSel.filter(d => d.root).each(function () {
      const g = d3.select(this)
      g.append('rect')
        .attr('x', -40).attr('y', -28).attr('width', 80).attr('height', 56)
        .attr('rx', 8).attr('fill', 'var(--surface-raised)').attr('stroke', 'var(--border)')
        .attr('class', 'map-node-box')
      g.append('text').attr('x', 0).attr('y', 0).attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-primary)').attr('font-size', 9).attr('font-family', 'var(--font-mono)').attr('font-weight', 700)
        .attr('class', 'map-node-title').attr('visibility', 'hidden')
      g.append('text').attr('x', 0).attr('y', -6).attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-muted)').attr('font-size', 8).attr('font-family', 'var(--font-mono)')
        .text('INTERNET')
      g.append('text').attr('x', 0).attr('y', 8).attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-muted)').attr('font-size', 7).attr('font-family', 'var(--font-mono)')
        .text('MQTT BRIDGE')
    })

    // Regular nodes
    nodeSel.filter(d => !d.root).each(function (d) {
      const g = d3.select(this)
      const col = resolveColor(d.node)
      const trust = Math.round(getTrustScore(d.node.anomaly_score ?? 0) * 100)

      g.append('rect')
        .attr('x', -36).attr('y', -20).attr('width', 72).attr('height', 42)
        .attr('rx', 7).attr('fill', 'var(--surface-raised)')
        .attr('stroke', d.node.node_id === selectedNodeId ? 'var(--accent)' : col)
        .attr('stroke-width', d.node.node_id === selectedNodeId ? 2 : 1)
        .attr('opacity', d.node.status === 'OFFLINE' ? 0.5 : 1)
        .attr('class', 'map-node-box')

      g.append('circle')
        .attr('cx', 26).attr('cy', -12).attr('r', 3.5)
        .attr('fill', col)
        .attr('opacity', d.node.status === 'OFFLINE' ? 0.4 : 1)

      if (d.node.status === 'QUARANTINED') {
        g.append('circle').attr('cx', 26).attr('cy', -12).attr('r', 3.5)
          .attr('fill', 'none').attr('stroke', col).attr('stroke-width', 1.5)
          .call(pulse => {
            pulse.append('animate').attr('attributeName', 'r')
              .attr('values', '3.5;9;3.5').attr('dur', '2s').attr('repeatCount', 'indefinite')
            pulse.append('animate').attr('attributeName', 'opacity')
              .attr('values', '0.6;0;0.6').attr('dur', '2s').attr('repeatCount', 'indefinite')
          })
      }

      g.append('text').attr('class', 'map-node-title').attr('x', 0).attr('y', -32)
        .attr('text-anchor', 'middle').attr('visibility', 'hidden')
        .attr('fill', 'var(--text-secondary)').attr('font-size', 8).attr('font-family', 'var(--font-mono)')

      g.append('text').attr('x', 0).attr('y', -2).attr('text-anchor', 'middle')
        .attr('fill', 'var(--text-primary)').attr('font-size', 8).attr('font-family', 'var(--font-mono)').attr('font-weight', 700)
        .text(d.node.node_id.length > 10 ? d.node.node_id.slice(-8) : d.node.node_id)

      if (d.node.device_type) {
        g.append('text').attr('x', 0).attr('y', 7).attr('text-anchor', 'middle')
          .attr('fill', 'var(--text-muted)').attr('font-size', 7).attr('font-family', 'var(--font-mono)')
          .text(typeAbbr(d.node.device_type))
      }

      g.append('text').attr('x', 0).attr('y', 16).attr('text-anchor', 'middle')
        .attr('fill', col).attr('font-size', 7).attr('font-family', 'var(--font-mono)')
        .text(d.node.status === 'OFFLINE' ? 'Offline' : `Trust ${trust}%`)
    })

    // ── Simulation ─────────────────────────────────────────────────────────
    const cx = W / 2
    const cy = H / 2

    const simulation = d3.forceSimulation(simNodes)
      .force('link', d3.forceLink(simLinks).distance(d => {
        const t = typeof d.target === 'number' ? simNodes[d.target] : d.target
        return t?.node?.status === 'QUARANTINED' ? 170 : 95
      }).strength(0.4))
      .force('charge', d3.forceManyBody().strength(-180))
      .force('collide', d3.forceCollide().radius(42))
      .force('x', d3.forceX(cx).strength(0.08))
      .force('y', d3.forceY(cy).strength(0.08))
      .force('center', d3.forceCenter(cx, cy))

    // Pin the internet root near the top
    const rootNode = simNodes[0]
    if (rootNode) {
      rootNode.fx = cx
      rootNode.fy = cy - H * 0.32
    }

    // Links color
    linkSel.attr('stroke', d => {
      if (d.kind === 'quarantine') return 'var(--status-danger)'
      const t = typeof d.target === 'number' ? simNodes[d.target] : d.target
      return t && !t.root ? resolveColor(t.node) : 'var(--accent)'
    })

    simRef.current = simulation

    // ── Traveling packets ──────────────────────────────────────────────────
    // A few glowing dots that move source→target along data links.
    const prefersReduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const packetLayer = svgRoot.append('g').attr('class', 'map-packets').style('pointer-events', 'none')
    const activeLinks = simLinks.filter(l => l.kind === 'data')
    const packetTimer = []
    const numPackets = prefersReduced ? 0 : Math.min(4, activeLinks.length)

    for (let i = 0; i < numPackets; i++) {
      const dot = packetLayer.append('circle')
        .attr('r', 2.5)
        .attr('fill', 'var(--accent)')
        .attr('opacity', 0.8)
      let progress = i / numPackets
      const link = activeLinks[i % activeLinks.length]
      packetTimer.push(d3.timer(elapsed => {
        progress += elapsed * 0.00006
        if (progress > 1) progress -= 1
        const src = simNodes[link.source] ?? link.source
        const tgt = simNodes[link.target] ?? link.target
        const x = src.x + (tgt.x - src.x) * progress
        const y = src.y + (tgt.y - src.y) * progress
        dot.attr('cx', x).attr('cy', y)
      }))
    }

    // ── Tick → position nodes + links ─────────────────────────────────────
    simulation.on('tick', () => {
      cloud.attr('transform', `translate(${(simNodes[0]?.x ?? cx) - 30}, ${(simNodes[0]?.y ?? cy) - 20})`)
      linkSel
        .attr('x1', d => d.source.x)
        .attr('y1', d => d.source.y)
        .attr('x2', d => d.target.x)
        .attr('y2', d => d.target.y)
      nodeSel.attr('transform', d => `translate(${d.x}, ${d.y})`)
    })

    // ── Resize handling ─────────────────────────────────────────────────────
    let ro = null
    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (!w || !h) return
      svg.attr('viewBox', `0 0 ${w} ${h}`).attr('width', w).attr('height', h)
      simulation.force('x', d3.forceX(w / 2).strength(0.08))
      simulation.force('y', d3.forceY(h / 2).strength(0.08))
      if (rootNode) { rootNode.fx = w / 2; rootNode.fy = h / 2 - h * 0.32 }
      simulation.alpha(0.3).restart()
    }
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(onResize)
      ro.observe(container)
    } else {
      window.addEventListener('resize', onResize)
    }

    simulation.alpha(0.8).restart()

    return () => {
      simulation.stop()
      packetTimer.forEach(t => t.stop())
      if (ro) ro.disconnect()
      else window.removeEventListener('resize', onResize)
    }
  }, [graph, selectedNodeId])

  if (list.length === 0) {
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', color:'var(--text-muted)' }}>
        <div style={{ textAlign:'center' }}>
          <Globe size={36} style={{ opacity:0.2, margin:'0 auto 8px' }} />
          <div style={{ fontSize:'var(--text-sm)' }}>No nodes connected</div>
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ position:'relative', height:'100%', width:'100%', overflow:'hidden' }}>
      <div style={{ position:'absolute', top:8, right:8, display:'flex', gap:4, zIndex:10 }}>
        {[
          { icon:ZoomIn,   action:() => setZoom(z => Math.min(z + 0.2, 2)) },
          { icon:ZoomOut,  action:() => setZoom(z => Math.max(z - 0.2, 0.4)) },
          { icon:Maximize2,action:() => setZoom(1) },
        ].map(({ icon:Icon, action }) => (
          <button
            key={(Icon.displayName ?? Icon.name) || 'zoom'}
            onClick={action}
            style={{
              width:26, height:26, borderRadius:5, border:'1px solid var(--border)',
              background:'var(--surface-raised)', cursor:'pointer',
              display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text-muted)'
            }}
          >
            <Icon size={11} />
          </button>
        ))}
      </div>

      <div style={{ width:'100%', height:'100%', overflow:'auto', display:'flex', alignItems:'center', justifyContent:'center' }}>
        <svg
          ref={svgRef}
          style={{ transform:`scale(${zoom})`, transformOrigin:'center', overflow:'visible', flexShrink:0 }}
        />
      </div>
    </div>
  )
}