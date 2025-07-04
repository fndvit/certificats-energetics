class Stores {
  static #instance;
  percentileRange;
  indicatorValues;

  constructor() {
    this.percentileRange = [0.25, 0.75];
    this.indicatorValues = [];
    Stores.#instance = this;
    if (Stores.#instance) return Stores.#instance;
  }
}

const stores = new Stores();
export default stores;
