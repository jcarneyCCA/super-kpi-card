/* ColumnSpark geometry — VENDORED plain-JS port of
 * apps/shared-libs/viz/utils/columnSpark.ts.
 *
 * Keep the logic byte-for-byte equivalent to the TS source: the React
 * `ColumnSpark` primitive and this file are the two render layers over the SAME
 * math until the shared render-core extraction. If you change the math here,
 * change it in columnSpark.ts too (and vice versa).
 *
 * Attaches to `window.CCA` (loaded after tokens.js).
 */
(function (global) {
  function rollingAverage(values, window, minPeriods) {
    if (minPeriods == null) minPeriods = 1;
    return values.map(function (_, i) {
      var start = Math.max(0, i - window + 1);
      var slice = values.slice(start, i + 1);
      if (slice.length < minPeriods) return null;
      var sum = slice.reduce(function (a, b) { return a + b; }, 0);
      return sum / slice.length;
    });
  }

  function computeColumnSpark(values, opts) {
    var width = opts.width;
    var height = opts.height;
    var padding = opts.padding != null ? opts.padding : 2;
    var barGapRatio = opts.barGapRatio != null ? opts.barGapRatio : 0.3;
    var maWindow = opts.maWindow != null ? opts.maWindow : 4;
    var maMinPeriods = opts.maMinPeriods != null ? opts.maMinPeriods : 1;
    var yDomain = opts.yDomain;
    var zeroBaseline = opts.zeroBaseline != null ? opts.zeroBaseline : true;

    var n = values.length;
    var innerW = Math.max(0, width - padding * 2);
    var innerH = Math.max(0, height - padding * 2);

    if (n === 0) {
      return { bars: [], linePoints: [], linePointsStr: '', domain: [0, 1], baselineY: height - padding };
    }

    var ma = rollingAverage(values, maWindow, maMinPeriods);
    var maDefined = ma.filter(function (v) { return v != null; });

    var domainMin, domainMax;
    if (yDomain) {
      domainMin = yDomain[0];
      domainMax = yDomain[1];
    } else {
      var all = values.concat(maDefined);
      var dataMin = Math.min.apply(null, all);
      var dataMax = Math.max.apply(null, all);
      domainMin = zeroBaseline ? Math.min(0, dataMin) : dataMin;
      domainMax = dataMax;
    }
    var range = (domainMax - domainMin) || 1;

    function scaleY(v) {
      return padding + (1 - (v - domainMin) / range) * innerH;
    }

    var baselineY = scaleY(domainMin);
    var slot = innerW / n;
    var barWidth = slot * (1 - barGapRatio);
    var barInset = (slot - barWidth) / 2;

    var bars = values.map(function (value, i) {
      var x = padding + i * slot + barInset;
      var valueY = scaleY(value);
      return {
        index: i,
        value: value,
        x: x,
        y: Math.min(valueY, baselineY),
        width: barWidth,
        height: Math.abs(baselineY - valueY),
      };
    });

    var linePoints = [];
    ma.forEach(function (value, i) {
      if (value == null) return;
      linePoints.push({ index: i, value: value, x: padding + i * slot + slot / 2, y: scaleY(value) });
    });
    var linePointsStr = linePoints.map(function (p) { return p.x + ',' + p.y; }).join(' ');

    return {
      bars: bars,
      linePoints: linePoints,
      linePointsStr: linePointsStr,
      domain: [domainMin, domainMax],
      baselineY: baselineY,
    };
  }

  global.CCA = global.CCA || {};
  global.CCA.computeColumnSpark = computeColumnSpark;
  global.CCA.rollingAverage = rollingAverage;
})(window);
