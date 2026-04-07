(function () {
  "use strict";

  window.UrlState = {
    /**
     * Encode current state to URL hash.
     * @param {Object} state - { view, filters, demographic, selected }
     */
    save: function (state) {
      var hash = this.encode(state);
      if (window.location.hash.slice(1) !== hash) {
        window.history.replaceState(null, "", "#" + hash);
      }
    },

    /**
     * Encode a state object to a query-string format.
     */
    encode: function (state) {
      if (!state) return "";
      var parts = [];

      if (state.view) {
        parts.push("view=" + encodeURIComponent(state.view));
      }

      if (state.filters) {
        if (state.filters.minShare !== undefined && state.filters.minShare > 0) {
          parts.push("minShare=" + encodeURIComponent(state.filters.minShare));
        }
        if (state.filters.minWeight !== undefined && state.filters.minWeight > 0) {
          parts.push("minWeight=" + encodeURIComponent(state.filters.minWeight));
        }
      }

      if (state.demographic) {
        if (state.demographic.dimension) {
          parts.push("demoDim=" + encodeURIComponent(state.demographic.dimension));
        }
        if (state.demographic.category) {
          parts.push("demoCat=" + encodeURIComponent(state.demographic.category));
        }
      }

      if (state.selected && state.selected.length > 0) {
        parts.push("selected=" + encodeURIComponent(state.selected.join(",")));
      }

      return parts.join("&");
    },

    /**
     * Decode URL hash to a state object.
     */
    decode: function () {
      var hash = window.location.hash.slice(1);
      if (!hash) return null;

      var params = {};
      hash.split("&").forEach(function (pair) {
        var idx = pair.indexOf("=");
        if (idx === -1) return;
        var key = decodeURIComponent(pair.substring(0, idx));
        var val = decodeURIComponent(pair.substring(idx + 1));
        params[key] = val;
      });

      var state = {};

      if (params.view) {
        state.view = params.view;
      }

      state.filters = {};
      if (params.minShare !== undefined) {
        state.filters.minShare = parseFloat(params.minShare) || 0;
      }
      if (params.minWeight !== undefined) {
        state.filters.minWeight = parseFloat(params.minWeight) || 0;
      }

      state.demographic = {};
      if (params.demoDim) {
        state.demographic.dimension = params.demoDim;
      }
      if (params.demoCat) {
        state.demographic.category = params.demoCat;
      }

      if (params.selected) {
        state.selected = params.selected.split(",").filter(function (s) { return s.length > 0; });
      } else {
        state.selected = [];
      }

      return state;
    },

    /**
     * Apply decoded state to the visualization.
     */
    apply: function (state) {
      if (!state) return;

      // Switch view if specified
      if (state.view && typeof switchTo === "function") {
        var validViews = ["mode", "activity", "sankey", "chord"];
        if (validViews.indexOf(state.view) !== -1) {
          switchTo(state.view);
        }
      }

      // Apply filter state
      if (state.filters && window.FilterControls) {
        if (state.filters.minShare !== undefined) {
          FilterControls.state.minShare = state.filters.minShare;
        }
        if (state.filters.minWeight !== undefined) {
          FilterControls.state.minWeight = state.filters.minWeight;
        }
        // Update slider UI if filter panel elements exist
        var shareSlider = document.querySelector("#filter-share-range");
        var weightSlider = document.querySelector("#filter-weight-range");
        if (shareSlider && state.filters.minShare !== undefined) {
          shareSlider.value = state.filters.minShare;
        }
        if (weightSlider && state.filters.minWeight !== undefined) {
          weightSlider.value = state.filters.minWeight;
        }
      }

      // Apply demographic state
      if (state.demographic && state.demographic.dimension) {
        var dimSelect = document.getElementById("demo-dimension");
        if (dimSelect) {
          dimSelect.value = state.demographic.dimension;
          // Trigger change to load categories
          if (typeof onDimensionChange === "function") {
            onDimensionChange();
          }
          if (state.demographic.category) {
            // Wait for categories to populate, then set
            setTimeout(function () {
              var catSelect = document.getElementById("demo-category");
              if (catSelect) {
                catSelect.value = state.demographic.category;
                if (typeof onCategoryChange === "function") {
                  onCategoryChange();
                }
              }
            }, 100);
          }
        }
      }

      // Apply node selection
      if (state.selected && state.selected.length > 0) {
        setTimeout(function () {
          state.selected.forEach(function (nodeId) {
            if (typeof selectNode === "function") {
              selectNode(nodeId);
            }
          });
        }, 200);
      }
    },

    /**
     * Gather the current visualization state from the DOM / globals.
     */
    getCurrentState: function () {
      var state = {};

      // Determine current view from toggle buttons
      var activeBtn = document.querySelector(".toggle-btn.active");
      if (activeBtn) {
        var id = activeBtn.id || "";
        state.view = id.replace("btn-", "");
      } else {
        state.view = "mode";
      }

      // Gather filter state
      state.filters = {};
      if (window.FilterControls) {
        state.filters.minShare = FilterControls.state.minShare || 0;
        state.filters.minWeight = FilterControls.state.minWeight || 0;
      }

      // Gather demographic state
      state.demographic = {};
      var dimSelect = document.getElementById("demo-dimension");
      var catSelect = document.getElementById("demo-category");
      if (dimSelect && dimSelect.value) {
        state.demographic.dimension = dimSelect.value;
        if (catSelect && catSelect.value) {
          state.demographic.category = catSelect.value;
        }
      }

      // Selected nodes
      state.selected = [];

      return state;
    },

    /**
     * Generate a full shareable URL.
     */
    getShareURL: function (state) {
      if (!state) state = this.getCurrentState();
      return window.location.origin + window.location.pathname + "#" + this.encode(state);
    },

    /**
     * Copy the share URL to clipboard and show a toast.
     */
    copyShareURL: function (state) {
      var url = this.getShareURL(state);
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          if (typeof showToast === "function") showToast("Link copied to clipboard", "success");
        }).catch(function () {
          UrlState._fallbackCopy(url);
        });
      } else {
        this._fallbackCopy(url);
      }
    },

    /**
     * Fallback copy method for browsers without clipboard API.
     */
    _fallbackCopy: function (text) {
      var textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        if (typeof showToast === "function") showToast("Link copied to clipboard", "success");
      } catch (err) {
        if (typeof showToast === "function") showToast("Could not copy link", "error");
      }
      document.body.removeChild(textarea);
    }
  };

  // Listen for hashchange to restore state
  window.addEventListener("hashchange", function () {
    var state = UrlState.decode();
    if (state) {
      UrlState.apply(state);
    }
  });
})();
