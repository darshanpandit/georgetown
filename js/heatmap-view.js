// ─────────────────────────────────────────────
//  HeatmapView — mode-purpose heatmap/matrix
//  showing relationship between trip purposes
//  and transport modes
// ─────────────────────────────────────────────

(function () {
  "use strict";

  // Purpose labels (rows) — matching activity molecule node IDs
  var PURPOSES = [
    { id: "home", label: "Home" },
    { id: "work", label: "Work" },
    { id: "shopping", label: "Shopping" },
    { id: "social", label: "Social" },
    { id: "school", label: "School" },
    { id: "medical", label: "Medical" },
    { id: "escort", label: "Escort" }
  ];

  // Mode labels (columns) — matching mode molecule node IDs
  var MODES = [
    { id: "car", label: "Car" },
    { id: "walk", label: "Walk" },
    { id: "bus", label: "Bus" },
    { id: "subway", label: "Subway" },
    { id: "bicycle", label: "Bicycle" },
    { id: "taxi", label: "Taxi" }
  ];

  var svg, container, tooltip;
  var margin = { top: 70, right: 80, bottom: 30, left: 90 };
  var matrixData = null;

  /**
   * Build the heatmap matrix by combining mode shares with activity chain data.
   *
   * For each purpose-mode pair, compute a usage intensity:
   * - From activity links: sum weights of links involving that purpose, weighted
   *   by whether the link's dominant mode matches.
   * - From mode shares: use the overall mode share as a baseline.
   * - Combine to produce a 0-1 intensity value.
   */
  function buildMatrix(modeData, activityData) {
    // Mode share lookup
    var modeShares = {};
    if (modeData && modeData.nodes) {
      modeData.nodes.forEach(function (n) {
        modeShares[n.id] = n.share;
      });
    }

    // Activity link analysis: for each purpose, count mode associations
    var purposeModeWeights = {};
    PURPOSES.forEach(function (p) {
      purposeModeWeights[p.id] = {};
      MODES.forEach(function (m) {
        purposeModeWeights[p.id][m.id] = 0;
      });
    });

    if (activityData && activityData.links) {
      activityData.links.forEach(function (link) {
        var src = typeof link.source === "object" ? link.source.id : link.source;
        var tgt = typeof link.target === "object" ? link.target.id : link.target;
        var mode = link.mode;
        var weight = link.weight || 0;

        if (!mode) return;

        // Attribute this link's weight to both source and target purposes
        if (purposeModeWeights[src] && purposeModeWeights[src][mode] !== undefined) {
          purposeModeWeights[src][mode] += weight;
        }
        if (purposeModeWeights[tgt] && purposeModeWeights[tgt][mode] !== undefined) {
          purposeModeWeights[tgt][mode] += weight;
        }
      });
    }

    // Normalize: find the max weight across the matrix for scaling
    var maxWeight = 0;
    PURPOSES.forEach(function (p) {
      MODES.forEach(function (m) {
        // Combine activity chain weight with mode share baseline
        var chainW = purposeModeWeights[p.id][m.id] || 0;
        var modeShare = modeShares[m.id] || 0;
        // Blend: chain data weighted by mode share creates final intensity
        var val = chainW > 0 ? chainW * (0.5 + modeShare) : modeShare * 0.1;
        purposeModeWeights[p.id][m.id] = val;
        if (val > maxWeight) maxWeight = val;
      });
    });

    // Build flat array of cells with normalized 0-1 values
    var cells = [];
    PURPOSES.forEach(function (p) {
      MODES.forEach(function (m) {
        var raw = purposeModeWeights[p.id][m.id] || 0;
        var normalized = maxWeight > 0 ? raw / maxWeight : 0;
        cells.push({
          purpose: p.id,
          purposeLabel: p.label,
          mode: m.id,
          modeLabel: m.label,
          value: normalized,
          rawValue: raw
        });
      });
    });

    return cells;
  }

  /**
   * Draw the heatmap.
   */
  function draw() {
    if (!matrixData || !svg) return;

    var containerEl = document.getElementById(container);
    var width = containerEl.clientWidth - margin.left - margin.right;
    var height = containerEl.clientHeight - margin.top - margin.bottom;
    if (width < 100) width = 400;
    if (height < 100) height = 300;

    svg.attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    var g = svg.select(".heatmap-area");

    var purposeIds = PURPOSES.map(function (p) { return p.id; });
    var modeIds = MODES.map(function (m) { return m.id; });

    // Scales
    var xScale = d3.scaleBand()
      .domain(modeIds)
      .range([0, width])
      .padding(0.08);

    var yScale = d3.scaleBand()
      .domain(purposeIds)
      .range([0, height])
      .padding(0.08);

    // Georgetown-theme sequential color scale: dark blue to bright cyan
    var colorScale = d3.scaleSequential(function (t) {
      // From #0a1228 (dark navy) to #00e5ff (bright cyan)
      var r = Math.round(10 + t * (0 - 10));
      var gVal = Math.round(18 + t * (229 - 18));
      var b = Math.round(40 + t * (255 - 40));
      return "rgb(" + r + "," + gVal + "," + b + ")";
    }).domain([0, 1]);

    // Label lookups
    var purposeLabels = {};
    PURPOSES.forEach(function (p) { purposeLabels[p.id] = p.label; });
    var modeLabels = {};
    MODES.forEach(function (m) { modeLabels[m.id] = m.label; });

    // Y axis (purpose labels)
    var yAxisG = g.selectAll(".y-axis").data([0]);
    yAxisG = yAxisG.enter().append("g").attr("class", "y-axis").merge(yAxisG);
    yAxisG.call(d3.axisLeft(yScale).tickSize(0).tickFormat(function (d) {
      return purposeLabels[d] || d;
    }));
    yAxisG.selectAll("text")
      .style("fill", "rgba(255,255,255,0.75)")
      .style("font-size", "0.8rem");
    yAxisG.select(".domain").style("stroke", "none");

    // X axis (mode labels — top)
    var xAxisG = g.selectAll(".x-axis").data([0]);
    xAxisG = xAxisG.enter().append("g").attr("class", "x-axis").merge(xAxisG);
    xAxisG.call(d3.axisTop(xScale).tickSize(0).tickFormat(function (d) {
      return modeLabels[d] || d;
    }));
    xAxisG.selectAll("text")
      .style("fill", "rgba(255,255,255,0.75)")
      .style("font-size", "0.8rem")
      .attr("dy", "-0.6em");
    xAxisG.select(".domain").style("stroke", "none");

    // Heatmap cells
    var cells = g.selectAll(".hm-cell")
      .data(matrixData, function (d) { return d.purpose + "-" + d.mode; });

    cells.exit().transition().duration(400).style("opacity", 0).remove();

    var cellsEnter = cells.enter().append("rect")
      .attr("class", "hm-cell")
      .attr("rx", 3)
      .attr("ry", 3)
      .style("cursor", "pointer")
      .style("opacity", 0);

    var allCells = cellsEnter.merge(cells);

    allCells.transition().duration(500)
      .attr("x", function (d) { return xScale(d.mode); })
      .attr("y", function (d) { return yScale(d.purpose); })
      .attr("width", xScale.bandwidth())
      .attr("height", yScale.bandwidth())
      .attr("fill", function (d) { return colorScale(d.value); })
      .style("opacity", 1);

    // Crosshair lines (hidden by default)
    var crossH = g.selectAll(".crosshair-h").data([0]);
    crossH = crossH.enter().append("line").attr("class", "crosshair-h")
      .style("stroke", "rgba(255,255,255,0.2)")
      .style("stroke-width", 1)
      .style("stroke-dasharray", "3,3")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .merge(crossH);

    var crossV = g.selectAll(".crosshair-v").data([0]);
    crossV = crossV.enter().append("line").attr("class", "crosshair-v")
      .style("stroke", "rgba(255,255,255,0.2)")
      .style("stroke-width", 1)
      .style("stroke-dasharray", "3,3")
      .style("pointer-events", "none")
      .style("opacity", 0)
      .merge(crossV);

    // Tooltip events
    cellsEnter
      .on("mouseover", function (d) {
        var pct = (d.value * 100).toFixed(1);
        tooltip.html(
          "<div class='tt-label'>" + d.purposeLabel + " + " + d.modeLabel + "</div>" +
          "<div class='tt-share' style='color:#00e5ff'>" +
          "Intensity: " + pct + "%</div>" +
          "<div style='font-size:0.78rem;color:rgba(255,255,255,0.5)'>" +
          "Purpose-mode usage strength</div>"
        ).classed("visible", true);

        // Dim other cells
        allCells.style("opacity", function (c) {
          return (c.purpose === d.purpose || c.mode === d.mode) ? 1 : 0.3;
        });

        // Show crosshairs
        var cx = xScale(d.mode) + xScale.bandwidth() / 2;
        var cy = yScale(d.purpose) + yScale.bandwidth() / 2;

        crossH.attr("x1", 0).attr("x2", width)
          .attr("y1", cy).attr("y2", cy)
          .style("opacity", 1);

        crossV.attr("x1", cx).attr("x2", cx)
          .attr("y1", 0).attr("y2", height)
          .style("opacity", 1);
      })
      .on("mousemove", function () {
        tooltip
          .style("left", (d3.event.pageX + 14) + "px")
          .style("top", (d3.event.pageY - 14) + "px");
      })
      .on("mouseout", function () {
        tooltip.classed("visible", false);
        allCells.style("opacity", 1);
        crossH.style("opacity", 0);
        crossV.style("opacity", 0);
      });

    // Color legend (intensity scale)
    drawColorLegend(svg, width, height);

    // Chart title
    var title = svg.selectAll(".chart-title").data(["Mode-Purpose Heatmap"]);
    title.enter().append("text")
      .attr("class", "chart-title")
      .attr("text-anchor", "middle")
      .style("fill", "#fff")
      .style("font-size", "0.95rem")
      .style("font-weight", "600")
      .merge(title)
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 20)
      .text("Mode-Purpose Heatmap");
  }

  /**
   * Draw a horizontal color legend showing the intensity scale.
   */
  function drawColorLegend(svgEl, chartWidth, chartHeight) {
    var legendWidth = 16;
    var legendHeight = chartHeight;
    var legendX = margin.left + chartWidth + 20;
    var legendY = margin.top;

    var legendG = svgEl.selectAll(".color-legend").data([0]);
    legendG = legendG.enter().append("g").attr("class", "color-legend").merge(legendG);
    legendG.attr("transform", "translate(" + legendX + "," + legendY + ")");

    // Gradient
    var defs = svgEl.selectAll("defs").data([0]);
    defs = defs.enter().append("defs").merge(defs);

    var gradient = defs.selectAll("#hm-gradient").data([0]);
    gradient = gradient.enter().append("linearGradient")
      .attr("id", "hm-gradient")
      .attr("x1", "0%").attr("y1", "100%")
      .attr("x2", "0%").attr("y2", "0%")
      .merge(gradient);

    var stops = [
      { offset: "0%", color: "rgb(10,18,40)" },
      { offset: "50%", color: "rgb(5,124,148)" },
      { offset: "100%", color: "rgb(0,229,255)" }
    ];

    var stopSel = gradient.selectAll("stop").data(stops);
    stopSel.enter().append("stop").merge(stopSel)
      .attr("offset", function (d) { return d.offset; })
      .attr("stop-color", function (d) { return d.color; });

    // Gradient bar
    var bar = legendG.selectAll(".legend-bar").data([0]);
    bar.enter().append("rect").attr("class", "legend-bar")
      .attr("rx", 3)
      .merge(bar)
      .attr("width", legendWidth)
      .attr("height", legendHeight)
      .attr("fill", "url(#hm-gradient)");

    // Labels
    var highLabel = legendG.selectAll(".legend-high").data(["High"]);
    highLabel.enter().append("text").attr("class", "legend-high")
      .style("fill", "rgba(255,255,255,0.5)")
      .style("font-size", "0.7rem")
      .merge(highLabel)
      .attr("x", legendWidth + 6).attr("y", 10)
      .text("High");

    var lowLabel = legendG.selectAll(".legend-low").data(["Low"]);
    lowLabel.enter().append("text").attr("class", "legend-low")
      .style("fill", "rgba(255,255,255,0.5)")
      .style("font-size", "0.7rem")
      .merge(lowLabel)
      .attr("x", legendWidth + 6).attr("y", legendHeight)
      .text("Low");
  }

  window.HeatmapView = {

    /**
     * Initialize the heatmap view.
     * @param {string} containerId — DOM element ID to render into
     * @param {Object} modeData — MODE_MOLECULE_DATA or equivalent
     * @param {Object} activityData — ACTIVITY_MOLECULE_DATA or equivalent
     */
    init: function (containerId, modeData, activityData) {
      container = containerId;

      var parentEl = document.getElementById(containerId);
      if (!parentEl) return;
      parentEl.innerHTML = "";

      // Build matrix data
      matrixData = buildMatrix(modeData, activityData);

      // SVG container
      var svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      parentEl.appendChild(svgEl);
      svg = d3.select(svgEl);

      svg.append("g")
        .attr("class", "heatmap-area")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      // Tooltip
      tooltip = d3.select("body").selectAll(".heatmap-tooltip").data([0]);
      tooltip = tooltip.enter().append("div")
        .attr("class", "tooltip heatmap-tooltip")
        .merge(tooltip);

      draw();
    },

    /**
     * Clean up DOM elements.
     */
    destroy: function () {
      if (container) {
        var el = document.getElementById(container);
        if (el) el.innerHTML = "";
      }
      d3.selectAll(".heatmap-tooltip").remove();
      svg = null;
      matrixData = null;
    },

    /**
     * Handle container resize — redraw at new dimensions.
     */
    resize: function () {
      draw();
    }
  };
})();
