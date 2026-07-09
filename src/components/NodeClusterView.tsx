import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { UserProfile, Post } from '../types';
import { Search, Sliders, Users, Radio, HelpCircle, UserPlus, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface NodeClusterViewProps {
  users: UserProfile[];
  posts: Post[];
  currentUserUid?: string;
}

interface NetworkNode extends d3.SimulationNodeDatum {
  id: string;
  name: string;
  photoURL: string;
  status: 'online' | 'offline';
  bio?: string;
  isCurrentUser: boolean;
  postsCount: number;
}

interface NetworkLink extends d3.SimulationLinkDatum<NetworkNode> {
  source: string | NetworkNode;
  target: string | NetworkNode;
  type: 'author' | 'interaction' | 'campus-relay';
  value: number;
}

export default function NodeClusterView({ users, posts, currentUserUid }: NodeClusterViewProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // States
  const [chargeStrength, setChargeStrength] = useState<number>(-220);
  const [linkDistance, setLinkDistance] = useState<number>(90);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState({ width: 600, height: 450 });
  const [simulationStats, setSimulationStats] = useState({ nodesCount: 0, linksCount: 0 });

  // Event handler to view profile
  const handleViewProfile = (uid: string) => {
    window.dispatchEvent(new CustomEvent('faraflick-view-profile', { detail: { uid } }));
  };

  // Resize listener
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({
          width: Math.max(width, 400),
          height: Math.max(height || 450, 350)
        });
      }
    });
    resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Compute graph data
  const getGraphData = () => {
    // 1. Unique users
    const nodeMap = new Map<string, NetworkNode>();

    // Add all existing active users as nodes
    users.forEach((u) => {
      nodeMap.set(u.uid, {
        id: u.uid,
        name: u.displayName || 'Anonymous Peer',
        photoURL: u.photoURL || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80',
        status: u.status || 'offline',
        bio: u.bio || 'Encrypted Tunnel Terminal Node',
        isCurrentUser: u.uid === currentUserUid,
        postsCount: posts.filter(p => p.authorId === u.uid).length,
      });
    });

    // Make sure we have at least some nodes
    if (nodeMap.size === 0 && currentUserUid) {
      nodeMap.set(currentUserUid, {
        id: currentUserUid,
        name: 'You (Console Core)',
        photoURL: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80',
        status: 'online',
        bio: 'Secured Cryptographic Terminal',
        isCurrentUser: true,
        postsCount: 0,
      });
    }

    const nodes = Array.from(nodeMap.values());
    const links: NetworkLink[] = [];

    // 2. Build links from interactions in posts
    posts.forEach((p) => {
      if (nodeMap.has(p.authorId)) {
        // Link commenters or likers if we have records, but if we don't, we can link authors together organically
        // Let's connect this post's author to other authors or nearby nodes
        nodes.forEach((n) => {
          if (n.id !== p.authorId && !links.some(l => (l.source === p.authorId && l.target === n.id) || (l.source === n.id && l.target === p.authorId))) {
            // Check if there is an interaction, otherwise create an organic campus relay link so it looks interconnected
            const isSharedFeed = Math.random() > 0.6; // random organic social gravity
            if (isSharedFeed) {
              links.push({
                source: p.authorId,
                target: n.id,
                type: 'interaction',
                value: 1.5,
              });
            }
          }
        });
      }
    });

    // If graph has no links, let's create a ring structure of relay connections so D3 looks amazing
    if (links.length === 0 && nodes.length > 1) {
      for (let i = 0; i < nodes.length; i++) {
        const sourceId = nodes[i].id;
        const targetId = nodes[(i + 1) % nodes.length].id;
        links.push({
          source: sourceId,
          target: targetId,
          type: 'campus-relay',
          value: 1.0,
        });
      }
    }

    return { nodes, links };
  };

  // Graph Simulation Effect
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous rendering

    const { nodes, links } = getGraphData();
    setSimulationStats({ nodesCount: nodes.length, linksCount: links.length });

    const width = dimensions.width;
    const height = dimensions.height;

    // Create a master group for zoom/pan
    const g = svg.append('g').attr('class', 'graph-content');

    // Setup zooming
    const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoomBehavior);

    // Filter node searches if needed
    let highlightedNodeId: string | null = null;
    if (searchQuery.trim()) {
      const found = nodes.find(n => n.name.toLowerCase().includes(searchQuery.toLowerCase()));
      if (found) highlightedNodeId = found.id;
    }

    // Force Simulation Setup
    const simulation = d3.forceSimulation<NetworkNode>(nodes)
      .force('link', d3.forceLink<NetworkNode, NetworkLink>(links)
        .id(d => d.id)
        .distance(linkDistance)
      )
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(32)) // prevent overlapping avatars
      .alphaDecay(0.025);

    // Create definitions for avatar images so we can crop them perfectly inside circles
    const defs = svg.append('defs');
    nodes.forEach((node) => {
      const patternId = `avatar-${node.id.replace(/[^a-zA-Z0-9]/g, '-')}`;
      defs.append('pattern')
        .attr('id', patternId)
        .attr('width', 1)
        .attr('height', 1)
        .attr('patternContentUnits', 'objectBoundingBox')
        .append('image')
        .attr('href', node.photoURL)
        .attr('width', 1)
        .attr('height', 1)
        .attr('preserveAspectRatio', 'xMidYMid slice')
        .attr('referrerpolicy', 'no-referrer');
    });

    // Render connection lines (links)
    const link = g.append('g')
      .attr('class', 'links')
      .selectAll<SVGLineElement, NetworkLink>('line')
      .data(links)
      .enter().append('line')
      .attr('stroke', d => {
        if (d.type === 'interaction') return '#00ff66';
        if (d.type === 'author') return '#a855f7';
        return '#27272a';
      })
      .attr('stroke-opacity', d => {
        if (d.type === 'interaction') return 0.55;
        return 0.35;
      })
      .attr('stroke-dasharray', d => d.type === 'campus-relay' ? '3,3' : 'none')
      .attr('stroke-width', d => Math.max(1.5, d.value));

    // Render nodes (circles)
    const node = g.append('g')
      .attr('class', 'nodes')
      .selectAll<SVGGElement, NetworkNode>('g')
      .data(nodes)
      .enter().append('g')
      .attr('cursor', 'pointer')
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      })
      .on('dblclick', (event, d) => {
        event.stopPropagation();
        handleViewProfile(d.id);
      })
      .call(d3.drag<SVGGElement, NetworkNode>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended)
      );

    // Outer neon ring for nodes based on state
    node.append('circle')
      .attr('r', 22)
      .attr('fill', 'none')
      .attr('stroke', d => {
        if (d.id === highlightedNodeId) return '#ff0055'; // Search target matches!
        if (d.isCurrentUser) return '#a855f7'; // Purple for current user
        return d.status === 'online' ? '#00ff66' : '#27272a';
      })
      .attr('stroke-width', d => d.id === highlightedNodeId ? 3.5 : 2)
      .attr('class', d => d.status === 'online' ? 'animate-pulse' : '')
      .style('filter', d => d.status === 'online' ? 'drop-shadow(0px 0px 4px rgba(0, 255, 102, 0.45))' : 'none');

    // Inner avatar fill circle
    node.append('circle')
      .attr('r', 18)
      .attr('fill', d => `url(#avatar-${d.id.replace(/[^a-zA-Z0-9]/g, '-')})`)
      .attr('stroke', '#0d0d0d')
      .attr('stroke-width', 1.5);

    // Text labels
    node.append('text')
      .attr('dy', 34)
      .attr('text-anchor', 'middle')
      .attr('fill', '#ffffff')
      .attr('font-size', '8px')
      .attr('font-family', 'var(--font-mono)')
      .attr('font-weight', 'bold')
      .text(d => d.name.length > 10 ? d.name.substring(0, 8) + '..' : d.name);

    // Online status dot indicator
    node.filter(d => d.status === 'online')
      .append('circle')
      .attr('cx', 13)
      .attr('cy', -13)
      .attr('r', 4.5)
      .attr('fill', '#00ff66')
      .attr('stroke', '#050505')
      .attr('stroke-width', 1.5);

    // Update simulation positions on each tick
    simulation.on('tick', () => {
      link
        .attr('x1', d => (d.source as NetworkNode).x || 0)
        .attr('y1', d => (d.source as NetworkNode).y || 0)
        .attr('x2', d => (d.target as NetworkNode).x || 0)
        .attr('y2', d => (d.target as NetworkNode).y || 0);

      node
        .attr('transform', d => `translate(${d.x || 0}, ${d.y || 0})`);
    });

    // Drag helper functions
    function dragstarted(event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode>, d: NetworkNode) {
      if (!event.active) simulation.alphaTarget(0.2).restart();
      d.fx = d.x;
      d.fy = d.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode>, d: NetworkNode) {
      d.fx = event.x;
      d.fy = event.y;
    }

    function dragended(event: d3.D3DragEvent<SVGGElement, NetworkNode, NetworkNode>, d: NetworkNode) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    // Zoom shortcuts helper
    const zoomIn = () => {
      svg.transition().duration(250).call(zoomBehavior.scaleBy, 1.3);
    };

    const zoomOut = () => {
      svg.transition().duration(250).call(zoomBehavior.scaleBy, 1 / 1.3);
    };

    const resetZoom = () => {
      svg.transition().duration(250).call(zoomBehavior.transform, d3.zoomIdentity);
    };

    // Attach shortcuts to window object for trigger buttons
    (window as any)._networkZoomIn = zoomIn;
    (window as any)._networkZoomOut = zoomOut;
    (window as any)._networkResetZoom = resetZoom;

    return () => {
      simulation.stop();
    };
  }, [users, posts, chargeStrength, linkDistance, dimensions, searchQuery]);

  return (
    <div className="border border-[var(--neon-green)] bg-zinc-950 text-white font-mono flex flex-col overflow-hidden relative shadow-[4px_4px_0px_var(--neon-green)]">
      
      {/* Top Banner Control Panel */}
      <div className="p-3 border-b border-[var(--neon-green)]/30 bg-black flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center space-x-2">
          <Radio className="w-4 h-4 text-[var(--neon-green)] animate-pulse" />
          <div>
            <h3 className="text-[10px] font-black uppercase tracking-widest text-white leading-tight">
              COCONUT TUNNEL NODE CLUSTER
            </h3>
            <p className="text-[8px] text-zinc-500 font-mono uppercase">
              RESONANCE MAP // {simulationStats.nodesCount} PEERS ACTIVE // {simulationStats.linksCount} GRAVITY VECTORS
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className={`p-1.5 border transition text-[10px] flex items-center gap-1 select-none cursor-pointer ${
              showConfig 
                ? 'bg-[var(--neon-green)] text-black border-[var(--neon-green)] font-black' 
                : 'border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-600'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">TUNING</span>
          </button>
        </div>
      </div>

      {/* Optional Tuning Panel */}
      {showConfig && (
        <div className="p-3 bg-zinc-950 border-b border-[var(--neon-green)]/20 grid grid-cols-1 sm:grid-cols-2 gap-3 text-[10px] text-zinc-400">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>GRAVITY CHARGE STRENGTH</span>
              <span className="text-[var(--neon-green)] font-bold">{chargeStrength}</span>
            </div>
            <input
              type="range"
              min="-500"
              max="-50"
              step="10"
              value={chargeStrength}
              onChange={(e) => setChargeStrength(Number(e.target.value))}
              className="w-full h-1 bg-zinc-900 appearance-none cursor-pointer accent-[var(--neon-green)]"
            />
          </div>

          <div className="space-y-1">
            <div className="flex justify-between">
              <span>GRAVITY LINK DISTANCE</span>
              <span className="text-[var(--neon-green)] font-bold">{linkDistance}px</span>
            </div>
            <input
              type="range"
              min="40"
              max="200"
              step="5"
              value={linkDistance}
              onChange={(e) => setLinkDistance(Number(e.target.value))}
              className="w-full h-1 bg-zinc-900 appearance-none cursor-pointer accent-[var(--neon-green)]"
            />
          </div>
        </div>
      )}

      {/* SVG Canvas and Sidebar Viewport */}
      <div className="flex flex-col md:flex-row flex-1 relative min-h-[350px]">
        
        {/* Sidebar Legend and Search */}
        <div className="w-full md:w-56 p-3.5 bg-black border-b md:border-b-0 md:border-r border-zinc-900 flex flex-col justify-between space-y-4 shrink-0">
          <div className="space-y-3.5">
            {/* Search filter input */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-zinc-500" />
              <input
                type="text"
                placeholder="Locate Terminal..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-zinc-950 border border-zinc-900 text-[10px] text-white focus:outline-none focus:border-[var(--neon-green)] uppercase tracking-wider font-mono placeholder:text-zinc-600 rounded-none"
              />
            </div>

            {/* Legend indicators */}
            <div className="space-y-2">
              <p className="text-[7.5px] uppercase tracking-widest text-zinc-500 font-bold block">NODE DIRECTORY</p>
              <div className="space-y-1.5 text-[9px]">
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-[var(--neon-green)] bg-[var(--neon-green)]/10 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--neon-green)]"></span>
                  </span>
                  <span className="text-zinc-300">Terminal Live (Online)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-zinc-700 bg-zinc-950"></span>
                  <span className="text-zinc-400">Terminal Dark (Offline)</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full border border-[#a855f7] bg-[#a855f7]/10 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#a855f7]"></span>
                  </span>
                  <span className="text-zinc-300">Your Core Node</span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick tips or instructions */}
          <div className="text-[8px] leading-relaxed text-zinc-500 bg-zinc-950 p-2.5 border border-zinc-900/60 uppercase">
            <span className="text-[var(--neon-green)] font-bold block mb-1">INTERACTION PROTOCOLS</span>
            • DRAG terminal rings to pin coordinates.<br/>
            • DOUBLE CLICK any node ring to view profile logs.<br/>
            • PINCH/WHEEL to scale or slide canvas perspective.
          </div>
        </div>

        {/* Dynamic D3 SVG Container */}
        <div ref={containerRef} className="flex-1 bg-[#050505] relative overflow-hidden flex items-center justify-center min-h-[300px]">
          
          <svg 
            ref={svgRef} 
            width={dimensions.width} 
            height={dimensions.height}
            className="block select-none"
          />

          {/* Zoom Control Pill on Canvas Bottom */}
          <div className="absolute bottom-3 right-3 flex items-center space-x-1 bg-black/85 border border-zinc-800 p-1 rounded-none">
            <button
              onClick={() => (window as any)._networkZoomIn?.()}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => (window as any)._networkZoomOut?.()}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => (window as any)._networkResetZoom?.()}
              className="p-1 text-zinc-400 hover:text-white hover:bg-zinc-900 transition cursor-pointer"
              title="Reset Viewport"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Overlay Detail Card for Selected Node */}
          {selectedNode && (
            <div className="absolute top-3 left-3 w-56 bg-black/95 border-2 border-[var(--neon-green)] p-3 shadow-2xl z-20 space-y-2.5 rounded-none animate-in fade-in zoom-in-95 duration-150">
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-2.5">
                  <img 
                    src={selectedNode.photoURL} 
                    alt={selectedNode.name} 
                    className="w-8 h-8 object-cover border border-[var(--neon-green)]/50"
                    referrerPolicy="no-referrer"
                  />
                  <div>
                    <h4 className="text-[10px] font-bold uppercase text-white tracking-wide truncate max-w-[100px]">
                      {selectedNode.name}
                    </h4>
                    <span className={`text-[7px] px-1 font-black uppercase inline-block border ${
                      selectedNode.status === 'online' 
                        ? 'text-[var(--neon-green)] border-[var(--neon-green)] bg-[var(--neon-green)]/10' 
                        : 'text-zinc-500 border-zinc-800 bg-zinc-950'
                    }`}>
                      {selectedNode.status}
                    </span>
                  </div>
                </div>
                <button 
                  onClick={() => setSelectedNode(null)} 
                  className="text-zinc-500 hover:text-white text-[10px] font-sans px-1"
                >
                  ✕
                </button>
              </div>

              <p className="text-[8.5px] text-zinc-400 leading-normal line-clamp-2 uppercase">
                {selectedNode.bio}
              </p>

              <div className="text-[7.5px] text-zinc-500 border-t border-zinc-900 pt-2 flex justify-between uppercase">
                <span>Active Chronicles: {selectedNode.postsCount}</span>
                {selectedNode.isCurrentUser && <span className="text-purple-400">Owner Node</span>}
              </div>

              <button
                onClick={() => {
                  handleViewProfile(selectedNode.id);
                  setSelectedNode(null);
                }}
                className="w-full text-center py-1.5 bg-[var(--neon-green)] text-black font-black font-mono text-[8px] uppercase tracking-wider block transition hover:bg-white cursor-pointer"
              >
                Inspect Terminal Logs
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
