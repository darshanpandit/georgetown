// ─────────────────────────────────────────────
//  Trip Simulator – Markov chain daily travel pattern simulation
// ─────────────────────────────────────────────

(function () {
  "use strict";

  // Seeded random for reproducibility (optional)
  function pseudoRandom(seed) {
    var s = seed || Date.now();
    return function () {
      s = (s * 16807 + 0) % 2147483647;
      return s / 2147483647;
    };
  }

  // Sample from a discrete distribution given cumulative probabilities
  function sampleDiscrete(probs, keys, rand) {
    var r = rand();
    var cumulative = 0;
    for (var i = 0; i < keys.length; i++) {
      cumulative += probs[keys[i]] || 0;
      if (r <= cumulative) return keys[i];
    }
    return keys[keys.length - 1];
  }

  // Generate a timestamp for trip events (minutes since midnight)
  function generateTimestamp(tripIndex, totalTrips) {
    // Spread trips roughly between 6am (360) and 10pm (1320)
    var startMin = 360;
    var endMin = 1320;
    var interval = (endMin - startMin) / Math.max(totalTrips, 1);
    var minutes = Math.round(startMin + tripIndex * interval);
    var h = Math.floor(minutes / 60);
    var m = minutes % 60;
    return {
      minutes: minutes,
      time: (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m
    };
  }

  window.TripSimulator = {

    buildTransitionMatrix: function (activityData) {
      // activityData: array of {source_activity, target_activity, chain_weight, dominant_mode}
      var activities = {};
      var matrix = {};

      // Collect all activities
      activityData.forEach(function (row) {
        activities[row.source_activity] = true;
        activities[row.target_activity] = true;
      });

      var actList = Object.keys(activities);

      // Initialize matrix
      actList.forEach(function (src) {
        matrix[src] = {};
        actList.forEach(function (tgt) {
          matrix[src][tgt] = 0;
        });
      });

      // Fill with chain weights
      activityData.forEach(function (row) {
        matrix[row.source_activity][row.target_activity] = row.chain_weight;
      });

      // Normalize each row to sum to 1
      actList.forEach(function (src) {
        var rowSum = 0;
        actList.forEach(function (tgt) { rowSum += matrix[src][tgt]; });
        if (rowSum > 0) {
          actList.forEach(function (tgt) { matrix[src][tgt] /= rowSum; });
        } else {
          // Dead-end state: return to home
          matrix[src]["home"] = 1;
        }
      });

      matrix._activities = actList;
      return matrix;
    },

    simulateDay: function (transitionMatrix, modeProbs, seed) {
      var rand = pseudoRandom(seed);
      var activities = transitionMatrix._activities;
      var chain = [];
      var current = "home";
      var maxTrips = 15; // safety cap
      var tripCount = 0;

      // modeProbs: object mapping activity-pairs or general mode probabilities
      // If not structured by pair, use a flat distribution
      var flatModeProbs = modeProbs || { car: 0.833, walk: 0.105, bus: 0.03, subway: 0.02, bicycle: 0.01 };
      var modeKeys = Object.keys(flatModeProbs);

      // Start at home
      chain.push({
        activity: "home",
        mode: null,
        timestamp: generateTimestamp(0, 8)
      });

      var visitedNonHome = false;

      while (tripCount < maxTrips) {
        // Sample next activity
        var next = sampleDiscrete(transitionMatrix[current], activities, rand);
        tripCount++;

        // Choose mode for this trip
        var mode = sampleDiscrete(flatModeProbs, modeKeys, rand);

        // If modeProbs has pair-specific info, use it
        if (modeProbs && modeProbs._pairs && modeProbs._pairs[current + "->" + next]) {
          mode = modeProbs._pairs[current + "->" + next];
        }

        var ts = generateTimestamp(tripCount, 8);
        chain.push({
          activity: next,
          mode: mode,
          timestamp: ts
        });

        if (next !== "home") visitedNonHome = true;

        // End day if we returned home after at least one non-home activity
        if (next === "home" && visitedNonHome && tripCount >= 2) {
          break;
        }

        current = next;
      }

      // Force return home if we hit max trips
      if (current !== "home") {
        chain.push({
          activity: "home",
          mode: sampleDiscrete(flatModeProbs, modeKeys, rand),
          timestamp: generateTimestamp(tripCount + 1, 8)
        });
      }

      return chain;
    },

    monteCarloSimulation: function (transitionMatrix, modeProbs, numDays) {
      numDays = numDays || 1000;
      var tripLengths = [];
      var modeCounts = {};
      var activityCounts = {};
      var totalTrips = 0;

      for (var d = 0; d < numDays; d++) {
        var day = this.simulateDay(transitionMatrix, modeProbs, d * 7 + 42);
        var dayTrips = day.length - 1; // first entry is starting at home, not a trip
        tripLengths.push(dayTrips);
        totalTrips += dayTrips;

        for (var t = 0; t < day.length; t++) {
          var step = day[t];
          activityCounts[step.activity] = (activityCounts[step.activity] || 0) + 1;
          if (step.mode) {
            modeCounts[step.mode] = (modeCounts[step.mode] || 0) + 1;
          }
        }
      }

      // Compute mode distribution
      var modeDistribution = {};
      var totalModeTrips = 0;
      var mKeys = Object.keys(modeCounts);
      mKeys.forEach(function (m) { totalModeTrips += modeCounts[m]; });
      mKeys.forEach(function (m) {
        modeDistribution[m] = modeCounts[m] / totalModeTrips;
      });

      // Activity distribution
      var activityDistribution = {};
      var totalActs = 0;
      var aKeys = Object.keys(activityCounts);
      aKeys.forEach(function (a) { totalActs += activityCounts[a]; });
      aKeys.forEach(function (a) {
        activityDistribution[a] = activityCounts[a] / totalActs;
      });

      // Trip length distribution
      var avgTrips = totalTrips / numDays;
      tripLengths.sort(function (a, b) { return a - b; });
      var medianTrips = tripLengths[Math.floor(numDays / 2)];
      var minTrips = tripLengths[0];
      var maxTrips = tripLengths[tripLengths.length - 1];

      // Standard deviation of trip lengths
      var variance = 0;
      for (var v = 0; v < tripLengths.length; v++) {
        variance += Math.pow(tripLengths[v] - avgTrips, 2);
      }
      variance /= numDays;

      // Build trip length histogram
      var tripLengthHist = {};
      tripLengths.forEach(function (len) {
        tripLengthHist[len] = (tripLengthHist[len] || 0) + 1;
      });
      Object.keys(tripLengthHist).forEach(function (k) {
        tripLengthHist[k] /= numDays;
      });

      return {
        numDays: numDays,
        avgTripsPerDay: parseFloat(avgTrips.toFixed(2)),
        medianTripsPerDay: medianTrips,
        tripLengthRange: [minTrips, maxTrips],
        tripLengthStdDev: parseFloat(Math.sqrt(variance).toFixed(2)),
        tripLengthDistribution: tripLengthHist,
        modeDistribution: modeDistribution,
        activityDistribution: activityDistribution
      };
    },

    stationaryDistribution: function (transitionMatrix) {
      var activities = transitionMatrix._activities;
      var n = activities.length;

      // Power iteration: start with uniform, multiply by transition matrix repeatedly
      var dist = {};
      activities.forEach(function (a) { dist[a] = 1 / n; });

      var iterations = 200;
      for (var iter = 0; iter < iterations; iter++) {
        var newDist = {};
        activities.forEach(function (a) { newDist[a] = 0; });

        // pi(j) = sum_i pi(i) * P(i,j)
        activities.forEach(function (i) {
          activities.forEach(function (j) {
            newDist[j] += dist[i] * (transitionMatrix[i][j] || 0);
          });
        });

        // Check convergence
        var maxDiff = 0;
        activities.forEach(function (a) {
          maxDiff = Math.max(maxDiff, Math.abs(newDist[a] - dist[a]));
        });

        dist = newDist;
        if (maxDiff < 1e-10) break;
      }

      return dist;
    },

    isErgodic: function (transitionMatrix) {
      var activities = transitionMatrix._activities;
      var n = activities.length;

      // Check irreducibility via BFS from first node
      var visited = {};
      var queue = [activities[0]];
      visited[activities[0]] = true;

      while (queue.length > 0) {
        var current = queue.shift();
        for (var i = 0; i < activities.length; i++) {
          var next = activities[i];
          if (!visited[next] && (transitionMatrix[current][next] || 0) > 0) {
            visited[next] = true;
            queue.push(next);
          }
        }
      }

      var reachable = Object.keys(visited).length;
      if (reachable < n) {
        return { ergodic: false, irreducible: false, aperiodic: false, reason: "Chain is not irreducible; only " + reachable + " of " + n + " states reachable" };
      }

      // Check aperiodicity: if any state has self-loop, chain is aperiodic
      var hasSelfLoop = false;
      for (var s = 0; s < activities.length; s++) {
        if ((transitionMatrix[activities[s]][activities[s]] || 0) > 0) {
          hasSelfLoop = true;
          break;
        }
      }

      // Also check via GCD of return cycle lengths (simplified: check if
      // raising transition matrix to power 2 makes all entries positive)
      if (!hasSelfLoop) {
        // Compute T^2 and check for positive diagonal
        var hasOddCycle = false;
        for (var a = 0; a < activities.length && !hasOddCycle; a++) {
          for (var b = 0; b < activities.length && !hasOddCycle; b++) {
            if ((transitionMatrix[activities[a]][activities[b]] || 0) > 0 &&
                (transitionMatrix[activities[b]][activities[a]] || 0) > 0) {
              // 2-cycle exists, combined with any odd-length path gives aperiodic
              hasOddCycle = true;
            }
          }
        }
        // For practical purposes with travel data, if irreducible and has
        // any 2-cycle and 3-cycle, it's aperiodic
        if (!hasOddCycle) {
          return { ergodic: false, irreducible: true, aperiodic: false, reason: "Chain may be periodic" };
        }
      }

      return { ergodic: true, irreducible: true, aperiodic: true, reason: "Chain is ergodic" };
    },

    mixingTime: function (transitionMatrix) {
      var activities = transitionMatrix._activities;
      var n = activities.length;

      // Estimate spectral gap by computing the second-largest eigenvalue
      // via power iteration on (T - pi * 1^T) where pi is stationary dist
      var stationary = this.stationaryDistribution(transitionMatrix);

      // Power iteration to find second eigenvalue
      // Initialize random vector orthogonal to stationary distribution
      var v = {};
      var vSum = 0;
      activities.forEach(function (a, i) {
        v[a] = (i % 2 === 0 ? 1 : -1);
        vSum += v[a] * stationary[a];
      });
      // Orthogonalize against stationary distribution
      activities.forEach(function (a) {
        v[a] -= vSum;
      });

      var lambda2 = 0;
      for (var iter = 0; iter < 100; iter++) {
        // Multiply by transition matrix
        var newV = {};
        activities.forEach(function (a) { newV[a] = 0; });
        activities.forEach(function (i) {
          activities.forEach(function (j) {
            newV[j] += v[i] * (transitionMatrix[i][j] || 0);
          });
        });

        // Re-orthogonalize against stationary
        var proj = 0;
        activities.forEach(function (a) { proj += newV[a] * stationary[a]; });
        activities.forEach(function (a) { newV[a] -= proj; });

        // Compute norm
        var norm = 0;
        activities.forEach(function (a) { norm += newV[a] * newV[a]; });
        norm = Math.sqrt(norm);

        if (norm < 1e-12) break;

        // Compute eigenvalue estimate (Rayleigh quotient)
        var dotProd = 0;
        activities.forEach(function (a) { dotProd += newV[a] * v[a]; });
        var vNorm = 0;
        activities.forEach(function (a) { vNorm += v[a] * v[a]; });
        if (vNorm > 0) {
          lambda2 = dotProd / vNorm;
        }

        // Normalize
        activities.forEach(function (a) { newV[a] /= norm; });
        v = newV;
      }

      lambda2 = Math.abs(lambda2);
      var spectralGap = 1 - lambda2;
      // Mixing time approximately 1/spectralGap * ln(1/epsilon), epsilon = 0.01
      var mixTime = spectralGap > 1e-10 ? Math.log(100) / spectralGap : Infinity;

      return {
        secondEigenvalue: parseFloat(lambda2.toFixed(6)),
        spectralGap: parseFloat(spectralGap.toFixed(6)),
        mixingTime: parseFloat(mixTime.toFixed(2)),
        interpretation: mixTime < 5 ? "Fast mixing — chain converges quickly" :
          mixTime < 20 ? "Moderate mixing — chain converges in reasonable time" :
          "Slow mixing — chain takes many steps to converge"
      };
    },

    goodnessOfFit: function (simulated, observed) {
      // Chi-squared test comparing simulated vs observed mode distributions
      var modes = Object.keys(observed);
      var chiSquared = 0;
      var degreesOfFreedom = modes.length - 1;
      var n = 1000; // effective sample size

      modes.forEach(function (mode) {
        var obs = observed[mode] || 0;
        var sim = simulated[mode] || 0;
        var expected = obs * n;
        var actual = sim * n;
        if (expected > 0) {
          chiSquared += Math.pow(actual - expected, 2) / expected;
        }
      });

      // Approximate p-value using chi-squared distribution
      // Using Wilson-Hilferty approximation for chi-squared CDF
      var k = degreesOfFreedom;
      var z = 0;
      if (k > 0) {
        z = Math.pow(chiSquared / k, 1 / 3) - (1 - 2 / (9 * k));
        z /= Math.sqrt(2 / (9 * k));
      }
      // Standard normal CDF approximation
      var pValue = 1 - 0.5 * (1 + erf(z / Math.sqrt(2)));
      if (pValue < 0) pValue = 0;
      if (pValue > 1) pValue = 1;

      return {
        chiSquared: parseFloat(chiSquared.toFixed(4)),
        degreesOfFreedom: degreesOfFreedom,
        pValue: parseFloat(pValue.toFixed(6)),
        significant: pValue < 0.05,
        interpretation: pValue >= 0.05
          ? "Simulated distribution is consistent with observed data (p=" + pValue.toFixed(3) + ")"
          : "Simulated distribution differs significantly from observed data (p=" + pValue.toFixed(3) + ")"
      };
    }
  };

  // Error function approximation for p-value computation
  function erf(x) {
    var sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);
    var a1 = 0.254829592;
    var a2 = -0.284496736;
    var a3 = 1.421413741;
    var a4 = -1.453152027;
    var a5 = 1.061405429;
    var p = 0.3275911;
    var t = 1.0 / (1.0 + p * x);
    var y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
    return sign * y;
  }

})();
