import mapboxgl from 'npm:mapbox-gl';

export class MapBase {
  static defaults = {
    zoom: 7.6,
    minZoom: 7,
    maxZoom: 14,
    center: [1.5, 41.7]
  };

  constructor(container) {
    this.accessToken =
      'pk.eyJ1IjoiZm5kdml0IiwiYSI6ImNrYzBzYjhkMDBicG4yc2xrbnMzNXVoeDIifQ.mrdvw_7AIeOwa5IgHLaHJg';

    this.map = new mapboxgl.Map({
      container,
      zoom: MapBase.defaults.zoom,
      center: MapBase.defaults.center,
      minZoom: MapBase.defaults.minZoom,
      maxZoom: MapBase.defaults.maxZoom,
      accessToken: this.accessToken,
      style: 'mapbox://styles/fndvit/clvnpq95k01jg01qz1px52jzf'
    });

    this.map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
      'top-right'
    );
  }

  destroy() {
    this.map.remove();
  }
}
