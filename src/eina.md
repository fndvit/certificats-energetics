---
title: Eina de decisions
---

```js
import mapboxgl from 'npm:mapbox-gl';
import * as vgplot from 'npm:@uwdata/vgplot';
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
