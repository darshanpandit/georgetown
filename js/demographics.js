// ─────────────────────────────────────────────
//  Demographics — loads NHTS demographic breakdown
//  data and builds per-category molecule datasets
// ─────────────────────────────────────────────

(function() {
  "use strict";

  // Map CSV mode identifiers to molecule node IDs
  var MODE_ID_MAP = {
    car:         "car",
    walk:        "walk",
    transit_bus: "bus",
    subway_rail: "subway",
    bicycle:     "bicycle",
    other:       "other"
  };

  // Human-readable labels for dimension names
  var DIMENSION_LABELS = {
    age_group: "Age Group",
    area_type: "Area Type",
    income:    "Income"
  };

  window.Demographics = {
    data: null,

    /**
     * Load demographic CSV data.
     * @param {string} [path] — URL/path to the CSV file
     * @returns {Promise<Array>} parsed rows
     */
    load: function(path) {
      path = path || "data/nhts-2017-demographics.csv";
      return DataLoader.loadCSV(path).then(function(rows) {
        Demographics.data = rows;
        return rows;
      });
    },

    /**
     * Get available demographic dimensions (e.g. age_group, area_type, income).
     * @returns {string[]}
     */
    getDimensions: function() {
      if (!this.data) return [];
      var dims = {};
      this.data.forEach(function(r) { dims[r.demographic] = true; });
      return Object.keys(dims);
    },

    /**
     * Human-readable label for a dimension key.
     * @param {string} dimension
     * @returns {string}
     */
    getDimensionLabel: function(dimension) {
      return DIMENSION_LABELS[dimension] || dimension;
    },

    /**
     * Get categories for a dimension (e.g. ["16-24", "25-44", "45-64", "65+"]).
     * @param {string} dimension
     * @returns {string[]}
     */
    getCategories: function(dimension) {
      if (!this.data) return [];
      var cats = [];
      this.data.forEach(function(r) {
        if (r.demographic === dimension && cats.indexOf(r.category) === -1) {
          cats.push(r.category);
        }
      });
      return cats;
    },

    /**
     * Build molecule data for a specific demographic + category.
     * Starts from baseData (MODE_MOLECULE_DATA) and overrides node shares
     * with demographic-specific values, then scales link weights proportionally.
     *
     * @param {string} dimension  — e.g. "age_group"
     * @param {string} category   — e.g. "16-24"
     * @param {Object} baseData   — MODE_MOLECULE_DATA or equivalent
     * @returns {Object} molecule data { title, subtitle, nodes, links }
     */
    buildMoleculeForCategory: function(dimension, category, baseData) {
      if (!this.data || !baseData) return baseData;

      // Collect demographic shares keyed by CSV mode name
      var demoShares = {};
      this.data.forEach(function(r) {
        if (r.demographic === dimension && r.category === category) {
          demoShares[r.mode] = parseFloat(r.share);
        }
      });

      // Build share lookup keyed by node id
      var shareByNodeId = {};
      Object.keys(demoShares).forEach(function(csvMode) {
        var nodeId = MODE_ID_MAP[csvMode] || csvMode;
        shareByNodeId[nodeId] = demoShares[csvMode];
      });

      // Build base share lookup for ratio calculations
      var baseShareById = {};
      baseData.nodes.forEach(function(n) {
        baseShareById[n.id] = n.share;
      });

      // Clone nodes, overriding shares where demographic data exists
      var nodes = baseData.nodes.map(function(n) {
        var clone = {
          id:    n.id,
          label: n.label,
          share: shareByNodeId[n.id] !== undefined ? shareByNodeId[n.id] : n.share,
          color: n.color
        };
        return clone;
      });

      // Filter out nodes with zero or missing share
      var activeIds = {};
      nodes.forEach(function(n) { if (n.share > 0) activeIds[n.id] = true; });

      // Clone links — scale weight proportionally to how the endpoint shares changed
      var links = [];
      baseData.links.forEach(function(l) {
        var srcId = typeof l.source === "object" ? l.source.id : l.source;
        var tgtId = typeof l.target === "object" ? l.target.id : l.target;

        if (!activeIds[srcId] || !activeIds[tgtId]) return;

        var srcRatio = (shareByNodeId[srcId] !== undefined && baseShareById[srcId])
          ? shareByNodeId[srcId] / baseShareById[srcId] : 1;
        var tgtRatio = (shareByNodeId[tgtId] !== undefined && baseShareById[tgtId])
          ? shareByNodeId[tgtId] / baseShareById[tgtId] : 1;
        var scale = Math.sqrt(srcRatio * tgtRatio);

        links.push({
          source: srcId,
          target: tgtId,
          weight: Math.round(l.weight * scale * 1000) / 1000
        });
      });

      var dimLabel = Demographics.getDimensionLabel(dimension);
      return {
        title: "Mode Molecule",
        subtitle: dimLabel + ": " + category +
                  " — node size = mode share, bonds = multimodal trip chains",
        nodes: nodes,
        links: links
      };
    },

    /**
     * Build comparison data showing all categories for a dimension.
     * @param {string} dimension
     * @param {Object} baseData — MODE_MOLECULE_DATA or equivalent
     * @returns {Array<{category: string, nodes: Array, links: Array}>}
     */
    getComparison: function(dimension, baseData) {
      var cats = this.getCategories(dimension);
      var self = this;
      return cats.map(function(cat) {
        var data = self.buildMoleculeForCategory(dimension, cat, baseData);
        return {
          category: cat,
          nodes: data.nodes,
          links: data.links
        };
      });
    }
  };
})();
