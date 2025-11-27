import { quantile, min as d3Min, max as d3Max, bin } from 'd3-array';
import fs from 'fs/promises';
import { ckmeans } from 'simple-statistics';
import { emissionsIndicatorsMeta, socEcIndicatorsMeta } from '../components/indicatorsMeta.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function readJsonWithFallback(relPath) {
  const candidates = [path.join(__dirname, relPath), path.join(process.cwd(), relPath)];

  const errors = [];
  for (const p of candidates) {
    try {
      const text = await fs.readFile(p, 'utf8');
      try {
        return JSON.parse(text);
      } catch (parseErr) {
        throw new Error(`Invalid JSON at ${p}: ${parseErr.message}`);
      }
    } catch (err) {
      errors.push({ path: p, err });
    }
  }
}

async function getIndicatorsData(paths) {
  const indicatorsValues = {};
  const indicatorsData = {};
  indicatorsData.emissions = {};
  indicatorsData.socEc = {};

  for (const [datasetIndex, pathName] of paths.entries()) {
    try {
      const fileContent = await readJsonWithFallback(pathName);

      const dataset = fileContent;

      for (const row of dataset) {
        for (const indicator of [...emissionsIndicatorsMeta, ...socEcIndicatorsMeta]) {
          if (!indicatorsValues[indicator.value]) {
            indicatorsValues[indicator.value] = [];
          }
          indicatorsValues[indicator.value].push(row[indicator.value]);
        }
      }

      for (const [indicatorName, indicatorValues] of Object.entries(indicatorsValues)) {
        if (emissionsIndicatorsMeta.find((ind) => ind.value === indicatorName)) {
          // Emissions indicators
          const indicatorMeta = emissionsIndicatorsMeta.find((ind) => ind.value === indicatorName);

          if (!indicatorsData.emissions[indicatorName]) {
            indicatorsData.emissions[indicatorName] = [];
          }

          indicatorsData.emissions[indicatorName][datasetIndex] = getEmissionsIndicatorData(
            indicatorValues,
            indicatorMeta
          );
        } else {
          // Income indicators
          const indicatorMeta = socEcIndicatorsMeta.find((ind) => ind.value === indicatorName);

          if (!indicatorsData.socEc[indicatorName]) {
            indicatorsData.socEc[indicatorName] = [];
          }

          indicatorsData.socEc[indicatorName][datasetIndex] = getSocEcIndicatorData(
            indicatorValues,
            indicatorMeta
          );
        }
      }
    } catch (err) {
      console.error('Error reading file:', err);
    }
  }

  return indicatorsData;
}

// Update Emissions Indicator
function getEmissionsIndicatorData(indicatorValues, indicatorMeta) {
  const nClasses = indicatorMeta.colors.length;
  let bins;
  // let fullDomain;
  let thresholds;

  if (indicatorMeta.binOperation == 'ckmeans') {
    const ckMeans = ckmeans(indicatorValues, nClasses);
    const ckThresholds = ckMeans.map((d) => d3Min(d));

    bins = bin()
      .thresholds(ckThresholds)
      .value((d) => d)(indicatorValues);

    const stops = bins.map((d) => d.x0);
    stops.push(bins[bins.length - 1].x1);

    thresholds = [...bins.map((d) => d.x1).slice(0, bins.length - 1)];
    // fullDomain = [...stops];
  } else if (indicatorMeta.binOperation === 'logarithmic') {
    const min = d3Min(indicatorValues);
    const max = d3Max(indicatorValues);
    const nClasses = indicatorMeta.colors.length;

    const logMin = Math.log10(min);
    const logMax = Math.log10(max);

    const logStops = Array.from({ length: nClasses }, (_, i) =>
      Math.pow(10, logMin + (i * (logMax - logMin)) / (nClasses - 1))
    );

    logStops[0] = min;
    logStops[logStops.length - 1] = max;

    thresholds = logStops.slice(1);

    bins = bin()
      .thresholds(thresholds)
      .value((d) => d)(indicatorValues);

    const stops = bins.map((d) => d.x0);
    stops.push(bins[bins.length - 1].x1);
  }

  return {
    thresholds,
    range: indicatorMeta.colors,
    bins: 1
  };
}

function getSocEcIndicatorData(indicatorValues, indicatorMeta) {
  const sortedValues = indicatorValues.filter((v) => v != null).sort((a, b) => a - b);

  const sum = sortedValues.reduce((a, b) => a + b, 0);
  const count = sortedValues.length;

  return {
    mean: sum / count,
    min: sortedValues[0],
    max: sortedValues[sortedValues.length - 1],
    q1: quantile(sortedValues, 0.25),
    q3: quantile(sortedValues, 0.75),
    values: sortedValues
  };
}

const indicatorsData = await getIndicatorsData(['./seccen.json', './mun.json', './com.json']);
process.stdout.write(JSON.stringify(indicatorsData));
