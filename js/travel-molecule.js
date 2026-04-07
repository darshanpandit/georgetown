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

        showTooltip(d, currentData.links, nodesById);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        nodeGroup.selectAll(".node").transition().duration(300).style("opacity", 1);
        linkGroup.selectAll(".link").transition().duration(300).style("opacity", function (l) {
          return l.modeColor ? 0.55 : 0.3;
        });
        hideTooltip();
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
      .style("width", "100%")
      .style("max-width", WIDTH + "px")
      .style("height", "auto");

    var defs = svg.append("defs");
    addGlowFilter(defs);

    linkGroup = svg.append("g").attr("class", "links");
    nodeGroup = svg.append("g").attr("class", "nodes");

    createTooltip();
    buildViz(container, data);
  };

  window.switchDataset = function (data) {
    // Fade out, rebuild, fade in
    linkGroup.transition().duration(300).style("opacity", 0);
    nodeGroup.transition().duration(300).style("opacity", 0)
      .on("end", function () {
        buildViz(null, data);
      });
  };

})();
