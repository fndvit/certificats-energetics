---
title: Mosaic test
---

```js
import * as vgplot from "npm:@uwdata/vgplot";
import { qualifColorDomain, qualifColorRange, categoricalScheme5 } from './components/colors.js';

// Fitxers 
const labels = FileAttachment("./data/labels.json").json();
const municipis = FileAttachment("./data/municipis.json").json();
```

```js
// Diccionaris 
const municipisByCode = municipis.reduce((dict, row) => {
  const codi = row.codi; 
  if (!(codi in dict)) {
    dict[codi] = row.nom;
  }
  return dict;
}, {});

const qualifLabelsLookup = ({
  1: "A",
  2: "B",
  3: "C",
  4: "D",
  5: "E",
  6: "F",
  7: "G"
});

const qualifColorScheme = d3.scaleLinear()
    .domain(qualifColorDomain)
    .range(qualifColorRange)
    .interpolate()

// DuckDB
const db = await DuckDBClient.of({
  certificats: FileAttachment("./data/certificats.parquet"),
  municipis: FileAttachment("./data/municipis.parquet")
  });
const sql = db.sql.bind(db);


// VG Plot views

await db.sql`
  CREATE VIEW certificats_grouped AS
  SELECT
    zona_climatica,
    codi_poblacio,
    COUNT(*) AS n_certificats,
    AVG(emissions_de_co2) AS avg_emissions,
    AVG(qual_emissions) AS avg_qual_emissions,
    SUM(emissions_de_co2) AS sum_emissions
  FROM certificats
  WHERE emissions_de_co2 IS NOT NULL
    AND zona_climatica IS NOT NULL
    AND codi_poblacio IS NOT NULL
  GROUP BY zona_climatica, codi_poblacio
`;

// VG Client 
const coordinator = new vgplot.Coordinator();
const vg = vgplot.createAPIContext({coordinator});
coordinator.databaseConnector(vgplot.wasmConnector({duckdb: db._db}));
```

```sql
SELECT COUNT(*)
FROM certificats_grouped;
```

```js
const populationRangeInput = Inputs.range([2000, 100000], {step: 10000, label: "Població mínima"});
const populationThreshold = Generators.input(populationRangeInput);
```

```js
municipisByCode
```

```js
municipis.find((d) => d.codi == '80155')
```

```sql id=grouped_poblacio display
SELECT
  zona_climatica,
  codi_poblacio,
  COUNT(*) AS n_certificats,
  AVG(emissions_de_co2) AS avg_emissions,
  AVG(qual_emissions) AS avg_qual_emissions,
  SUM(emissions_de_co2) AS sum_emissions,
  municipis.poblacio
FROM certificats
INNER JOIN municipis
 ON certificats.codi_poblacio = municipis.codi
WHERE emissions_de_co2 IS NOT NULL
  AND zona_climatica IS NOT NULL
  AND codi_poblacio IS NOT NULL
  AND municipis.poblacio > ${populationThreshold}
GROUP BY zona_climatica, codi_poblacio, municipis.poblacio
ORDER BY avg_emissions ASC;
```


```js
grouped_poblacio
```

${populationRangeInput}
<div class="card">
<p> Color/ Dins una població hi han múltiples zones climàtiques </p>
  <h2 style="font-weight: 600"> Certificacions per zona climàtica </h2>
    ${Plot.plot({
      width: 900,
      height: 400,
      x: {
        label: "Nombre d'edificis certificats",
        nice: true
      },
      y: {
        label: "Zona climàtica",
      },
      color: {
        legend: true,
        scheme: "turbo",
        label: "Mitjana d’emissions de Kg CO₂/m2 * any"
      },
      marks: [
        Plot.barX(grouped_poblacio, {
          x: "n_certificats",
          y: "zona_climatica",
          fill: "avg_emissions",
          tip: true,
          title: d =>`Població: ${municipisByCode[d.codi_poblacio]} \nNombre d'edificis certificats: ${d.n_certificats}\nMitjana d’emissions: ${d.avg_emissions.toFixed(2)}`
        })
      ]
    })}
</div>

<div class="card">
  <p> Format llegenda / Els que menys emeten no es veuen </p>
  <h2 style="font-weight: 600"> Distribució d'emissions </h2>
    ${Plot.plot({
      width: 900,
      height: 300,
      x: {
        label: "Emissions",
      },
      color: {
        legend: true,
        domain: [1, 7],
        interpolate: d3.interpolateRgbBasis(qualifColorRange),
        label: "Puntuació mitjana del certificat d'emissions"
      },
      marks: [
        Plot.rectY(grouped_poblacio, Plot.stackX({
          x: "sum_emissions",
          order: "avg_qual_emissions",
          reverse: true,
          y2: "avg_qual_emissions", // y2 to avoid stacking by y
          fill: "avg_qual_emissions",
          insetLeft: 0.1,
          insetRight: 0.1,
          title: d =>`Població: ${municipisByCode[d.codi_poblacio]}\nEmissions: ${(d.sum_emissions / 1000).toFixed(2)} t CO2/m2 * any\nQualificació d'emissions mitjana: ${d.avg_qual_emissions ? d.avg_qual_emissions.toFixed(2) : ''}`,
          tip: true
        })),
      ]
    })}
</div>

<div class="card">
  <p> </p>
  <h2 style="font-weight: 600"> Top poblacions amb més emissions </h2>
    ${Plot.plot({
      marginLeft: 200,
      width: 900,
      height: 300,
      y: {
        tickFormat: (d) => municipisByCode[d]
      },
      x: {
        label: "Mitjana d'emissions",
      },
      color: {
        legend: true,
        domain: [1, 7],
        interpolate: d3.interpolateRgbBasis(qualifColorRange),
        label: "Puntuació mitjana del certificat d'emissions"
      },
      marks: [
        Plot.barX(grouped_poblacio.slice(-10), {
          x: "avg_emissions",
          y: "codi_poblacio",
          sort: {
            y: "x",
            reverse: true
          },
          fill: "avg_qual_emissions",
          tip: true
          }
        ),
      ]
    })}
</div>

<!-- Multi view -->

```js
const $us = vg.Selection.single();
const $motiu = vg.Selection.single();
const $qual = vg.Selection.single();
const $date = vg.Selection.crossfilter();
const $all = vg.Selection.intersect({include: [$us, $motiu, $qual, $date], cross: true});
```
<div class="card">
  <p> Filtres input </p>
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
    vg.yScale("band"),
    vg.colorDomain(qualifColorDomain),
    vg.colorRange(qualifColorRange),
    vg.yTickFormat((d) => qualifLabelsLookup[d]),
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
