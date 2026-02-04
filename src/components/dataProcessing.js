import * as d3 from 'npm:d3';
import { ckmeans } from 'npm:simple-statistics';

/**
 * Processes emissions indicator data across all geographic levels.
 * Creates bins and thresholds for map visualization using ckmeans or logarithmic binning.
 *
 * @param {Object} indicator - Emissions indicator metadata
 * @param {string} indicator.value - Field name in dataset
 * @param {string} indicator.binOperation - 'ckmeans' or 'logarithmic'
 * @param {string[]} indicator.colors - Color scheme array
 * @param {Array} datasets - Array of datasets [seccen, mun, com]
 * @returns {Array} Array of processed data with bins, thresholds, and ranges for each level
 */
export function getEmissionsIndicatorData(indicator, datasets) {
  const data = [];
  datasets.forEach((dataset, i) => {
    const emissionsIndicatorArray = dataset.map((d) => d[indicator.value]);

    const nClasses = indicator.colors.length;
    let bins;
    let fullDomain;
    let thresholds;

    if (indicator.binOperation == 'ckmeans') {
      const ckMeans = ckmeans(emissionsIndicatorArray, nClasses);
      const ckThresholds = ckMeans.map((d) => d3.min(d));

      bins = d3
        .bin()
        .thresholds(ckThresholds)
        .value((d) => d)(emissionsIndicatorArray);

      const stops = bins.map((d) => d.x0);
      stops.push(bins[bins.length - 1].x1);

      thresholds = [...bins.map((d) => d.x1).slice(0, bins.length - 1)];
      fullDomain = [...stops]; // color stop1 color stop2 color finalStop color
    } else if (indicator.binOperation === 'logarithmic') {
      const min = d3.min(emissionsIndicatorArray);
      const max = d3.max(emissionsIndicatorArray);
      const nClasses = indicator.colors.length;

      const logMin = Math.log10(min);
      const logMax = Math.log10(max);

      const logStops = Array.from({ length: nClasses }, (_, i) =>
        Math.pow(10, logMin + (i * (logMax - logMin)) / (nClasses - 1))
      );

      logStops[0] = min;
      logStops[logStops.length - 1] = max;

      thresholds = logStops.slice(1);

      bins = d3
        .bin()
        .thresholds(thresholds)
        .value((d) => d)(emissionsIndicatorArray);

      const stops = bins.map((d) => d.x0);
      stops.push(bins[bins.length - 1].x1);

      fullDomain = stops;
    }

    data.push({ layerId: i, fullDomain, thresholds, range: indicator.colors, bins });
  });

  return data;
}

/**
 * Processes income/socioeconomic indicator data across geographic levels.
 * Calculates statistics (min, max, mean, quartiles) for available data.
 *
 * @param {Object} indicator - Socioeconomic indicator metadata
 * @param {string} indicator.value - Field name in dataset
 * @param {boolean[]} indicator.levels - Availability flags [seccen, mun, com]
 * @param {Array} datasets - Array of datasets [seccen, mun, com]
 * @param {Array} valuesByLevel - Geographic level ID configurations
 * @returns {Array} Array of processed income data with stats for each level (or null if unavailable)
 */
export function getIncomeIndicatorData(indicator, datasets, valuesByLevel) {
  const data = [];
  datasets.forEach((dataset, i) => {
    if (indicator.levels[i]) {
      const incomeEntries = dataset
        .map((d) => ({ id: d[valuesByLevel[i].id], value: d[indicator.value] }))
        .filter((v) => v.value != null && !isNaN(v.value))
        .sort((a, b) => a.value - b.value);

      const incomeValues = incomeEntries.map((d) => d.value);

      const sum = incomeValues.reduce((a, b) => a + b, 0);
      const count = incomeValues.length;

      data.push({
        mean: sum / count,
        min: incomeValues[0],
        max: incomeValues[incomeValues.length - 1],
        q1: d3.quantile(incomeValues, 0.25),
        q3: d3.quantile(incomeValues, 0.75),
        values: incomeEntries
      });
    } else {
      data.push(null);
    }
  });

  return data;
}

/**
 * Maps emissions data to classification bins for a specific geographic level.
 * Combines emissions values with income values and assigns classification.
 *
 * @param {number} datasetIndex - Geographic level index (0=seccen, 1=mun, 2=com)
 * @param {Array} datasets - Array of datasets
 * @param {Object} emissionsIndicator - Emissions indicator metadata
 * @param {Object} incomeIndicator - Income indicator metadata
 * @param {Array} emissionsIndicatorData - Processed emissions data with bins
 * @param {Array} valuesByLevel - Geographic level ID configurations
 * @returns {Array} Sorted array of {id, class, emissionsValue, incomeValue}
 */
export function getEmissionsData(
  datasetIndex,
  datasets,
  emissionsIndicator,
  incomeIndicator,
  emissionsIndicatorData,
  valuesByLevel
) {
  const index = datasetIndex;
  const getEntryClass = (value) =>
    emissionsIndicatorData[index].bins
      .findIndex((d) => {
        return d.x0 != d.x1 ? value >= d.x0 && value < d.x1 : value >= d.x0;
      })
      .toString();

  const valuesByClass = datasets[index]
    .map((d) => {
      const emissionsValue = d[emissionsIndicator.value];
      const incomeValue = d[incomeIndicator.value];
      const id = d[valuesByLevel[datasetIndex].id];
      return { id, class: getEntryClass(emissionsValue), emissionsValue, incomeValue };
    })
    .sort((a, b) => a.emissionsValue - b.emissionsValue);

  return valuesByClass;
}
