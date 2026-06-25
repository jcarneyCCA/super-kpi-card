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
    var primary = aggregate(buckets.slice(primStart).map(function (b) { return b.value; }), agg);

    var comparison = null;
    if (mode === 'prior') {
      var compEnd = primStart;
      var compStart = Math.max(0, compEnd - primaryLen);
      if (compEnd > compStart) {
        comparison = aggregate(buckets.slice(compStart, compEnd).map(function (b) { return b.value; }), agg);
      }
    } else { // yoy — match each primary bucket shifted back ~1 year
      var byKey = {};
      buckets.forEach(function (b) { byKey[b.start.getTime()] = b.value; });
      var compVals = [];
      buckets.slice(primStart).forEach(function (b) {
        var prior;
        if (unit === 'month') {
          prior = new Date(b.start.getFullYear() - 1, b.start.getMonth(), 1);
        } else {
          var d = new Date(b.start); d.setDate(d.getDate() - 364); prior = mondayOf(d);
        }
        var v = byKey[prior.getTime()];
        if (v != null) compVals.push(v);
      });
      if (compVals.length) comparison = aggregate(compVals, agg);
    }

    return {
      unit: unit,
      values: buckets.map(function (b) { return b.value; }),
      labels: buckets.map(function (b) { return labelFor(b.start, unit); }),
      primary: primary,
      comparison: comparison
    };
  }

  global.CCA = global.CCA || {};
  global.CCA.resolvePeriods = resolvePeriods;
  global.CCA.mondayOf = global.CCA.mondayOf || mondayOf;
})(window);
