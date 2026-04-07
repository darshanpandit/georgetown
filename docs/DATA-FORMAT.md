# Travel Molecule -- Data Format Reference

This document describes the data formats used by the Travel Molecule visualization, how to create custom datasets, and field definitions.

---

## JSON Schema

The canonical data format is defined in `data/schema.json` (JSON Schema Draft-07). A valid dataset contains `nodes` and `links` arrays, plus optional `metadata`.

### Minimal Example

```json
{
  "nodes": [
    { "id": "car",  "label": "Car",  "share": 0.83, "color": "#4a9eff" },
    { "id": "walk", "label": "Walk", "share": 0.10, "color": "#34d399" },
    { "id": "bus",  "label": "Bus",  "share": 0.07, "color": "#f97316" }
  ],
  "links": [
    { "source": "car",  "target": "walk", "weight": 0.45 },
    { "source": "walk", "target": "bus",  "weight": 0.30 }
  ]
}
```

### Full Structure

```json
{
  "metadata": {
    "title": "Mode Molecule",
    "subtitle": "Description text shown below the title",
    "source": "NHTS 2017",
    "sourceUrl": "https://nhts.ornl.gov/",
    "year": 2017,
    "region": "United States",
    "methodology": "Household travel diary survey",
    "sampleSize": 129696,
    "lastUpdated": "2026-04-07",
    "units": {
      "share": "proportion",
      "weight": "proportion"
    }
  },
  "nodes": [ ... ],
  "links": [ ... ]
}
```

---

## Node Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `id` | string | Yes | Unique identifier. Pattern: `^[a-z_]+$` |
| `label` | string | Yes | Human-readable name displayed in the visualization |
| `share` | number | Yes | Proportion (0.0-1.0) representing mode share or activity share |
| `color` | string | No | Hex color code, e.g. `"#4a9eff"`. Defaults to gray |
| `description` | string | No | Extended description shown in tooltips |
| `category` | string | No | Grouping category for filtering |

### Share Values

Shares are proportions between 0 and 1 (not percentages). They do not need to sum to exactly 1.0 across all nodes, but the visualization works best when they are approximately normalized.

---

## Link Fields

| Field | Type | Required | Description |
|---|---|---|---|
| `source` | string | Yes | ID of the source node |
| `target` | string | Yes | ID of the target node |
| `weight` | number | Yes | Chain strength/frequency (0.0-1.0) |
| `label` | string | No | Description of the chain |
| `mode` | string | No | Dominant transport mode (activity chains only) |
| `modeColor` | string | No | Color for mode-colored links |

### Weight Values

Weights represent the strength of the multimodal connection. Higher values produce thicker bonds in the molecule view. The scale is relative within the dataset.

---

## CSV File Formats

The system supports loading data from CSV files, either through the UI file upload or via URL parameters.

### Modes CSV (`nhts-2017-modes.csv`)

```csv
mode_id,mode_label,mode_share,color
car,Car/Truck,0.833,#4a9eff
walk,Walk,0.105,#34d399
transit_bus,Bus,0.030,#f97316
subway_rail,Subway/Rail,0.020,#a78bfa
bicycle,Bicycle,0.010,#f472b6
```

**Column definitions:**
- `mode_id` -- Unique identifier for the mode
- `mode_label` -- Display name
- `mode_share` -- Proportion of all trips using this mode
- `color` -- Hex color for visualization

### Mode Chains CSV (`nhts-2017-mode-chains.csv`)

```csv
source_mode,target_mode,chain_weight,chain_label
car,walk,0.45,Park and walk
walk,transit_bus,0.30,Walk to bus
walk,subway_rail,0.25,Walk to rail
```

**Column definitions:**
- `source_mode` -- ID of the first mode in the chain
- `target_mode` -- ID of the second mode in the chain
- `chain_weight` -- Strength of the multimodal connection (0-1)
- `chain_label` -- Description of the transfer pattern

### Activities CSV (`nhts-2017-activities.csv`)

```csv
activity_id,activity_label,trip_share,color
home,Home,0.280,#4a9eff
work,Work,0.185,#ef4444
shopping,Shopping/Errands,0.195,#f97316
```

### Activity Chains CSV (`nhts-2017-activity-chains.csv`)

```csv
source_activity,target_activity,chain_weight,dominant_mode,mode_color
home,work,0.95,car,#4a9eff
shopping,home,0.65,walk,#34d399
```

**Additional columns for activity chains:**
- `dominant_mode` -- The most common transport mode for this chain
- `mode_color` -- Color of the dominant mode (for colored links)

### Demographics CSV (`nhts-2017-demographics.csv`)

```csv
demographic,category,mode,share
age_group,16-24,car,0.72
age_group,16-24,walk,0.15
area_type,Urban,car,0.78
income,Under $25K,car,0.70
```

**Column definitions:**
- `demographic` -- Dimension name (e.g. `age_group`, `area_type`, `income`)
- `category` -- Category within the dimension (e.g. `16-24`, `Urban`)
- `mode` -- Transport mode identifier
- `share` -- Mode share for this demographic group

---

## User-Uploaded Data

When loading files via the "Load Data" button:

- **Single JSON file** -- Must contain `nodes` and `links` arrays
- **Two CSV files** -- Files are matched by name:
  - Names containing `mode` or `node` are treated as node data
  - Names containing `chain`, `link`, or `edge` are treated as link data
- CSV columns are mapped flexibly:
  - Node ID: `id`, `mode`, or `name`
  - Node label: `label`, `mode`, or `name`
  - Node share: `share` (parsed as float)
  - Link source: `source` or `from`
  - Link target: `target` or `to`
  - Link weight: `value` or `weight`

---

## Creating a Custom Dataset

### Step 1: Prepare your data

Identify your transportation modes (or other categories) and compute shares. Shares should be proportions that approximately sum to 1.0.

### Step 2: Define connections

Identify multimodal chains -- pairs of modes that are commonly used together in a single trip. Assign weights based on frequency or strength of the connection.

### Step 3: Choose a format

**JSON** is the simplest for a complete dataset:

```json
{
  "metadata": {
    "title": "London Transport Molecule",
    "source": "Transport for London",
    "year": 2023,
    "region": "Greater London"
  },
  "nodes": [
    { "id": "tube",       "label": "Tube",         "share": 0.34, "color": "#0019A8" },
    { "id": "bus",        "label": "Bus",           "share": 0.28, "color": "#DC241F" },
    { "id": "walk",       "label": "Walking",       "share": 0.20, "color": "#34d399" },
    { "id": "rail",       "label": "National Rail", "share": 0.08, "color": "#1C3F94" },
    { "id": "cycle",      "label": "Cycling",       "share": 0.05, "color": "#00A4A7" },
    { "id": "car",        "label": "Car",           "share": 0.03, "color": "#94a3b8" },
    { "id": "taxi_ph",    "label": "Taxi/PHV",      "share": 0.02, "color": "#fbbf24" }
  ],
  "links": [
    { "source": "tube",  "target": "walk",  "weight": 0.85 },
    { "source": "tube",  "target": "bus",   "weight": 0.40 },
    { "source": "tube",  "target": "rail",  "weight": 0.30 },
    { "source": "bus",   "target": "walk",  "weight": 0.70 },
    { "source": "rail",  "target": "tube",  "weight": 0.35 },
    { "source": "cycle", "target": "tube",  "weight": 0.15 },
    { "source": "walk",  "target": "bus",   "weight": 0.25 }
  ]
}
```

### Step 4: Load your data

Option A -- File upload: Click "Load Data" in the visualization and select your JSON file.

Option B -- URL parameter: Host your JSON file and load with `?data=https://example.com/london-transport.json`

Option C -- CSV via URL: `?modes=path/to/modes.csv&chains=path/to/chains.csv`

### Step 5: Validate

Use `DataLoader.validate(data)` to check your dataset for structural errors:

```javascript
var result = DataLoader.validate(myData);
if (!result.valid) {
  console.error("Validation errors:", result.errors);
}
```

---

## Valid Values Reference

### Mode IDs (NHTS default dataset)

| ID | Label | Typical Share |
|---|---|---|
| `car` | Car | 0.833 |
| `walk` | Walk | 0.105 |
| `bus` | Bus | 0.024 |
| `subway` | Subway | 0.016 |
| `bicycle` | Bicycle | 0.010 |
| `taxi` | Taxi/TNC | 0.007 |
| `other` | Other | 0.005 |

### Activity IDs (NHTS default dataset)

| ID | Label | Typical Share |
|---|---|---|
| `home` | Home | 0.28 |
| `work` | Work | 0.19 |
| `shopping` | Shopping | 0.20 |
| `social` | Social | 0.15 |
| `school` | School | 0.07 |
| `medical` | Medical | 0.04 |
| `escort` | Escort | 0.07 |

### Demographic Dimensions

| Dimension | Categories |
|---|---|
| `age_group` | `16-24`, `25-44`, `45-64`, `65+` |
| `area_type` | `Urban`, `Suburban`, `Rural` |
| `income` | `Under $25K`, `$25K-$50K`, `$50K-$100K`, `Over $100K` |
