// -------------------------------------------------
//  TravelAPI -- Programmatic Data API
//  Query NHTS travel data without touching the DOM.
//  Works in browser (window.TravelAPI) and Node.js
//  (module.exports) environments.
// -------------------------------------------------

(function (root) {
  "use strict";

  // ── Internal helpers ──────────────────────────

  /**
   * Resolve the embedded data objects.  In the browser these live on
   * `window`; when loaded via Node `require()` the caller must first
   * load travel-molecule-data.js into the global scope.
   */
  function getModeData() {
    return root.MODE_MOLECULE_DATA || null;
  }

  function getActivityData() {
    return root.ACTIVITY_MOLECULE_DATA || null;
  }

  function getDemographicRows() {
    if (root.Demographics && root.Demographics.data) {
      return root.Demographics.data;
    }
    return null;
  }

  /** Build an id-keyed lookup from a nodes array. */
  function nodesById(nodes) {
    var map = {};
    nodes.forEach(function (n) { map[n.id] = n; });
    return map;
  }

  /** Resolve a link endpoint that might be an object (D3 simulation). */
  function linkId(endpoint) {
    return typeof endpoint === "object" ? endpoint.id : endpoint;
  }

  /** Build adjacency list from links. */
  function buildAdj(links) {
    var adj = {};
    links.forEach(function (l) {
      var s = linkId(l.source);
      var t = linkId(l.target);
      if (!adj[s]) adj[s] = [];
      if (!adj[t]) adj[t] = [];
      adj[s].push({ neighbor: t, weight: l.weight });
      adj[t].push({ neighbor: s, weight: l.weight });
    });
    return adj;
  }

  /** Sort helper: comparator for a field. */
  function cmp(field, order) {
    var dir = order === "asc" ? 1 : -1;
    return function (a, b) {
      return a[field] > b[field] ? dir : a[field] < b[field] ? -dir : 0;
    };
  }

  /** Escape a value for CSV output. */
  function csvEscape(val) {
    if (val === null || val === undefined) return "";
    var str = String(val);
    if (str.indexOf(",") !== -1 || str.indexOf('"') !== -1 || str.indexOf("\n") !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }

  // ── MODE_ID_MAP (mirrors demographics.js) ─────
  var MODE_ID_MAP = {
    car: "car",
    walk: "walk",
    transit_bus: "bus",
    subway_rail: "subway",
    bicycle: "bicycle",
    other: "other"
  };

  // ── The API object ────────────────────────────

  var TravelAPI = {

    // ── Metadata ──────────────────────────────
    version: "1.0.0",
    dataSource: "NHTS 2017",
    lastUpdated: "2026-04-07",

    // ── Data Access ──────────────────────────

    /**
     * Get all modes with their shares.
     * @param {Object} [options]
     * @param {number} [options.minShare=0] - Filter modes below this share
     * @param {string} [options.sortBy="share"] - "share" or "label"
     * @param {string} [options.order="desc"] - "desc" or "asc"
     * @param {number} [options.limit] - Maximum number of results
     * @returns {Array<{id:string, label:string, share:number, color:string}>}
     */
    getModes: function (options) {
      var data = getModeData();
      if (!data) return [];
      var opts = options || {};
      var minShare = opts.minShare || 0;
      var sortBy = opts.sortBy || "share";
      var order = opts.order || "desc";

      var result = data.nodes.filter(function (n) {
        return n.share >= minShare;
      }).map(function (n) {
        return { id: n.id, label: n.label, share: n.share, color: n.color };
      });

      result.sort(cmp(sortBy, order));
      if (opts.limit && opts.limit > 0) {
        result = result.slice(0, opts.limit);
      }
      return result;
    },

    /**
     * Get all activities with their shares.
     * @param {Object} [options]
     * @param {number} [options.minShare=0]
     * @param {string} [options.sortBy="share"]
     * @param {string} [options.order="desc"]
     * @param {number} [options.limit]
     * @returns {Array<{id:string, label:string, share:number, color:string}>}
     */
    getActivities: function (options) {
      var data = getActivityData();
      if (!data) return [];
      var opts = options || {};
      var minShare = opts.minShare || 0;
      var sortBy = opts.sortBy || "share";
      var order = opts.order || "desc";

      var result = data.nodes.filter(function (n) {
        return n.share >= minShare;
      }).map(function (n) {
        return { id: n.id, label: n.label, share: n.share, color: n.color };
      });

      result.sort(cmp(sortBy, order));
      if (opts.limit && opts.limit > 0) {
        result = result.slice(0, opts.limit);
      }
      return result;
    },

    /**
     * Get all links/chains, optionally filtered.
     * @param {Object} [options]
     * @param {number} [options.minWeight=0]
     * @param {string} [options.sourceMode] - Filter by source mode id
     * @param {string} [options.targetMode] - Filter by target mode id
     * @param {string} [options.dataset="modes"] - "modes" or "activities"
     * @returns {Array<{source:string, target:string, weight:number}>}
     */
    getChains: function (options) {
      var opts = options || {};
      var dataObj = opts.dataset === "activities" ? getActivityData() : getModeData();
      if (!dataObj) return [];
      var minWeight = opts.minWeight || 0;

      return dataObj.links.filter(function (l) {
        var s = linkId(l.source);
        var t = linkId(l.target);
        if (l.weight < minWeight) return false;
        if (opts.sourceMode && s !== opts.sourceMode) return false;
        if (opts.targetMode && t !== opts.targetMode) return false;
        return true;
      }).map(function (l) {
        var result = {
          source: linkId(l.source),
          target: linkId(l.target),
          weight: l.weight
        };
        if (l.mode) result.mode = l.mode;
        if (l.modeColor) result.modeColor = l.modeColor;
        return result;
      });
    },

    /**
     * Get demographic breakdown for a specific dimension and category.
     * Returns mode shares for that group.
     * @param {string} dimension - e.g. "age_group", "area_type", "income"
     * @param {string} category - e.g. "16-24", "Urban", "Under $25K"
     * @returns {Object|null} { dimension, category, modes: [{mode, share}] }
     */
    getDemographic: function (dimension, category) {
      var rows = getDemographicRows();
      if (!rows) return null;
      var modes = [];
      rows.forEach(function (r) {
        if (r.demographic === dimension && r.category === category) {
          modes.push({
            mode: MODE_ID_MAP[r.mode] || r.mode,
            modeRaw: r.mode,
            share: parseFloat(r.share)
          });
        }
      });
      if (modes.length === 0) return null;
      return { dimension: dimension, category: category, modes: modes };
    },

    // ── Queries ──────────────────────────────

    /**
     * Get the mode share for a specific mode.
     * @param {string} modeId - e.g. "car", "walk", "bus"
     * @returns {number|null} Share as a proportion (0-1), or null if not found
     */
    getModeShare: function (modeId) {
      var data = getModeData();
      if (!data) return null;
      for (var i = 0; i < data.nodes.length; i++) {
        if (data.nodes[i].id === modeId) return data.nodes[i].share;
      }
      return null;
    },

    /**
     * Get all modes directly connected to the given mode.
     * @param {string} modeId
     * @returns {Array<{mode:string, weight:number}>}
     */
    getConnectedModes: function (modeId) {
      var data = getModeData();
      if (!data) return [];
      var results = [];
      data.links.forEach(function (l) {
        var s = linkId(l.source);
        var t = linkId(l.target);
        if (s === modeId) results.push({ mode: t, weight: l.weight });
        else if (t === modeId) results.push({ mode: s, weight: l.weight });
      });
      results.sort(function (a, b) { return b.weight - a.weight; });
      return results;
    },

    /**
     * Get the strongest multimodal chain in the dataset.
     * @returns {{source:string, target:string, weight:number}|null}
     */
    getStrongestChain: function () {
      var data = getModeData();
      if (!data || !data.links.length) return null;
      var best = null;
      data.links.forEach(function (l) {
        if (!best || l.weight > best.weight) {
          best = {
            source: linkId(l.source),
            target: linkId(l.target),
            weight: l.weight
          };
        }
      });
      return best;
    },

    /**
     * Compare mode shares between two demographic categories.
     * @param {string} dim - Dimension, e.g. "age_group", "area_type"
     * @param {string} category1 - First category, e.g. "16-24"
     * @param {string} category2 - Second category, e.g. "65+"
     * @returns {{differences: Array, summary: string}|null}
     */
    compareDemographics: function (dim, category1, category2) {
      var d1 = this.getDemographic(dim, category1);
      var d2 = this.getDemographic(dim, category2);
      if (!d1 || !d2) return null;

      // Build share maps
      var map1 = {};
      d1.modes.forEach(function (m) { map1[m.mode] = m.share; });
      var map2 = {};
      d2.modes.forEach(function (m) { map2[m.mode] = m.share; });

      // Collect all modes from both groups
      var allModes = {};
      d1.modes.forEach(function (m) { allModes[m.mode] = true; });
      d2.modes.forEach(function (m) { allModes[m.mode] = true; });

      var differences = [];
      Object.keys(allModes).forEach(function (mode) {
        var share1 = map1[mode] || 0;
        var share2 = map2[mode] || 0;
        var delta = share1 - share2;
        differences.push({
          mode: mode,
          share1: share1,
          share2: share2,
          delta: Math.round(delta * 10000) / 10000
        });
      });

      // Sort by absolute delta descending
      differences.sort(function (a, b) {
        return Math.abs(b.delta) - Math.abs(a.delta);
      });

      // Build summary
      var topDiff = differences[0];
      var direction = topDiff.delta > 0 ? "higher" : "lower";
      var summary = category1 + " has " + direction + " " + topDiff.mode +
        " usage (" + (topDiff.share1 * 100).toFixed(1) + "% vs " +
        (topDiff.share2 * 100).toFixed(1) + "%) compared to " + category2 +
        ". Largest difference: " + (Math.abs(topDiff.delta) * 100).toFixed(1) +
        " percentage points.";

      return { differences: differences, summary: summary };
    },

    /**
     * Find the shortest path between two modes via multimodal chains.
     * Uses BFS on the link graph.
     * @param {string} fromMode
     * @param {string} toMode
     * @returns {{path: string[], totalWeight: number}|null}
     */
    findPath: function (fromMode, toMode) {
      var data = getModeData();
      if (!data) return null;

      var adj = buildAdj(data.links);
      if (!adj[fromMode]) return null;

      // BFS
      var visited = {};
      var parent = {};
      var queue = [fromMode];
      visited[fromMode] = true;
      parent[fromMode] = null;

      while (queue.length > 0) {
        var current = queue.shift();
        if (current === toMode) {
          // Reconstruct path
          var path = [];
          var node = toMode;
          while (node !== null) {
            path.unshift(node);
            node = parent[node];
          }
          // Calculate total weight along path
          var totalWeight = 0;
          for (var i = 0; i < path.length - 1; i++) {
            var neighbors = adj[path[i]] || [];
            for (var j = 0; j < neighbors.length; j++) {
              if (neighbors[j].neighbor === path[i + 1]) {
                totalWeight += neighbors[j].weight;
                break;
              }
            }
          }
          totalWeight = Math.round(totalWeight * 1000) / 1000;
          return { path: path, totalWeight: totalWeight };
        }
        var neighbors = adj[current] || [];
        for (var k = 0; k < neighbors.length; k++) {
          var nb = neighbors[k].neighbor;
          if (!visited[nb]) {
            visited[nb] = true;
            parent[nb] = current;
            queue.push(nb);
          }
        }
      }

      return null; // No path
    },

    // ── Aggregation ─────────────────────────

    /**
     * Compute summary statistics for any array of data items with a
     * `share` property.
     * @param {Array<{share: number}>} data
     * @returns {{count:number, totalShare:number, mean:number, median:number, stddev:number, entropy:number, hhi:number}}
     */
    summarize: function (data) {
      if (!data || data.length === 0) {
        return { count: 0, totalShare: 0, mean: 0, median: 0, stddev: 0, entropy: 0, hhi: 0 };
      }

      var shares = data.map(function (d) { return d.share; });
      var n = shares.length;
      var totalShare = 0;
      shares.forEach(function (s) { totalShare += s; });
      var mean = totalShare / n;

      // Median
      var sorted = shares.slice().sort(function (a, b) { return a - b; });
      var median;
      if (n % 2 === 0) {
        median = (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
      } else {
        median = sorted[Math.floor(n / 2)];
      }

      // Standard deviation
      var sumSqDiff = 0;
      shares.forEach(function (s) {
        var diff = s - mean;
        sumSqDiff += diff * diff;
      });
      var stddev = Math.sqrt(sumSqDiff / n);

      // Shannon entropy (using natural log)
      var entropy = 0;
      shares.forEach(function (s) {
        if (s > 0 && totalShare > 0) {
          var p = s / totalShare;
          entropy -= p * Math.log(p);
        }
      });

      // HHI (Herfindahl-Hirschman Index) -- shares as percentages
      var hhi = 0;
      shares.forEach(function (s) {
        var pct = s * 100;
        hhi += pct * pct;
      });

      return {
        count: n,
        totalShare: Math.round(totalShare * 10000) / 10000,
        mean: Math.round(mean * 10000) / 10000,
        median: Math.round(median * 10000) / 10000,
        stddev: Math.round(stddev * 10000) / 10000,
        entropy: Math.round(entropy * 10000) / 10000,
        hhi: Math.round(hhi * 100) / 100
      };
    },

    // ── Natural Language Query ───────────────

    /**
     * Parse a simple natural language question and return a structured answer.
     *
     * Supported patterns:
     *  - "top N modes"         -> getModes sorted by share, limit N
     *  - "share of X"          -> getModeShare(X)
     *  - "compare X and Y"     -> compareDemographics(...)
     *  - "connections of X"    -> getConnectedModes(X)
     *  - "what connects X"     -> getConnectedModes(X)
     *  - "strongest chain"     -> getStrongestChain()
     *  - "path from X to Y"   -> findPath(X, Y)
     *  - "summary"            -> summarize(getModes())
     *
     * @param {string} questionString
     * @returns {{type:string, question:string, answer:*}|{type:"unknown", question:string, error:string}}
     */
    query: function (questionString) {
      if (!questionString || typeof questionString !== "string") {
        return { type: "unknown", question: "", error: "No question provided" };
      }

      var q = questionString.trim().toLowerCase();

      // "top N modes"
      var topMatch = q.match(/^top\s+(\d+)\s+modes?$/);
      if (topMatch) {
        var n = parseInt(topMatch[1], 10);
        return {
          type: "top_modes",
          question: questionString,
          answer: TravelAPI.getModes({ sortBy: "share", order: "desc", limit: n })
        };
      }

      // "share of X"
      var shareMatch = q.match(/^(?:what\s+is\s+(?:the\s+)?)?share\s+of\s+(\w+)$/);
      if (shareMatch) {
        var modeId = shareMatch[1];
        var share = TravelAPI.getModeShare(modeId);
        return {
          type: "mode_share",
          question: questionString,
          answer: share !== null
            ? { mode: modeId, share: share, percentage: (share * 100).toFixed(1) + "%" }
            : { mode: modeId, share: null, error: "Mode not found" }
        };
      }

      // "compare X and Y"
      var compareMatch = q.match(/^compare\s+(.+?)\s+and\s+(.+)$/);
      if (compareMatch) {
        var cat1 = compareMatch[1].trim();
        var cat2 = compareMatch[2].trim();
        // Try to infer the dimension from the category names
        var dim = TravelAPI._inferDimension(cat1, cat2);
        if (dim) {
          return {
            type: "comparison",
            question: questionString,
            answer: TravelAPI.compareDemographics(dim, cat1, cat2)
          };
        }
        return {
          type: "comparison",
          question: questionString,
          answer: null,
          error: "Could not find demographic categories: " + cat1 + ", " + cat2
        };
      }

      // "connections of X" or "what connects X"
      var connMatch = q.match(/^(?:connections?\s+of|what\s+(?:modes?\s+)?connects?\s+(?:to\s+)?)(\w+)$/);
      if (connMatch) {
        var mId = connMatch[1];
        return {
          type: "connections",
          question: questionString,
          answer: TravelAPI.getConnectedModes(mId)
        };
      }

      // "strongest chain"
      if (q.indexOf("strongest") !== -1 && q.indexOf("chain") !== -1) {
        return {
          type: "strongest_chain",
          question: questionString,
          answer: TravelAPI.getStrongestChain()
        };
      }

      // "path from X to Y"
      var pathMatch = q.match(/^(?:what\s+is\s+(?:the\s+)?)?path\s+from\s+(\w+)\s+to\s+(\w+)$/);
      if (pathMatch) {
        return {
          type: "path",
          question: questionString,
          answer: TravelAPI.findPath(pathMatch[1], pathMatch[2])
        };
      }

      // "summary"
      if (q === "summary" || q === "summarize" || q === "stats") {
        return {
          type: "summary",
          question: questionString,
          answer: TravelAPI.summarize(TravelAPI.getModes())
        };
      }

      return {
        type: "unknown",
        question: questionString,
        error: "Could not parse question. Try: 'top 3 modes', 'share of car', 'compare Urban and Rural', 'connections of walk', 'strongest chain', 'path from bicycle to bus'"
      };
    },

    /**
     * Infer the demographic dimension from category names.
     * @private
     */
    _inferDimension: function (cat1, cat2) {
      var rows = getDemographicRows();
      if (!rows) return null;

      // Normalize inputs for case-insensitive matching
      var c1Lower = cat1.toLowerCase();
      var c2Lower = cat2.toLowerCase();

      // Build a map of dimension -> categories (lowercase)
      var dimCats = {};
      rows.forEach(function (r) {
        if (!dimCats[r.demographic]) dimCats[r.demographic] = {};
        dimCats[r.demographic][r.category.toLowerCase()] = r.category;
      });

      // Find which dimension contains both categories
      var dims = Object.keys(dimCats);
      for (var i = 0; i < dims.length; i++) {
        var dim = dims[i];
        if (dimCats[dim][c1Lower] && dimCats[dim][c2Lower]) {
          // Update cat names to their actual casing
          return dim;
        }
      }
      return null;
    },

    /**
     * Helper to resolve original-case category names from lowercase input.
     * @private
     */
    _resolveCategoryCase: function (dim, catLower) {
      var rows = getDemographicRows();
      if (!rows) return catLower;
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].demographic === dim && rows[i].category.toLowerCase() === catLower.toLowerCase()) {
          return rows[i].category;
        }
      }
      return catLower;
    },

    // ── Export ───────────────────────────────

    /**
     * Get all data as a single structured JSON object.
     * @returns {Object}
     */
    toJSON: function () {
      var modeData = getModeData();
      var activityData = getActivityData();
      var demoRows = getDemographicRows();

      var result = {
        metadata: {
          version: TravelAPI.version,
          dataSource: TravelAPI.dataSource,
          lastUpdated: TravelAPI.lastUpdated
        },
        modes: null,
        activities: null,
        demographics: null
      };

      if (modeData) {
        result.modes = {
          nodes: modeData.nodes.map(function (n) {
            return { id: n.id, label: n.label, share: n.share, color: n.color };
          }),
          links: modeData.links.map(function (l) {
            return { source: linkId(l.source), target: linkId(l.target), weight: l.weight };
          })
        };
      }

      if (activityData) {
        result.activities = {
          nodes: activityData.nodes.map(function (n) {
            return { id: n.id, label: n.label, share: n.share, color: n.color };
          }),
          links: activityData.links.map(function (l) {
            var link = { source: linkId(l.source), target: linkId(l.target), weight: l.weight };
            if (l.mode) link.mode = l.mode;
            return link;
          })
        };
      }

      if (demoRows) {
        result.demographics = demoRows.map(function (r) {
          return { demographic: r.demographic, category: r.category, mode: r.mode, share: r.share };
        });
      }

      return result;
    },

    /**
     * Get data as a CSV string.
     * @param {string} tableName - "modes", "chains", "activities", or "demographics"
     * @returns {string}
     */
    toCSV: function (tableName) {
      var lines = [];

      if (tableName === "modes") {
        lines.push("id,label,share,color");
        var modes = TravelAPI.getModes({ sortBy: "share", order: "desc" });
        modes.forEach(function (m) {
          lines.push(csvEscape(m.id) + "," + csvEscape(m.label) + "," + m.share + "," + csvEscape(m.color));
        });
      } else if (tableName === "chains") {
        lines.push("source,target,weight");
        var chains = TravelAPI.getChains();
        chains.forEach(function (c) {
          lines.push(csvEscape(c.source) + "," + csvEscape(c.target) + "," + c.weight);
        });
      } else if (tableName === "activities") {
        lines.push("id,label,share,color");
        var activities = TravelAPI.getActivities({ sortBy: "share", order: "desc" });
        activities.forEach(function (a) {
          lines.push(csvEscape(a.id) + "," + csvEscape(a.label) + "," + a.share + "," + csvEscape(a.color));
        });
      } else if (tableName === "demographics") {
        lines.push("dimension,category,mode,share");
        var rows = getDemographicRows();
        if (rows) {
          rows.forEach(function (r) {
            lines.push(csvEscape(r.demographic) + "," + csvEscape(r.category) + "," + csvEscape(r.mode) + "," + r.share);
          });
        }
      } else {
        return "Error: tableName must be one of: modes, chains, activities, demographics";
      }

      return lines.join("\n");
    }
  };

  // ── Export for browser and Node.js ─────────
  if (typeof module !== "undefined" && module.exports) {
    module.exports = TravelAPI;
  } else {
    root.TravelAPI = TravelAPI;
  }

})(typeof window !== "undefined" ? window : (typeof global !== "undefined" ? global : this));
