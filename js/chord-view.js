// ─────────────────────────────────────────────
//  Chord Diagram View
//  Shows mode-to-mode transfer relationships
// ─────────────────────────────────────────────

(function () {
  "use strict";

  var WIDTH = 960;
  var HEIGHT = 620;
  var OUTER_RADIUS = Math.min(WIDTH, HEIGHT) * 0.42;
  var INNER_RADIUS = OUTER_RADIUS - 24;

  var svg, tooltip;
  var currentContainerId = null;

  // ── Build chord matrix from mode molecule data ──
  function buildMatrix(data) {
    var nodes = data.nodes.slice();
    var n = nodes.length;
    var matrix = [];
    var i, j;

    // Initialize matrix
    for (i = 0; i < n; i++) {
      matrix[i] = [];
      for (j = 0; j < n; j++) {
        matrix[i][j] = 0;
      }
    }

    // Build index lookup
    var indexById = {};
    nodes.forEach(function (node, idx) {
      indexById[node.id] = idx;
    });

    // Fill matrix from links (multimodal trip chains)
    data.links.forEach(function (l) {
      var sId = typeof l.source === "object" ? l.source.id : l.source;
      var tId = typeof l.target === "object" ? l.target.id : l.target;
      var si = indexById[sId];
      var ti = indexById[tId];
      if (si !== undefined && ti !== undefined) {
        // Scale weight by mode shares for visual balance
        var weight = l.weight * 100;
        matrix[si][ti] = weight;
        matrix[ti][si] = weight;
      }
    });

    // Add diagonal values proportional to mode share (self-loops for arc length)
    nodes.forEach(function (node, idx) {
      matrix[idx][idx] = node.share * 200;
    });

    return { matrix: matrix, nodes: nodes, indexById: indexById };
  }

  // ── Tooltip helpers ──
  function createTooltip() {
    if (tooltip) return;
    tooltip = d3.select("body").append("div").attr("class", "tooltip chord-tooltip");
  }

  function showChordTooltip(d, nodes) {
    var src = nodes[d.source.index];
    var tgt = nodes[d.target.index];
    var weight = d.source.value.toFixed(1);
    var html = '<div class="tt-label">' + src.label + ' ↔ ' + tgt.label + '</div>';
    html += '<div class="tt-share">Chain strength: ' + weight + '</div>';
    html += '<div style="margin-top:4px;font-size:0.75rem;color:rgba(255,255,255,0.5);">' +
      'Multimodal trip transfers between these modes</div>';
    tooltip.html(html).classed("visible", true);
  }

  function showArcTooltip(d, nodes) {
    var node = nodes[d.index];
    var html = '<div class="tt-label">' + node.label + '</div>';
    html += '<div class="tt-share" style="color:' + node.color + '">' +
      (node.share * 100).toFixed(1) + '% mode share</div>';
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
  function render(containerId, data) {
    currentContainerId = containerId;
    var container = d3.select("#" + containerId);
    container.selectAll("*").remove();

    // Update title
    d3.select("#viz-title").text("Chord Diagram");
    d3.select("#viz-subtitle").text("Mode-to-mode transfers — arc = mode share, chord = multimodal chain strength");

    var chordData = buildMatrix(data);
    var matrix = chordData.matrix;
    var nodes = chordData.nodes;

    svg = container.append("svg")
      .attr("viewBox", "0 0 " + WIDTH + " " + HEIGHT)
      .attr("preserveAspectRatio", "xMidYMid meet")
      .attr("role", "img")
      .attr("aria-label", "Chord diagram showing mode-to-mode transfer relationships")
      .style("width", "100%")
      .style("max-width", WIDTH + "px")
      .style("height", "auto");

    createTooltip();

    var g = svg.append("g")
      .attr("transform", "translate(" + (WIDTH / 2) + "," + (HEIGHT / 2) + ")");

    // D3 chord layout
    var chord = d3.chord()
      .padAngle(0.04)
      .sortSubgroups(d3.descending);

    var chords = chord(matrix);

    var arc = d3.arc()
      .innerRadius(INNER_RADIUS)
      .outerRadius(OUTER_RADIUS);

    var ribbon = d3.ribbon()
      .radius(INNER_RADIUS);

    // Draw arcs (groups)
    var arcGroup = g.append("g").attr("class", "chord-arcs");
    var arcs = arcGroup.selectAll(".chord-arc")
      .data(chords.groups)
      .enter().append("g")
      .attr("class", "chord-arc");

    arcs.append("path")
      .attr("d", arc)
      .attr("fill", function (d) { return nodes[d.index].color; })
      .attr("stroke", function (d) { return d3.color(nodes[d.index].color).darker(0.5); })
      .attr("stroke-width", 1);

    // Arc labels
    arcs.append("text")
      .each(function (d) { d.angle = (d.startAngle + d.endAngle) / 2; })
      .attr("dy", "0.35em")
      .attr("transform", function (d) {
        var angle = d.angle * 180 / Math.PI - 90;
        var flip = d.angle > Math.PI;
        return "rotate(" + angle + ") translate(" + (OUTER_RADIUS + 12) + ")" +
          (flip ? " rotate(180)" : "");
      })
      .attr("text-anchor", function (d) { return d.angle > Math.PI ? "end" : "start"; })
      .attr("fill", "rgba(255,255,255,0.8)")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .text(function (d) { return nodes[d.index].label; });

    // Draw chords (ribbons) — skip self-loops
    var ribbonGroup = g.append("g").attr("class", "chord-ribbons");
    var ribbons = ribbonGroup.selectAll(".chord-ribbon")
      .data(chords.filter(function (d) { return d.source.index !== d.target.index; }))
      .enter().append("path")
      .attr("class", "chord-ribbon")
      .attr("d", ribbon)
      .attr("fill", function (d) { return nodes[d.source.index].color; })
      .attr("fill-opacity", 0.45)
      .attr("stroke", function (d) { return d3.color(nodes[d.source.index].color).darker(0.3); })
      .attr("stroke-width", 0.5)
      .attr("stroke-opacity", 0.4);

    // Hover interactions — ribbons
    ribbons
      .on("mouseenter", function (d) {
        ribbons.transition().duration(200)
          .attr("fill-opacity", function (r) { return r === d ? 0.75 : 0.06; });
        arcs.selectAll("path").transition().duration(200)
          .attr("fill-opacity", function (a) {
            return (a.index === d.source.index || a.index === d.target.index) ? 1 : 0.25;
          });
        showChordTooltip(d, nodes);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        ribbons.transition().duration(300).attr("fill-opacity", 0.45);
        arcs.selectAll("path").transition().duration(300).attr("fill-opacity", 1);
        hideTooltip();
      });

    // Hover interactions — arcs
    arcs.selectAll("path")
      .on("mouseenter", function (d) {
        // Highlight chords connected to this arc
        ribbons.transition().duration(200)
          .attr("fill-opacity", function (r) {
            return (r.source.index === d.index || r.target.index === d.index) ? 0.75 : 0.06;
          });
        arcs.selectAll("path").transition().duration(200)
          .attr("fill-opacity", function (a) { return a.index === d.index ? 1 : 0.25; });
        showArcTooltip(d, nodes);
      })
      .on("mousemove", moveTooltip)
      .on("mouseleave", function () {
        ribbons.transition().duration(300).attr("fill-opacity", 0.45);
        arcs.selectAll("path").transition().duration(300).attr("fill-opacity", 1);
        hideTooltip();
      });

    // Fade in
    svg.style("opacity", 0).transition().duration(500).style("opacity", 1);
  }

  // ── Public API ──
  window.ChordView = {
    init: function (containerId, data) {
      render(containerId, data);
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
