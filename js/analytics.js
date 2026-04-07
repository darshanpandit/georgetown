// ─────────────────────────────────────────────
//  Analytics Engine – Statistical analysis on travel data
//  Pure computation, no UI
// ─────────────────────────────────────────────

(function () {
  "use strict";

  // ── Helpers ──

  function buildAdjacency(nodes, links) {
    var adj = {};
    var nodeIds = nodes.map(function (n) { return n.id; });
    nodeIds.forEach(function (id) { adj[id] = {}; });
    links.forEach(function (l) {
      var s = typeof l.source === "object" ? l.source.id : l.source;
      var t = typeof l.target === "object" ? l.target.id : l.target;
      adj[s][t] = l.weight || 1;
      adj[t][s] = l.weight || 1;
    });
    return adj;
  }

  function getNodeIds(nodes) {
    return nodes.map(function (n) { return n.id; });
  }

  window.Analytics = {

    // ── Distribution Analysis ──

    entropy: function (shares) {
      var h = 0;
      for (var i = 0; i < shares.length; i++) {
        var p = shares[i];
        if (p > 0) {
          h -= p * Math.log2(p);
        }
      }
      return h;
    },

    effectiveNumber: function (shares) {
      var h = this.entropy(shares);
      return Math.pow(2, h);
    },

    theilIndex: function (shares) {
      var n = shares.length;
      if (n === 0) return 0;
      var mean = 0;
      for (var i = 0; i < n; i++) mean += shares[i];
      mean /= n;
      if (mean === 0) return 0;

      var T = 0;
      for (var j = 0; j < n; j++) {
        var x = shares[j];
        if (x > 0) {
          T += (x / mean) * Math.log(x / mean);
        }
      }
      return T / n;
    },

    // ── Network Analysis ──

    betweennessCentrality: function (nodes, links) {
      var ids = getNodeIds(nodes);
      var adj = buildAdjacency(nodes, links);
      var n = ids.length;
      var cb = {};
      ids.forEach(function (id) { cb[id] = 0; });

      // Brandes algorithm for unweighted shortest paths
      ids.forEach(function (s) {
        var stack = [];
        var pred = {};
        var sigma = {};
        var dist = {};
        ids.forEach(function (v) {
          pred[v] = [];
          sigma[v] = 0;
          dist[v] = -1;
        });
        sigma[s] = 1;
        dist[s] = 0;
        var queue = [s];

        while (queue.length > 0) {
          var v = queue.shift();
          stack.push(v);
          var neighbors = Object.keys(adj[v] || {});
          for (var i = 0; i < neighbors.length; i++) {
            var w = neighbors[i];
            if (dist[w] < 0) {
              queue.push(w);
              dist[w] = dist[v] + 1;
            }
            if (dist[w] === dist[v] + 1) {
              sigma[w] += sigma[v];
              pred[w].push(v);
            }
          }
        }

        var delta = {};
        ids.forEach(function (v) { delta[v] = 0; });
        while (stack.length > 0) {
          var w2 = stack.pop();
          for (var j = 0; j < pred[w2].length; j++) {
            var v2 = pred[w2][j];
            delta[v2] += (sigma[v2] / sigma[w2]) * (1 + delta[w2]);
          }
          if (w2 !== s) {
            cb[w2] += delta[w2];
          }
        }
      });

      // Normalize for undirected graph
      var norm = (n - 1) * (n - 2);
      if (norm > 0) {
        ids.forEach(function (id) {
          cb[id] = cb[id] / norm;
        });
      }

      return cb;
    },

    eigenvectorCentrality: function (nodes, links, iterations) {
      iterations = iterations || 20;
      var ids = getNodeIds(nodes);
      var adj = buildAdjacency(nodes, links);
      var n = ids.length;

      // Initialize all scores to 1
      var scores = {};
      ids.forEach(function (id) { scores[id] = 1.0; });

      for (var iter = 0; iter < iterations; iter++) {
        var newScores = {};
        var maxVal = 0;
        ids.forEach(function (id) {
          var sum = 0;
          var neighbors = Object.keys(adj[id] || {});
          for (var j = 0; j < neighbors.length; j++) {
            sum += scores[neighbors[j]] * (adj[id][neighbors[j]] || 1);
          }
          newScores[id] = sum;
          if (sum > maxVal) maxVal = sum;
        });

        // Normalize by max value
        if (maxVal > 0) {
          ids.forEach(function (id) {
            newScores[id] /= maxVal;
          });
        }
        scores = newScores;
      }

      return scores;
    },

    detectCommunities: function (nodes, links) {
      var ids = getNodeIds(nodes);
      var adj = buildAdjacency(nodes, links);

      // Label propagation algorithm
      var labels = {};
      ids.forEach(function (id, i) { labels[id] = i; });

      var maxIter = 50;
      for (var iter = 0; iter < maxIter; iter++) {
        var changed = false;
        // Shuffle order each iteration
        var shuffled = ids.slice();
        for (var k = shuffled.length - 1; k > 0; k--) {
          var r = Math.floor(Math.random() * (k + 1));
          var tmp = shuffled[k];
          shuffled[k] = shuffled[r];
          shuffled[r] = tmp;
        }

        for (var i = 0; i < shuffled.length; i++) {
          var node = shuffled[i];
          var neighbors = Object.keys(adj[node] || {});
          if (neighbors.length === 0) continue;

          // Count weighted label frequencies among neighbors
          var labelCounts = {};
          for (var j = 0; j < neighbors.length; j++) {
            var nLabel = labels[neighbors[j]];
            var w = adj[node][neighbors[j]] || 1;
            labelCounts[nLabel] = (labelCounts[nLabel] || 0) + w;
          }

          // Find most frequent label
          var bestLabel = labels[node];
          var bestCount = -1;
          var labelKeys = Object.keys(labelCounts);
          for (var m = 0; m < labelKeys.length; m++) {
            if (labelCounts[labelKeys[m]] > bestCount) {
              bestCount = labelCounts[labelKeys[m]];
              bestLabel = parseInt(labelKeys[m], 10);
            }
          }

          if (labels[node] !== bestLabel) {
            labels[node] = bestLabel;
            changed = true;
          }
        }

        if (!changed) break;
      }

      // Group nodes by label
      var communities = {};
      ids.forEach(function (id) {
        var lbl = labels[id];
        if (!communities[lbl]) communities[lbl] = [];
        communities[lbl].push(id);
      });

      return Object.keys(communities).map(function (key) {
        return communities[key];
      });
    },

    clusteringCoefficient: function (nodes, links) {
      var ids = getNodeIds(nodes);
      var adj = buildAdjacency(nodes, links);
      var totalCoeff = 0;
      var countNodes = 0;

      ids.forEach(function (v) {
        var neighbors = Object.keys(adj[v] || {});
        var k = neighbors.length;
        if (k < 2) return;

        var triangles = 0;
        for (var i = 0; i < k; i++) {
          for (var j = i + 1; j < k; j++) {
            if (adj[neighbors[i]] && adj[neighbors[i]][neighbors[j]]) {
              triangles++;
            }
          }
        }

        var possibleTriangles = (k * (k - 1)) / 2;
        totalCoeff += triangles / possibleTriangles;
        countNodes++;
      });

      return countNodes > 0 ? totalCoeff / countNodes : 0;
    },

    // ── Comparison Analysis ──

    jsDivergence: function (distribution1, distribution2) {
      // Jensen-Shannon divergence
      var n = Math.min(distribution1.length, distribution2.length);
      var m = [];
      for (var i = 0; i < n; i++) {
        m.push((distribution1[i] + distribution2[i]) / 2);
      }

      function klDiv(p, q) {
        var kl = 0;
        for (var j = 0; j < p.length; j++) {
          if (p[j] > 0 && q[j] > 0) {
            kl += p[j] * Math.log2(p[j] / q[j]);
          }
        }
        return kl;
      }

      return (klDiv(distribution1, m) + klDiv(distribution2, m)) / 2;
    },

    rankBiasedOverlap: function (ranking1, ranking2, p) {
      p = p || 0.9;
      var maxLen = Math.max(ranking1.length, ranking2.length);
      var rbo = 0;
      var set1 = {};
      var set2 = {};

      for (var d = 1; d <= maxLen; d++) {
        if (d <= ranking1.length) set1[ranking1[d - 1]] = true;
        if (d <= ranking2.length) set2[ranking2[d - 1]] = true;

        // Compute overlap at depth d
        var overlap = 0;
        var keys1 = Object.keys(set1);
        for (var k = 0; k < keys1.length; k++) {
          if (set2[keys1[k]]) overlap++;
        }

        var agreement = overlap / d;
        rbo += Math.pow(p, d - 1) * agreement;
      }

      return (1 - p) * rbo;
    },

    // ── Decomposition ──

    shiftShareDecomposition: function (baseDist, compareDist, baseWeights, compareWeights) {
      var n = baseDist.length;
      var structural = 0;
      var compositional = 0;
      var interaction = 0;

      for (var i = 0; i < n; i++) {
        var bw = baseWeights ? baseWeights[i] : 1 / n;
        var cw = compareWeights ? compareWeights[i] : 1 / n;
        var bd = baseDist[i];
        var cd = compareDist[i];

        // Structural: change in shares with base weights
        structural += bw * (cd - bd);
        // Compositional: change in weights with base shares
        compositional += (cw - bw) * bd;
        // Interaction: joint change
        interaction += (cw - bw) * (cd - bd);
      }

      return {
        structural: structural,
        compositional: compositional,
        interaction: interaction,
        total: structural + compositional + interaction
      };
    },

    // ── Summary ──

    fullReport: function (data) {
      var nodes = data.nodes;
      var links = data.links;
      var shares = nodes.map(function (n) { return n.share; });
      var ids = getNodeIds(nodes);
      var n = nodes.length;

      // Distribution metrics
      var entropyVal = this.entropy(shares);
      var maxEntropy = Math.log2(n);
      var effectiveNum = this.effectiveNumber(shares);
      var theil = this.theilIndex(shares);

      // HHI
      var hhi = 0;
      for (var i = 0; i < shares.length; i++) {
        hhi += shares[i] * shares[i];
      }

      // Gini
      var sorted = shares.slice().sort(function (a, b) { return a - b; });
      var gini = 0;
      if (n > 1) {
        var sumDiffs = 0;
        var totalShare = 0;
        for (var ii = 0; ii < n; ii++) {
          totalShare += sorted[ii];
          for (var jj = 0; jj < n; jj++) {
            sumDiffs += Math.abs(sorted[ii] - sorted[jj]);
          }
        }
        var meanShare = totalShare / n;
        if (meanShare > 0) {
          gini = sumDiffs / (2 * n * n * meanShare);
        }
      }

      // Network metrics
      var possibleLinks = n > 1 ? (n * (n - 1)) / 2 : 1;
      var density = links.length / possibleLinks;
      var avgClustering = this.clusteringCoefficient(nodes, links);
      var communities = this.detectCommunities(nodes, links);
      var betweenness = this.betweennessCentrality(nodes, links);
      var eigenvector = this.eigenvectorCentrality(nodes, links, 20);

      // Sorted central nodes
      var centralNodes = ids.map(function (id) {
        return { id: id, betweenness: betweenness[id], eigenvector: eigenvector[id] };
      }).sort(function (a, b) { return b.betweenness - a.betweenness; });

      // Find dominant node
      var sortedByShare = nodes.slice().sort(function (a, b) { return b.share - a.share; });
      var dominant = sortedByShare[0];

      // Build insights
      var insights = [];

      // Concentration insight
      var concentrationWord = effectiveNum < 3 ? "highly concentrated" :
        effectiveNum < 5 ? "moderately concentrated" : "well distributed";
      insights.push(
        "The mode distribution is " + concentrationWord +
        " (effective number: " + effectiveNum.toFixed(2) + " modes)" +
        (dominant ? ", dominated by " + dominant.label.toLowerCase() + " travel" : "")
      );

      // Centrality insight
      if (centralNodes.length > 0) {
        var topCentral = centralNodes[0];
        var nodeLabel = "";
        for (var ci = 0; ci < nodes.length; ci++) {
          if (nodes[ci].id === topCentral.id) { nodeLabel = nodes[ci].label; break; }
        }
        insights.push(
          nodeLabel + " has the highest betweenness centrality (" +
          topCentral.betweenness.toFixed(2) +
          "), serving as the critical connector between travel modes"
        );
      }

      // Community insight
      if (communities.length > 1) {
        var communityDescs = communities.map(function (c) {
          return c.join(", ");
        });
        insights.push(
          communities.length + " distinct communities emerge: " +
          communityDescs.map(function (d) { return "(" + d + ")"; }).join(" and ")
        );
      } else {
        insights.push(
          "All modes form a single interconnected community, suggesting strong multimodal integration"
        );
      }

      // Inequality insight
      if (gini > 0.5) {
        insights.push(
          "High inequality in mode usage (Gini: " + gini.toFixed(2) +
          ", Theil: " + theil.toFixed(2) +
          ") suggests significant disparities in transportation options"
        );
      }

      // Clustering insight
      if (avgClustering > 0.5) {
        insights.push(
          "High clustering coefficient (" + avgClustering.toFixed(2) +
          ") indicates strong triadic closure — connected modes tend to share connections"
        );
      }

      return {
        distribution: {
          entropy: parseFloat(entropyVal.toFixed(4)),
          normalizedEntropy: parseFloat((maxEntropy > 0 ? entropyVal / maxEntropy : 0).toFixed(4)),
          effectiveNumber: parseFloat(effectiveNum.toFixed(4)),
          hhi: parseFloat(hhi.toFixed(4)),
          gini: parseFloat(gini.toFixed(4)),
          theilIndex: parseFloat(theil.toFixed(4))
        },
        network: {
          density: parseFloat(density.toFixed(4)),
          avgClustering: parseFloat(avgClustering.toFixed(4)),
          communities: communities,
          centralNodes: centralNodes.map(function (cn) {
            return {
              id: cn.id,
              betweenness: parseFloat(cn.betweenness.toFixed(4)),
              eigenvector: parseFloat(cn.eigenvector.toFixed(4))
            };
          })
        },
        insights: insights
      };
    }
  };

})();
