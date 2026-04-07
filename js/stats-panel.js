// ─────────────────────────────────────────────
//  Stats Panel – Collapsible statistics sidebar
// ─────────────────────────────────────────────

(function () {
  "use strict";

  var isOpen = false;

  function computeDegrees(data) {
    var degrees = {};
    data.nodes.forEach(function (n) { degrees[n.id] = 0; });
    data.links.forEach(function (l) {
      var sid = typeof l.source === "object" ? l.source.id : l.source;
      var tid = typeof l.target === "object" ? l.target.id : l.target;
      degrees[sid] = (degrees[sid] || 0) + 1;
      degrees[tid] = (degrees[tid] || 0) + 1;
    });
    return degrees;
  }

  window.StatsPanel = {

    compute: function (data) {
      var nodes = data.nodes;
      var links = data.links;
      var n = nodes.length;

      // Total counts
      var totalNodes = n;
      var totalLinks = links.length;

      // Shares sorted descending
      var sorted = nodes.slice().sort(function (a, b) { return b.share - a.share; });
      var top3 = sorted.slice(0, 3);

      // Average link weight
      var avgWeight = 0;
      if (links.length > 0) {
        var sumW = 0;
        links.forEach(function (l) { sumW += (l.weight || 0); });
        avgWeight = sumW / links.length;
      }

      // Network density
      var possibleLinks = n > 1 ? (n * (n - 1)) / 2 : 1;
      var density = totalLinks / possibleLinks;

      // Most connected node (highest degree)
      var degrees = computeDegrees(data);
      var maxDegreeNode = null;
      var maxDegree = 0;
      nodes.forEach(function (nd) {
        if (degrees[nd.id] > maxDegree) {
          maxDegree = degrees[nd.id];
          maxDegreeNode = nd;
        }
      });

      // Strongest bond (highest weight link)
      var strongestLink = null;
      var maxWeight = -1;
      links.forEach(function (l) {
        if (l.weight > maxWeight) {
          maxWeight = l.weight;
          strongestLink = l;
        }
      });
      var strongestLabel = "";
      if (strongestLink) {
        var sId = typeof strongestLink.source === "object" ? strongestLink.source.id : strongestLink.source;
        var tId = typeof strongestLink.target === "object" ? strongestLink.target.id : strongestLink.target;
        var nodesById = {};
        nodes.forEach(function (nd) { nodesById[nd.id] = nd; });
        var sLabel = nodesById[sId] ? nodesById[sId].label : sId;
        var tLabel = nodesById[tId] ? nodesById[tId].label : tId;
        strongestLabel = sLabel + " — " + tLabel;
      }

      // HHI (Herfindahl-Hirschman Index) on shares
      var hhi = 0;
      nodes.forEach(function (nd) {
        var pct = nd.share * 100;
        hhi += pct * pct;
      });

      // Gini coefficient on shares
      var shares = nodes.map(function (nd) { return nd.share; }).sort(function (a, b) { return a - b; });
      var gini = 0;
      if (n > 1) {
        var sumOfAbsDiffs = 0;
        var totalShare = 0;
        for (var i = 0; i < n; i++) {
          totalShare += shares[i];
          for (var j = 0; j < n; j++) {
            sumOfAbsDiffs += Math.abs(shares[i] - shares[j]);
          }
        }
        var meanShare = totalShare / n;
        gini = sumOfAbsDiffs / (2 * n * n * meanShare);
      }

      return {
        totalNodes: totalNodes,
        totalLinks: totalLinks,
        top3: top3,
        avgWeight: avgWeight,
        density: density,
        maxDegreeNode: maxDegreeNode,
        maxDegree: maxDegree,
        strongestLabel: strongestLabel,
        strongestWeight: maxWeight,
        hhi: hhi,
        gini: gini
      };
    },

    render: function (stats, container) {
      var html = "";

      // Overview section
      html += '<div class="sp-section">';
      html += '<div class="sp-header">Overview</div>';
      html += '<div class="sp-row"><span class="sp-label">Nodes</span><span class="sp-value">' + stats.totalNodes + '</span></div>';
      html += '<div class="sp-row"><span class="sp-label">Links</span><span class="sp-value">' + stats.totalLinks + '</span></div>';
      html += '<div class="sp-row"><span class="sp-label">Avg weight</span><span class="sp-value">' + (stats.avgWeight * 100).toFixed(1) + '%</span></div>';
      html += '</div>';

      // Distribution section
      html += '<div class="sp-section">';
      html += '<div class="sp-header">Distribution</div>';
      html += '<div class="sp-sublabel">Top 3 by share</div>';
      stats.top3.forEach(function (node) {
        html += '<div class="sp-row"><span class="sp-label">' + node.label +
          '</span><span class="sp-value" style="color:' + node.color + '">' +
          (node.share * 100).toFixed(1) + '%</span></div>';
      });
      html += '<div class="sp-row"><span class="sp-label">HHI</span><span class="sp-value">' + stats.hhi.toFixed(0) + '</span></div>';
      html += '<div class="sp-row"><span class="sp-label">Gini coeff.</span><span class="sp-value">' + stats.gini.toFixed(3) + '</span></div>';
      html += '</div>';

      // Network section
      html += '<div class="sp-section">';
      html += '<div class="sp-header">Network</div>';
      html += '<div class="sp-row"><span class="sp-label">Density</span><span class="sp-value">' + (stats.density * 100).toFixed(1) + '%</span></div>';
      if (stats.maxDegreeNode) {
        html += '<div class="sp-row"><span class="sp-label">Most connected</span><span class="sp-value" style="color:' +
          stats.maxDegreeNode.color + '">' + stats.maxDegreeNode.label + ' (' + stats.maxDegree + ')</span></div>';
      }
      if (stats.strongestLabel) {
        html += '<div class="sp-row"><span class="sp-label">Strongest bond</span><span class="sp-value">' +
          stats.strongestLabel + ' (' + (stats.strongestWeight * 100).toFixed(0) + '%)</span></div>';
      }
      html += '</div>';

      container.innerHTML = html;
    },

    toggle: function () {
      var panel = document.getElementById("stats-panel");
      if (!panel) return;
      isOpen = !isOpen;
      panel.classList.toggle("open", isOpen);
      var btn = document.getElementById("btn-stats");
      if (btn) btn.classList.toggle("active", isOpen);
    },

    update: function (data) {
      var container = document.getElementById("stats-panel");
      if (!container) return;
      var stats = StatsPanel.compute(data);
      StatsPanel.render(stats, container);
    }
  };

})();
