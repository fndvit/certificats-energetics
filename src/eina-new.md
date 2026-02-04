---
title: Eina de decisions
toc: false
style: ./eina-new.css
---

<!--    Imports & files    -->

```js
import {
  qualifColorDomain,
  qualifColorRange,
  categoricalScheme5,
  mapColorScheme
} from './components/colors.js';
import { html } from 'npm:htl';
import mapboxgl from 'npm:mapbox-gl';
import * as vgplot from 'npm:@uwdata/vgplot';
import rangeSlider from 'npm:range-slider-input';
import sliderState from './components/sliderState.js';
import { ChoroplethMap } from './components/map/choropleth.js';
import { emissionsIndicatorsMeta, socEcIndicatorsMeta } from './components/indicatorsMeta.js';
import { getEmissionsIndicatorData, getIncomeIndicatorData, getEmissionsData } from './components/dataProcessing.js';
import { getHoveredInfo, getTickColor, lowercaseFirstLetter } from './components/mapHelpers.js';

const labels = FileAttachment('./data/labels.json').json();
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
const hoveredInfo = getHoveredInfo(hoveredPolygonId, currentDatasetIndex, datasets, valuesByLevel, incomeIndicatorData, emissionsData, municipisDict);
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

${mapTooltip()}

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

<!-- <div class="card">
    <div>
      ${hoverItemHeader}
    </div>
    <div style="display: flex; flex-direction: row; gap: 15px;">
      <div class="card" style="flex: 1;">
        ${hoveredItemCard(hoveredInfo.emissionsData, emissionsIndicator, 'emissions')}
      </div>
      <div class="card" style="flex: 1;">
        ${hoveredItemCard(hoveredInfo.incomeData, incomeIndicator, 'demografic')}
      </div>
    </div>
  </div> -->


```js
const mapTooltip = () => { 
  const p = mousePosition;

  if (!hoveredPolygonId || p == null) return null;

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

<!-- 
```js
const hoveredItemCard = (data, indicator, type) => {
  if (!hoveredPolygonId) {
    return html` <div
      style="display: flex; gap: 20px; justify-content: space-between; height: 100%;"
    >
      <div style="flex: 1; display: flex; flex-direction: column;">
        <h5>${indicator.name}</h5>
        <div style="display: flex; flex-direction: row; gap:4px; align-items: end"></div>
      </div>
    </div>`;
  } else if (!data.value) {
    return html` <div
      style="display: flex; gap: 20px; justify-content: space-between; height: 100%;"
    >
      <div style="flex: 1; display: flex; flex-direction: column;">
        <h5>${indicator.name}</h5>
        <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
          <h1 class="${type == 'emissions' ? 'indicador-emissions' : 'indicador-demografic'}">
            ${'Sense dades'}
          </h1>
        </div>
      </div>
    </div>`;
  }

  return html` <div style="display: flex; gap: 20px; justify-content: space-between; height: 100%;">
    <div style="flex: 1; display: flex; flex-direction: column;">
      <h5>${indicator.name}</h5>
      <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
        <h1 class="${type == 'emissions' ? 'indicador-emissions' : 'indicador-demografic'}">
          ${Number.isInteger(data.value)
            ? data.value.toString()
            : emissionsIndicator.value == 'total_emissions'
              ? (data.value / 1000000).toFixed(2)
              : data.value.toFixed(2)}
        </h1>
        <h3 class="${type == 'emissions' ? 'indicador-emissions' : 'indicador-demografic'}">
          (${indicator.units})
        </h3>
      </div>
      <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
        <h3>Posició</h3>
        <h2>${data.pos + 1}</h2>
        <h3>de</h3>
        <h2>${data.totalValues}</h2>
      </div>
    </div>
  </div>`;
};
``` -->

<!-- return {
    names,
    incomeData: { value: incomeValue, pos: incomeDataPos, totalValues: incomeValues.length },
    emissionsData: {
      value: emissionsDataValue,
      pos: emissionsDataPos,
      totalValues: emissionsData.length
    },
    nCerts
  }; -->

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

```js
const hoverItemHeader = html` <h3>
  ${hoveredInfo.names ? hoveredInfo.names.filter((n) => n !== '').join(' / ') : ''}
</h3>
  <span> Nº certificats: <b> ${hoveredInfo.nCerts ?? 0} </b> </span> `
```

```js
const hoveredItemCard = (data, indicator, type) => {
  if (!hoveredPolygonId) {
    return html` <div
      style="display: flex; gap: 20px; justify-content: space-between; height: 100%;"
    >
      <div style="flex: 1; display: flex; flex-direction: column;">
        <h5>${indicator.name}</h5>
        <div style="display: flex; flex-direction: row; gap:4px; align-items: end"></div>
      </div>
    </div>`;
  } else if (!data.value) {
    return html` <div
      style="display: flex; gap: 20px; justify-content: space-between; height: 100%;"
    >
      <div style="flex: 1; display: flex; flex-direction: column;">
        <h5>${indicator.name}</h5>
        <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
          <h1 class="${type == 'emissions' ? 'indicador-emissions' : 'indicador-demografic'}">
            ${'Sense dades'}
          </h1>
        </div>
      </div>
    </div>`;
  }

  return html` <div style="display: flex; gap: 20px; justify-content: space-between; height: 100%;">
    <div style="flex: 1; display: flex; flex-direction: column;">
      <h5>${indicator.name}</h5>
      <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
        <h1 class="${type == 'emissions' ? 'indicador-emissions' : 'indicador-demografic'}">
          ${Number.isInteger(data.value)
            ? data.value.toString()
            : emissionsIndicator.value == 'total_emissions'
              ? (data.value / 1000000).toFixed(2)
              : data.value.toFixed(2)}
        </h1>
        <h3 class="${type == 'emissions' ? 'indicador-emissions' : 'indicador-demografic'}">
          (${indicator.units})
        </h3>
      </div>
      <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
        <h3>Posició</h3>
        <h2>${data.pos + 1}</h2>
        <h3>de</h3>
        <h2>${data.totalValues}</h2>
      </div>
    </div>
  </div>`;
};
```


<!--    Functions & Helpers    -->
<!-- Helper functions have been extracted to:
     - src/components/dataProcessing.js
     - src/components/mapHelpers.js
-->


```js
// const legend = document.createElement('div');
// legend.style.position = 'absolute';
// legend.style.bottom = '1rem';
// legend.style.right = '1rem';
// legend.style.background = 'white';
// legend.style.padding = '0.5rem 0.75rem';
// legend.style.border = '1px solid #ccc';
// legend.style.borderRadius = '0.5rem';
// legend.style.boxShadow = '0 2px 4px rgba(0,0,0,0.15)';
// legend.style.fontSize = '0.8rem';
// legend.style.lineHeight = '1.2rem';
// legend.style.zIndex = '10';

// // Append to map container
// mapContainer.appendChild(legend);
```

<!-- ```js
// Remove existing container if it exists
let existing = mapContainer.querySelector('.bottom-right-cards');
if (existing) existing.remove();

// Create outer card container
const outerCard = document.createElement('div');
outerCard.className = 'card bottom-right-cards'; // add card class and marker class
outerCard.style.position = 'absolute';
outerCard.style.bottom = '1rem';
outerCard.style.right = '1rem';
outerCard.style.padding = '0.75rem'; // smaller padding
outerCard.style.fontSize = '0.85rem'; // compact font
outerCard.style.display = 'flex';
outerCard.style.flexDirection = 'column';
outerCard.style.gap = '10px';
outerCard.style.zIndex = '10';
outerCard.style.maxWidth = '300px'; // optional constraint

// Optional header
const header = document.createElement('div');
header.innerHTML = hoveredInfo.names.filter(n => n !== '').join(' / ');
header.style.fontWeight = '600';
outerCard.appendChild(header);

// Inner horizontal flex container
const innerContainer = document.createElement('div');
innerContainer.style.display = 'flex';
innerContainer.style.flexDirection = 'row';
innerContainer.style.gap = '10px';

// Create and append the cards
const incomeCard = document.createElement('div');
incomeCard.className = 'card';
incomeCard.style.flex = '1';
incomeCard.style.fontSize = '0.75rem'; // shrink inner text
incomeCard.style.padding = '0.5rem';
incomeCard.appendChild(hoveredItemCard(hoveredInfo.incomeData, incomeIndicator, 'emissions'));

const emissionsCard = document.createElement('div');
emissionsCard.className = 'card';
emissionsCard.style.flex = '1';
emissionsCard.style.fontSize = '0.75rem';
emissionsCard.style.padding = '0.5rem';
emissionsCard.appendChild(hoveredItemCard(hoveredInfo.emissionsData, emissionsIndicator, 'demografic'));

innerContainer.appendChild(incomeCard);
innerContainer.appendChild(emissionsCard);

// Final assembly
outerCard.appendChild(innerContainer);
mapContainer.appendChild(outerCard);
``` -->

<!-- <div class="card" style="flex">
${resize((width) =>
    Plot.plot({
      height: 200,
      color: {
        type: "threshold",
        domain: emissionsIndicatorData[currentDatasetIndex].bins.map((d) => d.x0),
        range: emissionsIndicator.colors
      },
      y: { grid: true, label: `Nombre de ${valuesByLevel[currentDatasetIndex].censusLevel}` },
      marks: [
        Plot.rectY(emissionsIndicatorData[currentDatasetIndex].bins, {
          x1: "x0",
          x2: "x1",
          y2: "length",
          channels: {
            Mida: "y",
            Categoria: "x"
          },
          tip: {
            format: {
              y2: true,
              x: true,
              fill: false
            }
          },
          fill: emissionsIndicatorData[currentDatasetIndex].bins.map((d) => d.x0),
        }),
        Plot.ruleY([0])
      ]
    })
  )}
</div> -->


<!-- ```js
html `
    <div style="display: flex; margin-top: 10px; gap: 20px; align-items: stretch;">
      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center;">
        <h2>${emissionsIndicator.name}</h2>
        <h2 class="indicador-emissions">${hoveredInfo.emissionsData.value.toFixed(2)} ${emissionsIndicator.units}</h2>
        <h2>Posició ${hoveredInfo.emissionsData.pos} de ${emissionsData.length}</h2>
      </div>

      <div style="width: 1px; background: repeating-linear-gradient(
        to bottom,
        #999,
        #999 4px,
        transparent 4px,
        transparent 8px
      );"></div>

      <div style="flex: 1; display: flex; flex-direction: column; justify-content: center; ">
        <h2>${incomeIndicator.name}</h2>
        <h2 class="indicador-demografic">${hoveredInfo.incomeData.value} ${incomeIndicator.units}</h2>
        <h2>Posició ${hoveredInfo.incomeData.pos} de ${incomeIndicatorData[currentDatasetIndex].values.length}</h2>
      </div>
    </div>`
``` -->