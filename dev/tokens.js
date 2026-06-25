/* CCA design tokens — VENDORED from the @cca/viz library so the Super KPI Card
 * Tableau viz extension renders in the exact CCA brand palette/fonts without a
 * build step or React.
 *
 * Source of truth (keep in sync until the shared render-core extraction):
 *   - apps/shared-libs/viz/tokens/colors.ts
 *   - apps/shared-libs/viz/tokens/typography.ts
 *   - apps/shared-libs/viz/tokens/formatting.ts
 *   - apps/shared-libs/viz/utils/format.ts  (formatNumber)
 *
 * Attaches a single global `window.CCA` (plain script, no modules) so it loads
 * reliably inside Tableau's sandboxed extension iframe.
 */
(function (global) {
  var colors = {
    brandTeal: '#1F617A',       // brand.teal — ColumnSpark line, brand ink (NOT "good" semantics)
    positive: '#2C7BB6',        // semantic.positive — blue, "good / up" (delta arrow)
    negative: '#E07830',        // semantic.negative — orange, "bad / down" (delta arrow)
    neutralText: '#333333',     // neutral.text — hero number
    neutralSubtitle: '#888888', // neutral.subtitle — caption / comparison label
    neutralMuted: '#b0b0b0',    // comparison-window bars (mid-light gray)
    neutralLabel: '#999999',    // neutral.label
    neutralBorder: '#e0e0e0',   // neutral.border — card border
    neutralBackground: '#ffffff', // neutral.background — card bg (CCA-light)
  };

  // UI_FONT — system-available (Segoe UI on Windows), so no webfont load needed
  // inside the Tableau iframe. Matches DESIGN.md "data values use the UI font".
  var fonts = {
    ui: "'Segoe UI', system-ui, -apple-system, BlinkMacSystemFont, sans-serif",
  };

  var formats = {
    currency: '$,.0f',
    currencyK: '$,.0s',
    currencyM: '$,.1s',
    percentage: '.1f%',
    percentageFmt: '+.1f%',
    integer: ',.0f',
    decimal: ',.1f',
  };

  // Port of @cca/viz/utils/format.ts formatNumber — keep behavior identical.
  function formatNumber(value, fmt) {
    if (fmt.charAt(fmt.length - 1) === '%') {
      return formatNumber(value, fmt.slice(0, -1)) + '%';
    }
    if (fmt.indexOf('s') !== -1) {
      var prefix = fmt.indexOf('$') !== -1 ? '$' : '';
      var a = Math.abs(value);
      if (a >= 1e6) return prefix + (value / 1e6).toFixed(1) + 'M';
      if (a >= 1e3) return prefix + Math.round(value / 1e3) + 'K';
      return prefix + Math.round(value);
    }
    if (fmt.indexOf('$') !== -1) {
      return '$' + Math.round(value).toLocaleString();
    }
    if (fmt.charAt(0) === '+') {
      var sign = value >= 0 ? '+' : '';
      var dec = fmt.indexOf('.1') !== -1 ? 1 : 0;
      return sign + value.toFixed(dec);
    }
    if (fmt.indexOf('.1') !== -1) {
      return value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    }
    return Math.round(value).toLocaleString();
  }

  global.CCA = global.CCA || {};
  global.CCA.colors = colors;
  global.CCA.fonts = fonts;
  global.CCA.formats = formats;
  global.CCA.formatNumber = formatNumber;
})(window);
