<!-- Client -->
```js
import { DBClient } from "./db/client.js";
const client = await DBClient.create();
```

<!-- Components -->
```js
import { qualifColorLookup } from "./components/colors.js";
```


<!-- Aggregated Data -->
```js
const certificatesByYear = await client.getCertificatesByYear();
const qualificationCounts = await(await client.getQualificationCounts()).toArray();
```

# Observatori

```js
const qualTypeName = view(Inputs.radio(
  new Map([["Emissions", "emissions"], ["Energia", "energia"]]),
  { value: "emissions", label: "Tipus de qualificació", format: ([name]) => name }
));
```

${Plot.plot({
  marginBottom: 100,
  color: {
    domain: Object.keys(qualifColorLookup),
    range: Object.values(qualifColorLookup)
  },
  x: { grid: true },
  marks: [
    Plot.barX(
      qualificationCounts.filter(d => d.type === qualTypeName),
      {
        x: "count",
        y: "qual",
        fill: "qual"
      }
    )
  ]
})}



${
  Plot.plot({
  height: 300,
  x: { label: "Any", type: "band" },
  y: { label: "Certificats" },
  color: {
    domain: Object.keys(qualifColorLookup),
    range: Object.values(qualifColorLookup)
  },
  marks: [
    Plot.barY(
      certificatesByYear,
      {
        x: "year",
        y: "n_cert",
        fill: "qual_emissions",
        tip: true,
        strokeOpacity: 0.9,
        sort: { fill: "y" }
      }
    )
  ]
})
}