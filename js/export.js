(function () {
  "use strict";

  /**
   * Inline computed styles from the document into a cloned SVG element
   * so that the exported file renders correctly standalone.
   */
  function inlineStyles(original, clone) {
    var originalChildren = original.querySelectorAll("*");
    var cloneChildren = clone.querySelectorAll("*");
    for (var i = 0; i < originalChildren.length; i++) {
      var computed = window.getComputedStyle(originalChildren[i]);
      var style = "";
      for (var j = 0; j < computed.length; j++) {
        var prop = computed[j];
        style += prop + ":" + computed.getPropertyValue(prop) + ";";
      }
      cloneChildren[i].setAttribute("style", style);
    }
  }

  /**
   * Prepare a standalone SVG clone with inlined styles and XML namespace.
   */
  function prepareSVGClone(svgElement) {
    var clone = svgElement.cloneNode(true);
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");

    // Add a dark background rect matching the page theme
    var bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    bg.setAttribute("width", "100%");
    bg.setAttribute("height", "100%");
    bg.setAttribute("fill", "#041E42");
    clone.insertBefore(bg, clone.firstChild);

    inlineStyles(svgElement, clone);
    return clone;
  }

  /**
   * Trigger a file download in the browser.
   */
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 5000);
  }

  window.ExportTools = {
    /**
     * Export current SVG as a downloadable SVG file.
     */
    exportSVG: function (svgElement, filename) {
      if (!svgElement) {
        svgElement = document.querySelector("#molecule-container svg");
      }
      if (!svgElement) {
        if (typeof showToast === "function") showToast("No visualization to export", "error");
        return;
      }
      filename = filename || "travel-molecule.svg";

      var clone = prepareSVGClone(svgElement);
      var serializer = new XMLSerializer();
      var svgString = serializer.serializeToString(clone);
      var blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
      downloadBlob(blob, filename);
      if (typeof showToast === "function") showToast("Exported SVG", "success");
    },

    /**
     * Export current SVG as a PNG image.
     * @param {Element} svgElement - the SVG DOM element
     * @param {string} filename - output filename
     * @param {number} scale - resolution multiplier (default 2 for retina)
     */
    exportPNG: function (svgElement, filename, scale) {
      if (!svgElement) {
        svgElement = document.querySelector("#molecule-container svg");
      }
      if (!svgElement) {
        if (typeof showToast === "function") showToast("No visualization to export", "error");
        return;
      }
      filename = filename || "travel-molecule.png";
      scale = scale || 2;

      var clone = prepareSVGClone(svgElement);
      var serializer = new XMLSerializer();
      var svgString = serializer.serializeToString(clone);
      var svgDataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgString);

      var viewBox = svgElement.getAttribute("viewBox");
      var parts = viewBox ? viewBox.split(/\s+/) : [];
      var width = parts.length >= 4 ? parseInt(parts[2], 10) : svgElement.clientWidth || 960;
      var height = parts.length >= 4 ? parseInt(parts[3], 10) : svgElement.clientHeight || 620;

      var canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      var ctx = canvas.getContext("2d");

      var img = new Image();
      img.onload = function () {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(function (blob) {
          if (blob) {
            downloadBlob(blob, filename);
            if (typeof showToast === "function") showToast("Exported PNG", "success");
          } else {
            if (typeof showToast === "function") showToast("PNG export failed", "error");
          }
        }, "image/png");
      };
      img.onerror = function () {
        if (typeof showToast === "function") showToast("PNG export failed", "error");
      };
      img.src = svgDataUrl;
    },

    /**
     * Export visualization data as CSV (nodes + links).
     */
    exportDataCSV: function (data, filename) {
      if (!data) {
        data = { nodes: window.getMoleculeNodes ? window.getMoleculeNodes() : [], links: [] };
      }
      filename = filename || "travel-molecule-data.csv";

      var lines = [];
      // Nodes section
      lines.push("type,id,label,share,color");
      if (data.nodes) {
        data.nodes.forEach(function (n) {
          lines.push("node," + csvEscape(n.id) + "," + csvEscape(n.label) + "," + n.share + "," + csvEscape(n.color));
        });
      }
      // Blank separator
      lines.push("");
      lines.push("type,source,target,weight");
      if (data.links) {
        data.links.forEach(function (l) {
          var src = typeof l.source === "object" ? l.source.id : l.source;
          var tgt = typeof l.target === "object" ? l.target.id : l.target;
          var weight = l.weight !== undefined ? l.weight : l.value;
          lines.push("link," + csvEscape(src) + "," + csvEscape(tgt) + "," + weight);
        });
      }

      var csvContent = lines.join("\n");
      var blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      downloadBlob(blob, filename);
      if (typeof showToast === "function") showToast("Exported CSV", "success");
    },

    /**
     * Export visualization data as pretty-printed JSON.
     */
    exportDataJSON: function (data, filename) {
      if (!data) {
        data = { nodes: window.getMoleculeNodes ? window.getMoleculeNodes() : [], links: [] };
      }
      filename = filename || "travel-molecule-data.json";

      // Clean up D3 simulation properties from nodes
      var cleanData = {
        nodes: (data.nodes || []).map(function (n) {
          return { id: n.id, label: n.label, share: n.share, color: n.color };
        }),
        links: (data.links || []).map(function (l) {
          var src = typeof l.source === "object" ? l.source.id : l.source;
          var tgt = typeof l.target === "object" ? l.target.id : l.target;
          var weight = l.weight !== undefined ? l.weight : l.value;
          return { source: src, target: tgt, weight: weight };
        })
      };

      var jsonString = JSON.stringify(cleanData, null, 2);
      var blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
      downloadBlob(blob, filename);
      if (typeof showToast === "function") showToast("Exported JSON", "success");
    }
  };

  /** Escape a value for CSV output. */
  function csvEscape(val) {
    if (val === null || val === undefined) return "";
    var str = String(val);
    if (str.indexOf(",") !== -1 || str.indexOf('"') !== -1 || str.indexOf("\n") !== -1) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  }
})();
