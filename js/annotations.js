// ─────────────────────────────────────────────
//  Annotations – User-Created SVG Annotations
// ─────────────────────────────────────────────

(function () {
  "use strict";

  var nextId = 1;
  var annotationMode = false;
  var annotationGroup = null;

  window.Annotations = {
    items: [],

    // Add an annotation to a node
    add: function (nodeId, text) {
      var node = this._findNodeElement(nodeId);
      if (!node) return null;

      var datum = d3.select(node).datum();
      if (!datum) return null;

      var id = "ann-" + nextId++;
      var annotation = {
        id: id,
        nodeId: nodeId,
        text: text,
        // Offset from the node position for the text box
        offsetX: 80,
        offsetY: -60,
        color: "#fbbf24"
      };

      this.items.push(annotation);
      this.render();

      return annotation;
    },

    // Remove a specific annotation
    remove: function (id) {
      this.items = this.items.filter(function (item) {
        return item.id !== id;
      });
      this.render();
    },

    // Clear all annotations
    clearAll: function () {
      this.items = [];
      this.render();
      if (typeof showToast === "function") {
        showToast("All annotations cleared", "success");
      }
    },

    // Render all annotations as SVG overlays
    render: function () {
      var svg = d3.select("#molecule-container svg");
      if (svg.empty()) return;

      // Create or select annotation group
      if (!annotationGroup || annotationGroup.empty()) {
        annotationGroup = svg.append("g").attr("class", "annotation-layer");
      }

      // Clear previous renders
      annotationGroup.selectAll(".annotation-item").remove();

      var self = this;

      this.items.forEach(function (ann) {
        var node = self._findNodeElement(ann.nodeId);
        if (!node) return;

        var datum = d3.select(node).datum();
        if (!datum || datum.x === undefined) return;

        var nodeX = datum.x;
        var nodeY = datum.y;
        var textX = nodeX + ann.offsetX;
        var textY = nodeY + ann.offsetY;

        var group = annotationGroup.append("g")
          .attr("class", "annotation-item")
          .attr("data-annotation-id", ann.id);

        // Leader line from node to text box
        group.append("line")
          .attr("class", "annotation-leader")
          .attr("x1", nodeX)
          .attr("y1", nodeY)
          .attr("x2", textX)
          .attr("y2", textY)
          .attr("stroke", ann.color)
          .attr("stroke-width", 1.5)
          .attr("stroke-dasharray", "4,3")
          .attr("stroke-opacity", 0.7);

        // Small circle at the node end
        group.append("circle")
          .attr("cx", nodeX)
          .attr("cy", nodeY)
          .attr("r", 4)
          .attr("fill", ann.color)
          .attr("fill-opacity", 0.8);

        // Measure text to size background
        var textLen = ann.text.length;
        var boxWidth = Math.min(Math.max(textLen * 6.5 + 20, 80), 200);
        var boxHeight = Math.ceil(textLen * 6.5 / (boxWidth - 16)) * 14 + 20;
        boxHeight = Math.max(boxHeight, 32);

        // Background rect
        group.append("rect")
          .attr("class", "annotation-bg")
          .attr("x", textX - boxWidth / 2)
          .attr("y", textY - boxHeight / 2)
          .attr("width", boxWidth)
          .attr("height", boxHeight)
          .attr("rx", 6)
          .attr("ry", 6)
          .attr("fill", "rgba(10, 18, 40, 0.88)")
          .attr("stroke", ann.color)
          .attr("stroke-width", 1)
          .attr("stroke-opacity", 0.6);

        // Text content
        var textEl = group.append("text")
          .attr("class", "annotation-text")
          .attr("x", textX)
          .attr("y", textY)
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", "#e0e0e0")
          .attr("font-size", "11px")
          .style("pointer-events", "none");

        // Word wrap the text
        self._wrapText(textEl, ann.text, boxWidth - 12);

        // Delete button (small x in top-right corner)
        var delGroup = group.append("g")
          .attr("class", "annotation-delete")
          .attr("transform", "translate(" + (textX + boxWidth / 2 - 8) + "," + (textY - boxHeight / 2 + 8) + ")")
          .style("cursor", "pointer")
          .style("opacity", 0);

        delGroup.append("circle")
          .attr("r", 7)
          .attr("fill", "rgba(239, 68, 68, 0.8)");

        delGroup.append("text")
          .attr("text-anchor", "middle")
          .attr("dominant-baseline", "central")
          .attr("fill", "#fff")
          .attr("font-size", "10px")
          .attr("font-weight", "bold")
          .text("\u00d7");

        delGroup.on("click", function () {
          d3.event.stopPropagation();
          self.remove(ann.id);
        });

        // Show delete button on hover
        group.on("mouseenter", function () {
          delGroup.transition().duration(150).style("opacity", 1);
        }).on("mouseleave", function () {
          delGroup.transition().duration(150).style("opacity", 0);
        });

        // Make the text box draggable
        var drag = d3.drag()
          .on("start", function () {
            d3.event.sourceEvent.stopPropagation();
          })
          .on("drag", function () {
            ann.offsetX += d3.event.dx;
            ann.offsetY += d3.event.dy;
            self.render();
          });

        group.select(".annotation-bg").call(drag);
      });
    },

    // Export annotations as JSON
    exportJSON: function () {
      var exportItems = this.items.map(function (item) {
        return {
          id: item.id,
          nodeId: item.nodeId,
          text: item.text,
          offsetX: item.offsetX,
          offsetY: item.offsetY,
          color: item.color
        };
      });
      return JSON.stringify(exportItems, null, 2);
    },

    // Import annotations from JSON
    importJSON: function (json) {
      try {
        var parsed = JSON.parse(json);
        if (!Array.isArray(parsed)) {
          if (typeof showToast === "function") {
            showToast("Invalid annotation data", "error");
          }
          return;
        }
        this.items = parsed;
        // Update nextId to avoid collisions
        this.items.forEach(function (item) {
          var numMatch = item.id.match(/ann-(\d+)/);
          if (numMatch) {
            var num = parseInt(numMatch[1], 10);
            if (num >= nextId) nextId = num + 1;
          }
        });
        this.render();
        if (typeof showToast === "function") {
          showToast("Imported " + parsed.length + " annotation(s)", "success");
        }
      } catch (e) {
        if (typeof showToast === "function") {
          showToast("Failed to parse annotation JSON", "error");
        }
      }
    },

    // Toggle annotation mode
    toggleMode: function () {
      annotationMode = !annotationMode;

      var btn = document.getElementById("btn-annotate");
      if (btn) {
        btn.classList.toggle("active", annotationMode);
      }

      if (annotationMode) {
        this._enableAnnotationClicks();
        if (typeof showToast === "function") {
          showToast("Annotation mode ON \u2014 click a node to annotate", "success");
        }
      } else {
        this._disableAnnotationClicks();
        if (typeof showToast === "function") {
          showToast("Annotation mode OFF", "success");
        }
      }
    },

    isActive: function () {
      return annotationMode;
    },

    // Update annotation positions when simulation ticks
    updatePositions: function () {
      if (this.items.length === 0) return;
      this.render();
    },

    // Helper: find a node DOM element by id
    _findNodeElement: function (nodeId) {
      var found = null;
      d3.selectAll("#molecule-container svg .node").each(function () {
        var datum = d3.select(this).datum();
        if (datum && datum.id === nodeId) {
          found = this;
        }
      });
      return found;
    },

    // Helper: word-wrap SVG text
    _wrapText: function (textEl, text, maxWidth) {
      var words = text.split(/\s+/);
      var line = [];
      var lineNumber = 0;
      var lineHeight = 14;
      var tspan = textEl.append("tspan")
        .attr("x", textEl.attr("x"))
        .attr("dy", 0);

      var totalLines = 1;
      var testLine = [];

      // First pass: count lines
      words.forEach(function (word) {
        testLine.push(word);
        if (testLine.join(" ").length * 6.5 > maxWidth) {
          testLine = [word];
          totalLines++;
        }
      });

      // Second pass: render centered vertically
      var startDy = -(totalLines - 1) * lineHeight / 2;
      tspan.attr("dy", startDy);
      line = [];

      for (var i = 0; i < words.length; i++) {
        line.push(words[i]);
        if (line.join(" ").length * 6.5 > maxWidth && line.length > 1) {
          line.pop();
          tspan.text(line.join(" "));
          line = [words[i]];
          lineNumber++;
          tspan = textEl.append("tspan")
            .attr("x", textEl.attr("x"))
            .attr("dy", lineHeight)
            .text(words[i]);
        } else {
          tspan.text(line.join(" "));
        }
      }
    },

    // Enable click-to-annotate on nodes
    _enableAnnotationClicks: function () {
      var self = this;
      this._annotationClickHandler = function () {
        var datum = d3.select(this).datum();
        if (!datum) return;
        d3.event.stopPropagation();

        // Prompt for annotation text
        self._showAnnotationPrompt(datum.id, datum.label);
      };

      d3.selectAll("#molecule-container svg .node")
        .on("click.annotation", this._annotationClickHandler);

      // Add visual indicator
      d3.selectAll("#molecule-container svg .node")
        .style("cursor", "crosshair");
    },

    _disableAnnotationClicks: function () {
      d3.selectAll("#molecule-container svg .node")
        .on("click.annotation", null)
        .style("cursor", null);
    },

    // Show a prompt dialog for entering annotation text
    _showAnnotationPrompt: function (nodeId, nodeLabel) {
      var self = this;

      // Remove existing prompt if any
      var existing = document.querySelector(".annotation-prompt");
      if (existing) existing.parentNode.removeChild(existing);

      var promptDiv = document.createElement("div");
      promptDiv.className = "annotation-prompt";
      promptDiv.innerHTML =
        '<div class="annotation-prompt-content">' +
          '<div class="annotation-prompt-title">Annotate: ' + nodeLabel + '</div>' +
          '<textarea class="annotation-prompt-input" placeholder="Enter annotation text..." rows="3"></textarea>' +
          '<div class="annotation-prompt-buttons">' +
            '<button class="annotation-prompt-cancel">Cancel</button>' +
            '<button class="annotation-prompt-save">Add Annotation</button>' +
          '</div>' +
        '</div>';

      document.body.appendChild(promptDiv);

      var input = promptDiv.querySelector(".annotation-prompt-input");
      input.focus();

      promptDiv.querySelector(".annotation-prompt-cancel").addEventListener("click", function () {
        promptDiv.parentNode.removeChild(promptDiv);
      });

      promptDiv.querySelector(".annotation-prompt-save").addEventListener("click", function () {
        var text = input.value.trim();
        if (text) {
          self.add(nodeId, text);
        }
        promptDiv.parentNode.removeChild(promptDiv);
      });

      // Submit on Enter (without Shift)
      input.addEventListener("keydown", function (e) {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          var text = input.value.trim();
          if (text) {
            self.add(nodeId, text);
          }
          promptDiv.parentNode.removeChild(promptDiv);
        } else if (e.key === "Escape") {
          promptDiv.parentNode.removeChild(promptDiv);
        }
      });
    }
  };
})();
