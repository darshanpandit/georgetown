# Travel Molecule -- System Architecture

This document describes the module structure, data flow, design decisions, and extension points of the Travel Molecule visualization.

---

## Module Dependency Graph

```
travel-molecule-data.js          (no dependencies -- raw data)
        |
        v
data-loader.js                   (no dependencies -- CSV/JSON parsing)
        |
        v
demographics.js                  (depends on: DataLoader)
        |
        v
+-------+--------+--------+--------+--------+--------+--------+
|       |        |        |        |        |        |        |
v       v        v        v        v        v        v        v
travel  sankey   chord    bar      heatmap  stats    filter   api.js
-mol.js -view.js -view.js -chart   -view.js -panel   -ctrl.js
                          -view.js          .js
+-------+--------+--------+--------+--------+--------+--------+
        |
        v
+-------+--------+--------+--------+--------+
|       |        |        |        |        |
v       v        v        v        v        v
keyboard story   annota   export   url      travel-
-nav.js  -mode   -tions   .js      -state   molecule
         .js     .js               .js      .html
```

### Dependency Details

| Module | Depends On | Depended On By |
|---|---|---|
| `travel-molecule-data.js` | -- | All views, API, Stats, Filters |
| `data-loader.js` | -- | Demographics, HTML (file upload) |
| `demographics.js` | DataLoader | HTML, BarChartView, API |
| `travel-molecule.js` | D3.js, data | HTML (main orchestrator) |
| `sankey-view.js` | D3.js, data | HTML |
| `chord-view.js` | D3.js, data | HTML |
| `bar-chart-view.js` | D3.js, Demographics | HTML |
| `heatmap-view.js` | D3.js, data | HTML |
| `stats-panel.js` | -- | HTML |
| `filter-controls.js` | -- | HTML |
| `keyboard-nav.js` | -- | HTML |
| `story-mode.js` | D3.js | HTML |
| `annotations.js` | D3.js | HTML |
| `export.js` | -- | HTML |
| `url-state.js` | -- | HTML |
| `api.js` | data, Demographics | External consumers |

---

## Data Flow

```
                     CSV Files                    Embedded JS
                  (data/*.csv)              (travel-molecule-data.js)
                       |                              |
                       v                              v
                  DataLoader.loadCSV()      MODE_MOLECULE_DATA
                  DataLoader.parseCSV()     ACTIVITY_MOLECULE_DATA
                       |                              |
                       v                              v
                  DataLoader.buildModeData()    Direct use by views
                  DataLoader.buildActivityData()
                       |                              |
                       +---------- merge -------------+
                                    |
                                    v
                          { nodes, links }
                         (molecule format)
                                    |
                    +---------------+---------------+
                    |               |               |
                    v               v               v
              Force Graph      Sankey View     Chord View
              (molecule)       (flows)         (transfers)
                    |
                    v
              User Interactions
              (hover, click, drag, filter)
                    |
                    v
              FilterControls.apply()
              Demographics.buildMoleculeForCategory()
                    |
                    v
              switchDataset() -- updates the active view
                    |
                    v
              StatsPanel.update() -- recomputes metrics
              UrlState.save() -- updates shareable URL
```

### Data Format at Each Stage

1. **Raw CSV** -- Text with headers, parsed by `DataLoader.parseCSV()`
2. **Parsed rows** -- `Array<Object>` with string/number values
3. **Molecule format** -- `{title, subtitle, nodes: [{id, label, share, color}], links: [{source, target, weight}]}`
4. **D3 simulation data** -- Same as molecule format but with `x`, `y`, `vx`, `vy`, `fx`, `fy` added to nodes; `source`/`target` become object references.

### URL Parameter Data Loading

The HTML page supports three URL-driven loading modes:

| Parameter | Behavior |
|---|---|
| `?data=<url>` | Load a complete JSON dataset from a URL |
| `?modes=<url>&chains=<url>` | Load two CSV files for modes and chains |
| `?source=csv` | Load from the default `data/` directory CSVs |
| (none) | Use embedded data from `travel-molecule-data.js` |

---

## View System

The application has four visualization views, switched by the toggle bar:

| View | Module | Data Input | Key Feature |
|---|---|---|---|
| Mode Molecule | `travel-molecule.js` | `MODE_MOLECULE_DATA` | Force-directed graph with draggable nodes |
| Activity Molecule | `travel-molecule.js` | `ACTIVITY_MOLECULE_DATA` | Same engine, colored links by mode |
| Sankey Flow | `sankey-view.js` | Both datasets | Purpose-to-mode flows |
| Chord Diagram | `chord-view.js` | `MODE_MOLECULE_DATA` | Mode transfer matrix |

Two additional views are available but not wired into the toggle bar:

| View | Module | Data Input |
|---|---|---|
| Bar Chart | `bar-chart-view.js` | Demographics CSV |
| Heatmap | `heatmap-view.js` | Both datasets |

### View Lifecycle

1. `switchTo(view)` is called from the toggle bar or keyboard shortcut
2. Previous non-molecule views call `.destroy()` to clean up SVG and tooltips
3. For molecule views: `switchDataset(data)` fades out and rebuilds the force graph
4. For other views: the container is cleared and the new view calls `.init()`

---

## Extension Points

### Adding a New View

1. Create `js/my-view.js` following the pattern:

```javascript
(function () {
  "use strict";
  
  window.MyView = {
    init: function (containerId, data) {
      // Create SVG, bindings, render
    },
    destroy: function () {
      // Remove SVG, tooltips, event listeners
    },
    resize: function () {
      // Handle container resize (often a no-op with viewBox)
    }
  };
})();
```

2. Add a `<script>` tag in `travel-molecule.html`
3. Add a toggle button in the `.toggle-bar` div
4. Add a case in the `switchTo()` function
5. Add a keyboard shortcut in `keyboard-nav.js`

### Adding a New Analysis Module

1. Create `js/my-analysis.js` exposing `window.MyAnalysis`
2. Methods should accept molecule-format data and return plain objects
3. Keep DOM interaction separate from computation
4. Add a `<script>` tag in the HTML

### Adding a New Data Source

1. Prepare CSV or JSON following the format in [DATA-FORMAT.md](DATA-FORMAT.md)
2. For CSV: create loader methods in `DataLoader` or use existing `loadCSV`/`buildModeData`
3. For JSON: load via `?data=<url>` or file upload
4. Validate with `DataLoader.validate(data)`

### Adding a New Demographic Dimension

1. Add rows to `nhts-2017-demographics.csv` with the new dimension name:
   ```csv
   gender,Male,car,0.84
   gender,Male,walk,0.09
   gender,Female,car,0.82
   gender,Female,walk,0.12
   ```
2. Add a human-readable label in `demographics.js` `DIMENSION_LABELS`:
   ```javascript
   var DIMENSION_LABELS = {
     age_group: "Age Group",
     area_type: "Area Type",
     income: "Income",
     gender: "Gender"
   };
   ```
3. The UI dropdown will automatically pick up the new dimension.

---

## Design Decisions and Tradeoffs

### Embedded Data vs. Server

The default dataset is embedded directly in `travel-molecule-data.js` as JavaScript variables. This allows the visualization to work as a single HTML file without a web server.

**Tradeoff:** Larger initial page load, but zero deployment complexity. CSV loading is available for larger or dynamic datasets.

### D3 v4

The project uses D3 v4 (loaded from CDN with SRI integrity hash). D3 v4 was chosen for broad browser compatibility and because the force simulation API is stable.

**Tradeoff:** Missing some D3 v7 conveniences, but avoids breaking changes and works in older browsers.

### IIFE Module Pattern

All modules use the immediately-invoked function expression (IIFE) pattern with `window.*` exports rather than ES modules.

**Tradeoff:** No build step required and works directly in browsers. Sacrifices tree-shaking and static analysis, but keeps the project deployable by opening a single HTML file.

### Force Simulation for Layout

The molecule view uses D3's force simulation with charge, link, center, and collision forces. Node sizes scale with `d3.scaleSqrt()` to map share to visual area.

**Tradeoff:** Organic-looking layouts that respond to data changes, but non-deterministic -- nodes settle in different positions each load. The simulation uses bounded coordinates to keep nodes on-screen.

### Synthetic Sankey Flows

The Sankey view generates flows by multiplying purpose shares by mode shares with hand-tuned multipliers, rather than using actual cross-tabulation data.

**Tradeoff:** Plausible-looking flows without requiring a full trip-purpose-by-mode matrix. If real cross-tabulation data is available, the `buildFlowData` function should be replaced.

### Responsive SVG via viewBox

All views use `viewBox` with percentage width rather than fixed pixel dimensions. This provides automatic responsiveness without resize event handlers.

### Statistics as Pure Functions

`StatsPanel.compute()` is a pure function that takes data and returns a stats object. This separates computation from rendering and makes it usable by the API module.

---

## File Structure

```
georgetown/
  travel-molecule.html     -- Main entry point
  css/
    travel-molecule.css    -- All styles
  js/
    travel-molecule-data.js  -- Embedded NHTS data
    data-loader.js           -- CSV/JSON loading and parsing
    travel-molecule.js       -- Force-directed molecule view
    sankey-view.js           -- Sankey flow diagram
    chord-view.js            -- Chord diagram
    bar-chart-view.js        -- Stacked bar chart
    heatmap-view.js          -- Purpose-mode heatmap
    stats-panel.js           -- Statistics sidebar
    filter-controls.js       -- Interactive filters
    demographics.js          -- Demographic data loading
    keyboard-nav.js          -- Keyboard shortcuts
    story-mode.js            -- Guided tour
    annotations.js           -- User annotations
    export.js                -- SVG/PNG/CSV/JSON export
    url-state.js             -- Shareable URL state
    api.js                   -- Programmatic data API
  data/
    schema.json              -- JSON Schema definition
    nhts-2017-modes.csv      -- Mode share data
    nhts-2017-mode-chains.csv      -- Multimodal chain data
    nhts-2017-activities.csv       -- Activity share data
    nhts-2017-activity-chains.csv  -- Activity chain data
    nhts-2017-demographics.csv     -- Demographic breakdowns
  docs/
    API.md                   -- This API reference
    DATA-FORMAT.md           -- Data format documentation
    ARCHITECTURE.md          -- This architecture document
```
