// ─────────────────────────────────────────────
//  Sankey Flow Diagram View
//  Shows flows from trip purposes (left) through transport modes (right)
// ─────────────────────────────────────────────

(function () {
  "use strict";

  var WIDTH = 960;
  var HEIGHT = 620;
  var PADDING = { top: 40, right: 40, bottom: 40, left: 40 };
  var NODE_WIDTH = 24;
  var NODE_PAD = 16;

  var svg, tooltip;
  var currentContainerId = null;

  // ── Build synthetic flow data ──
  function buildFlowData(modeData, activityData) {
    var purposes = activityData.nodes.map(function (n) {
      return { id: "purpose-" + n.id, label: n.label, share: n.share, color: n.color, side: "left" };
    });
    var modes = modeData.nodes.map(function (n) {
      return { id: "mode-" + n.id, label: n.label, share: n.share, color: n.color, side: "right" };
    });

    // Generate synthetic flows: each purpose distributes across modes
    // Weight is proportional to (purpose share * mode share) with some variation
    var flows = [];
    var seedMultipliers = {
      "home-car": 1.2, "home-walk": 1.5, "home-bus": 0.8,
      "work-car": 1.4, "work-subway": 2.0, "work-bus": 1.3,
      "shopping-car": 1.3, "shopping-walk": 1.8,
      "social-car": 1.1, "social-taxi": 2.5, "social-walk": 1.2,
      "school-car": 0.9, "school-bus": 3.0, "school-walk": 1.5,
      "medical-car": 1.5, "medical-taxi": 2.0,
      "escort-car": 1.8, "escort-walk": 0.5
    };

    purposes.forEach(function (p) {
      var purposeKey = p.id.replace("purpose-", "");
      var totalWeight = 0;
      var rawFlows = [];

      modes.forEach(function (m) {
        var modeKey = m.id.replace("mode-", "");
        var key = purposeKey + "-" + modeKey;
        var multiplier = seedMultipliers[key] || 0.6;
        var weight = p.share * m.share * multiplier;
        if (weight > 0.0005) {
          rawFlows.push({ source: p.id, target: m.id, value: weight });
          totalWeight += weight;
        }
      });

      // Normalize so each purpose's flows sum to its share
      rawFlows.forEach(function (f) {
        f.value = (f.value / totalWeight) * p.share;
        flows.push(f);
      });
    });

    return { nodes: purposes.concat(modes), flows: flows };
  }

  // ── Simple Sankey layout (no plugin needed) ──
  function computeLayout(data) {
    var innerWidth = WIDTH - PADDING.left - PADDING.right - NODE_WIDTH;
    var innerHeight = HEIGHT - PADDING.top - PADDING.bottom;

    var leftNodes = data.nodes.filter(function (n) { return n.side === "left"; });
    var rightNodes = data.nodes.filter(function (n) { return n.side === "right"; });

    // Sort by share descending
    leftNodes.sort(function (a, b) { return b.share - a.share; });
    rightNodes.sort(function (a, b) { return b.share - a.share; });

    // Compute total shares for scaling
    var leftTotal = d3.sum(leftNodes, function (n) { return n.share; });
    var rightTotal = d3.sum(rightNodes, function (n) { return n.share; });

    // Assign y positions for left nodes
    var leftScale = (innerHeight - NODE_PAD * (leftNodes.length - 1)) / leftTotal;
    var yOffset = 0;
    leftNodes.forEach(function (n) {
      n.x = PADDING.left;
      n.y = PADDING.top + yOffset;
      n.height = n.share * leftScale;
      yOffset += n.height + NODE_PAD;
    });

    // Assign y positions for right nodes
    var rightScale = (innerHeight - NODE_PAD * (rightNodes.length - 1)) / rightTotal;
    yOffset = 0;
    rightNodes.forEach(function (n) {
      n.x = PADDING.left + innerWidth;
      n.y = PADDING.top + yOffset;
      n.height = n.share * rightScale;
      yOffset += n.height + NODE_PAD;
    });

    // Build node lookup
    var nodesById = {};
    data.nodes.forEach(function (n) { nodesById[n.id] = n; });

    // Compute flow thicknesses relative to available space
    // Track cumulative offsets per node for stacking flows
    var sourceOffsets = {};
    var targetOffsets = {};
    data.nodes.forEach(function (n) {
      sourceOffsets[n.id] = 0;
      targetOffsets[n.id] = 0;
    });

    // Sort flows by source then target for consistent ordering
    data.flows.sort(function (a, b) {
      var sa = nodesById[a.source];
      var sb = nodesById[b.source];
      var ta = nodesById[a.target];
      var tb = nodesById[b.target];
      if (sa.y !== sb.y) return sa.y - sb.y;
      return ta.y - tb.y;
    });

    // Total flow value to scale thickness
    var maxNodeFlow = {};
    data.flows.forEach(function (f) {
      maxNodeFlow[f.source] = (maxNodeFlow[f.source] || 0) + f.value;
      maxNodeFlow[f.target] = (maxNodeFlow[f.target] || 0) + f.value;
    });

    data.flows.forEach(function (f) {
      var src = nodesById[f.source];
      var tgt = nodesById[f.target];

      // Flow thickness proportional to the node height
      var srcRatio = f.value / maxNodeFlow[f.source];
      var tgtRatio = f.value / maxNodeFlow[f.target];
      var srcThickness = srcRatio * src.height;
      var tgtThickness = tgtRatio * tgt.height;

      f.sy = src.y + sourceOffsets[f.source];
      f.ty = tgt.y + targetOffsets[f.target];
      f.sheight = srcThickness;
      f.theight = tgtThickness;

      sourceOffsets[f.source] += srcThickness;
      targetOffsets[f.target] += tgtThickness;
    });

    return { nodes: data.nodes, flows: data.flows, nodesById: nodesById };
  }

  // ── Generate curved path for a flow ──
  function flowPath(f) {
    var x0 = f.sourceNode.x + NODE_WIDTH;
    var x1 = f.targetNode.x;
    var xi = d3.interpolateNumber(x0, x1);
    var xm0 = xi(0.4);
    var xm1 = xi(0.6);

    var y0top = f.sy;
    var y0bot = f.sy + f.sheight;
    var y1top = f.ty;
    var y1bot = f.ty + f.theight;

    return "M" + x0 + "," + y0top +
      "C" + xm0 + "," + y0top + " " + xm1 + "," + y1top + " " + x1 + "," + y1top +
      "L" + x1 + "," + y1bot +
      "C" + xm1 + "," + y1bot + " " + xm0 + "," + y0bot + " " + x0 + "," + y0bot +
      "Z";
  }

  // ── Tooltip helpers ──
  function createTooltip() {
    if (tooltip) return;
    tooltip = d3.select("body").append("div").attr("class", "tooltip sankey-tooltip");
  }

  function showFlowTooltip(f) {
    var src = f.sourceNode;
    var tgt = f.targetNode;
    var pct = (f.value / src.share * 100).toFixed(1);
    var html = '<div class="tt-label">' + src.label + ' → ' + tgt.label + '</div>';
    html += '<div class="tt-share" style="color:' + tgt.color + '">' +
      pct + '% of ' + src.label + ' trips use ' + tgt.label + '</div>';
    tooltip.html(html).classed("visible", true);
  }

  function moveTooltip() {
    var e = d3.event;
    tooltip
      .style("left", (e.pageX + 16) + "px")
      .style("top", (e.pageY - 12) + "px");
  }

  function hideTooltip() {
    if (tooltip) tooltip.classed("visible", false);
  }

  // ── Render ──
  function render(containerId, modeData, activityData) {
    currentContainerId = containerId;
    var container = d3.select("#" + containerId);
    container.selectAll("*").remove();

    // Update title
    d3.select("#viz-title").text("Sankey Flow");
    d3.select("#viz-subtitle").text("Trip purpose → transport mode flows — thickness = usage proportion");

    var flowData = buildFlowData(modeData, activityData);
    var layout = computeLayout(flowData);

    svg = container.append("svg")
      .attr("viewBox", "0 0 " + WIDTH + " " + HEIGHT)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("role", "img")
      .attr("aria-label", "Sankey flow diagram showing trip purpose to transport mode flows")
      .style("width", "100%")
      .style("max-width", WIDTH + "px")
      .style("height", "auto");

    createTooltip();

    // Attach source/target node references to flows
    layout.flows.forEach(function (f) {
      f.sourceNode = layout.nodesById[f.source];
      f.targetNode = layout.nodesById[f.target];
    });

    // Draw flows
    var flowGroup = svg.append("g").attr("class", "sankey-flows");
    var flows = flowGroup.selectAll(".sankey-flow")
      .data(layout.flows)
      .enter().append("path")
      .attr("class", "sankey-flow")
      .attr("d", flowPath)
      .attr("fill", function (f) { return f.targetNode.color; })
      .attr("fill-opacity", 0.35)
      .attr("stroke", "none");

    // Draw nodes
    var nodeGroup = svg.append("g").attr("class", "sankey-nodes");
    var nodes = nodeGroup.selectAll(".sankey-node")
      .data(layout.nodes)
      .enter().append("g")
      .attr("class", "sankey-node");

    nodes.append("rect")
      .attr("x", function (d) { return d.x; })
      .attr("y", function (d) { return d.y; })
      .attr("width", NODE_WIDTH)
      .attr("height", function (d) { return Math.max(d.height, 2); })
      .attr("fill", function (d) { return d.color; })
      .attr("rx", 3)
      .attr("ry", 3)
      .attr("stroke", function (d) { return d3.color(d.color).darker(0.5); })
      .attr("stroke-width", 1);

    // Node labels
    nodes.append("text")
      .attr("x", function (d) {
        return d.side === "left" ? d.x - 8 : d.x + NODE_WIDTH + 8;
      })
      .attr("y", function (d) { return d.y + d.height / 2; })
      .attr("dy", "0.35em")
      .attr("text-anchor", function (d) { return d.side === "left" ? "end" : "start"; })
      .attr("fill", "rgba(255,255,255,0.85)")
      .attr("font-size", "12px")
      .attr("font-weight", "500")
      .text(function (d) { return d.label + " (" + (d.share * 100).toFixed(1) + "%)"; });

    // Column headers
    svg.append("text")
      .attr("x", PADDING.left + NODE_WIDTH / 2)
      .attr("y", PADDING.top - 16)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.5)")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("letter-spacing", "0.08em")
      .text("TRIP PURPOSE");

    svg.append("text")
      .attr("x", WIDTH - PADDING.right - NODE_WIDTH / 2)
      .attr("y", PADDING.top - 16)
      .attr("text-anchor", "middle")
      .attr("fill", "rgba(255,255,255,0.5)")
      .attr("font-size", "11px")
      .attr("font-weight", "600")
      .attr("letter-spacing", "0.08em")
      .text("TRANSPORT MODE");

    // Hover interactions
    flows
      .on("mouseenter", function (f) {
        // Highlight this flow, dim others
        flows.transition().duration(200)
          .attr("fill-opacity", function (d) { return d === f ? 0.7 : 0.08; });
        showFlowTooltip(f);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        flows.transition().duration(300)
          .attr("fill-opacity", 0.35);
        hideTooltip();
      });

    // Fade in
    svg.style("opacity", 0).transition().duration(500).style("opacity", 1);
  }

  // ── Public API ──
  window.SankeyView = {
    init: function (containerId, modeData, activityData) {
      render(containerId, modeData, activityData);
    },
    destroy: function () {
      if (currentContainerId) {
        d3.select("#" + currentContainerId).selectAll("*").remove();
      }
      if (tooltip) {
        tooltip.remove();
        tooltip = null;
      }
    },
    resize: function () {
      // SVG uses viewBox so it auto-resizes; no action needed
    }
  };

})();
