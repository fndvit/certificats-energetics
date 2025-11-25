class SliderState {
  static #instance;
  percentileRange;
  indicatorValues;

  constructor() {
    this.percentileRange = [0.25, 0.75];
    this.indicatorValues = [];
    SliderState.#instance = this;
    if (SliderState.#instance) return SliderState.#instance;
  }
}

const sliderState = new SliderState();
export default sliderState;
