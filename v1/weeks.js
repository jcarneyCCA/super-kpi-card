/* Week helpers — VENDORED plain-JS port of apps/shared-libs/viz/utils/weeks.ts.
 * CCA complete-weeks rule (Monday-start). Keep in sync with the TS source.
 * Attaches to window.CCA (loaded after tokens.js). */
(function (global) {
  function mondayOf(date) {
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var dow = (d.getDay() + 6) % 7; // Mon=0 … Sun=6
    d.setDate(d.getDate() - dow);
    return d;
  }

  // Drop rows in the current in-progress Monday-start week (or later) relative
  // to asOf. rows: [{ date: Date, ... }]. Returns the complete-weeks subset.
  function excludeIncompleteWeek(rows, asOf) {
    var currentMonday = mondayOf(asOf).getTime();
    return rows.filter(function (r) { return mondayOf(r.date).getTime() < currentMonday; });
  }

  global.CCA = global.CCA || {};
  global.CCA.mondayOf = mondayOf;
  global.CCA.excludeIncompleteWeek = excludeIncompleteWeek;
})(window);
