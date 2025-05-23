---
title: Mosaic test
sql:
  certificats: ./data/certificats.parquet
---

```js
const labels = FileAttachment("./data/labels.json").json();
```
<!-- ```js
import * as vgplot from "npm:@uwdata/vgplot";

const db = await DuckDBClient.of({certificats: FileAttachment("./data/certificats.parquet")});
const sql = db.sql.bind(db);

const coordinator = new vgplot.Coordinator();
const vg = vgplot.createAPIContext({coordinator});
coordinator.databaseConnector(vgplot.wasmConnector({duckdb: db._db}));
``` -->

```sql
DESC certificats
```

```js
import { qualifColorLookup, categoricalScheme5 } from './components/colors.js';
```

```js
zona_climatica_poblacio
```


```js
const $us = vg.Selection.single();
const $motiu = vg.Selection.single();
const $qual = vg.Selection.single();
const $date = vg.Selection.crossfilter();
const $all = vg.Selection.intersect({include: [$us, $motiu, $qual, $date], cross: true});
```
<!-- Multi view -->
<div class="card">
  <h2 style="margin-bottom: 20px; font-weight: 600"> Multivista interactiva </h2>
  ${vg.vconcat(
  // --------------- Timechart --------------- 
  vg.plot(
    vg.width(1200),
    vg.height(150),
    vg.rectY(
      vg.from("certificats", {
        filterBy: $all
      }), {
        x: vg.bin("data_entrada", {
          interval: 'month',
          as: "data_entrada_binned",
          insetLeft: 5
        }),
        y: vg.count(),
        fillOpacity: 1
      }
    ),
    vg.intervalX({
      as: $date
    }),
    // vg.panZoom({y: $ys}),
    vg.highlight({
      by: $date,
      fill: "#ccc",
      fillOpacity: 0.2
    }),
    vg.xTickSize(0),
    vg.xLabel(null),
    vg.yTickSize(0),
  ),
  // --------------- Energy Qualifications --------------- 
  vg.plot(
    vg.barX(
      vg.from("certificats"), {
        y: "qual_emissions",
        x: vg.count(),
        fill: "#ccc",
        inset: 0.5,
        opacity: 0.2
      }
    ),
    vg.barX(
      vg.from("certificats", {
        filterBy: $all,
        where: "qual_emissions IS NOT NULL"
      }), {
        y: "qual_emissions",
        x: vg.count(),
        fill: "qual_emissions",
        inset: 0.5
      }
    ),
    vg.colorDomain(Object.keys(qualifColorLookup)),
    vg.colorRange(Object.values(qualifColorLookup)),
    vg.yLabel("Qualificació emissions →"),
    vg.highlight({
      by: $qual
    }),
    vg.toggleY({
      as: $qual
    }),
  ),
  // --------------- Us edificis --------------- 
  vg.plot(
    vg.barX(
      vg.from("certificats"), {
        x: vg.count(),
        y: "us_edifici",
        inset: 0.5,
        fill: "#ccc",
        opacity: 0.2,
        sort: {
          y: "-x"
        }
      }
    ),
    vg.barX(
      vg.from("certificats", {
        filterBy: $all
      }), {
        x: vg.count(),
        y: "us_edifici",
        inset: 0.5,
        fill: "us_edifici",
        sort: {
          y: "-x"
        }
      }
    ),
    vg.toggleY({
      as: $us
    }),
    vg.highlight({
      by: $us
    }),
    vg.marginLeft(200),
    vg.colorDomain(Object.keys(labels.us_edifici).map(Number)),
    vg.colorRange(categoricalScheme5),
    vg.yLabel("Ús edifici →"),
    vg.yTickFormat((d) => labels.us_edifici[d]),
  ),
  // --------------- Motiu certificació --------------- 
  vg.plot(
    vg.barX(
      vg.from("certificats"), {
        x: vg.count(),
        y: "motiu",
        inset: 0.5,
        fill: "#ccc",
        opacity: 0.2,
        sort: {
          y: "-x"
        }
      }
    ),
    vg.barX(
      vg.from("certificats", {
        filterBy: $all
      }), {
        x: vg.count(),
        y: "motiu",
        inset: 0.5,
        fill: "motiu",
        sort: {
          y: "-x"
        }
      }
    ),
    vg.toggleY({
      as: $motiu
    }),
    vg.highlight({
      by: $motiu
    }),
    vg.marginLeft(180),
    vg.yLabel("Motiu →"),
    vg.colorDomain(Object.keys(labels.us_edifici).map(Number)),
    vg.colorRange(categoricalScheme5),
    vg.yTickFormat((d) => labels.motiu[d])
  )
)}
</div>

```sql id=zona_climatica_poblacio
SELECT
  zona_climatica,
  codi_poblacio,
  COUNT(*) AS n_certificats,
  AVG(emissions_de_co2) AS avg_emissions,
  SUM(emissions_de_co2) AS sum_emissions
FROM certificats
WHERE emissions_de_co2 IS NOT NULL
  AND zona_climatica IS NOT NULL
  AND codi_poblacio IS NOT NULL
GROUP BY zona_climatica, codi_poblacio
ORDER BY zona_climatica, avg_emissions ASC;
```

<div class="card">
  <h2 style="font-weight: 600"> Emissions per zona climàtica </h2>
    ${Plot.plot({
      width: 900,
      height: 500,
      x: {
        label: "Nombre d'edificis certificats",
        nice: true
      },
      y: {
        label: "Zona climàtica",
      },
      color: {
        scheme: "turbo",
        label: "Mitjana d’emissions de CO₂"
      },
      marks: [
        Plot.barX(zona_climatica_poblacio, {
          x: "n_certificats",
          y: "zona_climatica",
          fill: "avg_emissions",
          title: d =>
            `Població: ${d.codi_poblacio}
    Nombre de d'edificis certificats: ${d.n_certificats}
    Mitjana d’emissions: ${d.avg_emissions.toFixed(2)}`
        })
      ]
    })}
</div>

<!-- <div class="card">
  <h2 style="font-weight: 600"> Emissions per zona climàtica </h2>
    ${Plot.plot({
      marks: [
        Plot.rectY(zona_climatica_poblacio, Plot.stackX({
          x: "n_certificats",
          order: "HeadCount",
          reverse: true,
          y2: "HeadCount", // y2 to avoid stacking by y
          title: (d) => `${d.CountryName}\n${(d.HeadCount * 100).toFixed(1)}%`,
          insetLeft: 0.2,
          insetRight: 0.2
        })),
      ]
    })}
</div> -->
