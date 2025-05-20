---
title: Mosaic test
---

```js
const labels = FileAttachment("./data/labels.json").json();
```

```js
import { qualifColorLookup, categoricalScheme5 } from './components/colors.js';
```

```js
import * as vgplot from "npm:@uwdata/vgplot";

const db = await DuckDBClient.of({certificats: FileAttachment("./data/certificats.parquet")});
const sql = db.sql.bind(db);

const coordinator = new vgplot.Coordinator();
const vg = vgplot.createAPIContext({coordinator});
coordinator.databaseConnector(vgplot.wasmConnector({duckdb: db._db}));
```

<!-- ```sql
DESC certificats
```  -->

```js
const $us = vg.Selection.single();
const $motiu = vg.Selection.single();
const $qual = vg.Selection.single();
const $date = vg.Selection.crossfilter();
const $all = vg.Selection.intersect({include: [$us, $motiu, $qual, $date], cross: true});
```
<!-- Multi view -->
<div class="grid grid-cols-2">
  <!-- Motiu -->
  <div class="card">
    ${
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
            tip: true,
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
        vg.yLabel(null),
        vg.xLabel(null),
        vg.colorDomain(Object.keys(labels.us_edifici).map(Number)),
        vg.colorRange(categoricalScheme5),
        vg.yTickFormat((d) => labels.motiu[d])
      )
    }
  </div>
  <!-- Qualificacions -->
  <div class="card grid-rowspan-2">
    ${resize
      ((width,height) => vg.plot(
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
            inset: 0.5,
            tip: true,
          }
        ),
        vg.colorDomain(Object.keys(qualifColorLookup)),
        vg.colorRange(Object.values(qualifColorLookup)),
        vg.yLabel(null),
        vg.xLabel(null),
        vg.highlight({
          by: $qual
        }),
        vg.toggleY({
          as: $qual
        }),
        vg.width(width),
        vg.height(height)
      ))
    }
  </div>
  <!-- Us edifici -->
  <div class="card">
    ${
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
            tip: true,
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
        vg.yLabel(null),
        vg.xLabel(null),
        vg.yTickFormat((d) => labels.us_edifici[d]),
      )
    }
  </div>
  <!-- Timechart -->
  <div class="card grid-colspan-2">
    ${
      vg.plot(
        vg.width(1200),
        vg.height(150),
        vg.rectY(
          vg.from("certificats"), {
            x: vg.bin("data_entrada", {
              interval: 'month',
              as: "data_entrada_binned",
              insetLeft: 5
            }),
            y: vg.count(),
            fillOpacity: 0.2
          }
        ),
        vg.rectY(
          vg.from("certificats", {
            filterBy: $all
          }), 
          {
            x: vg.bin("data_entrada", 
              {
                interval: 'month',
                as: "data_entrada_binned",
                insetLeft: 5
              }),
            y: vg.count(),
            fillOpacity: 1,
            tip: true,
          }
        ),
        vg.intervalX({
          as: $date
        }),
        vg.highlight({
          by: $date,
          fill: "#ccc",
          fillOpacity: 0.2
        }),
        vg.xTickSize(0),
        vg.xLabel(null),
        vg.yLabel(null),
        vg.yTickSize(0),
      )
    }
  </div>
</div>

```js

 vg.plot(
    vg.barX(
      vg.from("certificats"),
      {
        y: "zona_climatica",
        x: vg.median("emissions_de_co2"),
        fill: "steelblue",
      }
    ),
  )

```