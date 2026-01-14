---
title: Observatori
toc: false
style: ./dashboard.css
---

```js
import * as vgplot from "npm:@uwdata/vgplot";
import { html } from "npm:htl";
import {
  qualifColorRange,
  categoricalScheme5,
} from "./components/colors.js";
import { zonaClimaticaBeeswarm } from "./components/zonaClimaticaBeeswarm.js";

// Fitxers
const labels = FileAttachment("./data/labels.json").json();
const municipis = FileAttachment("./data/municipis.json").json();
const municipisDict = FileAttachment("./data/municipisDict.json").json();
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

const qualifColorDomain = [1, 2, 3, 4, 5, 6, 7];

const qualifLabelsLookup = {
  1: "A",
  2: "B",
  3: "C",
  4: "D",
  5: "E",
  6: "F",
  7: "G",
};

const qualifColorScheme = d3
  .scaleLinear()
  .domain(qualifColorDomain)
  .range(qualifColorRange)
  .interpolate();
```

```js
// DuckDB
const db = await DuckDBClient.of({
  certificats: FileAttachment("./data/certificats.parquet"),
  municipis: FileAttachment("./data/municipis.parquet"),
});
const sql = db.sql.bind(db);

await sql`
  CREATE TABLE IF NOT EXISTS emissions_vs_size AS
  SELECT
    emissions_de_co2::DOUBLE AS emissions,
    metres_cadastre::DOUBLE AS size,
    qual_energia,
    qual_emissions,
    poblacio,
    comarca,
    provincia,
    data_entrada,
    us_edifici,
    normativa,
    motiu
  FROM certificats
  WHERE emissions_de_co2 IS NOT NULL 
    AND metres_cadastre IS NOT NULL 
    AND size < 200
    AND size > 15
    AND emissions < 80
    AND emissions > 5
`;

// VG Client
const coordinator = new vgplot.Coordinator();
const vg = vgplot.createAPIContext({ coordinator });
coordinator.databaseConnector(vgplot.wasmConnector({ duckdb: db._db }));
```

```js
const populationRangeInput = Inputs.range([0, 50000], {
  step: 2000,
  label: "Selecciona la població mínima: ",
  value: 50,
});
const populationThreshold = Generators.input(populationRangeInput);
```

```sql id=qualif_emissions_grouped
SELECT
  COUNT(*) AS frequency,
  qual_emissions,
FROM certificats
WHERE qual_emissions IS NOT NULL
GROUP BY qual_emissions
```

```sql id=qualif_energia_grouped
SELECT
  COUNT(*) AS frequency,
  qual_energia,
FROM certificats
WHERE qual_energia IS NOT NULL
GROUP BY qual_energia
```

```sql id=grouped_poblacio
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
GROUP BY zona_climatica, codi_poblacio, municipis.poblacio
ORDER BY avg_emissions ASC;
```

```js
const avg_climate_zone = Array.from(
  [...grouped_poblacio]
    .filter((d) => d.poblacio >= populationThreshold && d.zona_climatica)
    .reduce((acc, curr) => {
      const zona = curr.zona_climatica;
      const item = acc.get(zona) || { totalSum: 0, totalCount: 0 };
      item.totalSum += curr.sum_emissions || 0;
      item.totalCount += curr.n_certificats || 0;
      acc.set(zona, item);
      return acc;
    }, new Map())
).map(([zona, { totalSum, totalCount }]) => ({
  zona_climatica: zona,
  avg_emissions: totalSum / totalCount,
}));
```

<!-- FIRST: QUALIFICATIONS HISTOGRAMS -------------------------------------------------------------------------- -->

<div class="grid grid-cols-2">
  <div class="card">
    <h2>Puntuacions del certificat d'emissions</h2>
    ${
      Plot.plot({
        height: 300,
        marginLeft: 25,
        marginRight: 55,
        color: { domain: qualifColorDomain, range: qualifColorRange},
        x: { grid: true, label: "Nombre de certificats", labelOffset: 35 },
        y: { tickFormat: (d) => qualifLabelsLookup[d], label: null},
        marks: [
          Plot.barX(
            qualif_emissions_grouped,
            {
              x: "frequency", 
              y: "qual_emissions", 
              fill: "qual_emissions", 
              inset: 0.5, 
              tip: {
                format: {
                  x: (d) => `${d.toLocaleString('de-DE')}`,
                  y: false,
                  fill: false,
                }
              } 
            }
          ),
          Plot.text(
            qualif_emissions_grouped,
            {
              x: "frequency", 
              y: "qual_emissions",
              text: (d) => `${(d.frequency / d3.sum([...qualif_emissions_grouped], d => d.frequency )* 100).toFixed(2)} %`,
              fontWeight: 'bold',
              fontSize: 14,
              dx: 35
            }
          )
        ]
      })
    }
  </div>
  <div class="card">
    <h2>Puntuacions del certificat d'eficiència energètica</h2>
    ${
      Plot.plot({
        height: 300,
        marginLeft: 25,
        marginRight: 55,
        color: { domain: qualifColorDomain, range: qualifColorRange},
        x: { grid: true, label: "Nombre de certificats", labelOffset: 35 },
        y: { tickFormat: (d) => qualifLabelsLookup[d], label: null},
        marks: [
          Plot.barX(
            qualif_energia_grouped,
            {
              x: "frequency", 
              y: "qual_energia", 
              fill: "qual_energia", 
              inset: 0.5, 
              tip: {
                format: {
                  x: (d) => `${d.toLocaleString('de-DE')}`,
                  y: false,
                  fill: false,
                }
              } 
            }
          ),
          Plot.text(
            qualif_energia_grouped,
            {
              x: "frequency", 
              y: "qual_energia",
              text: (d) => `${(d.frequency / d3.sum([...qualif_energia_grouped], d => d.frequency )* 100).toFixed(2)} %`,
              fontWeight: 'bold',
              fontSize: 14,
              dx: 35
            }
          )
        ]
      })
    }
  </div>
</div>

<!-- THIRD: CLIMATE ZONES -------------------------------------------------------------------------- -->

```js
const threshold_poblacio = [...grouped_poblacio].filter(
  (d) =>
    municipis.find((m) => m.codi == d.codi_poblacio).poblacio >=
    populationThreshold
);
```

<div class="card">
  ${populationRangeInput}
  </br>
  <div style="display:flex; flex-direction:row; justify-content: space-between">
    <div>
      <h2>Emissions mitjanes dels edificis dels municipis amb més de ${populationThreshold} habitants</h2><h3> Classificades per zona climàtica </h3></span>
    </div>
    <div style="display:flex; flex-direction:row; align-items: center; justify-content: space-between; gap: 4rem; margin-right: 2rem"> 
      <div style="display:flex; flex-direction:column; align-items: start;">
        <h5> Mitjana d'emissions del municipi </h5> 
        <div>
          ${
            Plot.legend({color: {
              domain: beeswarmXDomain,
              scheme: "YlOrRd",
            }})
          }
        </div>
      </div>
      <div style="display:flex; flex-direction:column; align-items: start;">
        <h5> Emissions totals del municipi </h5>
        <div>
          ${
            Plot.plot({
              height: 50,
              width: 200,
              marginLeft: 10,
              marginRight: 25,
              marginTop: 25,
              r: { range: [1, 20] },
              x: { label: null, tickFormat: null, ticks: 0 },
              y: { label: null, tickFormat: null, ticks: 0 },
              marks: [
                Plot.dotX(radiusLegendData, 
                {
                  x: "pos",
                  r: "rad",
                  y:0, 
                  stroke: "#750000", 
                  fill:"white", 
                }),
              ]
            })
          }
        </div>
      </div>
      <div style="display:flex; flex-direction:column; align-items: start;">
        <h5> Mitjana d'emissions de la zona climàtica </h5>
        <div>
          ${
            Plot.plot({
              height: 50,
              width: 200,
              marginLeft: 0,
              marginTop: 35,
              x: { label: null, tickFormat: null, ticks: 0 },
              y: { label: null, tickFormat: null, ticks: 0 },
              marks: [
                Plot.ruleY([1, 2], {x1: 0, x2: 2, y:0, strokeWidth: 2, stroke: "#758292", opacity: 0.5, dy: -10}),
                Plot.dotX([1, 2], {x: 2, y:0, stroke: "#750000", fill:"white", r:4, dy: -10}),
              ]
            })
          }
        </div>
      </div> 
    </div>
    
  </div>
    ${Plot.plot({
      height: 800,
      width,
      margin: 30,
      marginLeft: 70,
      marginBottom: 50,
      color: {
        scheme: "YlOrRd",
      },
      y: { grid: true , label: null, tickFormat: null, ticks: 0 },
      fy: { label: null, ticks: 0, tickFormat: null },
      x: { grid: true, domain: beeswarmXDomain, label: "Emissions mitjanes (Kg CO₂/Any)"},
      r: { range: [1, 20] },
      marks: [
        Plot.dot(
          threshold_poblacio,
          Plot.dodgeY("middle", {
            x: "avg_emissions",
            r: "sum_emissions",
            fy: "zona_climatica",
            fill: "avg_emissions",
            channels: {
              emissions_mitjanes: {
                value: "avg_emissions",
                label: "Emissions mitjanes (Kg CO₂/Any)"
              },
              emissions_totals: {
                value: "sum_emissions",
                label: "Emissions totals (Kg CO₂/Any)"
              },
              zona: {
                value: "zona_climatica",
                label: "Zona climàtica"
              },
              municipi: {
                value: "codi_poblacio",
                label: "Municipi"
              },
              poblacio: {
                value: "codi_poblacio",
                label: "Població"
              }
            },
            tip: {
              format: {
                r: false,
                fy: false,
                x: false,
                stroke: false,
                fill: false,
                municipi: (d) => municipisDict[d].municipi,
                poblacio: (d) => [...municipis].find((m) => m.codi == d).poblacio,
                emissions_totals: true,
                emissions_mitjanes: true
              }
            },
            stroke: (d) => d.avg_emissions + 10,
            strokeWidth: 0.8,
          })
        ),
        Plot.ruleY(
          avg_climate_zone, {x1: beeswarmXDomain[0], x2: "avg_emissions", y:0, fy: "zona_climatica", strokeWidth: 2, stroke: "#758292", opacity: 0.5}
        ),
        Plot.dotX(
          avg_climate_zone, {x: "avg_emissions", fy: "zona_climatica", stroke: "#750000", fill:"white", r:4}
        ),
        Plot.text(
          avg_climate_zone, {x: beeswarmXDomain[0], text: (d) => d.zona_climatica, fy: "zona_climatica", dx: -30, fontSize: 14, fontWeight: "bold"  }
        )
      ]
    })}
</div>

```js
const beeswarmRDomain = d3.extent([
  ...new Set(threshold_poblacio.map((d) => d.sum_emissions)),
]);
const beeswarmXDomain = d3.extent([
  ...new Set(threshold_poblacio.map((d) => d.avg_emissions)),
]);
```

```js
const radiusLegendData = d3
  .range(5)
  .map((i) =>
    d3.interpolateNumber(beeswarmRDomain[0], beeswarmRDomain[1])(i / 4)
  )
  .map((r, i) => ({ rad: r, pos: i }));
```

<!-- Multi view ------------------------------------------------------- -->

```js
const $provincia = vg.Selection.single();
const $comarca = vg.Selection.single();
const $poblacio = vg.Selection.single();
const $us = vg.Selection.single();
const $motiu = vg.Selection.single();
const $normativa = vg.Selection.single();
const $qualEmissions = vg.Selection.single();
const $qualEnergia = vg.Selection.single();
const $date = vg.Selection.intersect();
const $raster = vg.Selection.intersect();

const $mainFilter = vg.Selection.intersect({
  include: [
    $provincia,
    $comarca,
    $poblacio,
    $us,
    $motiu,
    $normativa,
    $qualEmissions,
    $qualEnergia,
    $date,
    $raster,
  ],
  cross: true,
});
```

<h2 style="margin-bottom: 20px; font-weight: 600"> Multivista interactiva </h2>
<div id="multiview" class="grid grid-cols-3" style="grid-auto-rows: min-content;">
  <div class="card grid-colspan-1">
    <div style="display:flex; flex-direction:column;">
      <div>
        <h4> Nombre de certificats </h4>
      </div>
      ${vg.plot(
        vg.text(
          vg.from("emissions_vs_size", {
            filterBy: $mainFilter
          }), 
          {
            x: 0,
            text: vg.count(),
            fontSize: 60,
            fontWeight: "bold",
          }
        ),
        vg.xAxis(null),
      )}
      <div style="display:flex; flex-direction:column; ">
        <h3> Filtrar per: </h3>
        <hr style="height: 0px; margin-top: -20px; margin-bottom:0"></hr>
      </div>
    </div>
    ${
      vg.vconcat(
        vg.search({
            from: "emissions_vs_size",
            column: "provincia",
            as: $provincia,
            label: "Provincia ",
        }),
        vg.vspace(30),
        vg.search({
            from: "emissions_vs_size",
            column: "comarca",
            filterBy: $provincia,
            as: $comarca,
            label: "Comarca ",
        }),
        vg.vspace(30),
        vg.search({
            from: "emissions_vs_size",
            column: "poblacio",
            filterBy: $comarca,
            as: $poblacio,
            label: "Municipi ",
        })
      )
    }
  </div>
  <div class="card grid-colspan-2">
    <div style="display:flex; flex-direction:row;">
      <div style="display:flex; flex-direction:column;">
        <h4> Qualificació emissions </h4>
        <div class="barplot-xs">
          ${ 
            vg.plot(
              ...exploratoryCommonBarplot("qual_emissions", 350),
              vg.barX(
                vg.from("emissions_vs_size", {
                  filterBy: $mainFilter
                }), {
                  y: "qual_emissions",
                  x: vg.count(),
                  fill: "qual_emissions",
                  inset: 0.5
                }
              ),
              vg.marginRight(50),
              vg.yScale("band"),
              vg.colorDomain(qualifColorDomain),
              vg.colorRange(qualifColorRange),
              vg.yTickFormat((d) => qualifLabelsLookup[d]),
              vg.highlight({
                by: $qualEmissions
              }),
              vg.toggleY({
                as: $qualEmissions
              }),
            )
          }
        </div>
      </div>
      <div style="display:flex; flex-direction:column;">
        <h4> Qualificació energia </h4>
        <div class="barplot-xs">
          ${ 
            vg.plot(
              ...exploratoryCommonBarplot("qual_energia", 350),
              vg.barX(
                vg.from("emissions_vs_size", {
                  filterBy: $mainFilter
                }), {
                  y: "qual_energia",
                  x: vg.count(),
                  fill: "qual_energia",
                  inset: 0.5
                }
              ),
              vg.marginRight(50),
              vg.yScale("band"),
              vg.colorDomain(qualifColorDomain),
              vg.colorRange(qualifColorRange),
              vg.yTickFormat((d) => qualifLabelsLookup[d]),
              vg.highlight({
                by: $qualEnergia
              }),
              vg.toggleY({
                as: $qualEnergia
              }),
            )
          }
        </div>
      </div>
    </div>
  </div>
  <div class="card grid-colspan-3">
    <div style="display:flex; flex-direction:row;">
      <div style="display:flex; flex-direction:column;">
        <h4> Ús edifici </h4>
        <div class="barplot-xs">
          ${ 
            vg.plot(
              ...exploratoryCommonBarplot("us_edifici", 250),
              vg.barX(
                vg.from("emissions_vs_size", {
                  filterBy: $mainFilter
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
              vg.marginRight(50),
              vg.marginLeft(200),
              vg.colorDomain(Object.keys(labels.us_edifici).map(Number)),
              vg.colorRange(categoricalScheme5),
              vg.yTickFormat((d) => truncateLabel(labels.us_edifici[d], 25)),
            )
          }
        </div>
      </div>
      <div style="display:flex; flex-direction:column;">
        <h4> Motiu certificació </h4>
        <div class="barplot-xs">
          ${ 
            vg.plot(
              ...exploratoryCommonBarplot("motiu", 250),
              vg.barX(
                vg.from("emissions_vs_size", {
                  filterBy: $mainFilter
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
              vg.marginRight(50),
              vg.marginLeft(200),
              vg.colorRange(categoricalScheme5),
              vg.yTickFormat((d) => truncateLabel(labels.motiu[d], 25)),
              vg.colorDomain(Object.keys(labels.motiu).map(Number)),
            )
          }
        </div>
      </div>
      <div style="display:flex; flex-direction:column;">
        <h4> Normativa de certificació </h4>
        <div class="barplot-xs">
          ${ 
            vg.plot(
              ...exploratoryCommonBarplot("normativa", 250),
              vg.barX(
                vg.from("emissions_vs_size", {
                  filterBy: $mainFilter
                }), {
                  x: vg.count(),
                  y: "normativa",
                  inset: 0.5,
                  fill: "normativa",
                  sort: {
                    y: "-x"
                  }
                }
              ),
              vg.toggleY({
                as: $normativa
              }),
              vg.highlight({
                by: $normativa
              }),
              vg.marginRight(50),
              vg.marginLeft(200),
              vg.colorRange(categoricalScheme5),
              vg.yTickFormat((d) => truncateLabel(labels.normativa[d], 25)),
              vg.colorDomain(Object.keys(labels.normativa).map(Number)),
            )
          }
        </div>
      </div>
    </div>
  </div>
  <div class="card grid-colspan-3">
    ${
      resize((width) => vg.plot(
        vg.width(1500),
          vg.height(170),
          vg.gridY({stroke: "black", strokeWidth: 0.5, strokeOpacity: 0.8, strokeDasharray: 2}),
          vg.rectY(
            vg.from("emissions_vs_size", {
              filterBy: $mainFilter
            }), {
              x: vg.bin("data_entrada", {
                interval: 'month',
              }),
              tip: true,
              y: vg.count(),
              fill: "#6e6e6e",
              fillOpacity: 1,
            }
          ),
          vg.intervalX({as: $date}),
          vg.xTickSize(0),
          vg.xLabel(null),
          vg.yTickSize(0),
          vg.yLabel('Nombre de certificats')
        )
      )
    }
  </div>
</div>

```js
function vgTextMark(column) {
  return vg.text(
    vg.from("emissions_vs_size", {
      filterBy: $mainFilter,
    }),
    {
      x: vg.count(),
      y: column,
      inset: 0.5,
      text: vg.count(),
      dx: 30,
      fontSize: 14,
    },
  );
}
```

```js
function exploratoryCommonBarplot(column, height) {
  return [
    vg.height(height),
    vgTextMark(column),
    vg.xGrid(true),
    vg.yLabel(null),
    vg.xLabel(null),
    vg.xTicks(4),
    vg.yTickSize(0),
    vg.yTickFormat((value) =>
      value.length > 10 ? value.slice(0, 10) + "..." : value
    ),
  ];
}
```

<div class="card">
${vg.plot(
  vg.frame({fill: "black"}),
  vg.width(1500),
  vg.height(250),
  vg.raster(
    vg.from("emissions_vs_size", {filterBy: $mainFilter}),
    {
      x: "emissions",
      y: "size",
      fill: "qual_energia",
      pixelSize: 5,
      imageRendering: "pixelated",
    }
  ),
  vg.intervalXY({as: $raster}),
  vg.colorDomain(qualifColorDomain),
  vg.colorRange(qualifColorRange),
  vg.yLabel('Superfície (m2)'),
  vg.xLabel('Emissions (Kg/CO2 * any)'),
)}
</div>

```js
function truncateLabel(label, maxChars) {
  return label.length > maxChars ? label.slice(0, maxChars) + "..." : label;
}
```

<style>
.barplot-xs text {
  font-size: 15px;
}
</style>
