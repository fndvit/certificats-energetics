---
title: Eina de decisions
toc: false
style: ./eina.css
---

<link rel="stylesheet" href="npm:mapbox-gl@3.16.0/dist/mapbox-gl.css">

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
import { qualifColorScheme, emissionsColorScheme } from './components/colors.js';
import { InfoTooltip } from './components/infoTooltip.js';

const REGION_CARD_TABLE_ROWS = 5;

const municipisDict = FileAttachment('./data/municipisDict.json').json();
const pointsData = await FileAttachment('./data/certificats-points.parquet').parquet();

const emissionsCol = pointsData.getChild('emissions_de_co2');
const _emVals = Array.from({length: pointsData.numRows}, (_, i) => Number(emissionsCol.get(i))).filter(v => isFinite(v) && v >= 0).sort(d3.ascending);
const emissionsRangeDomain = [d3.quantile(_emVals, 0.02), d3.quantile(_emVals, 0.98)];

const datasets = [
  await FileAttachment('./data/seccen_aggregates.json')
    .json()
    .then((data) => {
      return data.filter((d) => d.mean_emissions);
    }),
  await FileAttachment('./data/mun_aggregates.json')
    .json()
    .then((data) => {
      return data.filter((d) => d.mean_emissions);
    }),
  await FileAttachment('./data/com_aggregates.json')
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

```js
const viewportStats = Mutable(null);
const setViewportStats = (x) => (viewportStats.value = x);
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

      _rangeTracker.lowerShouldFlash = v[0] !== sliderState.currentRange[0];
      _rangeTracker.upperShouldFlash = v[1] !== sliderState.currentRange[1];

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

const _rangeTracker = { lowerShouldFlash: false, upperShouldFlash: false };

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

  // Keep currentRange in step with the handles, so the next user drag only
  // flashes the number that actually changed.
  sliderState.currentRange = [roundedLowHandle, roundedHighHandle];
  setIncomeRange([roundedLowHandle, roundedHighHandle]);
}


const clusterIndicatorInput = Inputs.select(clusterIndicatorsMeta, {
  label: '',
  format: (d) => d.name,
  value: clusterIndicatorsMeta[0]
});

// Qualification: continuous over 1-7 so the dot matches the gradient beneath it
const qualifColorScale = d3.scaleSequential(
  d3.interpolateRgbBasis(qualifColorScheme)
).domain([1, 7]).clamp(true);

// Emissions: continuous scale over domain
const emissionsColorScale = d3.scaleSequential(
  d3.interpolateRgbBasis(emissionsColorScheme)
).domain(emissionsRangeDomain).clamp(true);

// Thousands separated by dots (148.433.069)
const formatThousands = d3.formatLocale({
  decimal: ',', thousands: '.', grouping: [3], currency: ['', '']
}).format(',.0f');

function clusterColorRamp(meanValue, type) {
  let gradient, pct, color;
  if (type === 'qual') {
    gradient = `linear-gradient(to right, ${qualifColorScheme.join(', ')})`;
    pct = meanValue != null ? Math.min(100, Math.max(0, ((meanValue - 1) / 6) * 100)) : null;
    color = meanValue != null ? qualifColorScale(meanValue) : null;
  } else {
    const [lo, hi] = emissionsRangeDomain;
    const stops = Array.from({length: 12}, (_, i) =>
      emissionsColorScale(lo + (hi - lo) * i / 11)
    );
    gradient = `linear-gradient(to right, ${stops.join(', ')})`;
    pct = meanValue != null
      ? Math.min(100, Math.max(0, ((meanValue - lo) / (hi - lo)) * 100))
      : null;
    color = meanValue != null ? emissionsColorScale(meanValue) : null;
  }
  return html`
    <div class="cluster-ramp-bar" style="background: ${gradient};">
      ${pct != null ? html`<div class="cluster-ramp-dot" style="left:${pct.toFixed(1)}%; background:${color};"></div>` : ''}
    </div>`;
}

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

// Custom dropdown over a hidden Inputs.select (which stays the value store for
// Generators.input). The native iOS picker anchors far from the control inside
// the fixed mobile card, so the list is positioned from the wrapper's rect.
// Built once here so re-rendering choroplethBody doesn't stack listeners.
let dropdownIdCounter = 0;
function withCustomDropdown(input, options) {
  const listId = `choropleth-select-list-${++dropdownIdCounter}`;
  input.style.display = 'none';

  const trigger = html`<button type="button" class="choropleth-select-trigger"
    aria-haspopup="listbox" aria-expanded="false" aria-controls=${listId}></button>`;
  const list = html`<ul class="choropleth-select-list" id=${listId} role="listbox" tabindex="-1" hidden></ul>`;
  const items = options.map((option, i) => {
    const li = html`<li role="option" id=${`${listId}-${i}`}>${option.name}</li>`;
    li.addEventListener('click', () => select(i));
    li.addEventListener('pointermove', () => setActive(i));
    list.append(li);
    return li;
  });
  const wrapper = html`<div class="choropleth-select">${input}${trigger}${list}</div>`;

  let activeIndex = -1;

  const sync = () => {
    trigger.textContent = input.value.name;
    items.forEach((li, i) => {
      const selected = options[i] === input.value;
      li.classList.toggle('is-selected', selected);
      li.setAttribute('aria-selected', selected);
    });
  };

  const setActive = (i) => {
    activeIndex = i;
    items.forEach((li, j) => li.classList.toggle('is-active', j === i));
    list.setAttribute('aria-activedescendant', items[i].id);
    items[i].scrollIntoView({ block: 'nearest' });
  };

  const position = () => {
    const rect = wrapper.getBoundingClientRect();
    const margin = 8;
    const spaceAbove = rect.top - margin;
    const spaceBelow = window.innerHeight - rect.bottom - margin;
    list.style.left = `${rect.left}px`;
    list.style.width = `${rect.width}px`;
    if (spaceAbove > spaceBelow) {
      list.style.top = 'auto';
      list.style.bottom = `${window.innerHeight - rect.top + 4}px`;
      list.style.maxHeight = `${spaceAbove - 4}px`;
    } else {
      list.style.bottom = 'auto';
      list.style.top = `${rect.bottom + 4}px`;
      list.style.maxHeight = `${spaceBelow - 4}px`;
    }
  };

  const onOutsidePointer = (e) => {
    if (!wrapper.contains(e.target)) close();
  };
  const onScroll = (e) => {
    if (e.target !== list) close();
  };
  const onResize = () => close();

  const open = () => {
    if (!list.hidden) return;
    list.hidden = false;
    position();
    trigger.setAttribute('aria-expanded', 'true');
    setActive(Math.max(0, options.indexOf(input.value)));
    list.focus({ preventScroll: true });
    document.addEventListener('pointerdown', onOutsidePointer, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
  };

  const close = ({ focusTrigger = false } = {}) => {
    if (list.hidden) return;
    list.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onOutsidePointer, true);
    window.removeEventListener('scroll', onScroll, true);
    window.removeEventListener('resize', onResize);
    if (focusTrigger) trigger.focus();
  };

  const select = (i) => {
    if (options[i] !== input.value) {
      input.value = options[i];
      input.dispatchEvent(new Event('input', { bubbles: true }));
    }
    close({ focusTrigger: true });
  };

  trigger.addEventListener('click', () => (list.hidden ? open() : close()));
  trigger.addEventListener('keydown', (e) => {
    if (['Enter', ' ', 'ArrowDown', 'ArrowUp'].includes(e.key)) {
      e.preventDefault();
      open();
    }
  });
  list.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive(Math.min(items.length - 1, activeIndex + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(Math.max(0, activeIndex - 1));
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      select(activeIndex);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close({ focusTrigger: true });
    } else if (e.key === 'Tab') {
      close();
    }
  });

  input.addEventListener('input', sync);
  sync();
  return wrapper;
}

const emissionsIndicatorSelect = withCustomDropdown(emissionsIndicatorInput, emissionsIndicatorsMeta);
const incomeIndicatorSelect = withCustomDropdown(incomeIndicatorInput, socEcIndicatorsMeta);
const clusterIndicatorSelect = withCustomDropdown(clusterIndicatorInput, clusterIndicatorsMeta);
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
  updateAnalysisZone();
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

document.addEventListener('cluster-viewport-stats', (e) => {
  setViewportStats(e.detail);
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

<!-- Reactive: Toggles cluster-mode class on top card when map mode changes
     Depends on: mapMode -->
```js
document.querySelector('.cluster-top-card')
  ?.classList.toggle('cluster-mode', mapMode === 'cluster');
```

<!-- Reactive: Shows/hides analysis zone overlay when map mode changes
     Depends on: mapMode, mapLoaded -->
```js
if (mapLoaded) {
  if (mapMode === 'cluster') {
    analysisZoneEl.classList.remove('hidden');
    updateAnalysisZone();
  } else {
    analysisZoneEl.classList.add('hidden');
  }
}
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
      background: linear-gradient(to right, var(--accent) ${widthPercent}%, #eee ${widthPercent}%);
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
const modeToggleButtons = html`<div class="mode-tabs">
  <button class="mode-toggle-btn ${mapMode === 'choropleth' ? 'active' : ''}"
    onclick=${() => { setMapMode('choropleth'); if (mapLoaded) map.setMode('choropleth'); }}>
    Coropletes
  </button>
  <button class="mode-toggle-btn ${mapMode === 'cluster' ? 'active' : ''}"
    onclick=${() => { setMapMode('cluster'); if (mapLoaded) map.setMode('cluster'); }}>
    Clústers
  </button>
</div>`;
```

```js
// Re-run whenever mapMode changes; double-rAF waits for Observable's reactive
// DOM updates to finish before measuring the card's new dimensions.
{
  mapMode;
  requestAnimationFrame(() => requestAnimationFrame(updateAnalysisZone));
}
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

const analysisZoneEl = display(document.createElement('div'));
analysisZoneEl.className = 'cluster-analysis-zone hidden';
```

```js
// This cell re-runs when mapLoaded flips, so tear down its listeners first.
const _ac = new AbortController();
invalidation.then(() => _ac.abort());

function updateAnalysisZone() {
  const topCard = document.querySelector('.card.glass');
  if (!topCard || !mapLoaded) return;
  const r = topCard.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight;
  const sidebarEl = document.getElementById('observablehq-sidebar');
  const sidebarRight = sidebarEl ? Math.max(0, sidebarEl.getBoundingClientRect().right) : 0;
  // On mobile, align the zone with the top card's edges to use the full width
  const isMobile = window.matchMedia('(max-width: 600px)').matches;
  const left = isMobile ? r.left : Math.max(sidebarRight + 8, 46);
  // On desktop, mirror the sidebar gap on the right and the top gap at the bottom
  const right = isMobile ? r.right : vw - 14;
  const top = r.bottom + 16;
  const bottom = isMobile ? vh - r.left : vh - 16;
  Object.assign(analysisZoneEl.style, {
    top: `${top}px`, left: `${left}px`,
    width: `${right - left}px`, height: `${bottom - top}px`
  });
  map.setClusterAnalysisRect({ top, left, right, bottom });
}

window.addEventListener('resize', updateAnalysisZone, { signal: _ac.signal });
document.getElementById('observablehq-sidebar-toggle')
  ?.addEventListener('change', () => requestAnimationFrame(updateAnalysisZone), { signal: _ac.signal });

const _sidebarCloseBtn = document.getElementById('observablehq-sidebar-close');
function _syncCloseBtn() {
  if (!_sidebarCloseBtn) return;
  const isDesktop = window.matchMedia('(min-width: calc(912px + 6rem))').matches;
  const toggle = document.getElementById('observablehq-sidebar-toggle');
  _sidebarCloseBtn.style.visibility =
    toggle?.checked || (toggle?.indeterminate && isDesktop) ? 'visible' : 'hidden';
}
document.getElementById('observablehq-sidebar-toggle')
  ?.addEventListener('change', _syncCloseBtn, { signal: _ac.signal });
window.addEventListener('resize', _syncCloseBtn, { signal: _ac.signal });
requestAnimationFrame(_syncCloseBtn);
```

${hoveredPolygonId && !isMouseOverUI && !isMouseButtonPressed && mapMode === 'choropleth' ? mapTooltip() : ''}

${showClusterModal && clusterModalData ? clusterModal() : ''}

```js
const clusterBody = (() => {
  const count = viewportStats?.count ?? 0;
  const mean = count > 0 ? viewportStats[clusterIndicator.statKey] : null;
  const isQual = clusterIndicator.type === 'qual';
  const value = mean != null ? mean.toFixed(isQual ? 2 : 1) : '—';

  return html`<div class="cluster-zone-stats">
    <div class="cluster-row">
      <span class="cluster-zone-title">
        Zona d'anàlisi — <strong>${count} certificats</strong>
      </span>
      <span class="cluster-zone-surface">
        Superfície total — <strong>${formatThousands(count > 0 ? viewportStats.sumMetresCadastre : 0)}m²</strong>
      </span>
    </div>
    <div class="cluster-row cluster-row--controls">
      <div class="choropleth-selector cluster-selector">
        <p class="choropleth-selector-label">Pintat per</p>
        ${clusterIndicatorSelect}
      </div>
      <div class="cluster-legend">
        <div class="cluster-legend-header">
          ${InfoTooltip(clusterIndicator.info)}
          <span class="cluster-legend-label">${clusterIndicator.legendLabel}</span>
          <span class="cluster-legend-value">${value}</span>
        </div>
        ${clusterColorRamp(mean, isQual ? 'qual' : 'emissions')}
      </div>
    </div>
  </div>`;
})();

// Clip the threshold legend swatches to a pill shape (ticks stay unclipped)
const roundedLegend = (svg) => {
  const rects = Array.from(svg.querySelectorAll('rect'));
  if (!rects.length) return svg;
  const x0 = d3.min(rects, (r) => +r.getAttribute('x'));
  const x1 = d3.max(rects, (r) => +r.getAttribute('x') + +r.getAttribute('width'));
  const y = +rects[0].getAttribute('y');
  const h = +rects[0].getAttribute('height');
  const id = `legend-clip-${Math.random().toString(36).slice(2)}`;
  const ns = 'http://www.w3.org/2000/svg';
  const clipPath = document.createElementNS(ns, 'clipPath');
  clipPath.setAttribute('id', id);
  const clipRect = document.createElementNS(ns, 'rect');
  Object.entries({ x: x0, y, width: x1 - x0, height: h, rx: h / 2 })
    .forEach(([k, v]) => clipRect.setAttribute(k, v));
  clipPath.appendChild(clipRect);
  svg.prepend(clipPath);
  rects[0].parentNode.setAttribute('clip-path', `url(#${id})`);
  return svg;
};

const choroplethBody = (() => {
  if (window._choroplethCollapsed === undefined) window._choroplethCollapsed = false;

  const el = html`<div class="choropleth-body">
    <!-- CHOROPLETH MODE -->
    ${informationPhrase}
    <div class="choropleth-filters">
      <button class="choropleth-collapse-toggle" aria-expanded="true">
        <span class="choropleth-collapse-label">Veure filtres i gràfic</span>
        <svg class="choropleth-collapse-icon" width="8" height="5" viewBox="0 0 8 5" aria-hidden="true">
          <path d="M1 1l3 3 3-3" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <div class="choropleth-collapsible">
        <div class="choropleth-selectors-wrapper">
          <div class="choropleth-selector">
            <p class="choropleth-selector-label">Indicador d'emissions</p>
            ${emissionsIndicatorSelect}
          </div>
          <div class="choropleth-selector">
            <p class="choropleth-selector-label">Indicador sociodemogràfic</p>
            ${incomeIndicatorSelect}
          </div>
        </div>
        <!-- Choropleth controls: legend, histogram, slider, tick plot -->
        <div class="card choropleth-controls">
          <!-- Legend -->
          <div class="choropleth-legend">
            ${InfoTooltip(emissionsIndicator.info)}
            <span class="choropleth-legend-label">${emissionsIndicator.name} (${emissionsIndicator.units})</span>
            ${roundedLegend(Plot.legend({
              color: {
                type: "threshold",
                domain: emissionsIndicatorData[currentDatasetIndex].thresholds,
                range: emissionsIndicatorData[currentDatasetIndex].range,
                tickFormat: (d) => {
                  const value = emissionsIndicator.value === 'total_emissions' ? d / 1000000 : d;
                  return formatNumber(value);
                },
                label: null,
              },
              height: 30,
              marginTop: 4,
              marginBottom: 16
            }))}
          </div>
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
              },
              x: {
                domain: Array.from({ length: 7 }, (_, i) => i.toString()),
                tickFormat: null,
                tickSize: 0,
                label: null
              },
              marks: [
                Plot.barY(
                  histogramData,
                  Plot.groupX({
                    y: "count",
                    title: (d) => {
                      const bins = emissionsIndicatorData[currentDatasetIndex].bins;
                      const bin = bins[parseInt(d[0]?.class)];
                      if (!bin) return '';
                      const scale = emissionsIndicator.value === 'total_emissions' ? 1 / 1000000 : 1;
                      return `${formatNumber(bin.x0 * scale)} – ${formatNumber(bin.x1 * scale)} ${emissionsIndicator.units}\n${d.length} ${valuesByLevel[currentDatasetIndex].censusLevel}`;
                    }
                  }, { x: "class", fill: "class", tip: true })
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
                    d.incomeValue >= incomeRange[0] && d.incomeValue <= incomeRange[1]
                      ? getTickColor(d.class, emissionsIndicator)
                      : "#d9d9d9"
                })
              ]
            })
          )}
        </div>
      </div>
    </div>
  </div>`;

  const btn = el.querySelector('.choropleth-collapse-toggle');
  const collapsible = el.querySelector('.choropleth-collapsible');

  if (window._choroplethCollapsed) {
    btn.setAttribute('aria-expanded', 'false');
    btn.classList.add('is-collapsed');
    collapsible.classList.add('is-collapsed');
  }

  btn.addEventListener('click', () => {
    const expanded = btn.getAttribute('aria-expanded') === 'true';
    window._choroplethCollapsed = expanded;
    btn.setAttribute('aria-expanded', String(!expanded));
    btn.classList.toggle('is-collapsed', expanded);
    collapsible.classList.toggle('is-collapsed', expanded);
  });
  return el;
})();

const bodyContent = mapMode === 'cluster' ? clusterBody : choroplethBody;
```

<!-- Top Card -->

<div class="card glass cluster-top-card" style="margin-top:-25px; margin-bottom:25px; box-sizing:border-box;">
  <!-- HEADER ROW: tabs -->
  <div class="cluster-card-header">
    ${modeToggleButtons}
  </div>
  ${bodyContent}
</div>

<div id="region-card-wrapper">
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
          ${hoveredInfo.emissionsData.value == null ? "—" : `${fmt(hoveredInfo.emissionsData.value)} ${emissionsIndicator.units}`}
        </span>
      </div>
      <div class="mb-tip-row">
        <span>${incomeIndicator.name}</span>
        <span>
          ${hoveredInfo.incomeData.value == null ? "—" : `${fmt(hoveredInfo.incomeData.value)} ${incomeIndicator.units}`}
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
    <div class="card region-card-wrapper" style="box-sizing: border-box;"
         onmouseenter=${() => setIsMouseOverUI(true)}
         onmouseleave=${() => setIsMouseOverUI(false)}>
      <!-- Header with title and close button -->
      <div class="region-card-header">
        <div>
          <div class="mb-tip-title">
          ${regionTitle}
          </div>
          <span class="region-card-count">Nº certificats: ${indicators.count}</span>
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
            rows: window.innerWidth < 600 ? 4 : REGION_CARD_TABLE_ROWS
          })}
        </div>
      </div>
    </div>
  `;
};
```

```js
const QUAL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

const copyRef = async (ref) => {
  await navigator.clipboard.writeText(ref);
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = 'Codi copiat';
  document.body.appendChild(toast);
  toast.addEventListener('animationend', () => toast.remove());
};

const clusterModal = () => {
  const { refs, vals, coords, indicator } = clusterModalData;
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
          ${refs.map((ref, i) => {
            const [lon, lat] = coords?.[i] ?? [];
            const mapsUrl = lat != null
              ? `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`
              : null;
            return html`
              <li>
                <span class="cluster-modal-ref-group">
                  ${mapsUrl
                    ? html`<a class="cluster-modal-ref" href=${mapsUrl} target="_blank" rel="noopener" title="Obre a Google Maps Street View">${ref}</a>`
                    : html`<span class="cluster-modal-ref">${ref}</span>`
                  }
                  <button class="cluster-modal-copy" onclick=${() => copyRef(ref)} title="Copia la referència cadastral">Copia</button>
                </span>
                ${indicator.type === 'qual'
                  ? html`<span class="cluster-modal-qual qual-${vals[i]}">${QUAL_LABELS[vals[i] - 1] ?? '—'}</span>`
                  : html`<span class="cluster-modal-value">${vals[i] != null ? fmt(vals[i]) : '—'} <small>${indicator.units}</small></span>`
                }
              </li>
            `;
          })}
        </ul>
      </div>
    </div>
  `;
};
```

```js
const informationPhrase = (() => {
  const lowerFlash = _rangeTracker.lowerShouldFlash;
  const upperFlash = _rangeTracker.upperShouldFlash;
  _rangeTracker.lowerShouldFlash = false;
  _rangeTracker.upperShouldFlash = false;
  return html`
    <h3>
      <span>
      <strong>${emissionsIndicator.name}</strong>
      dels edificis de ${valuesByLevel[currentDatasetIndex].censusLevel} amb <strong>${lowercaseFirstLetter(incomeIndicator.name)}</strong> entre <span class="income-range-value income-range-lower${lowerFlash ? ' income-value--flash' : ''}">${formatNumber(incomeRange[0], '€')}</span> i <span class="income-range-value income-range-upper${upperFlash ? ' income-value--flash' : ''}">${formatNumber(incomeRange[1], '€')}</span>
      </span>
    </h3>
  `;
})();
```

<!--    Functions & Helpers    -->
<!-- Helper functions have been extracted to:
     - src/components/dataProcessing.js
     - src/components/mapHelpers.js
-->