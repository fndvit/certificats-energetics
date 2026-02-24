---
title: Eina de decisions
toc: false
style: ./eina.css
---

<!--    Imports & files    -->

```js
import { html } from 'npm:htl';
import rangeSlider from 'npm:range-slider-input';
import chroma from 'npm:chroma-js';
import sliderState from './components/sliderState.js';
import { MapManager } from './components/map/mapManager.js';
import { clusterIndicatorsMeta } from './components/map/clusterLayer.js';
import { emissionsIndicatorsMeta, socEcIndicatorsMeta } from './components/indicatorsMeta.js';
import { getEmissionsIndicatorData, getIncomeIndicatorData, getEmissionsData } from './components/dataProcessing.js';
import { getHoveredInfo, getTickColor, lowercaseFirstLetter, getRegionCardData } from './components/mapHelpers.js';
import { mapColorScheme } from './components/colors.js';

const municipisDict = FileAttachment('./data/municipisDict.json').json();
const pointsData = await FileAttachment('./data/certificats-points.parquet').parquet();

const datasets = [
  await FileAttachment('./data/seccen.json')
    .json()
    .then((data) => {
      return data.filter((d) => d.mean_emissions);
    }),
  await FileAttachment('./data/mun.json')
    .json()
    .then((data) => {
      return data.filter((d) => d.mean_emissions);
    }),
  await FileAttachment('./data/com.json')
    .json()
    .then((data) => {
      return data.filter((d) => d.mean_emissions);
    })
];
```

<!--    Dictionaries    -->

```js
const binningTypes = [
  {
    name: 'CKMeans',
    value: 'ckmeans'
  },
  {
    name: 'Logarítmica',
    value: 'logarithmic'
  }
];

const valuesByLevel = [
  {
    id: 'MUNDISSEC',
    censusLevel: 'seccions censals'
  },
  {
    id: 'codi_poblacio',
    censusLevel: 'municipis'
  },
  {
    id: 'codi_comarca',
    censusLevel: 'comarques'
  }
];
```

<!--    Mutables    -->

```js
const currentDatasetIndex = Mutable(1);
const setCurrentDatasetIndex = (x) => (currentDatasetIndex.value = x);
```

```js
const incomeRange = Mutable([0, 0]);
const setIncomeRange = (x) => (incomeRange.value = x);
```

```js
const mapLoaded = Mutable(false);
const setMapLoaded = (x) => (mapLoaded.value = x);
```

```js
const hoveredPolygonId = Mutable(null);
const setHoveredPolygonId = (x) => (hoveredPolygonId.value = x);
```

```js
const mousePosition = Mutable(null);
const setMousePosition = (([x, y]) => mousePosition.value = {x: x, y: y})
```

```js
const isMouseOverUI = Mutable(false);
const setIsMouseOverUI = (x) => (isMouseOverUI.value = x);
```

```js
const isMouseButtonPressed = Mutable(false);
const setIsMouseButtonPressed = (x) => (isMouseButtonPressed.value = x);
```

```js
const clickedPolygonId = Mutable(null);
const setClickedPolygonId = (x) => (clickedPolygonId.value = x);
```

```js
const clickedPolygonLevel = Mutable(null);
const setClickedPolygonLevel = (x) => (clickedPolygonLevel.value = x);
```

```js
const showRegionCard = Mutable(false);
const setShowRegionCard = (x) => (showRegionCard.value = x);
```

```js
const mapMode = Mutable('choropleth');
const setMapMode = (x) => (mapMode.value = x);
```

```js
const showClusterModal = Mutable(false);
const setShowClusterModal = (x) => (showClusterModal.value = x);
```

```js
const clusterModalData = Mutable(null);
const setClusterModalData = (x) => (clusterModalData.value = x);
```

<!--    Inputs    -->

```js
const nSteps = 30;

const sliderElement = html`<div></div>`;

const slider = rangeSlider(sliderElement, {
  onInput: (v, user) => {
    sliderElement.value = v;
    if (user) {
      const values = sliderState.indicatorValues;
      const n = values.length;

      const pLow = d3.bisectLeft(values, v[0]) / n;
      const pHigh = d3.bisectLeft(values, v[1]) / n;

      sliderState.percentileRange = [pLow, pHigh];

      sliderElement.dispatchEvent(new Event('input', { bubbles: true }));

      map.updateMapOpacity(sliderState.currentRange, v);

      sliderState.currentRange = v;
      setIncomeRange(v);
    }
  }
});

/**
 * Formats a number for display, using 2 decimal places unless it's an integer.
 * @param {number} value - Number to format
 * @param {string} [suffix=''] - Optional suffix (e.g., '€')
 * @returns {string} Formatted number
 */
function formatNumber(value, suffix = '') {
  const formatted = Number.isInteger(value) ? value.toString() : value.toFixed(2);
  return suffix ? `${formatted} ${suffix}` : formatted;
}

/**
 * Extracts just the numeric values from income indicator data for slider use.
 * @param {Object} incomeData - Income indicator data with values array
 * @returns {number[]} Array of numeric values
 */
function getIndicatorValues(incomeData) {
  return incomeData.values.map(d => d.value);
}

/**
 * Updates slider bounds with padding to prevent handles from sitting on exact min/max.
 * Extends range by 1 unit on each side for better UX.
 */
function updateSliderBounds(newMin, newMax, indicatorValues) {
  const SLIDER_PADDING = 1; // Extends range beyond min/max for easier interaction

  const [pLow, pHigh] = sliderState.percentileRange;
  const lowHandle = d3.quantileSorted(indicatorValues, pLow);
  const highHandle = d3.quantileSorted(indicatorValues, pHigh);

  const newMinExtended = newMin - SLIDER_PADDING;
  const newMaxExtended = newMax + SLIDER_PADDING;

  const divisionFactor = (newMaxExtended - newMinExtended) / nSteps;

  const roundToStep = (value) =>
    newMinExtended + Math.round((value - newMinExtended) / divisionFactor) * divisionFactor;

  const roundedLowHandle = roundToStep(lowHandle);
  const roundedHighHandle = roundToStep(highHandle);

  slider.step(divisionFactor);
  slider.min(newMinExtended - 1);
  slider.max(newMaxExtended + 1);
  slider.value([roundedLowHandle, roundedHighHandle]);
  
  setIncomeRange([roundedLowHandle, roundedHighHandle]);
}


const clusterIndicatorInput = Inputs.select(clusterIndicatorsMeta, {
  label: '',
  format: (d) => d.name,
  value: clusterIndicatorsMeta[0]
});

const emissionsIndicatorInput = Inputs.select(emissionsIndicatorsMeta, {
  label: "",
  format: (d) => d.name,
  value: emissionsIndicatorsMeta[0]
});

const incomeIndicatorInput = Inputs.select(socEcIndicatorsMeta, {
  label: '',
  format: (d) => d.name,
  value: socEcIndicatorsMeta[0]
});
```

```js
const clusterIndicator = Generators.input(clusterIndicatorInput);
const emissionsIndicator = Generators.input(emissionsIndicatorInput);
const incomeIndicator = Generators.input(incomeIndicatorInput);
```

<!--    Event listeners    -->

```js
document.addEventListener('polygon-change', (e) => {
  setMousePosition([e.detail.x, e.detail.y]);
  setHoveredPolygonId(e.detail.polygonId);
});

document.addEventListener('map-loaded', () => {
  sliderState.indicatorValues = getIndicatorValues(incomeIndicatorData[currentDatasetIndex]);
  map.initializeData(
    emissionsIndicator,
    emissionsIndicatorData,
    incomeIndicator,
    incomeIndicatorData
  );
  updateSliderBounds(
    incomeIndicatorData[1].min,
    incomeIndicatorData[1].max,
    getIndicatorValues(incomeIndicatorData[1])
  );
  setMapLoaded(true);
  sliderState.percentileRange = [0.25, 0.75];
  map.setMode(mapMode);
});

document.addEventListener('zoom-level-changed', (event) => {
  const datasetIndex = event.detail.zoomLevel;
  sliderState.indicatorValues = getIndicatorValues(incomeIndicatorData[datasetIndex]);
  setCurrentDatasetIndex(datasetIndex);
});

// Hide tooltip when mouse button is pressed (dragging)
document.addEventListener('mousedown', () => {
  setIsMouseButtonPressed(true);
  setHoveredPolygonId(null); // Clear hovered polygon to prevent stale tooltip
});

document.addEventListener('mouseup', () => {
  setIsMouseButtonPressed(false);
});

// Handle polygon click events for region card
document.addEventListener('polygon-click', (event) => {
  const { polygonId, level } = event.detail;

  if (polygonId === null) {
    // Clicked outside - close card
    setShowRegionCard(false);
    setClickedPolygonId(null);
    setClickedPolygonLevel(null);
  } else {
    // Clicked on a feature - show card
    setClickedPolygonId(polygonId);
    setClickedPolygonLevel(level);
    setShowRegionCard(true);
  }
});

// Handle cluster click events for cluster modal
document.addEventListener('cluster-click', (e) => {
  setClusterModalData(e.detail);
  setShowClusterModal(true);
});

// Hide tooltip when hovering over UI elements
// Attach listeners to all UI cards and Observable's sidebar
const uiElements = document.querySelectorAll('.card, .observablehq-sidebar, nav');
uiElements.forEach((element) => {
  element.addEventListener('mouseenter', () => setIsMouseOverUI(true));
  element.addEventListener('mouseleave', () => setIsMouseOverUI(false));
});
```

```js
// Reactive: Attach event listeners to region card wrapper when it appears
{
  const wrapper = document.getElementById('region-card-wrapper');
  if (wrapper && showRegionCard) {
    wrapper.addEventListener('mouseenter', () => setIsMouseOverUI(true));
    wrapper.addEventListener('mouseleave', () => setIsMouseOverUI(false));
  }
}
```

<!--    Reactive listeners    -->

<!-- Reactive: Toggles choropleth-specific controls visibility when map mode changes
     Depends on: mapMode -->
```js
document.querySelector('.choropleth-controls')
  ?.style.setProperty('display', mapMode === 'choropleth' ? '' : 'none');
```

<!-- Reactive: Updates slider bounds when dataset or income indicator changes
     Depends on: currentDatasetIndex, incomeIndicatorData -->
```js
updateSliderBounds(
  incomeIndicatorData[currentDatasetIndex].min,
  incomeIndicatorData[currentDatasetIndex].max,
  getIndicatorValues(incomeIndicatorData[currentDatasetIndex])
);
```

<!-- Reactive: Updates cluster map colors when cluster indicator changes
     Depends on: mapLoaded, clusterIndicator -->
```js
if (mapLoaded) {
  map.setClusterIndicator(clusterIndicator);
}
```

<!-- Reactive: Updates map colors when emissions indicator changes
     Depends on: mapLoaded, emissionsIndicator, emissionsIndicatorData -->
```js
if (mapLoaded) {
  map.updateEmissionsData(emissionsIndicator, emissionsIndicatorData);
}
```

<!-- Reactive: Updates map layer visibility when income indicator changes
     Depends on: mapLoaded, incomeIndicator, incomeIndicatorData -->
```js
if (mapLoaded) {
  map.updateIncomeData(incomeIndicator, incomeIndicatorData);
}
```

```js
incomeIndicator;
if (mapLoaded) {
  map.setMapOpacity([incomeRange[0], incomeRange[1]]);
}
```

```js
const emissionsIndicatorData = getEmissionsIndicatorData(emissionsIndicator, datasets);
```

```js
const incomeIndicatorData = getIncomeIndicatorData(incomeIndicator, datasets, valuesByLevel);
```

```js
const emissionsData = getEmissionsData(currentDatasetIndex, datasets, emissionsIndicator, incomeIndicator, emissionsIndicatorData, valuesByLevel);
```

```js
// Pre-compute lookup maps for O(1) performance
const datasetLookup = new Map(
  datasets[currentDatasetIndex].map(d => [
    d[valuesByLevel[currentDatasetIndex].id],
    d
  ])
);

const incomeLookup = new Map(
  incomeIndicatorData[currentDatasetIndex].values.map((d, i) => [
    d.id,
    { value: d.value, pos: i }
  ])
);

const emissionsLookup = new Map(
  emissionsData.map((d, i) => [
    d.id,
    { value: d.emissionsValue, pos: i }
  ])
);
```

```js
const hoveredInfo = getHoveredInfo(hoveredPolygonId, currentDatasetIndex, datasets, valuesByLevel, incomeIndicatorData, emissionsData, municipisDict, datasetLookup, incomeLookup, emissionsLookup);
```

```js
const regionCardData = showRegionCard && clickedPolygonId && clickedPolygonLevel !== null
  ? getRegionCardData(
      clickedPolygonId,
      clickedPolygonLevel,
      incomeIndicatorData,
      emissionsData,
      municipisDict,
      datasetLookup
    )
  : '';
```

```js
const histogramData = emissionsData.filter(
  (d) => d.incomeValue >= incomeRange[0] && d.incomeValue <= incomeRange[1]
);
```

```js
// Calculate max values for sparkbar scaling - reactive to level changes
const indicatorMaxValues = (() => {
  const level = clickedPolygonLevel ?? currentDatasetIndex;
  const dataset = datasets[level];

  return {
    count: d3.max(dataset, d => d.count) || 1,
    meanEmissions: d3.max(dataset, d => d.mean_emissions) || 1,
    totalEmissions: (d3.max(dataset, d => d.total_emissions) || 1000000) / 1000000,
    meanEnergyQual: 7,  // Fixed scale (1-7)
    meanEmissionsQual: 7,  // Fixed scale (1-7)
    totalPrimaryEnergy: d3.max(dataset, d => d.total_primary_energy) || 1,
    meanPrimaryEnergy: d3.max(dataset, d => d.mean_primary_energy) || 1,
    totalSurface: d3.max(dataset, d => d.total_surface) || 1,
    meanSurface: d3.max(dataset, d => d.mean_surface) || 1,
    totalCost: d3.max(dataset, d => d.total_cost) || 1,
    meanCost: d3.max(dataset, d => d.mean_cost) || 1
  };
})();
```

```js

function createSparkbarFormatter(indicatorKey, maxValue, allValues) {
  return (value) => {
    if (value == null) return html`<span>—</span>`;

    const widthPercent = Math.min((value / maxValue) * 100, 100);

    return html`<div style="
      background: linear-gradient(to right, #555 ${widthPercent}%, #ddd ${widthPercent}%);
      width: 100%;
      border-radius: 3px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding: 0 6px;
      box-sizing: border-box;
      font-size: 0.85em;
    "><span class="halo">${value.toFixed(2)}</span></div>`;
  };
}
```

```js
const modeToggle = html`<div style="display:flex; gap:8px; margin-bottom:16px;">
  <button class="mode-toggle-btn ${mapMode === 'choropleth' ? 'active' : ''}"
    onclick=${() => { setMapMode('choropleth'); if (mapLoaded) map.setMode('choropleth'); }}>
    Coropletes
  </button>
  <button class="mode-toggle-btn ${mapMode === 'cluster' ? 'active' : ''}"
    onclick=${() => { setMapMode('cluster'); if (mapLoaded) map.setMode('cluster'); }}>
    Punts
  </button>
</div>`;
```

<!--    Map & HTML    -->
```js
const mapContainer = display(document.createElement("div"));

Object.assign(mapContainer.style, {
  position: "fixed",
  inset: "0",
  zIndex: "-5",
});

const map = MapManager.create(mapContainer, datasets, pointsData);
invalidation.then(() => map.destroy());
```

${hoveredPolygonId && !isMouseOverUI && !isMouseButtonPressed && mapMode === 'choropleth' ? mapTooltip() : ''}

${showClusterModal && clusterModalData ? clusterModal() : ''}

<!-- Top Card -->

<div class="card glass" style="margin-top: -25px; margin-bottom: 25px; width: 550px; max-width: 550px; box-sizing: border-box;">
    <div style="display: flex; flex-direction: column;">
      <!-- Mode toggle -->
      ${modeToggle}
      <!-- Top row -->
      <div style="flex: 0 0 35%; min-width: 0;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%">
          <div class="glassText">
            ${informationPhrase}
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px">
            ${mapMode === 'cluster' ? html`
            <div>
              <p class="glassText" style="margin: 0px">Indicador</p>
              ${clusterIndicatorInput}
            </div>
            ` : html`
            <div>
              <p class="glassText" style="margin: 0px">Indicador d'emissions</p>
              ${emissionsIndicatorInput}
            </div>
            <div>
              <p class="glassText" style="margin: 0px">Indicador sociodemogràfic</p>
              ${incomeIndicatorInput}
            </div>
            `}
          </div>
        </div>
      </div>
      <!-- Bottom row -->
      <div class="card choropleth-controls" style="flex: 1; min-width: 0; gap: 8px">
        <!-- Legend -->
        ${
          Plot.legend(
            {color: 
              {
                type: "threshold",
                domain: emissionsIndicatorData[currentDatasetIndex].thresholds,
                range: emissionsIndicatorData[currentDatasetIndex].range,
                tickFormat: (d) => {
                  const value = emissionsIndicator.value === 'total_emissions' ? d / 1000000 : d;
                  return formatNumber(value);
                },
                label: `${emissionsIndicator.name} (${emissionsIndicator.units})`,
              }
            }
          )
        }
        <!-- Histogram -->
        ${resize((width) => 
          Plot.plot({
            height: 150,
            color: {
              type: "categorical",
              domain: Array.from({ length: 7 }, (_, i) => i.toString()),
              range: emissionsIndicator.colors
            },
            y: { 
              grid: true, 
              label: `Nombre de ${valuesByLevel[currentDatasetIndex].censusLevel}`,
            }, // Per mantenir escala -> domain: [0, mostFrequentClass[1]] 
            x: { 
              domain: Array.from({ length: 7 }, (_, i) => i.toString()), 
              tickFormat: null, 
              tickSize: 0, 
              label: null
            },
            marks: [
              Plot.barY(
                histogramData,
                Plot.groupX({ y: "count" }, { x: "class", fill: "class", tip:true })
              ),
              Plot.ruleY([0])
            ]
          })
        )}
        <!-- Slider -->
        ${sliderElement}
        <!-- Tick plot -->
        ${resize((width) =>
          Plot.plot({
            height: 80,
            x: {
              label: "Mitjana de la renda per unitat de consum (2022)"
            },
            marks: [
              Plot.tickX(emissionsData, {
                x: "incomeValue",
                strokeOpacity: 0.5,
                stroke: (d) =>
                  d.incomeValue >= incomeRange[0] && d.incomeValue <= incomeRange[1] ? getTickColor(d.class, emissionsIndicator) : "#d9d9d9"
              })
            ]
          })
        )}
      </div>
    </div>
  </div>

</div>

<div id="region-card-wrapper" style="width: 550px;">
  ${showRegionCard && mapMode === 'choropleth' ? regionCard() : ''}
</div>

```js
const mapTooltip = () => {
  const p = mousePosition;

  if (!hoveredPolygonId || hoveredPolygonId === null || p == null) return null;

  const fmt = d3.format(",.2f");

  const W = 240;
  const H = 70;

  const left = Math.max(8, p.x);
  const top = Math.max(8, p.y);

  return html`
    <div class="mb-tip" style="left:${left}px; top:${top}px;">
      <div class="mb-tip-title">
        ${hoveredInfo.names ? hoveredInfo.names.filter((n) => n !== '').join(' / ') : ''}
      </div>
      <div class="mb-tip-row">
        <span>${emissionsIndicator.name}</span>
        <span>
          ${hoveredInfo.emissionsData.value == null ? "—" : fmt(hoveredInfo.emissionsData.value)}
        </span>
      </div>
      <div class="mb-tip-row">
        <span>${incomeIndicator.name}</span>
        <span>
          ${hoveredInfo.incomeData.value == null ? "—" : fmt(hoveredInfo.incomeData.value)}
        </span>
      </div>
    </div>`;
}
```

```js
const regionCard = () => {
  if (!showRegionCard || !regionCardData) return '';

  const fmt = d3.format(",.1f");
  const fmtInt = d3.format(".1f");

  const { names, indicators, rankings } = regionCardData;

  // Format region title (filter out empty names)
  const regionTitle = names.filter(n => n !== '').join(' / ');

  // Get current level dataset for percentile calculations
  const level = clickedPolygonLevel ?? currentDatasetIndex;
  const dataset = datasets[level];

  // Collect all values for each indicator (for percentile-based coloring)
  const allIndicatorValues = {
    meanEmissions: dataset.map(d => d.mean_emissions).filter(v => v != null),
    meanEnergyQual: dataset.map(d => d.mean_energy_qual).filter(v => v != null),
    meanEmissionsQual: dataset.map(d => d.mean_emissions_qual).filter(v => v != null),
    meanPrimaryEnergy: dataset.map(d => d.mean_primary_energy).filter(v => v != null),
    meanSurface: dataset.map(d => d.mean_surface).filter(v => v != null),
    meanCost: dataset.map(d => d.mean_cost).filter(v => v != null),
    totalEmissions: dataset.map(d => d.total_emissions ? d.total_emissions / 1000000 : null).filter(v => v != null),
    totalPrimaryEnergy: dataset.map(d => d.total_primary_energy).filter(v => v != null),
    totalSurface: dataset.map(d => d.total_surface).filter(v => v != null),
    totalCost: dataset.map(d => d.total_cost).filter(v => v != null),
  };

  // Define indicators with their keys, labels, values, and units
  const indicatorsConfig = [
    { key: 'meanEmissions', label: 'Emissions mitjanes', value: indicators.meanEmissions, maxValue: indicatorMaxValues.meanEmissions, units: 'kg CO₂' },
    { key: 'meanEnergyQual', label: 'Qualificació mitjana d\'energia', value: indicators.meanEnergyQual, maxValue: indicatorMaxValues.meanEnergyQual, units: '(escala 1-7)' },
    { key: 'meanEmissionsQual', label: 'Qualificació mitjana d\'emissions', value: indicators.meanEmissionsQual, maxValue: indicatorMaxValues.meanEmissionsQual, units: '(escala 1-7)' },
    { key: 'meanPrimaryEnergy', label: 'Energia primària mitjana', value: indicators.meanPrimaryEnergy, maxValue: indicatorMaxValues.meanPrimaryEnergy, units: 'kWh' },
    { key: 'meanSurface', label: 'Superfície mitjana', value: indicators.meanSurface, maxValue: indicatorMaxValues.meanSurface, units: 'm²' },
    { key: 'meanCost', label: 'Cost anual mitjà', value: indicators.meanCost, maxValue: indicatorMaxValues.meanCost, units: '€' },
    { key: 'totalEmissions', label: 'Emissions totals', value: indicators.totalEmissions ? indicators.totalEmissions / 1000000 : null, maxValue: indicatorMaxValues.totalEmissions, units: 'Gg CO₂' },
    { key: 'totalPrimaryEnergy', label: 'Energia primària total', value: indicators.totalPrimaryEnergy, maxValue: indicatorMaxValues.totalPrimaryEnergy, units: 'kWh' },
    { key: 'totalSurface', label: 'Superfície total', value: indicators.totalSurface, maxValue: indicatorMaxValues.totalSurface, units: 'm²' },
    { key: 'totalCost', label: 'Cost anual total', value: indicators.totalCost, maxValue: indicatorMaxValues.totalCost, units: '€' },
  ];

  // Transform to table data
  const tableData = indicatorsConfig.map(ind => ({
    indicador: ind.label,
    valor: ind.value,
    _key: ind.key,
    _maxValue: ind.maxValue,
    _allValues: allIndicatorValues[ind.key],
    unitat: ind.units
  }));

  const handleClose = () => {
    setShowRegionCard(false);
    setClickedPolygonId(null);
    setClickedPolygonLevel(null);
    map.clearClickedFeature();
  };

  return html`
    <div class="card glass" style="width: 550px; max-width: 550px; box-sizing: border-box;"
         onmouseenter=${() => setIsMouseOverUI(true)}
         onmouseleave=${() => setIsMouseOverUI(false)}>
      <!-- Header with title and close button -->
      <div class="region-card-header">
        <div>
          <div class="mb-tip-title">
          ${regionTitle}
          </div>
          <span>Nº certificats: ${indicators.count}</span>
        </div>
        <button
          class="region-card-close"
          onclick=${handleClose}
          aria-label="Tancar"
        >
          ✕
        </button>
      </div>

      <!-- Rankings section -->
      ${rankings.emissions || rankings.income ? html`
        <div class="region-card-section">
          <div class="ranking-grid">
            ${rankings.emissions ? html`
              <div class="ranking-item">
                <span class="ranking-label">${emissionsIndicator.name}</span>
                <span>
                  Posició <strong>${rankings.emissions.position}</strong> de ${rankings.emissions.total}
                  <span class="ranking-percentile">(${fmt(rankings.emissions.percentile)}%)</span>
                </span>
              </div>
            ` : ''}
            ${rankings.income ? html`
              <div class="ranking-item">
                <span class="ranking-label">${incomeIndicator.name}</span>
                <span>
                  Posició <strong>${rankings.income.position}</strong> de ${rankings.income.total}
                  <span class="ranking-percentile">(${fmt(rankings.income.percentile)}%)</span>
                </span>
              </div>
            ` : ''}
          </div>
        </div>
      ` : ''}

      <!-- Indicators table with sparkbars -->
      <div class="region-card-section">
        <div class="card" style="padding: 0;">
          ${Inputs.table(tableData, {
            columns: ['indicador', 'valor', 'unitat'],
            header: {
              indicador: 'Indicador',
              valor: 'Valor',
              unitat: 'Unitat'
            },
            format: {
              valor: (value, i, data) => {
                const row = tableData[i];
                return createSparkbarFormatter(row._key, row._maxValue, row._allValues)(value);
              }
            },
            width: {
              indicador: '45%',
              valor: '35%',
              unitat: '20%'
            },
            layout: 'auto',
            rows: 7
          })}
        </div>
      </div>
    </div>
  `;
};
```

```js
const QUAL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const clusterModal = () => {
  const { refs, vals, indicator } = clusterModalData;
  const fmt = d3.format(',.2f');
  const handleClose = () => {
    setShowClusterModal(false);
    setClusterModalData(null);
  };
  return html`
    <div class="cluster-modal-backdrop" onclick=${handleClose}>
      <div class="card glass cluster-modal" onclick=${(e) => e.stopPropagation()}>
        <div class="region-card-header">
          <span>${refs.length} certificat${refs.length > 1 ? 's' : ''} — ${indicator.name}</span>
          <button class="region-card-close" onclick=${handleClose}>✕</button>
        </div>
        <ul class="cluster-modal-list">
          ${refs.map((ref, i) => html`
            <li>
              <span class="cluster-modal-ref">${ref}</span>
              ${indicator.type === 'qual'
                ? html`<span class="cluster-modal-qual qual-${vals[i]}">${QUAL_LABELS[vals[i] - 1] ?? '—'}</span>`
                : html`<span class="cluster-modal-value">${vals[i] != null ? fmt(vals[i]) : '—'} <small>${indicator.units}</small></span>`
              }
            </li>
          `)}
        </ul>
      </div>
    </div>
  `;
};
```

```js
const informationPhrase = html`
    <h3>
      <span>
      <strong>${emissionsIndicator.name}</strong>
      dels edificis de ${valuesByLevel[currentDatasetIndex].censusLevel} amb <strong>${lowercaseFirstLetter(incomeIndicator.name)}</strong> entre ${formatNumber(incomeRange[0], '€')} i ${formatNumber(incomeRange[1], '€')}
      </span>
    </h3>
  `;
```

<!--    Functions & Helpers    -->
<!-- Helper functions have been extracted to:
     - src/components/dataProcessing.js
     - src/components/mapHelpers.js
-->