import * as Plot from "npm:@observablehq/plot";
import { resize } from "npm:@observablehq/stdlib";
import { qualifColorLookup } from "./colors.js";

export function qualificationsHist(data, isEnergia) {
  const field = isEnergia ? "qual_energia" : "qual_emissions";
  return resize((width) =>
    Plot.plot({
      title: `Certificats per ${isEnergia ? "consum d'energia" : "emissions de C02"}`,
      width: width,
      height: 500,
      x: { label: "Any" },
      y: { label: "Nombre de certificats" },
      fy: { label: null },
      color: {
        domain: Object.keys(qualifColorLookup),
        range: Object.values(qualifColorLookup),
      },
      marks: [
        Plot.rectY(
          data,
          Plot.binX(
            { y: "count" },
            {
              x: "data_entrada",
              fy: field,
              fill: field,
              interval: "year",
              tip: true,
            }
          )
        ),
      ],
    })
  );
}
