// ─────────────────────────────────────────────
//  Travel Molecule – D3 Force-Directed Graph
// ─────────────────────────────────────────────

(function () {
  "use strict";

  var WIDTH = 960;
  var HEIGHT = 620;
  var MIN_RADIUS = 16;
  var MAX_RADIUS = 80;

  var svg, linkGroup, nodeGroup, simulation;
  var tooltip;
  var currentData = null;
  var selectedNodes = [];
  var selectionInfoEl = null;

  // ── Scales ──
  var radiusScale = d3.scaleSqrt().domain([0.005, 0.85]).range([MIN_RADIUS, MAX_RADIUS]);
  var linkWidthScale = d3.scaleLinear().domain([0, 1]).range([1.5, 9]);

  // ── Helpers ──
  function cloneData(data) {
    return {
      title: data.title,
      subtitle: data.subtitle,
      nodes: data.nodes.map(function (n) { return Object.assign({}, n); }),
      links: data.links.map(function (l) {
        return Object.assign({}, l, { source: l.source, target: l.target });
      })
    };
  }

  function connectedNodes(nodeId, links) {
    var result = {};
    links.forEach(function (l) {
      var sid = typeof l.source === "object" ? l.source.id : l.source;
      var tid = typeof l.target === "object" ? l.target.id : l.target;
      if (sid === nodeId) result[tid] = true;
      if (tid === nodeId) result[sid] = true;
    });
    return result;
  }

  function connectionList(nodeId, links, nodesById) {
    var items = [];
    links.forEach(function (l) {
      var sid = typeof l.source === "object" ? l.source.id : l.source;
      var tid = typeof l.target === "object" ? l.target.id : l.target;
      var other = null;
      if (sid === nodeId) other = tid;
      if (tid === nodeId) other = sid;
      if (other && nodesById[other]) {
        items.push({ label: nodesById[other].label, weight: l.weight });
      }
    });
    items.sort(function (a, b) { return b.weight - a.weight; });
    return items;
  }

  // ── Gradient defs ──
  function addGradients(defs, nodes) {
    defs.selectAll("radialGradient").remove();
    nodes.forEach(function (n) {
      var grad = defs.append("radialGradient")
        .attr("id", "grad-" + n.id)
        .attr("cx", "35%").attr("cy", "30%").attr("r", "65%");
      grad.append("stop").attr("offset", "0%")
        .attr("stop-color", "#fff").attr("stop-opacity", 0.6);
      grad.append("stop").attr("offset", "40%")
        .attr("stop-color", n.color).attr("stop-opacity", 0.9);
      grad.append("stop").attr("offset", "100%")
        .attr("stop-color", d3.color(n.color).darker(1.2)).attr("stop-opacity", 1);
    });
  }

  function addGlowFilter(defs) {
    if (defs.select("#glow").size()) return;
    var filter = defs.append("filter").attr("id", "glow")
      .attr("x", "-50%").attr("y", "-50%")
      .attr("width", "200%").attr("height", "200%");
    filter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "blur");
    var merge = filter.append("feMerge");
    merge.append("feMergeNode").attr("in", "blur");
    merge.append("feMergeNode").attr("in", "SourceGraphic");
  }

  // ── Tooltip ──
  function createTooltip() {
    tooltip = d3.select("body").append("div").attr("class", "tooltip");
  }

  function showTooltip(d, links, nodesById) {
    var conns = connectionList(d.id, links, nodesById);
    var html = '<div class="tt-label">' + d.label + '</div>';
    html += '<div class="tt-share" style="color:' + d.color + '">' +
      (d.share * 100).toFixed(1) + '% share</div>';
    if (conns.length) {
      html += '<div class="tt-connections">';
      conns.forEach(function (c) {
        html += '<div class="tt-conn-item"><span>' + c.label +
          '</span><span>' + (c.weight * 100).toFixed(0) + '%</span></div>';
      });
      html += '</div>';
    }
    tooltip.html(html).classed("visible", true);
  }

  function moveTooltip() {
    var e = d3.event;
    tooltip
      .style("left", (e.pageX + 16) + "px")
      .style("top", (e.pageY - 12) + "px");
  }

  function hideTooltip() {
    tooltip.classed("visible", false);
  }

  // ── Build / update ──
  function buildViz(container, data) {
    currentData = cloneData(data);

    var nodesById = {};
    currentData.nodes.forEach(function (n) { nodesById[n.id] = n; });

    // Update title
    d3.select("#viz-title").text(currentData.title);
    d3.select("#viz-subtitle").text(currentData.subtitle);

    // Gradients
    var defs = svg.select("defs");
    addGradients(defs, currentData.nodes);

    // ── Force simulation ──
    if (simulation) simulation.stop();

    simulation = d3.forceSimulation(currentData.nodes)
      .force("link", d3.forceLink(currentData.links)
        .id(function (d) { return d.id; })
        .distance(function (d) { return 140 - d.weight * 90; })
        .strength(function (d) { return 0.25 + d.weight * 0.4; })
      )
      .force("charge", d3.forceManyBody()
        .strength(function (d) { return -radiusScale(d.share) * 5 - 100; })
      )
      .force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2))
      .force("collision", d3.forceCollide()
        .radius(function (d) { return radiusScale(d.share) + 8; })
      )
      .on("tick", ticked);

    // ── Links ──
    linkGroup.selectAll(".link").remove();
    var links = linkGroup.selectAll(".link")
      .data(currentData.links)
      .enter().append("line")
      .attr("class", "link")
      .attr("stroke", function (d) {
        return d.modeColor || "rgba(255,255,255,0.25)";
      })
      .attr("stroke-opacity", function (d) { return d.modeColor ? 0.55 : 0.3; })
      .attr("stroke-width", function (d) { return linkWidthScale(d.weight); });

    // ── Nodes ──
    nodeGroup.selectAll(".node").remove();
    var nodes = nodeGroup.selectAll(".node")
      .data(currentData.nodes, function (d) { return d.id; })
      .enter().append("g")
      .attr("class", "node")
      .attr("aria-label", function(d) { return d.label + ": " + (d.share * 100).toFixed(1) + "% share"; })
      .attr("tabindex", "0")
      .attr("role", "button")
      .call(d3.drag()
        .on("start", dragStarted)
        .on("drag", dragged)
        .on("end", dragEnded)
      );

    // Outer glow circle
    nodes.append("circle")
      .attr("r", function (d) { return radiusScale(d.share) + 3; })
      .attr("fill", "none")
      .attr("stroke", function (d) { return d.color; })
      .attr("stroke-opacity", 0.25)
      .attr("stroke-width", 2)
      .style("filter", "url(#glow)");

    // Main sphere
    nodes.append("circle")
      .attr("class", "atom")
      .attr("r", function (d) { return radiusScale(d.share); })
      .attr("fill", function (d) { return "url(#grad-" + d.id + ")"; })
      .attr("stroke", function (d) { return d3.color(d.color).darker(0.5); })
      .attr("stroke-width", 1.5)
      .attr("stroke-opacity", 0.5);

    // Labels – internal for large nodes, external for small
    nodes.each(function (d) {
      var g = d3.select(this);
      var r = radiusScale(d.share);
      if (r >= 22) {
        g.append("text")
          .attr("class", "node-label")
          .attr("dy", "0.35em")
          .style("font-size", Math.max(10, r * 0.32) + "px")
          .text(d.label);
      } else {
        g.append("line")
          .attr("class", "leader-line")
          .attr("x1", 0).attr("y1", -r - 2)
          .attr("x2", 0).attr("y2", -r - 18);
        g.append("text")
          .attr("class", "node-label-external")
          .attr("dy", -r - 22)
          .text(d.label);
      }
    });

    // Fade in
    linkGroup.style("opacity", 0).transition().duration(600).style("opacity", 1);
    nodeGroup.style("opacity", 0).transition().duration(600).style("opacity", 1);

    // ── Interactions ──
    nodes
      .on("mouseenter", function (d) {
        // Only apply hover highlighting when no nodes are selected
        if (selectedNodes.length === 0) {
          var connected = connectedNodes(d.id, currentData.links);
          connected[d.id] = true;

          nodeGroup.selectAll(".node")
            .transition().duration(200)
            .style("opacity", function (n) { return connected[n.id] ? 1 : 0.12; });

          linkGroup.selectAll(".link")
            .transition().duration(200)
            .style("opacity", function (l) {
              var sid = typeof l.source === "object" ? l.source.id : l.source;
              var tid = typeof l.target === "object" ? l.target.id : l.target;
              return (sid === d.id || tid === d.id) ? 1 : 0.06;
            });
        }

        showTooltip(d, currentData.links, nodesById);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        if (selectedNodes.length === 0) {
          nodeGroup.selectAll(".node").transition().duration(300).style("opacity", 1);
          linkGroup.selectAll(".link").transition().duration(300).style("opacity", function (l) {
            return l.modeColor ? 0.55 : 0.3;
          });
        }
        hideTooltip();
      })
      .on("click", function (d) {
        d3.event.stopPropagation();
        var idx = selectedNodes.indexOf(d.id);
        if (idx >= 0) {
          selectedNodes.splice(idx, 1);
        } else {
          if (selectedNodes.length >= 2) selectedNodes.shift();
          selectedNodes.push(d.id);
        }
        updateSelection();
      });

    // Click SVG background to deselect all
    svg.on("click", function () {
      if (selectedNodes.length > 0) {
        selectedNodes = [];
        updateSelection();
      }
    });

    // ── Tick ──
    function ticked() {
      links
        .attr("x1", function (d) { return d.source.x; })
        .attr("y1", function (d) { return d.source.y; })
        .attr("x2", function (d) { return d.target.x; })
        .attr("y2", function (d) { return d.target.y; });

      nodes.attr("transform", function (d) {
        d.x = Math.max(MAX_RADIUS, Math.min(WIDTH - MAX_RADIUS, d.x));
        d.y = Math.max(MAX_RADIUS, Math.min(HEIGHT - MAX_RADIUS, d.y));
        return "translate(" + d.x + "," + d.y + ")";
      });
    }
  }

  // ── Selection & path highlighting ──
  function updateSelection() {
    var nodesById = {};
    if (currentData) {
      currentData.nodes.forEach(function (n) { nodesById[n.id] = n; });
    }

    // Update selection rings
    nodeGroup.selectAll(".node").each(function (d) {
      var isSelected = selectedNodes.indexOf(d.id) >= 0;
      d3.select(this).select(".selection-ring").remove();
      if (isSelected) {
        d3.select(this).insert("circle", ":first-child")
          .attr("class", "selection-ring")
          .attr("r", radiusScale(d.share) + 6)
          .attr("fill", "none")
          .attr("stroke", "#fff")
          .attr("stroke-width", 2.5)
          .attr("stroke-dasharray", "4,3");
      }
    });

    if (selectedNodes.length === 2) {
      highlightPath(selectedNodes[0], selectedNodes[1]);
    } else if (selectedNodes.length === 1) {
      highlightConnected(selectedNodes[0]);
    } else {
      clearHighlight();
    }

    updateSelectionInfo(nodesById);
  }

  function findShortestPath(startId, endId, links) {
    // BFS
    var adj = {};
    links.forEach(function (l) {
      var sid = typeof l.source === "object" ? l.source.id : l.source;
      var tid = typeof l.target === "object" ? l.target.id : l.target;
      if (!adj[sid]) adj[sid] = [];
      if (!adj[tid]) adj[tid] = [];
      adj[sid].push(tid);
      adj[tid].push(sid);
    });
    if (!adj[startId]) return null;
    var visited = {};
    var parent = {};
    var queue = [startId];
    visited[startId] = true;
    parent[startId] = null;
    while (queue.length > 0) {
      var current = queue.shift();
      if (current === endId) {
        // Reconstruct path
        var path = [];
        var node = endId;
        while (node !== null) {
          path.unshift(node);
          node = parent[node];
        }
        return path;
      }
      var neighbors = adj[current] || [];
      for (var i = 0; i < neighbors.length; i++) {
        if (!visited[neighbors[i]]) {
          visited[neighbors[i]] = true;
          parent[neighbors[i]] = current;
          queue.push(neighbors[i]);
        }
      }
    }
    return null; // No path found
  }

  function highlightPath(id1, id2) {
    var path = findShortestPath(id1, id2, currentData.links);
    if (!path) {
      // No path: just highlight the two selected nodes
      var selSet = {};
      selSet[id1] = true;
      selSet[id2] = true;
      nodeGroup.selectAll(".node").transition().duration(200)
        .style("opacity", function (d) { return selSet[d.id] ? 1 : 0.15; });
      linkGroup.selectAll(".link").transition().duration(200)
        .style("opacity", 0.06);
      return;
    }
    var pathSet = {};
    path.forEach(function (id) { pathSet[id] = true; });

    // Build set of path edges for consecutive node pairs
    var pathEdges = {};
    for (var i = 0; i < path.length - 1; i++) {
      var key = path[i] < path[i + 1] ? path[i] + "|" + path[i + 1] : path[i + 1] + "|" + path[i];
      pathEdges[key] = true;
    }

    nodeGroup.selectAll(".node").transition().duration(200)
      .style("opacity", function (d) { return pathSet[d.id] ? 1 : 0.15; });

    linkGroup.selectAll(".link").transition().duration(200)
      .style("opacity", function (l) {
        var sid = typeof l.source === "object" ? l.source.id : l.source;
        var tid = typeof l.target === "object" ? l.target.id : l.target;
        var key = sid < tid ? sid + "|" + tid : tid + "|" + sid;
        return pathEdges[key] ? 1 : 0.06;
      });
  }

  function highlightConnected(nodeId) {
    var connected = connectedNodes(nodeId, currentData.links);
    connected[nodeId] = true;

    nodeGroup.selectAll(".node").transition().duration(200)
      .style("opacity", function (d) { return connected[d.id] ? 1 : 0.15; });

    linkGroup.selectAll(".link").transition().duration(200)
      .style("opacity", function (l) {
        var sid = typeof l.source === "object" ? l.source.id : l.source;
        var tid = typeof l.target === "object" ? l.target.id : l.target;
        return (sid === nodeId || tid === nodeId) ? 1 : 0.06;
      });
  }

  function clearHighlight() {
    nodeGroup.selectAll(".node").transition().duration(300)
      .style("opacity", 1);
    linkGroup.selectAll(".link").transition().duration(300)
      .style("opacity", function (l) { return l.modeColor ? 0.55 : 0.3; });
  }

  function ensureSelectionInfoEl() {
    if (!selectionInfoEl) {
      selectionInfoEl = d3.select("body").append("div")
        .attr("id", "selection-info")
        .attr("class", "selection-info");
    }
    return selectionInfoEl;
  }

  function updateSelectionInfo(nodesById) {
    var el = ensureSelectionInfoEl();

    if (selectedNodes.length === 0) {
      el.classed("visible", false);
      return;
    }

    var html = "";

    if (selectedNodes.length === 1) {
      var nodeId = selectedNodes[0];
      var node = nodesById[nodeId];
      if (!node) { el.classed("visible", false); return; }
      var conns = connectionList(nodeId, currentData.links, nodesById);
      html = '<div class="si-title">' + node.label + '</div>';
      html += '<div class="si-share" style="color:' + node.color + '">' +
        (node.share * 100).toFixed(1) + '% share</div>';
      if (conns.length) {
        html += '<div class="si-connections">';
        conns.forEach(function (c) {
          html += '<div class="si-conn-item"><span>' + c.label +
            '</span><span>' + (c.weight * 100).toFixed(0) + '%</span></div>';
        });
        html += '</div>';
      }
    } else if (selectedNodes.length === 2) {
      var n1 = nodesById[selectedNodes[0]];
      var n2 = nodesById[selectedNodes[1]];
      if (!n1 || !n2) { el.classed("visible", false); return; }
      var path = findShortestPath(selectedNodes[0], selectedNodes[1], currentData.links);
      var directlyConnected = false;
      currentData.links.forEach(function (l) {
        var sid = typeof l.source === "object" ? l.source.id : l.source;
        var tid = typeof l.target === "object" ? l.target.id : l.target;
        if ((sid === selectedNodes[0] && tid === selectedNodes[1]) ||
            (sid === selectedNodes[1] && tid === selectedNodes[0])) {
          directlyConnected = true;
        }
      });
      var combinedShare = ((n1.share + n2.share) * 100).toFixed(1);
      html = '<div class="si-title">' + n1.label + ' \u2194 ' + n2.label + '</div>';
      html += '<div class="si-share">Combined share: ' + combinedShare + '%</div>';
      if (path) {
        var pathLabels = path.map(function (id) { return nodesById[id] ? nodesById[id].label : id; });
        html += '<div class="si-path">Path: ' + pathLabels.join(' \u2192 ') + '</div>';
        html += '<div class="si-detail">' +
          (directlyConnected ? 'Directly connected' : 'Connected via ' + (path.length - 2) + ' intermediate node' + (path.length - 2 !== 1 ? 's' : '')) +
          '</div>';
      } else {
        html += '<div class="si-detail">No path between these nodes</div>';
      }
    }

    el.html(html).classed("visible", true);
  }

  // ── Drag handlers ──
  function dragStarted(d) {
    if (!d3.event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(d) {
    d.fx = d3.event.x;
    d.fy = d3.event.y;
  }

  function dragEnded(d) {
    if (!d3.event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }

  // ── Public init ──
  window.initMolecule = function (containerId, data) {
    var container = d3.select("#" + containerId);

    svg = container.append("svg")
      .attr("viewBox", "0 0 " + WIDTH + " " + HEIGHT)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("role", "img")
      .attr("aria-label", "Travel molecule visualization showing transportation mode shares and multimodal trip chains")
      .style("width", "100%")
      .style("max-width", WIDTH + "px")
      .style("height", "auto");

    var defs = svg.append("defs");
    addGlowFilter(defs);

    linkGroup = svg.append("g").attr("class", "links");
    nodeGroup = svg.append("g").attr("class", "nodes");

    createTooltip();
    buildViz(container, data);

    window.addEventListener("resize", function() {
      var container = document.getElementById(containerId);
      if (container && simulation) {
        simulation.force("center", d3.forceCenter(WIDTH / 2, HEIGHT / 2));
        simulation.alpha(0.3).restart();
      }
    });
  };

  // ── Public API for keyboard navigation / search ──
  window.getMoleculeNodes = function () {
    return currentData ? currentData.nodes.slice() : [];
  };

  window.highlightNode = function (nodeId) {
    if (!currentData) return;
    if (nodeId === null) {
      clearHighlight();
      nodeGroup.selectAll(".node").select(".selection-ring").remove();
      return;
    }
    highlightConnected(nodeId);
  };

  window.selectNode = function (nodeId) {
    if (!currentData) return;
    selectedNodes = [nodeId];
    updateSelection();
  };

  window.switchDataset = function (data) {
    // Clear selection state when switching datasets
    selectedNodes = [];
    if (selectionInfoEl) selectionInfoEl.classed("visible", false);

    // Fade out, rebuild, fade in
    linkGroup.transition().duration(300).style("opacity", 0);
    nodeGroup.transition().duration(300).style("opacity", 0)
      .on("end", function () {
        buildViz(null, data);
      });
  };

})();
