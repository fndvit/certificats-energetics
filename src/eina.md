---
title: Eina de decisions
toc: false
style: ./dashboard.css
---

```js
html`<link href="https://cdn.jsdelivr.net/npm/range-slider-input@2.4.4/dist/style.css" rel="stylesheet">`
```

<!-- Imports & files -->
```js
import { html } from "npm:htl";
import mapboxgl from 'npm:mapbox-gl';
import * as vgplot from 'npm:@uwdata/vgplot';
import rangeSlider from "npm:range-slider-input";
import { ckmeans } from 'simple-statistics';
import { qualifColorDomain, qualifColorRange, categoricalScheme5, mapColorScheme } from './components/colors.js';
import { ChoroplethMap } from './components/choropleth.js';
import stores from './components/stores.js';

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

<!-- ```js
display(datasets)
``` -->

<!-- Dictionaries -->
```js
const binningTypes = [
  {
    name: "CKMeans",
    value: "ckmeans"
  },
  {
    name: "Logarítmica",
    value: "logarithmic"
  },
]

const emissionsIndicators = [
    {
      name: 'Mitjana d\'emissions',
      value: 'mean_emissions',
      binOperation: 'ckmeans',
      colors: mapColorScheme,
      sequentialColors: d3.quantize(d3.interpolateYlOrRd, 8).map((d) => d3.color(d).formatHex()),
      colorScaleType: 'categoric',
      units: 'Kg C02'
    },
    {
      name: 'Emissions totals',
      value: 'total_emissions',
      binOperation: 'logarithmic',
      colors: mapColorScheme,
      sequentialColors: ["#ffffcc", "#ffea9a", "#fecd6a", "#fea246", "#fc6932", "#e92a21", "#c00624", "#2b2627ff"],
      colorScaleType: 'categoric',
      units: 'Gg C02'
    },
    {
      name: "Qualificació mitjana d'energia",
      value: 'mean_energy_qual',
      binOperation: 'ckmeans',
      colors: qualifColorRange,
      sequentialColors: ["#ffffcc", "#ffea9a", "#fecd6a", "#fea246", "#fc6932", "#e92a21", "#c00624", "#2b2627ff"],
      colorScaleType: 'categoric',
      units: '1-7'
    },
    {
      name: "Qualificació mitjana d'emissions",
      value: 'mean_emissions_qual',
      binOperation: 'ckmeans',
      colors: qualifColorRange,
      sequentialColors: ["#ffffcc", "#ffea9a", "#fecd6a", "#fea246", "#fc6932", "#e92a21", "#c00624", "#2b2627ff"],
      colorScaleType: 'categoric',
      units: '1-7'
    },
];

const incomeIndicators = [
  {
    name: 'Mitjana de la renda per unitat de consum (2022)', 
    value: 'Media de la renta por unidad de consumo_2022',
    units: '€',
    levels: [true, true, false]
  },
  {
    name: 'Mediana de la renda per unitat de consum (2022)', 
    value: 'Mediana de la renta por unidad de consumo_2022',
    units: '€',
    levels: [true, true, false]
  }
];
```

```js
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
]
```

<!-- Helpers -->
```js
const lowercaseFirstLetter = str => str.charAt(0).toLowerCase() + str.slice(1);
```

```js
const currentDatasetIndex = Mutable(1);
const setCurrentDatasetIndex = (x) => (currentDatasetIndex.value = x);
```

```js
const incomeRange = Mutable([0, 0])
const setIncomeRange = (x) => (incomeRange.value = x);
```

```js
const mapLoaded = Mutable(false)
const setMapLoaded = (x) => (mapLoaded.value = x);
```

```js
const hoveredPolygonId = Mutable(null)
const setHoveredPolygonId = (x) => (hoveredPolygonId.value = x);
```


```js
// Update Emissions Indicator
function getEmissionsIndicatorData(indicator, binningType) {
  const data = [];
  datasets.forEach((dataset, i) => {
    const emissionsIndicatorArray = dataset.map((d) => d[indicator.value]);

    const nClasses = indicator.colors.length;
    let bins;
    let fullDomain;
    let thresholds;
  
    if(indicator.binOperation == 'ckmeans') {
      console.log('CKmeans BINNING');
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
    }

    else if (indicator.binOperation === 'logarithmic') {
      console.log('Loagrithmic BINNNNING');
      const min = d3.min(emissionsIndicatorArray);
      const max = d3.max(emissionsIndicatorArray);
      const nClasses = indicator.colors.length;

      const logMin = Math.log10(min);
      const logMax = Math.log10(max);

      const logStops = Array.from({ length: nClasses }, (_, i) =>
        Math.pow(10, logMin + i * (logMax - logMin) / (nClasses - 1))
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
  
    data.push({layerId: i, fullDomain, thresholds, range: indicator.colors, sequentialRange: indicator.sequentialColors, bins});
  })

  return data;
}

// Update income indicator
function getIncomeIndicatorData(indicator) {
  const data = [];
  datasets.forEach((dataset, i) => {
    console.log('UPDATING INCOME DATASET', i)
    if(indicator.levels[i]) {
      const incomeEntries = dataset
        .map((d) => ({id: d[valuesByLevel[i].id] ,value: d[indicator.value]}))
        .filter((v) => v.value != null && !isNaN(v.value))
        .sort((a, b) => a.value - b.value);

      const incomeValues = incomeEntries.map((d) => d.value);

      const sum = incomeValues.reduce((a, b) => a + b, 0);
      const count = incomeValues.length;

      console.log('Pushing content', incomeValues)

      data.push({ 
        mean: sum / count, 
        min: incomeValues[0], 
        max: incomeValues[incomeValues.length - 1], 
        q1: d3.quantile(incomeValues, 0.25), 
        q3: d3.quantile(incomeValues, 0.75),
        values: incomeEntries
      });
    }
    else {
      console.log('Pushing null')
      data.push(null)
    }
  })

  return data;
}
```

```js
const emissionsIndicatorData = getEmissionsIndicatorData(emissionsIndicator, binningType.value);
```

<!-- ```js
display(emissionsIndicatorData)
``` -->

```js
const incomeIndicatorData = getIncomeIndicatorData(incomeIndicator);
```

<!-- Inputs -->
```js
// Slider -----------
const defaultMin = 20000;
const defaultMax = 50000;

const sliderElement = html`<div></div>`;

const slider = rangeSlider(sliderElement, {
  min: defaultMin,
  max: defaultMax,
  step: 1000,
  value: [
    defaultMin + (defaultMax - defaultMin) * 0.2,
    defaultMax - (defaultMax - defaultMin) * 0.2
  ],
  onInput: (v, user) => {
    sliderElement.value = v;
    if (user) {
      // // Get new percentiles values
      const values = stores.indicatorValues;
      const n = values.length;

      const pLow = d3.bisectLeft(values, v[0]) / n;
      const pHigh = d3.bisectLeft(values, v[1]) / n;
      
      console.log('SETTING NEW PERCENTILES', {pLow, pHigh});
      stores.percentileRange = [pLow, pHigh];

      sliderElement.dispatchEvent(new Event("input", {bubbles: true}));
      console.log('Setting income range', v)
      setIncomeRange(v);
    }
  }
});

function updateSliderBounds(newMin, newMax, indicatorValues) {
  console.log('Updating slider bounds according to percentiles', stores.percentileRange)
  const [pLow, pHigh] = stores.percentileRange;
  const newLow = d3.quantileSorted(indicatorValues, pLow);
  const newHigh = d3.quantileSorted(indicatorValues, pHigh);

  slider.min(newMin);
  slider.max(newMax);
  slider.value([newLow, newHigh]);
  setIncomeRange([newLow, newHigh]);
}


// Indicators -----------
const binningTypeInput = Inputs.select(binningTypes, {
    label: "Estratègia d'agrupació",
    format: (d) => d.name,
    value: binningTypes[0]
  })

const emissionsIndicatorInput = Inputs.select(emissionsIndicators, {
    label: "Indicador d'emissions",
    format: (d) => d.name,
    value: emissionsIndicators[0]
  })


const incomeIndicatorInput = Inputs.select(incomeIndicators, {
    label: "Indicador sociodemogràfic",
    format: (d) => d.name,
    value: incomeIndicators[0]
  })
```

<!-- ```js
display(binningType)
``` -->

```js
const binningType = Generators.input(binningTypeInput);
const emissionsIndicator = Generators.input(emissionsIndicatorInput);
const incomeIndicator = Generators.input(incomeIndicatorInput);
```

```js
document.addEventListener('polygon-change', (e) => {
  setHoveredPolygonId(e.detail.polygonId)
});
```

<!-- Data Initializing -->
```js
document.addEventListener('map-loaded', () => {
  console.log('Map loaded', emissionsIndicator)
  map.initializeData(emissionsIndicator, emissionsIndicatorData, incomeIndicator, incomeIndicatorData);
  updateSliderBounds(
    incomeIndicatorData[1].min, 
    incomeIndicatorData[1].max, 
    incomeIndicatorData[1].values.map((d) => d.value),
  );  
  setMapLoaded(true);
  stores.percentileRange = [0.25, 0.75];
});
```

```js
document.addEventListener('zoom-level-changed', (event) => {
  const datasetIndex = event.detail.zoomLevel;
  setCurrentDatasetIndex(datasetIndex);
  stores.indicatorValues = incomeIndicatorData[datasetIndex].values.map(d => d.value);
});
```

```js
updateSliderBounds(
    incomeIndicatorData[currentDatasetIndex].min, 
    incomeIndicatorData[currentDatasetIndex].max, 
    incomeIndicatorData[currentDatasetIndex].values.map(d => d.value)
  );
```

```js
if(mapLoaded) {
  map.updateEmissionsData(emissionsIndicator, emissionsIndicatorData);
}
```

```js
if(mapLoaded) {
  map.updateIncomeData(incomeIndicator, incomeIndicatorData);
}
```

```js
incomeIndicator
if(mapLoaded) {
map.updateMapOpacity([incomeRange[0], incomeRange[1]]);
}
```

```js
const mapContainer = display(document.createElement('div'));
mapContainer.style = 'position:relative; height:540px; border-radius: 12px;';

const map = ChoroplethMap.create(mapContainer, datasets);
invalidation.then(() => map.destroy());
```

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

<div class="grid grid-cols-3" style="grid-auto-rows: min-content;">
  <div class="card" style="display:flex; flex-direction: column; gap: 25px;">
    <div stye="display: inline-block;">
      ${emissionsIndicatorInput}
      ${incomeIndicatorInput}
    </div>
    <div style="display:flex; flex-direction:column; gap:15px;">
      ${
        Plot.legend(
          {color: 
            {
              type: "threshold",
              domain: emissionsIndicatorData[currentDatasetIndex].thresholds,
              range: emissionsIndicatorData[currentDatasetIndex].range,
              tickFormat: (d) => {return emissionsIndicator.value == 'total_emissions' ? (d/1000000).toFixed(2) : d.toFixed(2)},
              width: 900,
              label: `${emissionsIndicator.name} (${emissionsIndicator.units})`,
            }
          }
        )
      }
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
                d.incomeValue >= incomeRange[0] && d.incomeValue <= incomeRange[1] ? getTickColor(d.class) : "#d9d9d9"
            })
          ]
        })
      )}
      ${resize((width) => 
        Plot.plot({
          height: 200,
          color: {
            type: "categorical",
            domain: Array.from({ length: 7 }, (_, i) => i.toString()),
            range: emissionsIndicator.colors
          },
          y: { grid: true, label: `Nombre de ${valuesByLevel[currentDatasetIndex].censusLevel}`}, // Per mantenir escala -> domain: [0, mostFrequentClass[1]] 
          x: { domain: Array.from({ length: 7 }, (_, i) => i.toString()), tickFormat: null, ticks: 0, label: null},
          marks: [
            Plot.barY(
              histogramData,
              Plot.groupX({ y: "count" }, { x: "class", fill: "class", tip:true })
            ),
            Plot.ruleY([0])
          ]
        })
      )}
    </div>
  </div>
  <div class="grid-colspan-2  grid-rowspan-3 card" style="display:flex; flex-direction: column;  gap: 15px;">
    ${informationPhrase}
    ${resize((width) => mapContainer)}
  </div>
  <div class="card">
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
  </div>
</div>

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

```js
const informationPhrase = 
  html`
    <h4>
      <span class="indicador-emissions">${emissionsIndicator.name}</span>
      dels edificis de 
      </span>
      <span>${valuesByLevel[currentDatasetIndex].censusLevel}</span>
      amb
      <span class="indicador-demografic" ">${lowercaseFirstLetter(incomeIndicator.name)}</span>
      entre 
      <span>${Number.isInteger(incomeRange[0]) ? incomeRange[0].toString() : incomeRange[0].toFixed(2)} €</span>
      i
      <span>${Number.isInteger(incomeRange[1]) ? incomeRange[1].toString() : incomeRange[1].toFixed(2)} €</span>
    </h4>
  `
```

```js
const hoverItemHeader = 
  html `
  <h3>
      ${hoveredInfo.names ? hoveredInfo.names.filter(n => n !== '').join(' / ') : ""}
  </h3>` 
```

<!-- { value: emissionsDataValue, pos: emissionsDataPos, totalValues: incomeValues.length } -->
```js
const hoveredItemCard = (data, indicator, type) => {
  console.log("Hovered item card data", data);
  if (!hoveredPolygonId) {
    return html `
    <div style="display: flex; gap: 20px; justify-content: space-between; height: 100%;">
      <div style="flex: 1; display: flex; flex-direction: column;">
        <h5>${indicator.name}</h5>
        <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
          
        </div>
      </div>
    </div>`
  }
  else if (!data.value) {
    return html `
    <div style="display: flex; gap: 20px; justify-content: space-between; height: 100%;">
      <div style="flex: 1; display: flex; flex-direction: column;">
        <h5>${indicator.name}</h5>
        <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
          <h1 class="${type == 'emissions' ? 'indicador-emissions' : 'indicador-demografic'}">${'Sense dades'}</h1>
        </div>
      </div>
    </div>`
  }

  return html `
  <div style="display: flex; gap: 20px; justify-content: space-between; height: 100%;">
    <div style="flex: 1; display: flex; flex-direction: column;">
      <h5>${indicator.name}</h5>
      <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
        <h1 class="${type == 'emissions' ? 'indicador-emissions' : 'indicador-demografic'}">${Number.isInteger(data.value) ? data.value.toString() : emissionsIndicator.value == 'total_emissions' ? (data.value/1000000).toFixed(2) : data.value.toFixed(2)}</h1>
        <h3 class="${type == 'emissions' ? 'indicador-emissions' : 'indicador-demografic'}">(${indicator.units})</h3>
      </div>
      <div style="display: flex; flex-direction: row; gap:4px; align-items: end">
        <h3>Posició</h3> <h2> ${data.pos} </h2>  <h3> de  </h3> <h2>${data.totalValues}</h2>
      </div>
    </div>
  </div>`
}
```

<!-- Histogram cells -->
```js
function getTickColor(val) {
  return d3.scaleThreshold(Array.from({ length: 7 }, (_, i) => i), emissionsIndicator.colors)(val);
}
```

```js
function getEmissionsData(datasetIndex) {
  console.log('GET EMISSIONS DATA FUNCTION RUN')
  const index = datasetIndex;
    const getEntryClass = (value) =>
      emissionsIndicatorData[index].bins.findIndex((d) => { return d.x0 != d.x1 ? (value >= d.x0 && value < d.x1) : value >= d.x0}).toString();
    
    const valuesByClass = datasets[index].map((d) => {
      const emissionsValue = d[emissionsIndicator.value];
      const incomeValue = d[incomeIndicator.value];
      const id = d[valuesByLevel[datasetIndex].id];
      return { id, class: getEntryClass(emissionsValue), emissionsValue, incomeValue };
    }).sort((a,b) => a.emissionsValue - b.emissionsValue);
    
    // const mostFrequentClass = d3.greatest(
    //   d3.rollup(valuesByClass, v => v.length, d => d.class),
    //   ([, count]) => count
    // );
    
    return valuesByClass;
   
  return null
}
```

```js
const emissionsData = getEmissionsData(currentDatasetIndex);
```

<!-- ```js
display(emissionsIndicatorData[currentDatasetIndex].bins)
``` -->

```js
const histogramData = emissionsData.filter(
      d => d.incomeValue >= incomeRange[0] && d.incomeValue <= incomeRange[1]
    );
```



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

<!-- Hovered cards cells -->

```js
function getHoveredNames(hoveredPolygon, currentDatasetIndex) {
  if(hoveredPolygon) {
    const sectionCode = currentDatasetIndex == 0 ? hoveredPolygon.slice(-3) : '';
    const districtCode = currentDatasetIndex == 0 ? hoveredPolygon.slice(6, 8) : '';
    const municipiCode = currentDatasetIndex == 0 ? hoveredPolygon.slice(0, -5) : currentDatasetIndex == 1 ? hoveredPolygon : '';
    
    if(municipisDict[municipiCode]) {
      const municipiName = (currentDatasetIndex == 0 || currentDatasetIndex == 1) ? municipisDict[municipiCode].municipi :  '';
      const comarcaName = currentDatasetIndex == 2 ? municipisDict.find(d => d.codi_comarca == hoveredPolygon).comarca : municipisDict[municipiCode].comarca;
  
      return [districtCode, sectionCode, municipiName, comarcaName];
    }
  }
  return ['']
}
```

```js
function getHoveredInfo(hoveredPolygonId, currentDatasetIndex) {
  const names = getHoveredNames(hoveredPolygonId, currentDatasetIndex);
  
  const incomeValues = incomeIndicatorData[currentDatasetIndex].values;
  const incomeDataPos = incomeValues.findIndex(obj => obj.id === hoveredPolygonId);
  const incomeValue = incomeDataPos !== -1 ? incomeValues[incomeDataPos].value : null;

  const emissionsDataPos = emissionsData.findIndex(obj => obj.id === hoveredPolygonId);
  const emissionsDataValue = emissionsDataPos !== -1 ? emissionsData[emissionsDataPos].emissionsValue : null;

  return {
    names,
    incomeData: { value: incomeValue, pos: incomeDataPos, totalValues: emissionsData.length },
    emissionsData: { value: emissionsDataValue, pos: emissionsDataPos, totalValues: incomeValues.length }
  };
}
```

```js
const hoveredInfo = getHoveredInfo(hoveredPolygonId, currentDatasetIndex);
```
<!-- 
```js
display(incomeRange)
``` -->

```js
// display('HISTOGRAM DATA')
// display(histogramData)

// display('EMISSIONS DATA')
// display(emissionsData)
```

<!-- ```js
display(emissionsIndicatorData[0].bins.map((d) => {return [d.x0, d.x1]}))
display('INDICATORS DATA')
display(emissionsIndicatorData)
display(incomeIndicatorData)
``` -->