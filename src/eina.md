---
title: Eina de decisions
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
import { qualifColorDomain, qualifColorRange, categoricalScheme5 } from './components/colors.js';
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
    {name: 'Mitjana d\'emissions', value: 'mean_emissions'},
    {name: 'Emissions totals', value: 'total_emissions'},
];

const incomeIndicators = [
  {name: 'Mitjana de la renda per unitat de consum (2022)', value: 'Mediana de la renta por unidad de consumo_2022'}
];
```

<!-- Update Emissions Indicator -->
```js
const emissionsIndicatorArray = datasets[0].map((d) => d[emissionsIndicator.value]);

const emissionsCKMeans = d3.bin()
  .thresholds(ckmeans(emissionsIndicatorArray, 7).map((d) => d3.min(d)))
  .value((d) => d)(emissionsIndicatorArray);

const ckMeansThresholds = emissionsCKMeans
  .map((d) => d.x1)
  .slice(0, emissionsCKMeans.length - 1);
```



<!-- Update income indicator -->
```js
const incomeValues = datasets[0]
  .map((d) => d[incomeIndicator.value])
  .filter((v) => v != null && !isNaN(v))
  .sort((a, b) => a - b);

const sum = incomeValues.reduce((a, b) => a + b, 0);
const count = incomeValues.length;
const minVal = incomeValues[0];
const maxVal = incomeValues[incomeValues.length - 1];
const q1 = d3.quantile(incomeValues, 0.25);
const q3 = d3.quantile(incomeValues, 0.75);

const incomeIndicatorStats = { mean: sum / count, min: minVal, max: maxVal, q1: q1, q3: q3 };

updateSliderBounds(incomeIndicatorStats.min, incomeIndicatorStats.max, incomeIndicatorStats.q1, incomeIndicatorStats.q3);
```

<!-- Inputs -->
```js
// Slider -----------
const incomeMin = 20000;
const incomeMax = 50000;

const sliderElement = html`<div></div>`;

const slider = rangeSlider(sliderElement, {
  min: incomeMin,
  max: incomeMax,
  step: 1000,
  value: [
    incomeMin + (incomeMax - incomeMin) * 0.2,
    incomeMax - (incomeMax - incomeMin) * 0.2
  ],
  onInput: (v, user) => {
    sliderElement.value = v;
    if (user) sliderElement.dispatchEvent(new Event("input", {bubbles: true}));
  }
});

// Event listener: lloc on posar events no reactius, escoltant només del slider
sliderElement.addEventListener('input', () => {
  // console.log('Slider changed, new value:', slider.value());
  map.updateMapOpacity([slider.value()[0], slider.value()[1]])
});

function updateSliderBounds(newMin, newMax, q1, q3) {
  console.log('Enter update slider bounds function', {newMin, newMax, q1, q3})
  slider.min(newMin);
  slider.max(newMax);
  slider.value([q1, q3]);
}

// document.addEventListener('income-values-updated', (event) => {
//   // console.log('Recieved income values update Event', event);
//   updateSliderBounds(event.detail.min, event.detail.max, event.detail.q1, event.detail.q3);
// });

const incomeRange = Generators.input(sliderElement)

// Indicators -----------
const emissionsIndicatorInput = Inputs.select(emissionsIndicators, {
    label: "Selecciona un indicador d'emissions",
    format: (d) => d.name,
    value: emissionsIndicators[0]
  })
const emissionsIndicator = Generators.input(emissionsIndicatorInput);
```
```js
const incomeIndicatorInput = Inputs.select(incomeIndicators, {
    label: "Selecciona un indicador de renda",
    format: (d) => d.name,
    value: incomeIndicators[0]
  })
const incomeIndicator = Generators.input(incomeIndicatorInput);
```

```js
const mapLoaded = Mutable(false)
const setMapLoaded = (x) => (mapLoaded.value = x);
```

<!-- Pass the data to the map once loaded to avoid map reloading -->
```js
document.addEventListener('map-loaded', () => {
  console.log('Map loaded event recieved')
  map.updateEmissionsData(emissionsIndicator.value, ckMeansThresholds);
  map.updateIncomeData(incomeIndicator.value, incomeIndicatorStats);
  updateSliderBounds(incomeIndicatorStats.min, incomeIndicatorStats.max, incomeIndicatorStats.q1, incomeIndicatorStats.q3);
  setMapLoaded(true)
});
```

```js
if(mapLoaded) {
  map.updateEmissionsData(emissionsIndicator.value, ckMeansThresholds)
}
```

```js
if(mapLoaded) {
  map.updateIncomeData(incomeIndicator.value, incomeIndicatorStats)
}
```

```js
datasets
```

```js
incomeRange
```

```js
display(emissionsIndicatorInput)
display(emissionsIndicator)
display(incomeIndicatorInput)
display(sliderElement)
```

```js
const mapContainer = display(document.createElement('div'));
mapContainer.style = 'height:720px;';

const map = ChoroplethMap.create(mapContainer, datasets);
invalidation.then(() => map.destroy());
```

```js
display(ckMeansThresholds)
display(incomeIndicatorStats)
```