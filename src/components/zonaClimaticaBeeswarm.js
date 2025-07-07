import * as Plot from "npm:@observablehq/plot";
import { resize } from "npm:@observablehq/stdlib";
import { html } from "npm:htl";

export function zonaClimaticaBeeswarm(data, zona_climatica, rDomain, xDomain) {
  return resize(
    (width) => html`
      <div
        style="display:flex; flex-direction:row; align-items: center; gap: 3rem"
      >
        <div style="min-width: 100px;">${zona_climatica}</div>
        <div>
          ${Plot.plot({
            height: 150,
            width,
            color: {
              scheme: "YlOrRd",
            },
            x: { domain: xDomain, grid: true, label: null },
            r: { range: [2, 20], domain: rDomain },
            marks: [
              Plot.dot(
                data,
                Plot.dodgeY("middle", {
                  x: "avg_emissions",
                  r: "sum_emissions",
                  fill: "avg_emissions",
                  stroke: (d) => d.avg_emissions + 40,
                  strokeWidth: 0.8,
                  tip: true,
                })
              ),
            ],
          })}
        </div>
      </div>
    `
  );
}
