/* Period model — VENDORED plain-JS (to be mirrored into @cca/viz/utils/periods.ts).
 * The "brain" behind the Super KPI Card's flexible comparisons: takes day-grain
 * rows + the user's choices (granularity / window length / comparison mode) and
 * returns the bucketed series plus the primary and comparison aggregates.
 *
 * Framework-agnostic and portable — the same logic travels to Brewery Brain.
 * Weeks are Monday-start (Mon–Sun); months are calendar months.
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
  function aggregate(vals, agg) {
    if (!vals.length) return 0;
    var s = vals.reduce(function (a, b) { return a + b; }, 0);
    return agg === 'average' ? s / vals.length : s;
  }

  /**
   * rows: [{ date: Date, value: number }] at any grain (day-level recommended).
   * opts: { unit:'week'|'month', primaryLen, comparisonMode:'prior'|'yoy',
   *         agg:'sum'|'average', excludeIncomplete=true, asOf?:Date }
   * → { unit, values:[], labels:[], primary, comparison }   (comparison null if no history)
   */
  function resolvePeriods(rows, opts) {
    var unit = opts.unit === 'month' ? 'month' : 'week';
    var primaryLen = Math.max(1, opts.primaryLen || 1);
    var mode = opts.comparisonMode === 'yoy' ? 'yoy' : 'prior';
    var agg = opts.agg === 'average' ? 'average' : 'sum';
    var excludeIncomplete = opts.excludeIncomplete !== false;
    var asOf = opts.asOf ? new Date(opts.asOf) : new Date();

    // Bucket the rows into Monday-weeks or calendar-months.
    var map = {};
    rows.forEach(function (r) {
      if (!r.date || isNaN(r.date.getTime())) return;
      var start = bucketStart(r.date, unit);
      var k = keyOf(start);
      if (!map[k]) map[k] = { start: start, vals: [] };
      map[k].vals.push(r.value);
    });
    var buckets = Object.keys(map).map(function (k) {
      return { start: map[k].start, value: aggregate(map[k].vals, agg) };
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
    var primary = aggregate(primaryIdx.map(function (i) { return buckets[i].value; }), agg);

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
    var comparison = comparisonIdx.length
      ? aggregate(comparisonIdx.map(function (i) { return buckets[i].value; }), agg)
      : null;

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
