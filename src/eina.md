---
title: Eina de decisions
---

```js
html`<link href="https://cdn.jsdelivr.net/npm/range-slider-input@2.4.4/dist/style.css" rel="stylesheet">`
```

```js
import { html } from "npm:htl";
import mapboxgl from 'npm:mapbox-gl';
import * as vgplot from 'npm:@uwdata/vgplot';
import rangeSlider from "npm:range-slider-input";
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

```js
datasets
```

```js
const mapContainer = display(document.createElement('div'));
mapContainer.style = 'height:720px;';

const mapInstance = ChoroplethMap.create(mapContainer, datasets);

invalidation.then(() => mapInstance.destroy());
```


```js
const incomeMin = 2000;
const incomeMax = 50000;

const incomeRange = html`<div></div>`;

const slider = rangeSlider(incomeRange, {
  min: incomeMin,
  max: incomeMax,
  step: 1000,
  value: [
    incomeMin + (incomeMax - incomeMin) * 0.2,
    incomeMax - (incomeMax - incomeMin) * 0.2
  ],
  onInput: (v, user) => {
    // Descomentar per fer reactiu
    // incomeRange.value = v;
    if (user) incomeRange.dispatchEvent(new Event("input", {bubbles: true}));
  }
});

// Event listener: lloc on posar events no reactius, escoltant només del slider
incomeRange.addEventListener('input', () => {
  console.log('Slider changed, new value:', slider.value());
});

incomeRange;
```

```js
display(incomeRange)
```

```js
const incomeValue = Generators.input(incomeRange)
```

```js
incomeValue
```