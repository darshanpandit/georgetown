// ─────────────────────────────────────────────
//  Equity Analysis – Transportation equity metrics across demographics
// ─────────────────────────────────────────────

(function () {
  "use strict";

  // Parse demographic CSV data into structured format
  // Returns { dimension: { category: { mode: share, ... }, ... }, ... }
  function parseDemographicData(data) {
    if (data._parsed) return data;
    // If already in structured format, return as-is
    if (!Array.isArray(data)) return data;

    var result = {};
    data.forEach(function (row) {
      var dim = row.demographic;
      var cat = row.category;
      var mode = row.mode;
      var share = parseFloat(row.share);
      if (!result[dim]) result[dim] = {};
      if (!result[dim][cat]) result[dim][cat] = {};
      result[dim][cat][mode] = share;
    });
    result._parsed = true;
    return result;
  }

  // Get effective number of modes (exponential of Shannon entropy)
  function effectiveNumber(shares) {
    var h = 0;
    for (var i = 0; i < shares.length; i++) {
      var p = shares[i];
      if (p > 0) h -= p * Math.log2(p);
    }
    return Math.pow(2, h);
  }

  // Extract share values from a category's mode map
  function getShares(modeMap) {
    var shares = [];
    var keys = Object.keys(modeMap);
    for (var i = 0; i < keys.length; i++) {
      if (keys[i] !== "_parsed") shares.push(modeMap[keys[i]]);
    }
    return shares;
  }

  // Compute auto share for a category
  function autoShare(modeMap) {
    return modeMap.car || modeMap["car/truck"] || modeMap.Car || 0;
  }

  // Compute transit share (bus + subway/rail)
  function transitShare(modeMap) {
    var t = 0;
    var keys = Object.keys(modeMap);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i].toLowerCase();
      if (k === "transit_bus" || k === "bus" || k === "subway_rail" || k === "subway" || k === "rail") {
        t += modeMap[keys[i]];
      }
    }
    return t;
  }

  window.EquityAnalysis = {

    modeDiversity: function (demographicData) {
      var parsed = parseDemographicData(demographicData);
      var result = {};

      var dimensions = Object.keys(parsed);
      dimensions.forEach(function (dim) {
        if (dim === "_parsed") return;
        result[dim] = {};
        var categories = Object.keys(parsed[dim]);
        categories.forEach(function (cat) {
          var shares = getShares(parsed[dim][cat]);
          result[dim][cat] = parseFloat(effectiveNumber(shares).toFixed(4));
        });
      });

      return result;
    },

    autoDependency: function (demographicData) {
      var parsed = parseDemographicData(demographicData);
      var result = {};

      var dimensions = Object.keys(parsed);
      dimensions.forEach(function (dim) {
        if (dim === "_parsed") return;
        result[dim] = {};
        var categories = Object.keys(parsed[dim]);
        categories.forEach(function (cat) {
          result[dim][cat] = parseFloat(autoShare(parsed[dim][cat]).toFixed(4));
        });
      });

      return result;
    },

    transitAccessGap: function (demographicData) {
      var parsed = parseDemographicData(demographicData);
      var result = {};

      var dimensions = Object.keys(parsed);
      dimensions.forEach(function (dim) {
        if (dim === "_parsed") return;
        var categories = Object.keys(parsed[dim]);
        var transitShares = [];
        categories.forEach(function (cat) {
          transitShares.push({
            category: cat,
            share: transitShare(parsed[dim][cat])
          });
        });

        transitShares.sort(function (a, b) { return b.share - a.share; });
        var highest = transitShares[0];
        var lowest = transitShares[transitShares.length - 1];

        result[dim] = {
          highest: { category: highest.category, transitShare: parseFloat(highest.share.toFixed(4)) },
          lowest: { category: lowest.category, transitShare: parseFloat(lowest.share.toFixed(4)) },
          ratio: lowest.share > 0
            ? parseFloat((highest.share / lowest.share).toFixed(2))
            : Infinity
        };
      });

      return result;
    },

    atkinsonIndex: function (shares, epsilon) {
      epsilon = epsilon !== undefined ? epsilon : 0.5;
      var n = shares.length;
      if (n === 0) return 0;

      var mean = 0;
      for (var i = 0; i < n; i++) mean += shares[i];
      mean /= n;
      if (mean === 0) return 0;

      if (epsilon === 1) {
        // Geometric mean case
        var logSum = 0;
        for (var j = 0; j < n; j++) {
          if (shares[j] > 0) {
            logSum += Math.log(shares[j]);
          } else {
            return 1; // Perfect inequality if any share is 0
          }
        }
        var geoMean = Math.exp(logSum / n);
        return parseFloat((1 - geoMean / mean).toFixed(6));
      }

      // General case
      var sumPow = 0;
      for (var k = 0; k < n; k++) {
        if (shares[k] > 0) {
          sumPow += Math.pow(shares[k], 1 - epsilon);
        }
      }
      var ede = Math.pow(sumPow / n, 1 / (1 - epsilon)); // Equally Distributed Equivalent
      return parseFloat((1 - ede / mean).toFixed(6));
    },

    palmaRatio: function (demographicData) {
      var diversity = this.modeDiversity(demographicData);
      var result = {};

      var dimensions = Object.keys(diversity);
      dimensions.forEach(function (dim) {
        var categories = Object.keys(diversity[dim]);
        var diversities = categories.map(function (cat) {
          return { category: cat, diversity: diversity[dim][cat] };
        }).sort(function (a, b) { return a.diversity - b.diversity; });

        var n = diversities.length;
        // Bottom 40%
        var bottom40Count = Math.max(1, Math.round(n * 0.4));
        // Top 10%
        var top10Count = Math.max(1, Math.round(n * 0.1));

        var bottomSum = 0;
        for (var i = 0; i < bottom40Count; i++) {
          bottomSum += diversities[i].diversity;
        }

        var topSum = 0;
        for (var j = n - top10Count; j < n; j++) {
          topSum += diversities[j].diversity;
        }

        var bottomAvg = bottomSum / bottom40Count;
        var topAvg = topSum / top10Count;

        result[dim] = {
          top10Avg: parseFloat(topAvg.toFixed(4)),
          bottom40Avg: parseFloat(bottomAvg.toFixed(4)),
          ratio: bottomAvg > 0 ? parseFloat((topAvg / bottomAvg).toFixed(4)) : Infinity,
          top10Groups: diversities.slice(n - top10Count).map(function (d) { return d.category; }),
          bottom40Groups: diversities.slice(0, bottom40Count).map(function (d) { return d.category; })
        };
      });

      return result;
    },

    equityReport: function (demographicData) {
      var parsed = parseDemographicData(demographicData);
      var diversity = this.modeDiversity(demographicData);
      var autoDep = this.autoDependency(demographicData);
      var transitGap = this.transitAccessGap(demographicData);
      var palma = this.palmaRatio(demographicData);

      var dimensions = {};
      var overallScores = [];

      var dimKeys = Object.keys(diversity);
      for (var d = 0; d < dimKeys.length; d++) {
        var dim = dimKeys[d];
        var categories = Object.keys(diversity[dim]);
        if (categories.length === 0) continue;

        // Mode diversity range
        var diversities = categories.map(function (c) { return diversity[dim][c]; });
        var maxDiv = Math.max.apply(null, diversities);
        var minDiv = Math.min.apply(null, diversities);
        var diversityGap = minDiv > 0 ? parseFloat((maxDiv / minDiv).toFixed(2)) : Infinity;

        // Auto dependency range
        var autoDeps = categories.map(function (c) { return autoDep[dim][c]; });
        var autoRange = [
          parseFloat(Math.min.apply(null, autoDeps).toFixed(2)),
          parseFloat(Math.max.apply(null, autoDeps).toFixed(2))
        ];

        // Atkinson index on diversities
        var atkinson = this.atkinsonIndex(diversities, 0.5);

        // Grade based on composite score
        var gapScore = diversityGap > 1 ? Math.min(diversityGap / 3, 1) : 0;
        var autoSpread = autoRange[1] - autoRange[0];
        var autoScore = Math.min(autoSpread / 0.3, 1);
        var transitRatio = transitGap[dim] ? (transitGap[dim].ratio === Infinity ? 10 : transitGap[dim].ratio) : 1;
        var transitScore = Math.min((transitRatio - 1) / 5, 1);

        var composite = 1 - (gapScore * 0.3 + autoScore * 0.3 + transitScore * 0.3 + atkinson * 0.1);
        composite = Math.max(0, Math.min(1, composite));
        overallScores.push(composite);

        var grade;
        if (composite >= 0.8) grade = "A";
        else if (composite >= 0.65) grade = "B";
        else if (composite >= 0.5) grade = "C";
        else if (composite >= 0.35) grade = "D";
        else grade = "F";

        dimensions[dim] = {
          modeDiversityGap: diversityGap,
          modeDiversityRange: [parseFloat(minDiv.toFixed(2)), parseFloat(maxDiv.toFixed(2))],
          autoDependencyRange: autoRange,
          transitAccessGap: transitGap[dim] ? transitGap[dim].ratio : null,
          atkinsonIndex: atkinson,
          palmaRatio: palma[dim] ? palma[dim].ratio : null,
          compositeScore: parseFloat(composite.toFixed(2)),
          grade: grade
        };
      }

      // Overall equity score
      var overallEquity = 0;
      if (overallScores.length > 0) {
        for (var s = 0; s < overallScores.length; s++) {
          overallEquity += overallScores[s];
        }
        overallEquity /= overallScores.length;
      }

      // Identify disadvantaged groups
      var disadvantaged = this.identifyDisadvantaged(demographicData);

      return {
        dimensions: dimensions,
        disadvantagedGroups: disadvantaged,
        overallEquityScore: parseFloat(overallEquity.toFixed(2))
      };
    },

    identifyDisadvantaged: function (demographicData) {
      var diversity = this.modeDiversity(demographicData);
      var autoDep = this.autoDependency(demographicData);
      var parsed = parseDemographicData(demographicData);

      // Collect all groups with their metrics
      var groups = [];
      var dimKeys = Object.keys(diversity);
      for (var d = 0; d < dimKeys.length; d++) {
        var dim = dimKeys[d];
        var categories = Object.keys(diversity[dim]);
        categories.forEach(function (cat) {
          groups.push({
            dimension: dim,
            category: cat,
            diversity: diversity[dim][cat],
            autoDependency: autoDep[dim][cat],
            transitAccess: transitShare(parsed[dim][cat])
          });
        });
      }

      // Score each group: lower diversity + higher auto dependency + lower transit = worse off
      var allDiversities = groups.map(function (g) { return g.diversity; });
      var allAuto = groups.map(function (g) { return g.autoDependency; });
      var allTransit = groups.map(function (g) { return g.transitAccess; });

      var maxDiv = Math.max.apply(null, allDiversities);
      var minDiv = Math.min.apply(null, allDiversities);
      var maxAuto = Math.max.apply(null, allAuto);
      var minAuto = Math.min.apply(null, allAuto);
      var maxTransit = Math.max.apply(null, allTransit);
      var minTransit = Math.min.apply(null, allTransit);

      var divRange = maxDiv - minDiv || 1;
      var autoRange = maxAuto - minAuto || 1;
      var transitRange = maxTransit - minTransit || 1;

      groups.forEach(function (g) {
        // Disadvantage score: 0 = best off, 1 = worst off
        var divScore = 1 - (g.diversity - minDiv) / divRange;
        var autoScore = (g.autoDependency - minAuto) / autoRange;
        var transitScore = 1 - (g.transitAccess - minTransit) / transitRange;
        g.disadvantageScore = (divScore + autoScore + transitScore) / 3;
      });

      groups.sort(function (a, b) { return b.disadvantageScore - a.disadvantageScore; });

      // Return top disadvantaged groups
      var threshold = 0.6;
      var disadvantaged = [];
      for (var i = 0; i < groups.length; i++) {
        var g = groups[i];
        if (g.disadvantageScore < threshold && disadvantaged.length > 0) break;

        var reasons = [];
        if (g.diversity <= minDiv + divRange * 0.25) reasons.push("lowest mode diversity");
        if (g.autoDependency >= maxAuto - autoRange * 0.25) reasons.push("highest auto-dependency");
        if (g.transitAccess <= minTransit + transitRange * 0.25) reasons.push("lowest transit access");

        if (reasons.length > 0) {
          disadvantaged.push({
            group: g.dimension + ": " + g.category,
            dimension: g.dimension,
            category: g.category,
            disadvantageScore: parseFloat(g.disadvantageScore.toFixed(2)),
            diversity: g.diversity,
            autoDependency: parseFloat(g.autoDependency.toFixed(2)),
            transitAccess: parseFloat(g.transitAccess.toFixed(4)),
            reasons: reasons
          });
        }

        if (disadvantaged.length >= 5) break;
      }

      return disadvantaged;
    }
  };

})();
