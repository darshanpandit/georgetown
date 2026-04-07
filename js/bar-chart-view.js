// ─────────────────────────────────────────────
//  BarChartView — horizontal stacked bar chart
//  comparing mode shares across demographic groups
// ─────────────────────────────────────────────

(function () {
  "use strict";

  // Mode colors matching molecule node colors from MODE_MOLECULE_DATA
  var MODE_COLORS = {
    car: "#4a9eff",
    walk: "#34d399",
    bus: "#f97316",
    transit_bus: "#f97316",
    subway: "#a78bfa",
    subway_rail: "#a78bfa",
    bicycle: "#f472b6",
    taxi: "#fbbf24",
    other: "#94a3b8"
  };

  // Friendly labels for mode identifiers
  var MODE_LABELS = {
    car: "Car",
    walk: "Walk",
    bus: "Bus",
    transit_bus: "Bus",
    subway: "Subway",
    subway_rail: "Subway",
    bicycle: "Bicycle",
    taxi: "Taxi/TNC",
    other: "Other"
  };

  // Dimension labels for the dropdown
  var DIMENSION_LABELS = {
    age_group: "Age Group",
    area_type: "Area Type",
    income: "Income"
  };

  var svg, container, tooltip, dropdown;
  var margin = { top: 50, right: 30, bottom: 40, left: 120 };
  var currentDimension = null;
  var demographicData = null;
  var transitionDuration = 600;

  /**
   * Group demographic rows by dimension and category.
   * Returns { dimension: { category: [ {mode, share}, ... ], ... }, ... }
   */
  function groupData(rows) {
    var grouped = {};
    rows.forEach(function (r) {
      var dim = r.demographic;
      var cat = r.category;
      if (!grouped[dim]) grouped[dim] = {};
      if (!grouped[dim][cat]) grouped[dim][cat] = [];
      grouped[dim][cat].push({
        mode: r.mode,
        share: parseFloat(r.share)
      });
    });
    return grouped;
  }

  /**
   * Collect all unique mode keys in stable order across the dataset.
   */
  function getAllModes(rows) {
    var seen = {};
    var modes = [];
    rows.forEach(function (r) {
      if (!seen[r.mode]) {
        seen[r.mode] = true;
        modes.push(r.mode);
      }
    });
    return modes;
  }

  /**
   * Draw or update the stacked bar chart for the given dimension.
   */
  function draw(dimension) {
    if (!demographicData || !dimension) return;

    var grouped = groupData(demographicData);
    var dimData = grouped[dimension];
    if (!dimData) return;

    var categories = Object.keys(dimData);
    var allModes = getAllModes(demographicData);

    var containerEl = document.getElementById(container);
    var width = containerEl.clientWidth - margin.left - margin.right;
    var height = containerEl.clientHeight - margin.top - margin.bottom;
    if (width < 100) width = 400;
    if (height < 100) height = 300;

    // Update SVG size
    svg.attr("width", width + margin.left + margin.right)
      .attr("height", height + margin.top + margin.bottom);

    var g = svg.select(".chart-area");

    // Scales
    var yScale = d3.scaleBand()
      .domain(categories)
      .range([0, height])
      .padding(0.25);

    var xScale = d3.scaleLinear()
      .domain([0, 1])
      .range([0, width]);

    // Build stacked data per category
    var stackedData = categories.map(function (cat) {
      var modeMap = {};
      dimData[cat].forEach(function (d) { modeMap[d.mode] = d.share; });

      var segments = [];
      var x0 = 0;
      allModes.forEach(function (mode) {
        var val = modeMap[mode] || 0;
        if (val > 0) {
          segments.push({
            mode: mode,
            x0: x0,
            x1: x0 + val,
            share: val,
            category: cat
          });
          x0 += val;
        }
      });
      return { category: cat, segments: segments };
    });

    // Y axis
    var yAxisG = g.selectAll(".y-axis").data([0]);
    yAxisG = yAxisG.enter().append("g").attr("class", "y-axis").merge(yAxisG);
    yAxisG.transition().duration(transitionDuration)
      .call(d3.axisLeft(yScale).tickSize(0));
    yAxisG.selectAll("text")
      .style("fill", "rgba(255,255,255,0.7)")
      .style("font-size", "0.8rem");
    yAxisG.select(".domain").style("stroke", "rgba(255,255,255,0.15)");

    // X axis
    var xAxisG = g.selectAll(".x-axis").data([0]);
    xAxisG = xAxisG.enter().append("g").attr("class", "x-axis")
      .attr("transform", "translate(0," + height + ")").merge(xAxisG);
    xAxisG.transition().duration(transitionDuration)
      .attr("transform", "translate(0," + height + ")")
      .call(d3.axisBottom(xScale).ticks(5).tickFormat(function (d) {
        return Math.round(d * 100) + "%";
      }));
    xAxisG.selectAll("text")
      .style("fill", "rgba(255,255,255,0.7)")
      .style("font-size", "0.75rem");
    xAxisG.select(".domain").style("stroke", "rgba(255,255,255,0.15)");
    xAxisG.selectAll(".tick line").style("stroke", "rgba(255,255,255,0.1)");

    // Bars — one group per category
    var barGroups = g.selectAll(".bar-group")
      .data(stackedData, function (d) { return d.category; });

    barGroups.exit().transition().duration(transitionDuration)
      .style("opacity", 0).remove();

    var barGroupsEnter = barGroups.enter().append("g")
      .attr("class", "bar-group")
      .attr("transform", function (d) {
        return "translate(0," + yScale(d.category) + ")";
      });

    barGroups = barGroupsEnter.merge(barGroups);

    barGroups.transition().duration(transitionDuration)
      .attr("transform", function (d) {
        return "translate(0," + yScale(d.category) + ")";
      });

    // Segments within each group
    barGroups.each(function (groupDatum) {
      var group = d3.select(this);
      var segs = group.selectAll(".bar-segment")
        .data(groupDatum.segments, function (d) { return d.mode; });

      segs.exit().transition().duration(transitionDuration)
        .attr("width", 0).remove();

      var segsEnter = segs.enter().append("rect")
        .attr("class", "bar-segment")
        .attr("y", 0)
        .attr("height", yScale.bandwidth())
        .attr("x", function (d) { return xScale(d.x0); })
        .attr("width", 0)
        .attr("fill", function (d) { return MODE_COLORS[d.mode] || "#94a3b8"; })
        .attr("rx", 2)
        .style("cursor", "pointer");

      segsEnter.merge(segs).transition().duration(transitionDuration)
        .attr("y", 0)
        .attr("height", yScale.bandwidth())
        .attr("x", function (d) { return xScale(d.x0); })
        .attr("width", function (d) { return xScale(d.x1) - xScale(d.x0); })
        .attr("fill", function (d) { return MODE_COLORS[d.mode] || "#94a3b8"; });

      // Tooltip events
      segsEnter
        .on("mouseover", function (d) {
          var label = MODE_LABELS[d.mode] || d.mode;
          var pct = (d.share * 100).toFixed(1);
          var dimLabel = DIMENSION_LABELS[currentDimension] || currentDimension;
          tooltip.html(
            "<div class='tt-label'>" + label + "</div>" +
            "<div class='tt-share' style='color:" + (MODE_COLORS[d.mode] || "#fff") + "'>" +
            pct + "% of trips</div>" +
            "<div style='font-size:0.78rem;color:rgba(255,255,255,0.5)'>" +
            dimLabel + ": " + d.category + "</div>"
          ).classed("visible", true);
          d3.select(this).style("opacity", 0.8);
        })
        .on("mousemove", function () {
          tooltip
            .style("left", (d3.event.pageX + 14) + "px")
            .style("top", (d3.event.pageY - 14) + "px");
        })
        .on("mouseout", function () {
          tooltip.classed("visible", false);
          d3.select(this).style("opacity", 1);
        });
    });

    // Chart title
    var title = svg.selectAll(".chart-title").data([dimension]);
    title.enter().append("text")
      .attr("class", "chart-title")
      .attr("x", (width + margin.left + margin.right) / 2)
      .attr("y", 24)
      .attr("text-anchor", "middle")
      .style("fill", "#fff")
      .style("font-size", "0.95rem")
      .style("font-weight", "600")
      .merge(title)
      .transition().duration(transitionDuration)
      .attr("x", (width + margin.left + margin.right) / 2)
      .text("Mode Share by " + (DIMENSION_LABELS[dimension] || dimension));
  }

  /**
   * Build the mode color legend below the chart.
   */
  function buildLegend(parentEl) {
    var legendEl = document.createElement("div");
    legendEl.className = "bar-chart-legend";
    legendEl.style.cssText =
      "display:flex;flex-wrap:wrap;gap:12px;justify-content:center;" +
      "padding:8px 0;font-size:0.75rem;color:rgba(255,255,255,0.6)";

    var modes = getAllModes(demographicData);
    modes.forEach(function (mode) {
      var item = document.createElement("span");
      item.style.cssText = "display:inline-flex;align-items:center;gap:4px";
      var dot = document.createElement("span");
      dot.style.cssText =
        "width:10px;height:10px;border-radius:50%;display:inline-block;background:" +
        (MODE_COLORS[mode] || "#94a3b8");
      item.appendChild(dot);
      item.appendChild(document.createTextNode(MODE_LABELS[mode] || mode));
      legendEl.appendChild(item);
    });

    parentEl.appendChild(legendEl);
  }

  window.BarChartView = {

    /**
     * Initialize the bar chart view.
     * @param {string} containerId — DOM element ID to render into
     * @param {Array} data — parsed demographic CSV rows
     */
    init: function (containerId, data) {
      container = containerId;
      demographicData = data;

      var parentEl = document.getElementById(containerId);
      if (!parentEl) return;
      parentEl.innerHTML = "";

      // Dimension selector dropdown
      var controls = document.createElement("div");
      controls.style.cssText =
        "display:flex;justify-content:center;margin-bottom:8px";
      dropdown = document.createElement("select");
      dropdown.style.cssText =
        "padding:6px 12px;border:1px solid rgba(255,255,255,0.2);" +
        "border-radius:6px;background:rgba(255,255,255,0.08);" +
        "color:rgba(255,255,255,0.8);font-size:0.8rem;cursor:pointer";

      var dims = {};
      data.forEach(function (r) { dims[r.demographic] = true; });
      var dimKeys = Object.keys(dims);

      dimKeys.forEach(function (d) {
        var opt = document.createElement("option");
        opt.value = d;
        opt.textContent = DIMENSION_LABELS[d] || d;
        dropdown.appendChild(opt);
      });

      dropdown.addEventListener("change", function () {
        BarChartView.setDimension(dropdown.value);
      });
      controls.appendChild(dropdown);
      parentEl.appendChild(controls);

      // SVG container
      var svgEl = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      parentEl.appendChild(svgEl);
      svg = d3.select(svgEl);

      var g = svg.append("g")
        .attr("class", "chart-area")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

      // Tooltip
      tooltip = d3.select("body").selectAll(".bar-chart-tooltip").data([0]);
      tooltip = tooltip.enter().append("div")
        .attr("class", "tooltip bar-chart-tooltip")
        .merge(tooltip);

      // Legend
      buildLegend(parentEl);

      // Draw initial dimension
      currentDimension = dimKeys[0] || null;
      if (currentDimension) {
        draw(currentDimension);
      }
    },

    /**
     * Switch the displayed demographic dimension.
     * @param {string} dimension — e.g. "age_group", "area_type", "income"
     */
    setDimension: function (dimension) {
      currentDimension = dimension;
      if (dropdown) dropdown.value = dimension;
      draw(dimension);
    },

    /**
     * Clean up DOM elements and event listeners.
     */
    destroy: function () {
      if (container) {
        var el = document.getElementById(container);
        if (el) el.innerHTML = "";
      }
      d3.selectAll(".bar-chart-tooltip").remove();
      svg = null;
      dropdown = null;
      demographicData = null;
      currentDimension = null;
    },

    /**
     * Handle container resize — redraw at new dimensions.
     */
    resize: function () {
      if (currentDimension) {
        draw(currentDimension);
      }
    }
  };
})();
