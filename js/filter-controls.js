(function() {
  "use strict";

  window.FilterControls = {
    // Current filter state
    state: {
      minShare: 0,
      minWeight: 0,
      selectedNodes: [],  // empty = all selected
      searchQuery: ""
    },

    _container: null,
    _rawData: null,
    _onFilter: null,

    // Apply filters to dataset, returns filtered copy
    apply: function(data) {
      var s = this.state;
      var filteredNodes = data.nodes.filter(function(n) {
        if (n.share < s.minShare) return false;
        if (s.selectedNodes.length && s.selectedNodes.indexOf(n.id) === -1) return false;
        if (s.searchQuery && n.label.toLowerCase().indexOf(s.searchQuery.toLowerCase()) === -1) return false;
        return true;
      });
      var nodeIds = {};
      filteredNodes.forEach(function(n) { nodeIds[n.id] = true; });
      var filteredLinks = data.links.filter(function(l) {
        var sid = typeof l.source === "object" ? l.source.id : l.source;
        var tid = typeof l.target === "object" ? l.target.id : l.target;
        return nodeIds[sid] && nodeIds[tid] && l.weight >= s.minWeight;
      });
      return {
        title: data.title,
        subtitle: data.subtitle,
        nodes: filteredNodes,
        links: filteredLinks
      };
    },

    // Initialize UI
    init: function(container, data, onFilter) {
      this._container = container;
      this._rawData = data;
      this._onFilter = onFilter;

      var self = this;

      // Build filter panel HTML
      var html = '';
      html += '<div class="filter-header">';
      html += '<span class="filter-title">Filters</span>';
      html += '<button class="filter-close" id="filter-close" title="Close">&times;</button>';
      html += '</div>';

      // Share slider
      html += '<div class="filter-section">';
      html += '<label class="filter-label">Min Share: <span id="share-value">0%</span></label>';
      html += '<input type="range" id="filter-share" class="filter-range" min="0" max="50" step="1" value="0">';
      html += '</div>';

      // Weight slider
      html += '<div class="filter-section">';
      html += '<label class="filter-label">Min Link Weight: <span id="weight-value">0%</span></label>';
      html += '<input type="range" id="filter-weight" class="filter-range" min="0" max="100" step="1" value="0">';
      html += '</div>';

      // Search input
      html += '<div class="filter-section">';
      html += '<label class="filter-label">Search Nodes</label>';
      html += '<div class="filter-search-wrap">';
      html += '<span class="filter-search-icon">\u{1F50D}</span>';
      html += '<input type="text" id="filter-search" class="filter-search" placeholder="Search\u2026">';
      html += '</div>';
      html += '</div>';

      // Node checkboxes
      html += '<div class="filter-section">';
      html += '<label class="filter-label">Select Nodes</label>';
      html += '<div class="filter-node-list" id="filter-node-list">';
      html += this._buildNodeCheckboxes(data.nodes);
      html += '</div>';
      html += '</div>';

      // Reset button
      html += '<button class="filter-reset" id="filter-reset">Reset Filters</button>';

      container.innerHTML = html;

      // Bind events
      var shareSlider = document.getElementById("filter-share");
      var weightSlider = document.getElementById("filter-weight");
      var searchInput = document.getElementById("filter-search");
      var resetBtn = document.getElementById("filter-reset");
      var closeBtn = document.getElementById("filter-close");

      shareSlider.addEventListener("input", function() {
        self.state.minShare = parseFloat(this.value) / 100;
        document.getElementById("share-value").textContent = this.value + "%";
        self._triggerFilter();
      });

      weightSlider.addEventListener("input", function() {
        self.state.minWeight = parseFloat(this.value) / 100;
        document.getElementById("weight-value").textContent = this.value + "%";
        self._triggerFilter();
      });

      searchInput.addEventListener("input", function() {
        self.state.searchQuery = this.value;
        self._triggerFilter();
      });

      resetBtn.addEventListener("click", function() {
        self.reset();
      });

      closeBtn.addEventListener("click", function() {
        container.classList.remove("open");
        document.getElementById("btn-filter").classList.remove("active");
      });

      // Bind checkbox events
      this._bindCheckboxEvents();
    },

    _buildNodeCheckboxes: function(nodes) {
      var html = '';
      nodes.forEach(function(n) {
        html += '<label class="filter-checkbox-label">';
        html += '<input type="checkbox" class="filter-node-cb" value="' + n.id + '" checked>';
        html += '<span class="filter-cb-custom"></span>';
        html += '<span class="filter-cb-dot" style="background:' + n.color + '"></span>';
        html += '<span class="filter-cb-text">' + n.label + '</span>';
        html += '</label>';
      });
      return html;
    },

    _bindCheckboxEvents: function() {
      var self = this;
      var cbs = document.querySelectorAll(".filter-node-cb");
      for (var i = 0; i < cbs.length; i++) {
        cbs[i].addEventListener("change", function() {
          self._updateSelectedFromCheckboxes();
          self._triggerFilter();
        });
      }
    },

    _updateSelectedFromCheckboxes: function() {
      var cbs = document.querySelectorAll(".filter-node-cb");
      var allChecked = true;
      var selected = [];
      for (var i = 0; i < cbs.length; i++) {
        if (cbs[i].checked) {
          selected.push(cbs[i].value);
        } else {
          allChecked = false;
        }
      }
      // If all are checked, treat as "no filter"
      this.state.selectedNodes = allChecked ? [] : selected;
    },

    _triggerFilter: function() {
      if (this._rawData && this._onFilter) {
        var filtered = this.apply(this._rawData);
        this._onFilter(filtered);
      }
    },

    // Update available nodes when dataset changes
    updateNodes: function(data) {
      this._rawData = data;
      var list = document.getElementById("filter-node-list");
      if (list) {
        list.innerHTML = this._buildNodeCheckboxes(data.nodes);
        this._bindCheckboxEvents();
      }
    },

    // Reset all filters
    reset: function() {
      this.state.minShare = 0;
      this.state.minWeight = 0;
      this.state.selectedNodes = [];
      this.state.searchQuery = "";

      var shareSlider = document.getElementById("filter-share");
      var weightSlider = document.getElementById("filter-weight");
      var searchInput = document.getElementById("filter-search");

      if (shareSlider) { shareSlider.value = 0; }
      if (weightSlider) { weightSlider.value = 0; }
      if (searchInput) { searchInput.value = ""; }

      document.getElementById("share-value").textContent = "0%";
      document.getElementById("weight-value").textContent = "0%";

      // Re-check all checkboxes
      var cbs = document.querySelectorAll(".filter-node-cb");
      for (var i = 0; i < cbs.length; i++) {
        cbs[i].checked = true;
      }

      this._triggerFilter();
    }
  };
})();
