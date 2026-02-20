class SliderState {
  static #instance;
  percentileRange;
  indicatorValues;

  constructor() {
    if (SliderState.#instance) return SliderState.#instance;

    this.percentileRange = [0.25, 0.75];
    this.indicatorValues = [];
    this.currentRange = [];
    SliderState.#instance = this;
  }
}

const sliderState = new SliderState();
export default sliderState;
