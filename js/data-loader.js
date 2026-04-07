// ─────────────────────────────────────────────
//  DataLoader — loads CSV/JSON data and converts
//  to molecule format for the Travel Molecule viz
// ─────────────────────────────────────────────

(function() {
  "use strict";

  window.DataLoader = {

    /**
     * Parse CSV text into an array of objects keyed by header row.
     * Handles quoted fields (including commas and newlines inside quotes),
     * empty lines, and trailing newlines.
     */
    parseCSV: function(text) {
      if (!text || typeof text !== "string") return [];

      // Normalise line endings and trim trailing whitespace
      text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n+$/, "");

      var lines = DataLoader._splitCSVLines(text);
      if (lines.length < 2) return [];

      var headers = DataLoader._parseCSVRow(lines[0]);
      var results = [];

      for (var i = 1; i < lines.length; i++) {
        var line = lines[i].trim();
        if (line === "") continue;

        var values = DataLoader._parseCSVRow(lines[i]);
        var obj = {};
        for (var h = 0; h < headers.length; h++) {
          var key = headers[h].trim();
          var val = h < values.length ? values[h].trim() : "";
          // Auto-convert numeric strings
          if (val !== "" && !isNaN(val) && val !== "") {
            obj[key] = Number(val);
          } else {
            obj[key] = val;
          }
        }
        results.push(obj);
      }

      return results;
    },

    /**
     * Split CSV text into logical lines, respecting quoted fields that
     * may contain newline characters.
     */
    _splitCSVLines: function(text) {
      var lines = [];
      var current = "";
      var inQuotes = false;

      for (var i = 0; i < text.length; i++) {
        var ch = text[i];
        if (ch === '"') {
          inQuotes = !inQuotes;
          current += ch;
        } else if (ch === "\n" && !inQuotes) {
          lines.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
      if (current !== "") lines.push(current);
      return lines;
    },

    /**
     * Parse a single CSV row into an array of field values.
     * Handles double-quoted fields and escaped quotes ("").
     */
    _parseCSVRow: function(row) {
      var fields = [];
      var field = "";
      var inQuotes = false;

      for (var i = 0; i < row.length; i++) {
        var ch = row[i];

        if (inQuotes) {
          if (ch === '"') {
            if (i + 1 < row.length && row[i + 1] === '"') {
              // Escaped quote
              field += '"';
              i++;
            } else {
              // End of quoted field
              inQuotes = false;
            }
          } else {
            field += ch;
          }
        } else {
          if (ch === '"') {
            inQuotes = true;
          } else if (ch === ",") {
            fields.push(field);
            field = "";
          } else {
            field += ch;
          }
        }
      }
      fields.push(field);
      return fields;
    },

    // ── Remote loading ─────────────────────────

    /**
     * Load a CSV file via fetch and return parsed array of objects.
     */
    loadCSV: function(url) {
      return fetch(url)
        .then(function(r) {
          if (!r.ok) throw new Error("Failed to load " + url + ": " + r.status);
          return r.text();
        })
        .then(function(text) { return DataLoader.parseCSV(text); });
    },

    /**
     * Load a JSON file via fetch.
     */
    loadJSON: function(url) {
      return fetch(url)
        .then(function(r) {
          if (!r.ok) throw new Error("Failed to load " + url + ": " + r.status);
          return r.json();
        });
    },

    // ── Data builders ──────────────────────────

    /**
     * Convert mode CSV rows into the molecule data format expected by
     * initMolecule / switchDataset.
     */
    buildModeData: function(modeRows, chainRows) {
      return {
        title: "Mode Molecule",
        subtitle: "NHTS " + (modeRows[0].year || "2017") +
                  " — node size = mode share, bonds = multimodal trip chains",
        nodes: modeRows.map(function(r) {
          return {
            id:    r.mode_id,
            label: r.mode_label,
            share: parseFloat(r.mode_share),
            color: r.color
          };
        }),
        links: chainRows.map(function(r) {
          return {
            source: r.source_mode,
            target: r.target_mode,
            weight: parseFloat(r.chain_weight)
          };
        })
      };
    },

    /**
     * Convert activity CSV rows into the molecule data format.
     */
    buildActivityData: function(activityRows, chainRows) {
      return {
        title: "Activity Molecule",
        subtitle: "Daily activity chains — edges colored by dominant transport mode",
        nodes: activityRows.map(function(r) {
          return {
            id:    r.activity_id,
            label: r.activity_label,
            share: parseFloat(r.trip_share),
            color: r.color
          };
        }),
        links: chainRows.map(function(r) {
          return {
            source:    r.source_activity,
            target:    r.target_activity,
            weight:    parseFloat(r.chain_weight),
            mode:      r.dominant_mode,
            modeColor: r.mode_color
          };
        })
      };
    },

    // ── Composite loaders ──────────────────────

    /**
     * Load a complete NHTS dataset from the given base directory.
     * Expects four CSV files following the naming convention below.
     * Returns a Promise resolving to { modes: {...}, activities: {...} }.
     */
    loadNHTS: function(basePath) {
      basePath = basePath || "data";
      return Promise.all([
        DataLoader.loadCSV(basePath + "/nhts-2017-modes.csv"),
        DataLoader.loadCSV(basePath + "/nhts-2017-mode-chains.csv"),
        DataLoader.loadCSV(basePath + "/nhts-2017-activities.csv"),
        DataLoader.loadCSV(basePath + "/nhts-2017-activity-chains.csv")
      ]).then(function(results) {
        return {
          modes:      DataLoader.buildModeData(results[0], results[1]),
          activities: DataLoader.buildActivityData(results[2], results[3])
        };
      });
    },

    /**
     * Load from a user-provided File object (drag-and-drop or file input).
     * JSON files are parsed as JSON; everything else is treated as CSV.
     */
    loadFromFile: function(file) {
      return new Promise(function(resolve, reject) {
        var reader = new FileReader();
        reader.onload = function(e) {
          try {
            if (file.name.endsWith(".json")) {
              resolve(JSON.parse(e.target.result));
            } else {
              resolve(DataLoader.parseCSV(e.target.result));
            }
          } catch (err) {
            reject(err);
          }
        };
        reader.onerror = reject;
        reader.readAsText(file);
      });
    },

    // ── Validation ─────────────────────────────

    /**
     * Validate that a data object matches the molecule data structure.
     * Returns { valid: Boolean, errors: String[] }.
     */
    validate: function(data) {
      var errors = [];

      if (!data || typeof data !== "object") {
        return { valid: false, errors: ["Data must be a non-null object"] };
      }

      if (!data.nodes || !Array.isArray(data.nodes)) {
        errors.push("Missing or invalid 'nodes' array");
      }
      if (!data.links || !Array.isArray(data.links)) {
        errors.push("Missing or invalid 'links' array");
      }

      if (data.nodes && Array.isArray(data.nodes)) {
        data.nodes.forEach(function(n, i) {
          if (!n.id) errors.push("Node " + i + " missing 'id'");
          if (typeof n.share !== "number" || isNaN(n.share)) {
            errors.push("Node " + (n.id || i) + " missing numeric 'share'");
          }
        });
      }

      if (data.links && Array.isArray(data.links)) {
        var nodeIds = {};
        (data.nodes || []).forEach(function(n) { nodeIds[n.id] = true; });

        data.links.forEach(function(l, i) {
          if (!nodeIds[l.source]) {
            errors.push("Link " + i + " references unknown source: " + l.source);
          }
          if (!nodeIds[l.target]) {
            errors.push("Link " + i + " references unknown target: " + l.target);
          }
        });
      }

      return { valid: errors.length === 0, errors: errors };
    }
  };
})();
