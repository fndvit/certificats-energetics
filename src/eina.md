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
import { qualifColorDomain, qualifColorRange, categoricalScheme5, mapThresholdScheme } from './components/colors.js';
import { ChoroplethMap } from './components/choropleth.js';

const labels = FileAttachment('./data/labels.json').json();
const municipis = FileAttachment('./data/municipis.json').json();

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

<!-- Dictionaries -->
```js
const emissionsIndicators = [
    {
      name: 'Mitjana d\'emissions',
      value: 'mean_emissions',
      type: 'threshold',
      colors: mapThresholdScheme,
    },
    {
      name: 'Emissions totals',
      value: 'total_emissions',
      type: 'threshold',
      colors: mapThresholdScheme,
    },
];

const incomeIndicators = [
  {
    name: 'Mitjana de la renda per unitat de consum (2022)', 
    value: 'Mediana de la renta por unidad de consumo_2022',
    levels: [true, true, false]
  }
];
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
// Update Emissions Indicator
function getEmissionsIndicatorData(indicator) {
  const data = [];
  datasets.forEach((dataset, i) => {
    const emissionsIndicatorArray = dataset.map((d) => d[indicator.value]);
  
    let domain = [];
    let ckMeans = [];
  
    if(indicator.type == 'threshold') {
      ckMeans = d3.bin()
        .thresholds(ckmeans(emissionsIndicatorArray, 7).map((d) => d3.min(d)))
        .value((d) => d)(emissionsIndicatorArray);
  
      domain = ckMeans
        .map((d) => d.x1)
        .slice(0, ckMeans.length - 1);
    }
  
    data.push({layerId: i, domain, range: indicator.colors, ckMeans});
  })

  return data;
}

// Update income indicator
function getIncomeIndicatorData(indicator) {
  const data = [];
  datasets.forEach((dataset, i) => {
    if(indicator.levels[i]) {
      const incomeValues = dataset
        .map((d) => d[incomeIndicator.value])
        .filter((v) => v != null && !isNaN(v))
        .sort((a, b) => a - b);

      const sum = incomeValues.reduce((a, b) => a + b, 0);
      const count = incomeValues.length;

      data.push({ 
        mean: sum / count, 
        min: incomeValues[0], 
        max: incomeValues[incomeValues.length - 1], 
        q1: d3.quantile(incomeValues, 0.25), 
        q3: d3.quantile(incomeValues, 0.75) 
      });
    }
    else {
      data.push(null)
    }
  })

  return data;
}
```

```js
const emissionsIndicatorData = getEmissionsIndicatorData(emissionsIndicator);
```

```js
const incomeIndicatorData = getIncomeIndicatorData(incomeIndicator)
```

```js
display(emissionsIndicatorData)
display(incomeIndicatorData)
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
    if (user) sliderElement.dispatchEvent(new Event("input", {bubbles: true}));
    setIncomeRange(v);
  }
});

function updateSliderBounds(newMin, newMax, q1, q3) {
  // console.log('Enter update slider bounds function', {newMin, newMax, q1, q3})
  slider.min(newMin);
  slider.max(newMax);
  slider.value([q1, q3]);
}


// Indicators -----------
const emissionsIndicatorInput = Inputs.select(emissionsIndicators, {
    label: "Selecciona un indicador d'emissions",
    format: (d) => d.name,
    value: emissionsIndicators[0]
  })


const incomeIndicatorInput = Inputs.select(incomeIndicators, {
    label: "Selecciona un indicador de renda",
    format: (d) => d.name,
    value: incomeIndicators[0]
  })
```

```js
const emissionsIndicator = Generators.input(emissionsIndicatorInput);
const incomeIndicator = Generators.input(incomeIndicatorInput);
```

<!-- Data Initializing -->
```js
document.addEventListener('map-loaded', () => {
  console.log('Map loaded event recieved')
  map.updateEmissionsData(emissionsIndicator.value, emissionsIndicatorData);
  map.updateIncomeData(incomeIndicator, incomeIndicatorData);
  updateSliderBounds(
    incomeIndicatorData[1].min, 
    incomeIndicatorData[1].max, 
    incomeIndicatorData[1].q1, 
    incomeIndicatorData[1].q3
  );
  sliderElement.dispatchEvent(new Event("input", { bubbles: true }));
  setMapLoaded(true)
});

```

```js
document.addEventListener('zoom-level-changed', (event) => {
  const datasetIndex = event.detail.zoomLevel;
  setCurrentDatasetIndex(datasetIndex);
  updateSliderBounds(
    incomeIndicatorData[datasetIndex].min, 
    incomeIndicatorData[datasetIndex].max, 
    incomeIndicatorData[datasetIndex].q1, 
    incomeIndicatorData[datasetIndex].q3
  );
});
```

```js
if(mapLoaded) {
  map.updateEmissionsData(emissionsIndicator.value, emissionsIndicatorData);
}
```

```js
if(mapLoaded) {
  map.updateIncomeData(incomeIndicator, incomeIndicatorData);
}
```

```js
display(datasets)
display(emissionsIndicatorInput)
display(incomeIndicatorInput)
display(incomeRange)
```

```js
map.updateMapOpacity([incomeRange[0], incomeRange[1]], currentDatasetIndex);
```

```js
const mapContainer = display(document.createElement('div'));
mapContainer.style = 'height:720px;';

const map = ChoroplethMap.create(mapContainer, datasets);
invalidation.then(() => map.destroy());
```

<div class="grid grid-cols-4">
  <div class="card grid-colspan-2">
    ${resize((width) => mapContainer)}
  </div>
  <div class="card grid-colspan-2">
     ${sliderElement}
     ${resize((width) => 
       Plot.plot({
         color: {
           type: "threshold",
           domain: Array.from({ length: 7 }, (_, i) => i.toString()),
           range: mapThresholdScheme
         },
         y: { grid: true}, // Per mantenir escala -> domain: [0, mostFrequentClass[1]] 
         x: { domain: Array.from({ length: 7 }, (_, i) => i.toString()) },
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


<!-- Histogram cells -->
```js
function getEmissionsData(datasetIndex) {
  const index = datasetIndex;
  if(emissionsIndicator.type == 'threshold') {
    const getEntryClass = (value) =>
      emissionsIndicatorData[index].ckMeans.findIndex((d) => value >= d.x0 && value <= d.x1).toString();
    
    const valuesByClass = datasets[index].map((d) => {
      const emissionsValue = d[emissionsIndicator.value];
      const incomeValue = d[incomeIndicator.value];
      return { class: getEntryClass(emissionsValue), emissionsValue, incomeValue };
    });
    
    // const mostFrequentClass = d3.greatest(
    //   d3.rollup(valuesByClass, v => v.length, d => d.class),
    //   ([, count]) => count
    // );
    
    return valuesByClass;
  }
   
  return null
}
```

```js
const emissionsData = getEmissionsData(currentDatasetIndex);
```

```js
const histogramData = emissionsData.filter(
      d => d.incomeValue >= incomeRange[0] && d.incomeValue <= incomeRange[1]
    );
```

```js
display(histogramData)
```