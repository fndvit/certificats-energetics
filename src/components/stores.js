class Stores {
  static #instance;
  percentileRange;
  indicatorValues;

  constructor() {
    if (Stores.#instance) return Stores.#instance;
    this.percentileRange = [0, 0];
    this.indicatorValues = [];
    Stores.#instance = this;
  }
}

const stores = new Stores();
export default stores;
