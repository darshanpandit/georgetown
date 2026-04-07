// ─────────────────────────────────────────────
//  Travel Molecule – Sample Data (NHTS-based)
// ─────────────────────────────────────────────

var MODE_MOLECULE_DATA = {
  title: "Mode Molecule",
  subtitle: "How Americans travel — node size = mode share, bonds = multimodal trip chains",
  nodes: [
    { id: "car",     label: "Car",        share: 0.833, color: "#4a9eff" },
    { id: "walk",    label: "Walk",       share: 0.105, color: "#34d399" },
    { id: "bus",     label: "Bus",        share: 0.024, color: "#f97316" },
    { id: "subway",  label: "Subway",     share: 0.016, color: "#a78bfa" },
    { id: "bicycle", label: "Bicycle",    share: 0.010, color: "#f472b6" },
    { id: "taxi",    label: "Taxi/TNC",   share: 0.007, color: "#fbbf24" },
    { id: "other",   label: "Other",      share: 0.005, color: "#94a3b8" }
  ],
  links: [
    { source: "car",     target: "walk",    weight: 0.45 },
    { source: "car",     target: "subway",  weight: 0.12 },
    { source: "car",     target: "bus",     weight: 0.08 },
    { source: "car",     target: "bicycle", weight: 0.03 },
    { source: "car",     target: "taxi",    weight: 0.04 },
    { source: "walk",    target: "bus",     weight: 0.30 },
    { source: "walk",    target: "subway",  weight: 0.25 },
    { source: "walk",    target: "bicycle", weight: 0.10 },
    { source: "bus",     target: "subway",  weight: 0.15 },
    { source: "bicycle", target: "subway",  weight: 0.06 },
    { source: "taxi",    target: "subway",  weight: 0.05 }
  ]
};

var ACTIVITY_MOLECULE_DATA = {
  title: "Activity Molecule",
  subtitle: "Daily activity chains — edges colored by dominant transport mode",
  nodes: [
    { id: "home",     label: "Home",       share: 0.28, color: "#4a9eff" },
    { id: "work",     label: "Work",       share: 0.19, color: "#ef4444" },
    { id: "shopping", label: "Shopping",   share: 0.20, color: "#f97316" },
    { id: "social",   label: "Social",     share: 0.15, color: "#34d399" },
    { id: "school",   label: "School",     share: 0.07, color: "#a78bfa" },
    { id: "medical",  label: "Medical",    share: 0.04, color: "#f472b6" },
    { id: "escort",   label: "Escort",     share: 0.07, color: "#86efac" }
  ],
  links: [
    { source: "home",     target: "work",     weight: 0.95, mode: "car",    modeColor: "#4a9eff" },
    { source: "home",     target: "shopping", weight: 0.70, mode: "car",    modeColor: "#4a9eff" },
    { source: "home",     target: "school",   weight: 0.55, mode: "car",    modeColor: "#4a9eff" },
    { source: "home",     target: "social",   weight: 0.60, mode: "car",    modeColor: "#4a9eff" },
    { source: "home",     target: "medical",  weight: 0.30, mode: "car",    modeColor: "#4a9eff" },
    { source: "home",     target: "escort",   weight: 0.45, mode: "car",    modeColor: "#4a9eff" },
    { source: "work",     target: "shopping", weight: 0.35, mode: "car",    modeColor: "#4a9eff" },
    { source: "work",     target: "social",   weight: 0.20, mode: "car",    modeColor: "#4a9eff" },
    { source: "work",     target: "escort",   weight: 0.15, mode: "car",    modeColor: "#4a9eff" },
    { source: "work",     target: "home",     weight: 0.90, mode: "subway", modeColor: "#a78bfa" },
    { source: "shopping", target: "home",     weight: 0.65, mode: "walk",   modeColor: "#34d399" },
    { source: "school",   target: "home",     weight: 0.40, mode: "walk",   modeColor: "#34d399" },
    { source: "social",   target: "home",     weight: 0.50, mode: "car",    modeColor: "#4a9eff" },
    { source: "shopping", target: "social",   weight: 0.20, mode: "walk",   modeColor: "#34d399" }
  ]
};
