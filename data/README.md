# NHTS 2017 Data Files

Data files derived from the [2017 National Household Travel Survey (NHTS)](https://nhts.ornl.gov/) for the Georgetown Travel Visualization project.

## Files

### nhts-2017-modes.csv

Mode share distribution for all person-trips in the 2017 NHTS.

| Column | Description |
|--------|-------------|
| `mode_id` | Unique identifier for the travel mode |
| `mode_label` | Human-readable mode name |
| `mode_share` | Fraction of all person-trips using this mode (sums to ~1.0) |
| `color` | Hex color used in visualizations |

### nhts-2017-mode-chains.csv

Multimodal trip chain connections — pairs of modes that appear together in linked trips.

| Column | Description |
|--------|-------------|
| `source_mode` | First mode in the chain (references `mode_id`) |
| `target_mode` | Second mode in the chain (references `mode_id`) |
| `chain_weight` | Relative strength of this multimodal pairing (0–1) |
| `chain_label` | Descriptive label for the trip chain |

### nhts-2017-activities.csv

Trip purpose / activity distribution for all person-trips.

| Column | Description |
|--------|-------------|
| `activity_id` | Unique identifier for the activity |
| `activity_label` | Human-readable activity name |
| `trip_share` | Fraction of all person-trips for this purpose (sums to ~1.0) |
| `color` | Hex color used in visualizations |

### nhts-2017-activity-chains.csv

Activity-to-activity trip chains showing which activities follow each other and the dominant travel mode for each transition.

| Column | Description |
|--------|-------------|
| `source_activity` | Origin activity (references `activity_id`) |
| `target_activity` | Destination activity (references `activity_id`) |
| `chain_weight` | Relative strength of this activity transition (0–1) |
| `dominant_mode` | Most common travel mode for this transition |
| `mode_color` | Hex color of the dominant mode |

### nhts-2017-demographics.csv

Mode share breakdowns by demographic group (age, area type, household income).

| Column | Description |
|--------|-------------|
| `demographic` | Demographic dimension (`age_group`, `area_type`, `income`) |
| `category` | Category within the dimension (e.g., `16-24`, `Urban`, `Under $25K`) |
| `mode` | Travel mode (references `mode_id`) |
| `share` | Mode share for this demographic segment |

## Source

All figures are based on the 2017 National Household Travel Survey (NHTS), conducted by the Federal Highway Administration (FHWA). The original microdata is available at <https://nhts.ornl.gov/>.

Values have been rounded and simplified for visualization purposes.

## Usage

These CSV files can be loaded directly by the travel molecule visualization in `js/travel-molecule-data.js`, or parsed by any CSV-capable tool (D3.js, pandas, R, etc.).
