/* Period model — VENDORED plain-JS (mirrored from @cca/viz/utils/periods.ts).
 * The "brain" behind the Super KPI Card's flexible comparisons: takes day-grain
 * rows + the user's choices (granularity / window length / comparison mode /
 * aggregation) and returns the bucketed series plus the primary and comparison
 * aggregates.
 *
 * Aggregation modes:
 *   sum      — additive measures (volume, $, counts). Window = Σ bucket values.
 *   average  — simple mean of bucket values (rates already equal-weighted).
 *   ratio    — aggregated percent / rate-of-sums. Each row carries {value=numerator,
 *              denom=denominator}; a bucket = Σnum/Σden; the window = Σnum/Σden pooled
 *              across its buckets (TRUE volume-weighted ratio, never a mean of ratios).
 *              This is what makes "% of total" metrics correct in the card.
 *
 * Framework-agnostic and portable — the same logic travels to Brewery Brain.
 * Weeks are Monday-start (Mon–Sun); months are calendar months.
 * KEEP IN SYNC with @cca/viz/utils/periods.ts.
 */
(function (global) {
  function startOfDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function mondayOf(date) {
    var d = startOfDay(date);
    var dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
    d.setDate(d.getDate() - dow);
    return d;
  }
  function firstOfMonth(date) { return new Date(date.getFullYear(), date.getMonth(), 1); }
  function bucketStart(date, unit) { return unit === 'month' ? firstOfMonth(date) : mondayOf(date); }
  function keyOf(start) { return start.getFullYear() + '-' + (start.getMonth() + 1) + '-' + start.getDate(); }

  function labelFor(start, unit) {
    return unit === 'month'
      ? start.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })      // "Jun 2026"
      : 'Week of ' + start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); // "Week of Jun 9"
  }
  function sum(vals) { return vals.reduce(function (a, b) { return a + b; }, 0); }
  function aggregate(vals, agg) {
    if (!vals.length) return 0;
    var s = sum(vals);
    return agg === 'average' ? s / vals.length : s;
  }

  /**
   * rows: [{ date: Date, value: number, denom?: number }] at any grain (day-level recommended).
   *       `denom` is only read in ratio mode (value = numerator).
   * opts: { unit:'week'|'month', primaryLen, comparisonMode:'prior'|'yoy',
   *         agg:'sum'|'average'|'ratio', excludeIncomplete=true, asOf?:Date }
   * → { unit, values:[], labels:[], primary, comparison, roles }   (comparison null if no history)
   */
  function resolvePeriods(rows, opts) {
    var unit = opts.unit === 'month' ? 'month' : 'week';
    var primaryLen = Math.max(1, opts.primaryLen || 1);
    var mode = opts.comparisonMode === 'yoy' ? 'yoy' : 'prior';
    var agg = opts.agg === 'average' ? 'average' : (opts.agg === 'ratio' ? 'ratio' : 'sum');
    var excludeIncomplete = opts.excludeIncomplete !== false;
    var asOf = opts.asOf ? new Date(opts.asOf) : new Date();
    var isRatio = agg === 'ratio';

    // Bucket the rows into Monday-weeks or calendar-months.
    var map = {};
    rows.forEach(function (r) {
      if (!r.date || isNaN(r.date.getTime())) return;
      var start = bucketStart(r.date, unit);
      var k = keyOf(start);
      if (!map[k]) map[k] = { start: start, vals: [], denoms: [] };
      map[k].vals.push(r.value);
      if (isRatio) map[k].denoms.push(r.denom != null ? r.denom : 0);
    });
    var buckets = Object.keys(map).map(function (k) {
      var b = map[k];
      if (isRatio) {
        var num = sum(b.vals), den = sum(b.denoms);
        return { start: b.start, value: den !== 0 ? num / den : 0, num: num, den: den };
      }
      return { start: b.start, value: aggregate(b.vals, agg) };
    }).sort(function (a, b) { return a.start - b.start; });

    // Complete-period rule: drop the current in-progress bucket (and any future).
    if (excludeIncomplete) {
      var curStart = bucketStart(asOf, unit).getTime();
      buckets = buckets.filter(function (b) { return b.start.getTime() < curStart; });
    }

    var n = buckets.length;
    var primStart = Math.max(0, n - primaryLen);
    var primaryIdx = [];
    for (var pi = primStart; pi < n; pi++) primaryIdx.push(pi);

    var comparisonIdx = [];
    if (mode === 'prior') {
      var compStart = Math.max(0, primStart - primaryLen);
      for (var ci = compStart; ci < primStart; ci++) comparisonIdx.push(ci);
    } else { // yoy — match each primary bucket shifted back ~1 year
      var idxByTime = {};
      buckets.forEach(function (b, i) { idxByTime[b.start.getTime()] = i; });
      primaryIdx.forEach(function (i) {
        var b = buckets[i], prior;
        if (unit === 'month') {
          prior = new Date(b.start.getFullYear() - 1, b.start.getMonth(), 1);
        } else {
          var d = new Date(b.start); d.setDate(d.getDate() - 364); prior = mondayOf(d);
        }
        var j = idxByTime[prior.getTime()];
        if (j != null) comparisonIdx.push(j);
      });
    }

    // Window aggregate. Ratio pools numerator/denominator across the window's buckets
    // (Σnum/Σden) — the volume-weighted rate. Sum/average keep their prior behaviour
    // (aggregate of the per-bucket values), byte-for-byte unchanged.
    function windowAgg(idxs) {
      if (isRatio) {
        var num = 0, den = 0;
        idxs.forEach(function (i) { num += buckets[i].num; den += buckets[i].den; });
        return den !== 0 ? num / den : 0;
      }
      return aggregate(idxs.map(function (i) { return buckets[i].value; }), agg);
    }
    var primary = windowAgg(primaryIdx);
    var comparison = comparisonIdx.length ? windowAgg(comparisonIdx) : null;

    // Per-bucket role so the card can highlight the two compared windows.
    var roles = buckets.map(function () { return 'context'; });
    comparisonIdx.forEach(function (i) { roles[i] = 'comparison'; });
    primaryIdx.forEach(function (i) { roles[i] = 'current'; });

    return {
      unit: unit,
      values: buckets.map(function (b) { return b.value; }),
      labels: buckets.map(function (b) { return labelFor(b.start, unit); }),
      primary: primary,
      comparison: comparison,
      roles: roles
    };
  }

  global.CCA = global.CCA || {};
  global.CCA.resolvePeriods = resolvePeriods;
  global.CCA.mondayOf = global.CCA.mondayOf || mondayOf;
})(window);
