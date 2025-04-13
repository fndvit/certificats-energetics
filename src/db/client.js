import { DuckDBClient } from "npm:@observablehq/duckdb";
import { FileAttachment } from "observablehq:stdlib";

export class DBClient {
  constructor(db) {
    this.db = db;
  }

  static async create() {
    const db = await DuckDBClient.of({
      certificats: FileAttachment("../data/certificats.parquet")
    });
  
    return new DBClient(db);
  }

  async getQualifications(isEmissions) {
    const column = isEmissions ? 'qual_emissions' : 'qual_energia';
    const query = `SELECT ${column} FROM certificats WHERE ${column} IS NOT NULL`;
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

