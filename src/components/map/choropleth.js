import mapboxgl from 'npm:mapbox-gl';
import { sources, layers, sourceLayerIds } from './meta.js';

class DataManager {
  static DatasetKeys = [
    { dfId: 'MUNDISSEC', tilesetId: 'MUNDISSEC' },
    { dfId: 'codi_poblacio', tilesetId: 'CODIMUNI' },
    { dfId: 'codi_comarca', tilesetId: 'CODICOMAR' }
  ];

  emissionsIndicatorData = {};
  incomeIndicatorData = {};

  constructor(datasets) {
    this.datasets = datasets;
  }

  // Return only emissions indicator data
  getIndicatorData(level, indicator) {
    return this.datasets[level].map((d) => ({
      id: d[DataManager.DatasetKeys[level].dfId],
      value: d[indicator]
    }));
  }

  getIndicatorsData(level, emissionsIndicator, socEcIndicator) {
    return this.datasets[level].map((d) => ({
      id: d[DataManager.DatasetKeys[level].dfId],
      emissionsValue: d[emissionsIndicator],
      demoValue: d[socEcIndicator]
    }));
  }
}

export class ChoroplethMap {
  static SourceLayerZooms = [
    [11, 22],
    [8.5, 11],
    [0, 8.5]
  ];

  static defaults = {
    zoom: 7,
    minZoom: 7,
    maxZoom: 14,
    center: [1.8, 41.7]
  };

  noDataColor = '#d4d4d4';

  emissionsIndicator = {};
  incomeIndicator = '';
  zoomLevels = [];
  visibleIndices = [];

  hoveredPolygonId = null;

  constructor(container, datasets) {
    this.accessToken =
      'pk.eyJ1IjoiZm5kdml0IiwiYSI6ImNrYzBzYjhkMDBicG4yc2xrbnMzNXVoeDIifQ.mrdvw_7AIeOwa5IgHLaHJg';

    this.dataManager = new DataManager(datasets);

    this.zoomLevels = ChoroplethMap.SourceLayerZooms;
    this.visibleIndices = [0, 1];
    this.currentDatasetIndex = 1;

    this.map = new mapboxgl.Map({
      container,
      zoom: ChoroplethMap.defaults.zoom,
      center: ChoroplethMap.defaults.center,
      minZoom: ChoroplethMap.defaults.minZoom,
      maxZoom: ChoroplethMap.defaults.maxZoom,
      accessToken: this.accessToken,
      style: 'mapbox://styles/fndvit/clvnpq95k01jg01qz1px52jzf'
    });

    this.map.on('load', () => this.onMapLoad());
    this.map.on('zoom', () => this.onMapZoom());
    layers.forEach((layer, i) => {
      this.map.on('mousemove', layer.fill.id, (e) => this.onMouseMove(e, i));
      this.map.on('mouseleave', layer.fill.id, () => this.onMouseLeave(i));
    });
  }

  static create(container, datasets) {
    return new ChoroplethMap(container, datasets);
  }

  destroy() {
    this.map.remove();
  }

  async onMapLoad() {
    sources.forEach((source) => {
      this.map.addSource(source.id, source);
    });

    ['border', 'fill'].forEach((type) => {
      this.zoomLevels.forEach((zoomLevel, i) => {
        this.map.addLayer(
          {
            ...layers[i][type],
            minzoom: zoomLevel[0],
            maxzoom: zoomLevel[1]
          },
          type == 'border' ? 'settlement-subdivision-label' : 'tunnel-simple'
        );
      });
    });

    this.map.addControl(
      new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
      'top-right'
    );

    document.dispatchEvent(new Event('map-loaded', { bubbles: true }));
  }

  async onMapZoom() {
    const currentZoom = this.map.getZoom();
    const currentZoomIndex = this.zoomLevels.findIndex(
      ([min, max]) => currentZoom >= min && currentZoom < max
    );

    if (currentZoomIndex !== this.currentDatasetIndex) {
      this.clearHighlightedFeatures();
      this.currentDatasetIndex = currentZoomIndex;

      const event = new CustomEvent('zoom-level-changed', {
        detail: { zoomLevel: currentZoomIndex },
        bubbles: true
      });

      document.dispatchEvent(event);
    }
  }

  async onMouseMove(e, i) {
    if (e.features.length > 0) {
      if (this.hoveredPolygonId !== null) {
        this.map.setFeatureState(
          {
            source: sources[i].id,
            sourceLayer: sourceLayerIds[i],
            id: this.hoveredPolygonId
          },
          { hover: false }
        );
      }
      this.hoveredPolygonId = e.features[0].id;

      const event = new CustomEvent('polygon-change', {
        detail: { polygonId: this.hoveredPolygonId },
        bubbles: true
      });
      document.dispatchEvent(event);

      this.map.setFeatureState(
        {
          source: sources[i].id,
          sourceLayer: sourceLayerIds[i],
          id: this.hoveredPolygonId
        },
        { hover: true }
      );
    }
  }

  async onMouseLeave(i) {
    if (this.hoveredPolygonId !== null) {
      this.map.setFeatureState(
        {
          source: sources[i].id,
          sourceLayer: sourceLayerIds[i],
          id: this.hoveredPolygonId
        },
        { hover: false }
      );
    }
    this.hoveredPolygonId = null;
  }

  /**
   * Creates a color step expression.
   * @param {{id: string, valueA: number, valueB: number}[]} data
   * @param {string} tilesetId
   * @param {{domain: number[], range: string[]}} scheme
   */
  createCategoricalColorExpression(data, tilesetId, scheme) {
    const { domain, range } = scheme;
    const colors = range.flatMap((color, index) => {
      return index < domain.length ? [color, domain[index]] : [color];
    });

    const matchExpression = ['match', ['get', tilesetId]];
    data.forEach((entry) => {
      if (entry.emissionsValue && entry.demoValue) {
        matchExpression.push(entry.id, entry.emissionsValue);
      }
    });
    matchExpression.push(0);

    const colorExpression = [
      'step',
      matchExpression,
      this.noDataColor, // color for 0 (unmatched)
      1,
      ...colors
    ];

    return colorExpression;
  }

  normalizeDomain(domain, epsilon = 1e-6) {
    const normalized = [...domain];
    for (let i = 1; i < normalized.length - 1; i++) {
      if (normalized[i] >= normalized[i + 1]) {
        normalized[i] = normalized[i] - epsilon;
      }
    }
    return normalized;
  }

  /**
   * Creates a range treshold opacity expression.
   * Features out of the range will be transparent.
   * @param {{id: string, value: number}[]} data
   * @param {string} tilesetId
   * @param {number[]} range
   */
  createOpacityExpression(data, tilesetId, range) {
    const matchExpression = ['match', ['get', tilesetId]];
    data.forEach((entry) => {
      if (entry.value) {
        matchExpression.push(entry.id, entry.value);
      }
    });
    matchExpression.push(0);

    return [
      'let',
      'indicatorValue',
      matchExpression,
      [
        'case',
        [
          'any',
          [
            'all',
            ['>=', ['var', 'indicatorValue'], range[0]],
            ['<=', ['var', 'indicatorValue'], range[1]]
          ],
          ['==', 0, ['var', 'indicatorValue']]
        ],
        1,
        0
      ]
    ];
  }

  updateMapOpacity(range) {
    const layerOpacity = this.createOpacityExpression(
      this.dataManager.getIndicatorData(this.currentDatasetIndex, this.incomeIndicator),
      DataManager.DatasetKeys[this.currentDatasetIndex].tilesetId,
      range
    );

    this.map.setPaintProperty(
      layers[this.currentDatasetIndex].fill.id,
      'fill-opacity',
      layerOpacity
    );
  }

  updateMapPalette() {
    layers.forEach((layer, i) => {
      if (this.visibleIndices.includes(i)) {
        this.updateLayerPalette(layer.fill, i);
      }
    });
  }

  updateLayerPalette(fillLayer, level) {
    let layerColor;
    if (this.emissionsIndicator.type == 'categoric') {
      layerColor = this.createCategoricalColorExpression(
        this.dataManager.getIndicatorsData(
          level,
          this.emissionsIndicator.value,
          this.incomeIndicator
        ),
        DataManager.DatasetKeys[level].tilesetId,
        {
          domain: this.dataManager.emissionsIndicatorData[level].thresholds,
          range: this.dataManager.emissionsIndicatorData[level].range
        }
      );
    }

    this.map.setPaintProperty(fillLayer.id, 'fill-color', layerColor);
  }

  initializeData(emissionsIndicator, emissionsIndicatorData, incomeIndicator, incomeIndicatorData) {
    this.emissionsIndicator = {
      value: emissionsIndicator.value,
      type: emissionsIndicator.colorScaleType
    };
    this.incomeIndicator = incomeIndicator.value;
    this.updateEmissionsData(emissionsIndicator.value, emissionsIndicatorData);
    this.updateIncomeData(incomeIndicator, incomeIndicatorData);
  }

  updateEmissionsData(emissionsIndicator, indicatorData) {
    this.dataManager.emissionsIndicatorData = indicatorData;
    this.emissionsIndicator = {
      value: emissionsIndicator.value,
      type: emissionsIndicator.colorScaleType
    };
    this.updateMapPalette();
  }

  updateIncomeData(incomeIndicator, indicatorData) {
    this.dataManager.incomeIndicatorData = indicatorData; // PDM: probably not needed
    this.incomeIndicator = incomeIndicator.value;
    this.updateLayerVisibilityAndZoom(incomeIndicator.levels);
  }

  updateLayerVisibilityAndZoom(availableLevels) {
    const visibleIndices = availableLevels
      .map((hasData, i) => (hasData ? i : null))
      .filter((i) => i !== null);

    this.visibleIndices = visibleIndices;

    let zoomLevels;

    switch (visibleIndices.length) {
      case 3:
        zoomLevels = [
          [11.5, 22],
          [8, 11.5],
          [0, 8]
        ];
        break;
      case 2:
        zoomLevels = [
          [9.5, 22],
          [0, 9.5]
        ];
        break;
      case 1:
        zoomLevels = [[0, 22]];
        break;
      default:
        console.warn('No visible layers!');
        zoomLevels = [];
    }

    this.zoomLevels = visibleIndices.map((_, i) => zoomLevels[i]);

    visibleIndices.forEach((layerIdx, i) => {
      const layer = layers[layerIdx];
      const fillLayerId = layer.fill?.id;
      const borderLayerId = layer.border?.id;
      const [minzoom, maxzoom] = zoomLevels[i];

      [fillLayerId, borderLayerId].forEach((layerId, i) => {
        if (!this.map.getLayer(layerId)) {
          this.map.addLayer(
            {
              ...layer.fill,
              minzoom,
              maxzoom
            },
            i == 0 ? 'tunnel-simple' : 'settlement-subdivision-label'
          );
        } else {
          this.map.setLayerZoomRange(layerId, minzoom, maxzoom);
        }
      });
    });

    layers.forEach((layer, i) => {
      if (!visibleIndices.includes(i)) {
        if (this.map.getLayer(layer.fill.id)) {
          this.map.removeLayer(layer.fill.id);
        }
      }
    });
  }

  clearHighlightedFeatures() {
    if (this.hoveredPolygonId !== null) {
      const source = sources[this.currentDatasetIndex];

      this.map.setFeatureState(
        {
          source: source.id,
          sourceLayer: source.layer,
          id: this.hoveredPolygonId
        },
        { hover: false }
      );

      this.hoveredPolygonId = null;
    }
  }
}
