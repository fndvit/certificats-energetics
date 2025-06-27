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

// Fitxers
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
    {name: 'Mitjana d\'emissions', value: 'mean_emissions'}
];

const incomeIndicators = [
  {name: 'Mitjana de la renda per unitat de consum (2022)', value: 'Mediana de la renta por unidad de consumo_2022'}
];
```

<!-- Inputs -->
```js
// Slider -----------
const incomeMin = 2000;
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
  slider.min(newMin);
  slider.max(newMax);
  slider.value([q1, q3]);
}

document.addEventListener('income-values-updated', (event) => {
  // console.log('Recieved income values update Event', event);
  updateSliderBounds(event.detail.min, event.detail.max, event.detail.q1, event.detail.q3);
});

const incomeRange = Generators.input(sliderElement)

// Indicators -----------
const emissionsIndicatorInput = Inputs.select(emissionsIndicators, {
    label: "Selecciona un indicador d'emissions",
    format: (d) => d.name,
    value: emissionsIndicators[0]
  })
const emissionsIndicator = Generators.input(emissionsIndicatorInput);

const incomeIndicatorInput = Inputs.select(incomeIndicators, {
    label: "Selecciona un indicador de renda",
    format: (d) => d.name,
    value: incomeIndicators[0]
  })
const incomeIndicator = Generators.input(incomeIndicatorInput);
```

```js
datasets
```

```js
incomeRange
```

```js
display(emissionsIndicatorInput)
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
const histogramData = datasets[0].filter((d) => d[])
```

```js
const emissionsIndicatorArray = datasets[0].map((d) => d[emissionsIndicator]);

const emissionsCKMeans = d3.bin()
      .thresholds(ckmeans(emissionsIndicatorArray, 7).map((d) => d3.min(d)))
      .value((d) => d)(emissionsIndicatorArray);
```
