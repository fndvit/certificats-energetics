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
    zoom: 7.6,
    minZoom: 7,
    maxZoom: 14,
    center: [1.5, 41.7]
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
    this.map.on('mousemove', (e) => this.onMouseMoveGeneral(e));

    // layers.forEach((layer, i) => {
    //   this.map.on('mousemove', layer.fill.id, (e) => this.onMouseMove(e, i));
    //   this.map.on('mouseleave', layer.fill.id, () => this.onMouseLeave(i));
    // });
  }

  /**
   * Factory method to create a new ChoroplethMap instance.
   * @param {HTMLElement} container - DOM element to mount the map
   * @param {Array} datasets - Array of datasets [seccen, mun, com]
   * @returns {ChoroplethMap} New map instance
   */
  static create(container, datasets) {
    return new ChoroplethMap(container, datasets);
  }

  /**
   * Cleans up the map instance and removes it from the DOM.
   */
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

  onMouseMoveGeneral(e) {
    const i = this.currentDatasetIndex;

    const layer = layers[i];
    const fillLayerId = layer.fill?.id;

    const features = this.map.queryRenderedFeatures(e.point, {
      layers: [fillLayerId]
    });

    const prevId = this.hoveredPolygonId;
    const nextFeature = features[0] ?? null;
    const nextId = nextFeature?.id ?? null;

    if (prevId === nextId) {
      // tooltip position update only
      if (nextId !== null) {
        const oe = e.originalEvent;
        document.dispatchEvent(
          new CustomEvent('polygon-change', {
            detail: { polygonId: nextId, x: oe.clientX, y: oe.clientY },
            bubbles: true
          })
        );
      }
      return;
    }

    // Clear previous hover
    if (prevId !== null) {
      this.map.setFeatureState(
        {
          source: sources[i].id,
          sourceLayer: sourceLayerIds[i],
          id: prevId
        },
        { hover: false }
      );
    }

    this.hoveredPolygonId = nextId;

    // Dispatch polygon-change event
    const oe = e.originalEvent;
    document.dispatchEvent(
      new CustomEvent('polygon-change', {
        detail: { polygonId: nextId, x: oe.clientX, y: oe.clientY },
        bubbles: true
      })
    );

    if (nextFeature) {
      this.lastHoveredSource = nextFeature.source;
      this.lastHoveredSourceLayer = nextFeature.sourceLayer;

      this.map.setFeatureState(
        {
          source: nextFeature.source,
          sourceLayer: nextFeature.sourceLayer,
          id: nextId
        },
        { hover: true }
      );
    }
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
   * Sets opacity for all features based on income range filter.
   * Features within range are fully visible, others are hidden.
   * @param {number[]} range - [min, max] income values to show
   */
  setMapOpacity(range) {
    const data = this.dataManager.getIndicatorData(this.currentDatasetIndex, this.incomeIndicator);
    const source = sources[this.currentDatasetIndex];

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      this.setFeatureOpacity(source, d.id, this.isBetweenRange(d.value, range));
    }
  }

  /**
   * Efficiently updates opacity when income range changes.
   * Only updates features that changed visibility state.
   * @param {number[]} oldRange - Previous [min, max] range
   * @param {number[]} newRange - New [min, max] range
   */
  updateMapOpacity(oldRange, newRange) {
    const data = this.dataManager.getIndicatorData(this.currentDatasetIndex, this.incomeIndicator);
    const source = sources[this.currentDatasetIndex];

    let wasIn, isIn, d;

    for (let i = 0; i < data.length; i++) {
      d = data[i];
      wasIn = this.isBetweenRange(d.value, oldRange);
      isIn = this.isBetweenRange(d.value, newRange);

      if (wasIn !== isIn) {
        this.setFeatureOpacity(source, d.id, isIn);
      }
    }
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

  /**
   * Initializes the map with emissions and income indicator data.
   * Called once after map loads.
   * @param {Object} emissionsIndicator - Emissions indicator metadata
   * @param {Array} emissionsIndicatorData - Processed emissions data with bins
   * @param {Object} incomeIndicator - Income indicator metadata
   * @param {Array} incomeIndicatorData - Processed income data with stats
   */
  initializeData(emissionsIndicator, emissionsIndicatorData, incomeIndicator, incomeIndicatorData) {
    this.emissionsIndicator = {
      value: emissionsIndicator.value,
      type: emissionsIndicator.colorScaleType
    };
    this.incomeIndicator = incomeIndicator.value;
    this.updateEmissionsData(emissionsIndicator.value, emissionsIndicatorData);
    this.updateIncomeData(incomeIndicator, incomeIndicatorData);
  }

  /**
   * Updates the map with new emissions indicator data.
   * Recalculates color palette for all visible layers.
   * @param {Object} emissionsIndicator - Emissions indicator metadata
   * @param {Array} indicatorData - Processed emissions data with bins
   */
  updateEmissionsData(emissionsIndicator, indicatorData) {
    this.dataManager.emissionsIndicatorData = indicatorData;
    this.emissionsIndicator = {
      value: emissionsIndicator.value,
      type: emissionsIndicator.colorScaleType
    };
    this.updateMapPalette();
  }

  /**
   * Updates the map with new income indicator data.
   * Adjusts layer visibility based on data availability.
   * @param {Object} incomeIndicator - Income indicator metadata
   * @param {Array} indicatorData - Processed income data with stats
   */
  updateIncomeData(incomeIndicator, indicatorData) {
    this.dataManager.incomeIndicatorData = indicatorData;
    this.incomeIndicator = incomeIndicator.value;
    this.updateLayerVisibilityAndZoom(incomeIndicator.levels);
  }

  updateLayerVisibilityAndZoom(availableLevels) {
    const visibleIndices = availableLevels
      .map((hasData, i) => (hasData ? i : null))
      .filter((i) => i !== null);

    this.visibleIndices = visibleIndices;

    let zoomLevels = this.getZoomLevels(visibleIndices.length);

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

  getZoomLevels(nVisibleIndices) {
    switch (nVisibleIndices) {
      case 3:
        return [
          [11.5, 22],
          [8, 11.5],
          [0, 8]
        ];
      case 2:
        return [
          [11.5, 22],
          [0, 11.5]
        ];
      case 1:
        return [[0, 22]];
      default:
        console.warn('No visible layers!');
        return [];
    }
  }

  isBetweenRange(val, range) {
    return val && val >= range[0] && val <= range[1];
  }

  setFeatureOpacity(source, featureId, visible) {
    this.map.setFeatureState(
      {
        source: source.id,
        sourceLayer: source.layer,
        id: featureId
      },
      { visible: visible }
    );
  }
}
