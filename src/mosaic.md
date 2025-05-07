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
const $us = vg.Selection.single();
const $motiu = vg.Selection.single();
const $qual = vg.Selection.single();
const $year = vg.Selection.single();
const $all = vg.Selection.intersect({include: [$us, $motiu, $year, $qual], cross: true});
```

```js
vg.vconcat(
  vg.plot(
    vg.width(1200),
    vg.height(200),
    vg.barY(
      vg.from("certificats", {filterBy: $all}),
      {x: vg.dateMonth("data_entrada"), y: vg.count()}
    ),
    vg.toggleY({as: $year}),
    vg.highlight({by: $year}),
  ),
  vg.plot(
    vg.width(1200),
    vg.barX(
      vg.from("certificats"),
      {y: "qual_emissions", x: vg.count(), fill: "#ccc", inset: 0.5, opacity: 0.2}
    ),
    vg.barX(
      vg.from("certificats", {
        filterBy: $all,
        }
      ),
      {y: "qual_emissions", x: vg.count(), fill: "qual_emissions", inset: 0.5}
    ),
    vg.colorRange(Object.values(qualifColorLookup)),
    vg.yLabel("Qualificació emissions →"),
    vg.highlight({by: $qual}),
    vg.toggleY({as: $qual}),
  ),
  vg.hconcat(
    vg.plot(
      vg.barX(
        vg.from("certificats"),
        {x: vg.count(), y: "us_edifici", inset: 0.5, fill: "#ccc", opacity: 0.2, sort: {y: "-x"}}
      ),
      vg.barX(
        vg.from("certificats", {filterBy: $all}),
        {x: vg.count(), y: "us_edifici", inset: 0.5, sort: {y: "-x"}}
      ),
      vg.toggleY({as: $us}),
      vg.highlight({by: $us}),
      vg.yLabel("Ús edificio →"),
    ),
    vg.plot(
      vg.barX(
        vg.from("certificats"),
        {x: vg.count(), y: "motiu", inset: 0.5, fill: "#ccc", opacity: 0.2, sort: {y: "-x"}}
      ),
      vg.barX(
        vg.from("certificats", {filterBy: $all}),
        {x: vg.count(), y: "motiu", inset: 0.5, sort: {y: "-x"}}
      ),
      vg.toggleY({as: $motiu}),
      vg.highlight({by: $motiu}),
      vg.yLabel("Motiu →"),
    ),
  )
)
```

```js

```