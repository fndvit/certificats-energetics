---
sql:
  certificats: ./data/certificats.parquet
---

```sql id=qualEmissions
SELECT qual_emissions 
FROM certificats                                
```

```js
const selectedField = 'qual_emissions';
const hist_query = `SELECT data_entrada, ${selectedField} FROM certificats WHERE ${selectedField} IS NOT NULL`;
const [result_hist] = await sql(hist_query);
console.log(result_hist);
```

```sql id=hist
SELECT data_entrada, ${selectedField}
FROM certificats
WHERE ${selectedField} IS NOT null             
```

```sql id=certificatesByYear
SELECT
    EXTRACT(YEAR FROM data_entrada) AS year,
    qual_emissions,
    COUNT(*) AS n_cert
FROM certificats
WHERE data_entrada < DATE '2025-01-01' AND qual_emissions IS NOT null
GROUP BY EXTRACT(YEAR FROM data_entrada), qual_emissions
ORDER BY n_cert DESC;
```

```js
const qualifColorLookup = ({
  A: "#3b7634",
  B: "#5ea336",
  C: "#a2cf2a",
  D: "#f7df1b",
  E: "#f18f20",
  F: "#eb422bff",
  G: "#ea2038"
});

const qualifColorScheme = [
  "#3b7634",
  "#5ea336",
  "#a2cf2a",
  "#f7df1b",
  "#f18f20",
  "#eb422bff",
  "#ea2038"
];
```

<div>
  <h1>Observatori</h1>
</div>

${Plot.plot({
  marginBottom: 100,
  color: {
    domain: Object.keys(qualifColorLookup),
    range: Object.values(qualifColorLookup)
  },
  x: { grid: true },
  marks: [
    Plot.barX(
      qualEmissions,
      Plot.groupY(
        { x: "count" },
        { y: "qual_emissions", fill: "qual_emissions" }
      )
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


