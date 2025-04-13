import { DuckDBClient } from "npm:@observablehq/duckdb";
import { FileAttachment } from "observablehq:stdlib";
import * as vgplot from "npm:@uwdata/vgplot";

export class DBClient {
  constructor(db, vg) {
    this.db = db;
    this.vg = vg;
  }

  static async create() {
    const db = await DuckDBClient.of({
      certificats: FileAttachment("../data/certificats.parquet")
    });

    const coordinator = new vgplot.Coordinator().databaseConnector(vgplot.wasmConnector({duckdb: db._db}));
    const vg = vgplot.createAPIContext({coordinator});

    return new DBClient(db, vg);
  }

  async getQualificationCounts() {
    const query = `
      SELECT qual_emissions AS qual, 'emissions' AS type, COUNT(*) AS count
      FROM certificats
      WHERE qual_emissions IS NOT NULL
      GROUP BY qual_emissions
      UNION ALL
      SELECT qual_energia AS qual, 'energia' AS type, COUNT(*) AS count
      FROM certificats
      WHERE qual_energia IS NOT NULL
      GROUP BY qual_energia
    `;
    return await this.db.query(query);
  }

  async getCertificatesByYear() {
    const query = `
      SELECT
        EXTRACT(YEAR FROM data_entrada) AS year,
        qual_emissions,
        COUNT(*) AS n_cert
      FROM certificats
      WHERE data_entrada < DATE '2025-01-01'
        AND qual_emissions IS NOT NULL
      GROUP BY EXTRACT(YEAR FROM data_entrada), qual_emissions
      ORDER BY n_cert DESC;
    `;
    return await this.db.query(query);
  }

  // setupVGPlot() { ... }
}

// import * as vgplot from "npm:@uwdata/vgplot";
// const vgCoordinator = new vgplot.Coordinator();
// vgCoordinator.databaseConnector(vgplot.wasmConnector({duckdb: db._db}));

// const sql = db.sql.bind(db);
// const vg = vgplot.createAPIContext({coordinator: vgCoordinator});

