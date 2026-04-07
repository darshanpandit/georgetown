# Travel Molecule -- API Reference

Complete reference for every public module in the Travel Molecule visualization system.

---

## TravelAPI (`js/api.js`)

Programmatic data API for querying NHTS travel data without DOM interaction. Works in browser (`window.TravelAPI`) and Node.js (`require('./js/api.js')`).

### Metadata

| Property | Value |
|---|---|
| `TravelAPI.version` | `"1.0.0"` |
| `TravelAPI.dataSource` | `"NHTS 2017"` |
| `TravelAPI.lastUpdated` | `"2026-04-07"` |

### Data Access

#### `getModes(options?)`

Returns all transportation modes with their shares.

**Parameters:**
- `options.minShare` (number, default `0`) -- Minimum share threshold
- `options.sortBy` (string, default `"share"`) -- `"share"` or `"label"`
- `options.order` (string, default `"desc"`) -- `"desc"` or `"asc"`
- `options.limit` (number) -- Maximum results to return

**Returns:** `Array<{id, label, share, color}>`

```javascript
TravelAPI.getModes({ minShare: 0.01, limit: 3 });
// [{ id: "car", label: "Car", share: 0.833, color: "#4a9eff" }, ...]
```

#### `getActivities(options?)`

Returns all activity types with their trip shares. Same options as `getModes`.

**Returns:** `Array<{id, label, share, color}>`

#### `getChains(options?)`

Returns multimodal trip chains, optionally filtered.

**Parameters:**
- `options.minWeight` (number, default `0`) -- Minimum chain weight
- `options.sourceMode` (string) -- Filter by source mode id
- `options.targetMode` (string) -- Filter by target mode id
- `options.dataset` (string, default `"modes"`) -- `"modes"` or `"activities"`

**Returns:** `Array<{source, target, weight}>`

```javascript
TravelAPI.getChains({ sourceMode: "car", minWeight: 0.05 });
```

#### `getDemographic(dimension, category)`

Returns mode shares for a specific demographic group.

**Parameters:**
- `dimension` (string) -- `"age_group"`, `"area_type"`, or `"income"`
- `category` (string) -- e.g. `"16-24"`, `"Urban"`, `"Under $25K"`

**Returns:** `{dimension, category, modes: [{mode, share}]}` or `null`

### Queries

#### `getModeShare(modeId)`

Returns the share for a single mode. Returns `null` if mode not found.

```javascript
TravelAPI.getModeShare("car"); // 0.833
```

#### `getConnectedModes(modeId)`

Returns modes directly connected via multimodal chains.

**Returns:** `Array<{mode, weight}>` sorted by weight descending.

#### `getStrongestChain()`

Returns the chain with the highest weight.

**Returns:** `{source, target, weight}`

#### `compareDemographics(dim, category1, category2)`

Compares mode shares between two demographic categories.

**Returns:** `{differences: [{mode, share1, share2, delta}], summary: string}`

```javascript
TravelAPI.compareDemographics("age_group", "16-24", "65+");
// { differences: [...], summary: "16-24 has lower car usage..." }
```

#### `findPath(fromMode, toMode)`

Finds the shortest path between two modes in the chain graph (BFS).

**Returns:** `{path: string[], totalWeight: number}` or `null`

```javascript
TravelAPI.findPath("bicycle", "bus");
// { path: ["bicycle", "walk", "bus"], totalWeight: 0.4 }
```

### Aggregation

#### `summarize(data)`

Computes summary statistics for any array of items with a `share` property.

**Returns:** `{count, totalShare, mean, median, stddev, entropy, hhi}`

### Natural Language Query

#### `query(questionString)`

Parses a simple natural language question and returns a structured answer.

**Supported patterns:**
- `"top 3 modes"` -- calls `getModes` with limit
- `"share of car"` -- calls `getModeShare`
- `"compare Urban and Rural"` -- calls `compareDemographics`
- `"connections of walk"` -- calls `getConnectedModes`
- `"strongest chain"` -- calls `getStrongestChain`
- `"path from bicycle to bus"` -- calls `findPath`
- `"summary"` -- calls `summarize`

**Returns:** `{type, question, answer}` or `{type: "unknown", error: string}`

### Export

#### `toJSON()`

Returns the complete dataset as a structured JSON object.

#### `toCSV(tableName)`

Returns data as a CSV string.

**Parameters:**
- `tableName` -- `"modes"`, `"chains"`, `"activities"`, or `"demographics"`

---

## DataLoader (`js/data-loader.js`)

Handles loading and parsing CSV/JSON data files into the molecule data format.

### Methods

#### `parseCSV(text)`

Parses CSV text into an array of objects keyed by header row. Handles quoted fields, escaped quotes, and newlines inside quotes.

**Parameters:**
- `text` (string) -- Raw CSV text

**Returns:** `Array<Object>`

#### `loadCSV(url)`

Loads a CSV file via `fetch` and returns parsed objects.

**Returns:** `Promise<Array<Object>>`

#### `loadJSON(url)`

Loads a JSON file via `fetch`.

**Returns:** `Promise<Object>`

#### `buildModeData(modeRows, chainRows)`

Converts mode CSV rows into the molecule data format.

**Returns:** `{title, subtitle, nodes: [{id, label, share, color}], links: [{source, target, weight}]}`

#### `buildActivityData(activityRows, chainRows)`

Converts activity CSV rows into the molecule data format.

**Returns:** `{title, subtitle, nodes, links}` -- links include `mode` and `modeColor` properties.

#### `loadNHTS(basePath?)`

Loads a complete NHTS dataset from four CSV files. Default `basePath` is `"data"`.

**Returns:** `Promise<{modes, activities}>`

#### `loadFromFile(file)`

Loads data from a `File` object (drag-and-drop or file input). JSON files are parsed as JSON; others as CSV.

**Returns:** `Promise<Object|Array>`

#### `validate(data)`

Validates that a data object matches the molecule data structure.

**Returns:** `{valid: boolean, errors: string[]}`

---

## StatsPanel (`js/stats-panel.js`)

Collapsible statistics sidebar showing network metrics.

### Methods

#### `compute(data)`

Computes statistics for a molecule dataset.

**Parameters:**
- `data` -- `{nodes, links}` molecule data

**Returns:** `{totalNodes, totalLinks, top3, avgWeight, density, maxDegreeNode, maxDegree, strongestLabel, strongestWeight, hhi, gini}`

#### `render(stats, container)`

Renders computed stats into a DOM container element.

#### `toggle()`

Toggles the stats panel open/closed.

#### `update(data)`

Shorthand: computes stats and renders them into `#stats-panel`.

---

## FilterControls (`js/filter-controls.js`)

Interactive filter panel for the visualization.

### State

```javascript
FilterControls.state = {
  minShare: 0,        // Minimum node share threshold (0-1)
  minWeight: 0,       // Minimum link weight threshold (0-1)
  selectedNodes: [],  // Array of selected node IDs (empty = all)
  searchQuery: ""     // Text filter on node labels
};
```

### Methods

#### `init(container, data, onFilter)`

Builds the filter panel UI and binds event handlers.

**Parameters:**
- `container` (Element) -- DOM element for the panel
- `data` -- Molecule dataset
- `onFilter` (function) -- Callback receiving the filtered dataset

#### `apply(data)`

Applies current filter state to a dataset and returns the filtered copy.

**Returns:** `{title, subtitle, nodes, links}`

#### `updateNodes(data)`

Updates the checkbox list when the dataset changes.

#### `reset()`

Resets all filters to their default state.

---

## Demographics (`js/demographics.js`)

Loads NHTS demographic breakdown data and builds per-category molecule datasets.

### Methods

#### `load(path?)`

Loads the demographics CSV file. Default path: `"data/nhts-2017-demographics.csv"`.

**Returns:** `Promise<Array>`

#### `getDimensions()`

Returns available dimensions (e.g. `["age_group", "area_type", "income"]`).

#### `getDimensionLabel(dimension)`

Returns a human-readable label (e.g. `"age_group"` becomes `"Age Group"`).

#### `getCategories(dimension)`

Returns categories for a dimension (e.g. `["16-24", "25-44", "45-64", "65+"]`).

#### `buildMoleculeForCategory(dimension, category, baseData)`

Builds molecule data with shares overridden for the given demographic group. Link weights are scaled proportionally.

**Returns:** `{title, subtitle, nodes, links}`

#### `getComparison(dimension, baseData)`

Returns data for all categories in a dimension.

**Returns:** `Array<{category, nodes, links}>`

---

## ExportTools (`js/export.js`)

Export the visualization as SVG, PNG, CSV, or JSON.

### Methods

#### `exportSVG(svgElement?, filename?)`

Exports the current SVG with inlined styles as a downloadable `.svg` file.

#### `exportPNG(svgElement?, filename?, scale?)`

Exports the SVG as a rasterized PNG. Default `scale` is 2 (retina).

#### `exportDataCSV(data?, filename?)`

Exports node and link data as a CSV file.

#### `exportDataJSON(data?, filename?)`

Exports data as pretty-printed JSON, cleaning up D3 simulation properties.

---

## UrlState (`js/url-state.js`)

Manages shareable URL state via the URL hash.

### Methods

#### `save(state)`

Encodes state to the URL hash.

#### `encode(state)`

Encodes a state object to a query-string format.

**Parameters:**
- `state.view` (string) -- `"mode"`, `"activity"`, `"sankey"`, `"chord"`
- `state.filters` (object) -- `{minShare, minWeight}`
- `state.demographic` (object) -- `{dimension, category}`
- `state.selected` (string[]) -- Selected node IDs

#### `decode()`

Decodes the URL hash back to a state object.

#### `apply(state)`

Applies a decoded state object to the visualization (switches view, sets filters, demographics, selection).

#### `getCurrentState()`

Reads the current visualization state from the DOM.

#### `getShareURL(state?)`

Returns a full shareable URL.

#### `copyShareURL(state?)`

Copies the share URL to the clipboard and shows a toast notification.

---

## StoryMode (`js/story-mode.js`)

Guided tour of the visualization with 9 narrated steps.

### Methods

#### `start()`

Begins the guided tour. Creates an overlay card with navigation controls.

#### `next()` / `prev()`

Navigates forward/backward through tour steps.

#### `goTo(index)`

Jumps to a specific step by index.

#### `stop()`

Ends the tour and removes the overlay.

### Properties

- `steps` -- Array of step definitions: `{title, text, action, highlight}`
- `currentStep` -- Current step index
- `active` -- Whether the tour is running

---

## Annotations (`js/annotations.js`)

User-created SVG annotations attached to nodes.

### Methods

#### `add(nodeId, text)`

Adds an annotation to a specific node. Returns the annotation object.

#### `remove(id)`

Removes a specific annotation by its ID.

#### `clearAll()`

Removes all annotations.

#### `render()`

Re-renders all annotation overlays on the SVG.

#### `toggleMode()`

Toggles annotation mode -- when active, clicking nodes opens an annotation prompt.

#### `isActive()`

Returns whether annotation mode is currently enabled.

#### `exportJSON()` / `importJSON(json)`

Serializes/deserializes annotations to/from JSON for saving and loading.

#### `updatePositions()`

Call to re-render after force simulation ticks.

---

## SankeyView (`js/sankey-view.js`)

Sankey flow diagram showing flows from trip purposes to transport modes.

### Methods

#### `init(containerId, modeData, activityData)`

Renders the Sankey diagram. Generates synthetic flows proportional to purpose and mode shares.

#### `destroy()`

Removes the SVG and tooltip elements.

#### `resize()`

No-op (SVG uses `viewBox` for responsive sizing).

---

## ChordView (`js/chord-view.js`)

Chord diagram showing mode-to-mode transfer relationships.

### Methods

#### `init(containerId, data)`

Renders the chord diagram from mode molecule data.

#### `destroy()`

Removes SVG and tooltip.

#### `resize()`

No-op (responsive via `viewBox`).

---

## BarChartView (`js/bar-chart-view.js`)

Horizontal stacked bar chart comparing mode shares across demographic groups.

### Methods

#### `init(containerId, data)`

Initializes with demographic CSV data. Renders a dimension selector dropdown, the chart, and a legend.

**Parameters:**
- `containerId` (string) -- DOM element ID
- `data` (Array) -- Parsed demographic CSV rows

#### `setDimension(dimension)`

Switches the displayed dimension (e.g. `"age_group"`, `"income"`).

#### `destroy()`

Cleans up DOM elements.

#### `resize()`

Redraws at current container dimensions.

---

## HeatmapView (`js/heatmap-view.js`)

Mode-purpose heatmap showing intensity of purpose-mode combinations.

### Methods

#### `init(containerId, modeData, activityData)`

Builds the heatmap matrix and renders the visualization.

#### `destroy()`

Cleans up DOM.

#### `resize()`

Redraws at current dimensions.

---

## KeyboardNav (`js/keyboard-nav.js`)

Keyboard navigation and shortcut handler.

### Methods

#### `init(getNodes, onFocus, onSelect)`

Registers keyboard event listeners.

**Parameters:**
- `getNodes` (function) -- Returns current node array
- `onFocus` (function) -- Called with focused node (or `null`)
- `onSelect` (function) -- Called when a node is selected

### Keyboard Shortcuts

| Key | Action |
|---|---|
| `Tab` / `Shift+Tab` | Cycle through nodes |
| `Enter` / `Space` | Select focused node |
| `Esc` | Clear selection |
| `/` | Open search |
| `1` | Mode Molecule view |
| `2` | Activity Molecule view |
| `3` | Sankey Flow view |
| `4` | Chord Diagram view |
| `t` | Start guided tour |
| `a` | Toggle annotation mode |
| `?` | Toggle keyboard help |

---

## Analytics (planned, S5-1)

Statistical analysis module for advanced metrics on travel data. Planned features include distribution analysis, correlation matrices, and trend detection.

## TripSimulator (planned, S5-2)

Markov chain simulation module for modeling trip sequences. Will generate synthetic trip chains based on observed transition probabilities.

## EquityAnalysis (planned, S5-3)

Equity metrics module for analyzing transportation access disparities across demographic groups. Will include Gini coefficients, access indices, and gap analysis.
