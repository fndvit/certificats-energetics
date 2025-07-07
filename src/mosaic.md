---
title: Mosaic test
toc: false
style: ./dashboard.css
---

```js
import * as vgplot from "npm:@uwdata/vgplot";
import { html } from "npm:htl";
import {
  qualifColorDomain,
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

// await db.sql`
//   CREATE VIEW certificats_grouped AS
//   SELECT
//     zona_climatica,
//     codi_poblacio,
//     COUNT(*) AS n_certificats,
//     AVG(emissions_de_co2) AS avg_emissions,
//     AVG(qual_emissions) AS avg_qual_emissions,
//     SUM(emissions_de_co2) AS sum_emissions
//   FROM certificats
//   WHERE emissions_de_co2 IS NOT NULL
//     AND zona_climatica IS NOT NULL
//     AND codi_poblacio IS NOT NULL
//   GROUP BY zona_climatica, codi_poblacio
// `;

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
  AND municipis.poblacio > ${populationThreshold}
GROUP BY zona_climatica, codi_poblacio, municipis.poblacio
ORDER BY avg_emissions ASC;
```

```sql id=grouped_municipis
SELECT
  zona_climatica,
  codi_poblacio,
  COUNT(*) AS n_certificats,
  AVG(emissions_de_co2) AS avg_emissions,
  AVG(qual_emissions) AS avg_qual_emissions,
  SUM(emissions_de_co2) AS sum_emissions,
FROM certificats
WHERE emissions_de_co2 IS NOT NULL
  AND zona_climatica IS NOT NULL
  AND codi_poblacio IS NOT NULL
GROUP BY codi_poblacio, zona_climatica
ORDER BY avg_emissions ASC;
```

```sql id=grouped_zona_climatica
SELECT
  zona_climatica,
  AVG(emissions_de_co2) AS avg_emissions
FROM certificats
INNER JOIN municipis
  ON certificats.codi_poblacio = municipis.codi
WHERE emissions_de_co2 IS NOT NULL
  AND zona_climatica IS NOT NULL
  AND municipis.poblacio > ${populationThreshold}
GROUP BY zona_climatica
ORDER BY avg_emissions ASC;
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

<!-- SECOND: TO DEFINE -------------------------------------------------------------------------- -->

<!-- ${populationRangeInput}

<div class="card">
  <p> Format llegenda / Els que menys emeten no es veuen </p>
  <h2 style="font-weight: 600"> Distribució d'emissions </h2>
    ${Plot.plot({
      width: 1920,
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
</div> -->

<!-- THIRD: CLIMATE ZONES -------------------------------------------------------------------------- -->

<!-- <div class="card">
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
</div> -->

<!-- <div class="card">
  <h2 style="font-weight: 600"> Certificacions per zona climàtica </h2>
    ${['B3', 'C2', 'C3', 'D2', 'D3'].map(
      (zona) => resize((width) => zonaClimaticaBeeswarm([...grouped_zona_climatica].filter(d => d.zona_climatica == zona), zona, beeswarmRDomain, [10, 100]))
      )
    }
</div> -->

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
          grouped_poblacio,
          Plot.dodgeY("middle", {
            x: "avg_emissions",
            r: "sum_emissions",
            fy: "zona_climatica",
            fill: "avg_emissions",
            channels: {
              emissions_totals: {
                value: "sum_emissions",
                label: "Emissions totals"
              },
              emissions_totals: {
                value: "sum_emissions",
                label: "Emissions totals"
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
                municipi: (d) => municipisDict[d].municipi,
                poblacio: (d) => [...municipis].find((m) => m.codi == d).poblacio,
                emissions_totals: true,
              }
            },
            stroke: (d) => d.avg_emissions + 10,
            strokeWidth: 0.8,
          })
        ),
        Plot.ruleY(
          grouped_zona_climatica, {x1: beeswarmXDomain[0], x2: "avg_emissions", y:0, fy: "zona_climatica", strokeWidth: 2, stroke: "#758292", opacity: 0.5}
        ),
        Plot.dotX(
          grouped_zona_climatica, {x: "avg_emissions", fy: "zona_climatica", stroke: "#750000", fill:"white", r:4}
        ),
        Plot.text(
          grouped_zona_climatica, {x: beeswarmXDomain[0], text: (d) => d.zona_climatica, fy: "zona_climatica", dx: -30, fontSize: 14, fontWeight: "bold"  }
        )
      ]
    })}
</div>

```js
const beeswarmRDomain = d3.extent([
  ...new Set([...grouped_poblacio].map((d) => d.sum_emissions)),
]);
const beeswarmXDomain = d3.extent([
  ...new Set([...grouped_poblacio].map((d) => d.avg_emissions)),
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

```js
display(radiusLegendData);
```

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

<!-- Multi view ------------------------------------------------------- -->

```js
const $us = vg.Selection.single();
const $motiu = vg.Selection.single();
const $qual = vg.Selection.single();
const $date = vg.Selection.crossfilter();
const $all = vg.Selection.intersect({
  include: [$us, $motiu, $qual, $date],
  cross: true,
});
```

<h2 style="margin-bottom: 20px; font-weight: 600"> Multivista interactiva </h2>
<div class="grid grid-cols-3" style="grid-auto-rows: min-content;">
  <div class="card grid-colspan-3 grid-rowspan-1">
    ${vg.plot(
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
    )}
  </div>
  <div class="card grid-colspan-2">
    ${vg.vconcat(
      vg.hconcat(
        vg.vconcat(
          // --------------- Energy Qualifications --------------- 
          vg.plot(
            vgTextMark("qual_emissions"),
            vg.barX(
              vg.from("certificats", {
                filterBy: $all
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
            vgTextMark("us_edifici"),
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
            vg.marginRight(50),
            vg.marginLeft(200),
            vg.colorDomain(Object.keys(labels.us_edifici).map(Number)),
            vg.colorRange(categoricalScheme5),
            vg.yLabel("Ús edifici →"),
            vg.yTickFormat((d) => labels.us_edifici[d]),
          ),
          // --------------- Motiu certificació --------------- 
          vg.plot(
            vgTextMark("motiu"),
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
            vg.marginRight(50),
            vg.marginLeft(200),
            vg.colorRange(categoricalScheme5),
            vg.yLabel("Motiu →"),
            vg.yTickFormat((d) => labels.motiu[d]),
            vg.colorDomain(Object.keys(labels.motiu).map(Number)),
          ),
        )
      )
    )}
  </div>
  <div class="card">
    <div style="display:flex; flex-direction:row;">
      <h3> Nombre de certificats </h3>
      ${vg.plot(
        vg.text(
          vg.from("certificats", {
            filterBy: $all
          }), 
          {
            x: 0,
            text: vg.count(),
            fontSize: 60,
            fontWeight: "bold"
          }
        ),
        vg.xAxis(null),
      )}
    </div>
    </br>
    ${
      vg.vconcat(
        vg.menu({
            from: "certificats",
            column: "qual_emissions",
            filterBy: $all,
            as: $all,
            label: "Qualificació emissions ",
            format: (d) =>  qualifLabelsLookup[d] ?? 'Sense dades'
        }),
        vg.vspace(30),
        vg.menu({
            from: "certificats",
            column: "qual_energia",
            filterBy: $all,
            as: $all,
            label: "Qualificació energia ",
            format: (d) =>  qualifLabelsLookup[d]
        }),
        vg.vspace(30),
        vg.menu({
            from: "certificats",
            column: "motiu",
            filterBy: $all,
            as: $all,
            label: "Motiu",
            format: (d) =>  labels.motiu[d]
        }),
        vg.vspace(30),
        vg.menu({
            from: "certificats",
            column: "us_edifici",
            filterBy: $all,
            as: $all,
            label: "Ús edifici",
            format: (d) =>  labels.us_edifici[d]
        }),
        vg.vspace(30),
        vg.menu({
            from: "certificats",
            column: "codi_poblacio",
            filterBy: $all,
            as: $all,
            label: "Municipi",
            format: (d) =>  municipisDict[d].municipi
        }),
      )
    }
  </div>
</div>

<div>

</div>

```js
function vgTextMark(column) {
  return vg.text(
    vg.from("certificats", {
      filterBy: $all,
    }),
    {
      x: vg.count(),
      y: column,
      inset: 0.5,
      text: vg.count(),
      dx: 20,
    }
  );
}
```

```js
display([...(await sql`SELECT * FROM CERTIFICATS LIMIT 10`)]);
```
