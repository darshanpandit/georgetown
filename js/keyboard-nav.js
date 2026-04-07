(function() {
  "use strict";

  window.KeyboardNav = {
    enabled: true,
    focusedNodeIndex: -1,
    nodes: [],

    init: function(getNodes, onFocus, onSelect) {
      this.getNodes = getNodes;
      this.onFocus = onFocus;
      this.onSelect = onSelect;

      document.addEventListener("keydown", function(e) {
        if (!KeyboardNav.enabled) return;
        if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;

        KeyboardNav.nodes = KeyboardNav.getNodes();

        switch(e.key) {
          case "Tab":
            e.preventDefault();
            if (e.shiftKey) KeyboardNav.prev(); else KeyboardNav.next();
            break;
          case "Enter":
          case " ":
            e.preventDefault();
            KeyboardNav.select();
            break;
          case "Escape":
            KeyboardNav.clear();
            break;
          case "/":
            e.preventDefault();
            KeyboardNav.openSearch();
            break;
          case "1":
            // Switch to Mode view
            if (typeof switchTo === "function") switchTo("mode");
            break;
          case "2":
            // Switch to Activity view
            if (typeof switchTo === "function") switchTo("activity");
            break;
          case "3":
            if (typeof switchTo === "function") switchTo("sankey");
            break;
          case "4":
            if (typeof switchTo === "function") switchTo("chord");
            break;
          case "t":
            if (typeof StoryMode !== "undefined" && StoryMode.start) StoryMode.start();
            break;
          case "a":
            if (typeof Annotations !== "undefined" && Annotations.toggleMode) Annotations.toggleMode();
            break;
          case "?":
            KeyboardNav.showHelp();
            break;
        }
      });
    },

    next: function() {
      this.focusedNodeIndex = (this.focusedNodeIndex + 1) % this.nodes.length;
      this.onFocus(this.nodes[this.focusedNodeIndex]);
    },

    prev: function() {
      this.focusedNodeIndex = this.focusedNodeIndex <= 0 ? this.nodes.length - 1 : this.focusedNodeIndex - 1;
      this.onFocus(this.nodes[this.focusedNodeIndex]);
    },

    select: function() {
      if (this.focusedNodeIndex >= 0 && this.nodes[this.focusedNodeIndex]) {
        this.onSelect(this.nodes[this.focusedNodeIndex]);
      }
    },

    clear: function() {
      this.focusedNodeIndex = -1;
      this.onFocus(null);
    },

    openSearch: function() {
      var searchBox = document.getElementById("node-search");
      if (searchBox) {
        searchBox.parentElement.classList.add("visible");
        searchBox.focus();
      }
    },

    showHelp: function() {
      // Show/hide keyboard shortcut overlay
      var help = document.getElementById("keyboard-help");
      if (help) help.classList.toggle("visible");
    }
  };
})();
