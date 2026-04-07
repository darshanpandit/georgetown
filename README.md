# Travel Molecule -- NHTS Transportation Visualization

Interactive force-directed visualization of U.S. travel patterns based on the National Household Travel Survey (NHTS). Built with D3.js for Georgetown University.

## Features

- **Mode Molecule** -- Transport mode shares as atoms, multimodal trip chains as bonds
- **Activity Molecule** -- Daily activity chains colored by dominant transport mode
- **Sankey Flow** -- Trip purpose to transport mode flow diagram
- **Chord Diagram** -- Mode-to-mode transfer relationships
- **Bar Chart** -- Stacked bar comparison across demographic groups
- **Heatmap** -- Purpose-mode usage intensity matrix
- **Demographics** -- Filter by age group, area type, or income
- **Statistics Panel** -- Network metrics: density, HHI, Gini, degree distribution
- **Interactive Filters** -- Filter by share threshold, link weight, and node selection
- **Guided Tour** -- 9-step narrated walkthrough of key insights
- **Annotations** -- Click nodes to add draggable text annotations
- **Export** -- SVG, PNG, CSV, and JSON export
- **Shareable URLs** -- Encode view state in URL hash for sharing
- **Keyboard Navigation** -- Full keyboard access with shortcuts
- **Programmatic API** -- Query data from scripts or AI agents without the DOM
- **Custom Data** -- Load your own datasets via file upload or URL

## Quick Start

Open `travel-molecule.html` in a browser. No build step or server required.

```bash
# Option 1: Direct file
open travel-molecule.html

# Option 2: Local server (for CSV loading)
python3 -m http.server 8000
# Then visit http://localhost:8000/travel-molecule.html
```

## Documentation

Detailed documentation is available in the `docs/` directory:

- **[docs/API.md](docs/API.md)** -- Full API reference for every public module
- **[docs/DATA-FORMAT.md](docs/DATA-FORMAT.md)** -- Data format specification and custom dataset guide
- **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** -- Module dependency graph, data flow, and extension points

## Data API for AI Agents

The `TravelAPI` module (`js/api.js`) provides programmatic access to the travel data. Include `travel-molecule-data.js` and `api.js` in your page or script:

```html
<script src="js/travel-molecule-data.js"></script>
<script src="js/api.js"></script>
```

### Example Queries

```javascript
// Get top 3 modes by share
TravelAPI.getModes({ limit: 3 });
// [{ id: "car", label: "Car", share: 0.833, ... }, ...]

// What is the mode share for walking?
TravelAPI.getModeShare("walk");  // 0.105

// What modes connect to subway?
TravelAPI.getConnectedModes("subway");
// [{ mode: "walk", weight: 0.25 }, { mode: "bus", weight: 0.15 }, ...]

// Compare demographics
TravelAPI.compareDemographics("area_type", "Urban", "Rural");
// { differences: [...], summary: "Urban has lower car usage..." }

// Natural language query
TravelAPI.query("top 3 modes");
TravelAPI.query("share of car");
TravelAPI.query("strongest chain");

// Export as JSON or CSV
TravelAPI.toJSON();
TravelAPI.toCSV("modes");
```

## Loading Custom Data

### Via URL Parameters

```
travel-molecule.html?data=https://example.com/my-dataset.json
travel-molecule.html?modes=data/modes.csv&chains=data/chains.csv
travel-molecule.html?source=csv
```

### Via File Upload

Click the "Load Data" button and select:
- A single `.json` file with `nodes` and `links` arrays
- Two `.csv` files: one for nodes (name contains "mode" or "node") and one for links (name contains "chain", "link", or "edge")

## Keyboard Shortcuts

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
| `?` | Toggle keyboard shortcut help |

## Data Sources

Sample data is derived from the **2017 National Household Travel Survey (NHTS)**, conducted by the Federal Highway Administration (FHWA) and managed by Oak Ridge National Laboratory.

> U.S. Department of Transportation, Federal Highway Administration. *2017 National Household Travel Survey*. Available at: https://nhts.ornl.gov/

The NHTS is a periodic national survey of daily travel by the American public, covering trip purposes, transport modes, time of day, and demographic characteristics. The 2017 survey included 129,696 households.

Mode share values in the default dataset represent approximate national averages. Demographic breakdowns are simplified from published NHTS summary tables.

## Browser Compatibility

- Chrome 60+
- Firefox 55+
- Safari 11+
- Edge 79+

The visualization uses D3.js v4, SVG, ES5 JavaScript, and CSS3 custom properties. No transpilation or polyfills are required.

## Project Structure

```
travel-molecule.html        -- Main entry point
css/travel-molecule.css     -- Styles
js/
  travel-molecule-data.js   -- Embedded NHTS data
  data-loader.js            -- CSV/JSON loading
  travel-molecule.js        -- Force-directed molecule view
  sankey-view.js            -- Sankey flow diagram
  chord-view.js             -- Chord diagram
  bar-chart-view.js         -- Demographic bar chart
  heatmap-view.js           -- Purpose-mode heatmap
  stats-panel.js            -- Statistics sidebar
  filter-controls.js        -- Interactive filters
  demographics.js           -- Demographic data loading
  keyboard-nav.js           -- Keyboard navigation
  story-mode.js             -- Guided tour
  annotations.js            -- User annotations
  export.js                 -- Export tools
  url-state.js              -- URL state management
  api.js                    -- Programmatic data API
data/
  schema.json               -- JSON Schema for datasets
  nhts-2017-*.csv           -- NHTS data files
docs/
  API.md                    -- API reference
  DATA-FORMAT.md            -- Data format guide
  ARCHITECTURE.md           -- Architecture documentation
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Follow the existing code style: ES5, IIFE modules, `window.*` exports
4. Test in at least Chrome and Firefox
5. Validate any new data files with `DataLoader.validate(data)`
6. Update documentation in `docs/` for any new public API
7. Submit a pull request with a clear description of changes

## Author

Darshan Pandit
