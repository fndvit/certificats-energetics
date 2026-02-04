---
title: Eina de decisions
toc: false
style: ./eina.css
---

<!--    Imports & files    -->

```js
import { html } from 'npm:htl';
import rangeSlider from 'npm:range-slider-input';
import sliderState from './components/sliderState.js';
import { ChoroplethMap } from './components/map/choropleth.js';
import { emissionsIndicatorsMeta, socEcIndicatorsMeta } from './components/indicatorsMeta.js';
import { getEmissionsIndicatorData, getIncomeIndicatorData, getEmissionsData } from './components/dataProcessing.js';
import { getHoveredInfo, getTickColor, lowercaseFirstLetter } from './components/mapHelpers.js';

const municipisDict = FileAttachment('./data/municipisDict.json').json();

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

function updateSliderBounds(newMin, newMax, indicatorValues) {
  const [pLow, pHigh] = sliderState.percentileRange;
  const lowHandle = d3.quantileSorted(indicatorValues, pLow);
  const highHandle = d3.quantileSorted(indicatorValues, pHigh);

  const newMinExtended = newMin - 1;
  const newMaxExtended = newMax + 1;

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
  sliderState.indicatorValues = incomeIndicatorData[currentDatasetIndex].values.map((d) => d.value)
  map.initializeData(
    emissionsIndicator,
    emissionsIndicatorData,
    incomeIndicator,
    incomeIndicatorData
  );
  updateSliderBounds(
    incomeIndicatorData[1].min,
    incomeIndicatorData[1].max,
    incomeIndicatorData[1].values.map((d) => d.value)
  );
  setMapLoaded(true);
  sliderState.percentileRange = [0.25, 0.75];
});

document.addEventListener('zoom-level-changed', (event) => {
  const datasetIndex = event.detail.zoomLevel;
  sliderState.indicatorValues = incomeIndicatorData[datasetIndex].values.map((d) => d.value);
  setCurrentDatasetIndex(datasetIndex);
});
```

<!--    Reactive listeners    -->

```js
updateSliderBounds(
  incomeIndicatorData[currentDatasetIndex].min,
  incomeIndicatorData[currentDatasetIndex].max,
  incomeIndicatorData[currentDatasetIndex].values.map((d) => d.value)
);
```

```js
if (mapLoaded) {
  map.updateEmissionsData(emissionsIndicator, emissionsIndicatorData);
}
```

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
// Pre-compute lookup maps for O(1) hover performance
const datasetLookup = datasets[currentDatasetIndex].reduce((map, d) => {
  map[d[valuesByLevel[currentDatasetIndex].id]] = d;
  return map;
}, {});
```

```js
const incomeLookup = incomeIndicatorData[currentDatasetIndex].values.reduce((map, d, i) => {
  map[d.id] = { value: d.value, pos: i };
  return map;
}, {});
```

```js
const emissionsLookup = emissionsData.reduce((map, d, i) => {
  map[d.id] = { value: d.emissionsValue, pos: i };
  return map;
}, {});
```

```js
const hoveredInfo = getHoveredInfo(hoveredPolygonId, currentDatasetIndex, datasets, valuesByLevel, incomeIndicatorData, emissionsData, municipisDict, datasetLookup, incomeLookup, emissionsLookup);
```

```js
const histogramData = emissionsData.filter(
  (d) => d.incomeValue >= incomeRange[0] && d.incomeValue <= incomeRange[1]
);
```

<!--    Map & HTML    -->
```js
const mapContainer = display(document.createElement("div"));

Object.assign(mapContainer.style, {
  position: "fixed",
  inset: "0",
  zIndex: "-5",
});

const map = ChoroplethMap.create(mapContainer, datasets);
invalidation.then(() => map.destroy());
```

${hoveredPolygonId ? mapTooltip() : ''}

<!-- Top Card -->

<div class="card glass" style="margin-top: -25px; max-width: 750px;">
    <div style="display: flex; flex-direction: row; gap: 1.5rem">
      <!-- Left column -->
      <div style="flex: 0 0 35%; min-width: 0;">
        <div style="display: flex; flex-direction: column; justify-content: space-between; height: 100%">
          <div class="glassText">
            ${informationPhrase}
          </div>
          <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 20px">
            <div>
              <p class="glassText" style="margin: 0px">Indicador d'emissions</p>
              ${emissionsIndicatorInput}
            </div>
            <div>
              <p class="glassText" style="margin: 0px">Indicador sociodemogràfic</p>
              ${incomeIndicatorInput}
            </div>
          </div>
        </div>
      </div>
      <!-- Right column -->
      <div class="card" style="flex: 1; min-width: 0; gap: 8px">
        <!-- Legend -->
        ${
          Plot.legend(
            {color: 
              {
                type: "threshold",
                domain: emissionsIndicatorData[currentDatasetIndex].thresholds,
                range: emissionsIndicatorData[currentDatasetIndex].range,
                tickFormat: (d) => {return emissionsIndicator.value == 'total_emissions' ? (d/1000000).toFixed(2) : d.toFixed(2)},
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
const informationPhrase = html`
    <p class="indicadorText" style="font-size: 16px">
      <span style="font-weight: bold;">${emissionsIndicator.name}</span>
      dels edificis de 
      </span>
      <span>${valuesByLevel[currentDatasetIndex].censusLevel}</span>
      amb
      <span style="font-weight: bold;">${lowercaseFirstLetter(incomeIndicator.name)}</span>
      entre 
      <span>${Number.isInteger(incomeRange[0]) ? incomeRange[0].toString() : incomeRange[0].toFixed(2)} €</span>
      i
      <span>${Number.isInteger(incomeRange[1]) ? incomeRange[1].toString() : incomeRange[1].toFixed(2)} €</span>
    </p>
  `;
```

<!--    Functions & Helpers    -->
<!-- Helper functions have been extracted to:
     - src/components/dataProcessing.js
     - src/components/mapHelpers.js
-->