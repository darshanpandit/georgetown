// ─────────────────────────────────────────────
//  Story Mode – Guided Tour of the Visualization
// ─────────────────────────────────────────────

(function () {
  "use strict";

  window.StoryMode = {
    steps: [
      {
        title: "The American Travel Molecule",
        text: "This visualization shows how Americans travel, based on the National Household Travel Survey. Each atom represents a transportation mode.",
        action: function () { switchTo("mode"); },
        highlight: null
      },
      {
        title: "Car Dominance",
        text: "Cars account for 83.3% of all trips \u2014 notice how the Car atom dwarfs everything else. This is the defining feature of American transportation.",
        action: function () { switchTo("mode"); },
        highlight: "car"
      },
      {
        title: "The Walking Bond",
        text: "The strongest multimodal chain is Car\u2192Walk (45%). Almost half of car trips involve walking to/from the vehicle \u2014 parking lots, garages, street parking.",
        action: function () { switchTo("mode"); },
        highlight: ["car", "walk"]
      },
      {
        title: "Transit Connections",
        text: "Walk\u2192Bus (30%) and Walk\u2192Subway (25%) show that transit depends heavily on walking access. This is why walkability near stations matters so much.",
        action: function () { switchTo("mode"); },
        highlight: ["walk", "bus"]
      },
      {
        title: "Daily Activity Chains",
        text: "Switching to activities \u2014 this shows how people chain trips throughout the day. Home is the anchor, with Work and Shopping as the strongest attractors.",
        action: function () { switchTo("activity"); },
        highlight: null
      },
      {
        title: "The Commute",
        text: "Home\u2192Work is the strongest activity chain (95% weight). But notice Work\u2192Home flows through Subway \u2014 many commuters drive to work but take transit home, or vice versa.",
        action: function () { switchTo("activity"); },
        highlight: ["home", "work"]
      },
      {
        title: "Mode Transfers",
        text: "The chord diagram reveals the hidden network of multimodal transfers. Most connections flow through Walk \u2014 it\u2019s the universal connector between modes.",
        action: function () { switchTo("chord"); },
        highlight: null
      },
      {
        title: "Purpose to Mode Flows",
        text: "The Sankey diagram shows which modes serve which purposes. Car dominates every category, but notice how Walk\u2019s share increases for Shopping and Social trips.",
        action: function () { switchTo("sankey"); },
        highlight: null
      },
      {
        title: "Explore Further",
        text: "Use the filters, demographics selector, and keyboard shortcuts to explore on your own. Press ? for keyboard help.",
        action: function () { switchTo("mode"); },
        highlight: null
      }
    ],

    currentStep: 0,
    active: false,
    _overlay: null,
    _card: null,

    start: function () {
      if (this.active) return;
      this.active = true;
      this.currentStep = 0;
      this._createOverlay();
      this.goTo(0);
    },

    next: function () {
      if (!this.active) return;
      if (this.currentStep < this.steps.length - 1) {
        this.goTo(this.currentStep + 1);
      } else {
        this.stop();
      }
    },

    prev: function () {
      if (!this.active) return;
      if (this.currentStep > 0) {
        this.goTo(this.currentStep - 1);
      }
    },

    goTo: function (index) {
      if (index < 0 || index >= this.steps.length) return;
      this.currentStep = index;
      var step = this.steps[index];
      this.renderStep(step);
    },

    stop: function () {
      this.active = false;
      this.currentStep = 0;
      this._removeOverlay();
      this._clearHighlight();
      if (typeof showToast === "function") {
        showToast("Story mode ended", "success");
      }
    },

    renderStep: function (step) {
      var self = this;

      // Execute the view-switching action
      if (step.action) {
        step.action();
      }

      // Small delay to let view transition complete before highlighting
      setTimeout(function () {
        self._applyHighlight(step.highlight);
      }, 400);

      // Build card content
      var total = this.steps.length;
      var current = this.currentStep + 1;

      var card = this._card;
      if (!card) return;

      // Title
      var titleEl = card.querySelector(".story-card-title");
      titleEl.textContent = step.title;

      // Text
      var textEl = card.querySelector(".story-card-text");
      textEl.textContent = step.text;

      // Counter
      var counterEl = card.querySelector(".story-card-counter");
      counterEl.textContent = current + " of " + total;

      // Prev button state
      var prevBtn = card.querySelector(".story-btn-prev");
      prevBtn.disabled = this.currentStep === 0;

      // Next button label
      var nextBtn = card.querySelector(".story-btn-next");
      nextBtn.textContent = this.currentStep === this.steps.length - 1 ? "Finish" : "Next";

      // Progress dots
      var dotsContainer = card.querySelector(".story-card-dots");
      dotsContainer.innerHTML = "";
      for (var i = 0; i < total; i++) {
        var dot = document.createElement("span");
        dot.className = "story-dot" + (i === this.currentStep ? " active" : "");
        dot.setAttribute("data-step", i);
        (function (idx) {
          dot.addEventListener("click", function () {
            self.goTo(idx);
          });
        })(i);
        dotsContainer.appendChild(dot);
      }
    },

    _createOverlay: function () {
      // Remove existing if any
      this._removeOverlay();

      // Create overlay backdrop (semi-transparent, click to exit)
      var overlay = document.createElement("div");
      overlay.className = "story-overlay";
      document.body.appendChild(overlay);
      this._overlay = overlay;

      // Create floating card
      var card = document.createElement("div");
      card.className = "story-card";
      card.innerHTML =
        '<div class="story-card-header">' +
          '<div class="story-card-title"></div>' +
          '<button class="story-btn-exit" title="Exit story mode">\u00d7</button>' +
        '</div>' +
        '<div class="story-card-text"></div>' +
        '<div class="story-card-footer">' +
          '<div class="story-card-dots"></div>' +
          '<div class="story-card-counter"></div>' +
          '<div class="story-card-buttons">' +
            '<button class="story-btn-prev">Previous</button>' +
            '<button class="story-btn-next">Next</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(card);
      this._card = card;

      // Wire up button events
      var self = this;
      card.querySelector(".story-btn-exit").addEventListener("click", function () {
        self.stop();
      });
      card.querySelector(".story-btn-prev").addEventListener("click", function () {
        self.prev();
      });
      card.querySelector(".story-btn-next").addEventListener("click", function () {
        self.next();
      });

      // Keyboard navigation within story mode
      this._keyHandler = function (e) {
        if (!self.active) return;
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          self.next();
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          self.prev();
        } else if (e.key === "Escape") {
          e.preventDefault();
          self.stop();
        }
      };
      document.addEventListener("keydown", this._keyHandler);
    },

    _removeOverlay: function () {
      if (this._overlay) {
        this._overlay.parentNode.removeChild(this._overlay);
        this._overlay = null;
      }
      if (this._card) {
        this._card.parentNode.removeChild(this._card);
        this._card = null;
      }
      if (this._keyHandler) {
        document.removeEventListener("keydown", this._keyHandler);
        this._keyHandler = null;
      }
    },

    _applyHighlight: function (highlight) {
      this._clearHighlight();

      if (!highlight) return;

      // For molecule views, use the existing highlight functions
      if (typeof highlight === "string") {
        // Single node highlight
        if (typeof window.highlightNode === "function") {
          window.highlightNode(highlight);
        }
      } else if (Array.isArray(highlight) && highlight.length === 2) {
        // Path highlight between two nodes — select them
        if (typeof window.selectNode === "function") {
          window.selectNode(highlight[0]);
        }
        // Use the internal selection mechanism for path highlighting
        var svg = document.querySelector("#molecule-container svg");
        if (svg) {
          var nodes = svg.querySelectorAll(".node");
          nodes.forEach(function (node) {
            var datum = d3.select(node).datum();
            if (datum && highlight.indexOf(datum.id) >= 0) {
              d3.select(node).style("opacity", 1);
              // Add a story highlight ring
              var r = d3.select(node).select(".atom").attr("r");
              d3.select(node).append("circle")
                .attr("class", "story-highlight-ring")
                .attr("r", parseFloat(r) + 8)
                .attr("fill", "none")
                .attr("stroke", "#fbbf24")
                .attr("stroke-width", 2.5)
                .attr("stroke-dasharray", "6,3")
                .style("animation", "selectionPulse 1.5s ease-in-out infinite");
            }
          });
        }
      }
    },

    _clearHighlight: function () {
      // Remove story highlight rings
      d3.selectAll(".story-highlight-ring").remove();

      // Clear node highlighting
      if (typeof window.highlightNode === "function") {
        window.highlightNode(null);
      }
    }
  };
})();
