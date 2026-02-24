import { MapBase } from './mapBase.js';
import { ChoroplethLayer } from './choroplethLayer.js';
import { ClusterLayer } from './clusterLayer.js';

export class MapManager {
  constructor(container, datasets, pointsData) {
    this.mapBase = new MapBase(container);
    this.choroplethLayer = null;
    this.clusterLayer = null;

    this.mapBase.map.on('load', async () => {
      this.choroplethLayer = new ChoroplethLayer(this.mapBase, datasets);
      await this.choroplethLayer.onMapLoad();

      this.clusterLayer = new ClusterLayer(this.mapBase, pointsData);
      await this.clusterLayer.onMapLoad();

      this.clusterLayer.hide();

      document.dispatchEvent(new Event('map-loaded', { bubbles: true }));
    });
  }

  static create(container, datasets, pointsData) {
    return new MapManager(container, datasets, pointsData);
  }

  setMode(mode) {
    if (!this.choroplethLayer || !this.clusterLayer) return;
    if (mode === 'cluster') {
      this.choroplethLayer.hide();
      this.clusterLayer.show();
    } else {
      this.clusterLayer.hide();
      this.choroplethLayer.show();
      if (this.mapBase.map.getZoom() > ChoroplethLayer.MAX_ZOOM) {
        this.mapBase.map.easeTo({ zoom: ChoroplethLayer.MAX_ZOOM });
      }
    }
  }

  initializeData(emissionsIndicator, emissionsIndicatorData, incomeIndicator, incomeIndicatorData) {
    this.choroplethLayer.initializeData(
      emissionsIndicator,
      emissionsIndicatorData,
      incomeIndicator,
      incomeIndicatorData
    );
  }

  updateEmissionsData(emissionsIndicator, indicatorData) {
    this.choroplethLayer.updateEmissionsData(emissionsIndicator, indicatorData);
  }

  updateIncomeData(incomeIndicator, indicatorData) {
    this.choroplethLayer.updateIncomeData(incomeIndicator, indicatorData);
  }

  setMapOpacity(range) {
    this.choroplethLayer.setMapOpacity(range);
  }

  updateMapOpacity(oldRange, newRange) {
    this.choroplethLayer.updateMapOpacity(oldRange, newRange);
  }

  clearClickedFeature() {
    this.choroplethLayer.clearClickedFeature();
  }

  destroy() {
    this.mapBase.destroy();
  }
}
