---
title: Mosaic test
---

```js
import { qualifColorLookup } from './components/colors.js';
```

```js
import * as vgplot from "npm:@uwdata/vgplot";

const db = await DuckDBClient.of({certificats: FileAttachment("./data/certificats.parquet")});
const sql = db.sql.bind(db);

const coordinator = new vgplot.Coordinator();
const vg = vgplot.createAPIContext({coordinator});
coordinator.databaseConnector(vgplot.wasmConnector({duckdb: db._db}));
```

```sql
DESC certificats
``` 

```js
const $ys = vg.Selection.intersect();
const $us = vg.Selection.single();
const $motiu = vg.Selection.single();
const $qual = vg.Selection.single();
const $range = vg.Selection.crossfilter();
const $all = vg.Selection.intersect({include: [$us, $motiu, $qual, $range], cross: true});
```

```js
vg.vconcat(
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
      as: $range
    }),
    // vg.panZoom({y: $ys}),
    vg.highlight({
      by: $range,
      fill: "#ccc",
      fillOpacity: 0.2
    }),
    vg.xTickSize(0),
    vg.xLabel(null),
    vg.yTickSize(0),
  ),
  vg.plot(
    vg.width(1200),
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
    vg.colorRange(Object.values(qualifColorLookup)),
    vg.yLabel("Qualificació emissions →"),
    vg.highlight({
      by: $qual
    }),
    vg.toggleY({
      as: $qual
    }),
  ),
  vg.hconcat(
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
      vg.yLabel("Ús edificio →"),
    ),
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
      vg.yLabel("Motiu →"),
    ),
  )
)
```

```js

```