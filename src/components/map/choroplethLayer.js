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

export class ChoroplethLayer {
  static SourceLayerZooms = [
    [11.5, 22],
    [8.5, 11.5],
    [0, 8.5]
  ];

  static defaults = {
    clickedFeatureOffsetX: 0,
    clickedFeatureOffsetY: 0
  };

  noDataColor = '#d4d4d4';

  emissionsIndicator = {};
  incomeIndicator = '';
  zoomLevels = [];
  visibleIndices = [];

  hoveredPolygonId = null;
  clickedPolygonId = null;
  clickedPolygonLevel = null;

  constructor(mapBase, datasets) {
    this.map = mapBase.map;
    this.dataManager = new DataManager(datasets);

    this.zoomLevels = ChoroplethLayer.SourceLayerZooms;
    this.visibleIndices = [0, 1];
    this.currentDatasetIndex = 1;
    this.currentIncomeRange = null;

    this.map.on('zoom', () => this.onMapZoom());
    this.map.on('mousemove', (e) => this.onMouseMoveGeneral(e));
    this.map.on('moveend', () => this.onMapMoveEnd());
    this.map.on('click', (e) => this.onMapClick(e));
  }

  async onMapLoad() {
    try {
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
    } catch (error) {
      console.error('Failed to initialize choropleth layers:', error);
      document.dispatchEvent(
        new CustomEvent('map-error', {
          detail: { error: error.message },
          bubbles: true
        })
      );
    }
  }

  show() {
    layers.forEach((layer) => {
      [layer.fill?.id, layer.border?.id].forEach((layerId) => {
        if (layerId && this.map.getLayer(layerId)) {
          this.map.setLayoutProperty(layerId, 'visibility', 'visible');
        }
      });
    });
  }

  hide() {
    layers.forEach((layer) => {
      [layer.fill?.id, layer.border?.id].forEach((layerId) => {
        if (layerId && this.map.getLayer(layerId)) {
          this.map.setLayoutProperty(layerId, 'visibility', 'none');
        }
      });
    });
  }

  async onMapZoom() {
    const currentZoom = this.map.getZoom();
    const currentZoomIndex = this.zoomLevels.findIndex(
      ([min, max]) => currentZoom >= min && currentZoom < max
    );

    if (currentZoomIndex !== this.currentDatasetIndex) {
      this.clearHighlightedFeatures();
      this.currentDatasetIndex = currentZoomIndex;

      if (this.currentIncomeRange !== null) {
        this.setMapOpacity(this.currentIncomeRange);
      }

      if (this.clickedPolygonLevel !== null && this.clickedPolygonLevel !== currentZoomIndex) {
        this.clearClickedFeature();
        document.dispatchEvent(
          new CustomEvent('polygon-click', {
            detail: { polygonId: null, level: null },
            bubbles: true
          })
        );
      }

      document.dispatchEvent(
        new CustomEvent('zoom-level-changed', {
          detail: { zoomLevel: currentZoomIndex },
          bubbles: true
        })
      );
    }
  }

  /**
   * Handles map moveend event to update opacity for newly visible features.
   * Only needed for census sections (viewport optimization).
   */
  onMapMoveEnd() {
    if (this.currentIncomeRange !== null && this.currentDatasetIndex === 0) {
      this.applyOpacityToViewport(this.currentIncomeRange);
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
   * Handles map click events to detect feature clicks and trigger region card display.
   * @param {Object} e - Mapbox click event
   */
  onMapClick(e) {
    const i = this.currentDatasetIndex;
    const layer = layers[i];
    const fillLayerId = layer.fill?.id;

    if (!fillLayerId) return;

    const features = this.map.queryRenderedFeatures(e.point, {
      layers: [fillLayerId]
    });

    const clickedFeature = features[0] ?? null;
    const clickedId = clickedFeature?.id ?? null;

    if (clickedId === null) {
      this.clearClickedFeature();
      document.dispatchEvent(
        new CustomEvent('polygon-click', {
          detail: { polygonId: null, level: null },
          bubbles: true
        })
      );
      return;
    }

    if (this.clickedPolygonId !== null && this.clickedPolygonLevel !== null) {
      this.map.setFeatureState(
        {
          source: sources[this.clickedPolygonLevel].id,
          sourceLayer: sourceLayerIds[this.clickedPolygonLevel],
          id: this.clickedPolygonId
        },
        { clicked: false }
      );
    }

    this.clickedPolygonId = clickedId;
    this.clickedPolygonLevel = i;

    this.map.setFeatureState(
      {
        source: clickedFeature.source,
        sourceLayer: clickedFeature.sourceLayer,
        id: clickedId
      },
      { clicked: true }
    );

    this.flyToFeature(clickedFeature, i);

    document.dispatchEvent(
      new CustomEvent('polygon-click', {
        detail: { polygonId: clickedId, level: i },
        bubbles: true
      })
    );
  }

  /**
   * Flies to a clicked feature, positioning its center with a configurable offset.
   * @param {Object} feature - The clicked Mapbox feature with geometry
   * @param {number} level - Geographic level index (0=census, 1=muni, 2=regions)
   */
  flyToFeature(feature, level) {
    if (!feature || !feature.geometry) return;

    const bounds = new mapboxgl.LngLatBounds();

    if (feature.geometry.type === 'Polygon') {
      feature.geometry.coordinates[0].forEach((coord) => {
        bounds.extend(coord);
      });
    } else if (feature.geometry.type === 'MultiPolygon') {
      feature.geometry.coordinates.forEach((polygon) => {
        polygon[0].forEach((coord) => {
          bounds.extend(coord);
        });
      });
    }

    const center = bounds.getCenter();
    const targetZoom = ChoroplethLayer.SourceLayerZooms[level][1] - 0.1;
    const offsetX = ChoroplethLayer.defaults.clickedFeatureOffsetX;
    const offsetY = ChoroplethLayer.defaults.clickedFeatureOffsetY;

    this.map.flyTo({
      center: center,
      zoom: targetZoom,
      offset: [offsetX, offsetY],
      duration: 1000,
      essential: true
    });
  }

  /**
   * Clears the clicked feature highlight and resets state.
   */
  clearClickedFeature() {
    if (this.clickedPolygonId !== null && this.clickedPolygonLevel !== null) {
      this.map.setFeatureState(
        {
          source: sources[this.clickedPolygonLevel].id,
          sourceLayer: sourceLayerIds[this.clickedPolygonLevel],
          id: this.clickedPolygonId
        },
        { clicked: false }
      );
      this.clickedPolygonId = null;
      this.clickedPolygonLevel = null;
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
      this.noDataColor,
      1,
      ...colors
    ];

    return colorExpression;
  }

  /**
   * Ensures domain values are strictly increasing for Mapbox step expressions.
   * @param {number[]} domain - Array of threshold values
   * @param {number} epsilon - Small value to separate equal thresholds (default: 1e-6)
   * @returns {number[]} Normalized domain with strictly increasing values
   */
  normalizeDomain(domain, epsilon = 1e-6) {
    const normalized = [...domain];
    for (let i = 1; i < normalized.length - 1; i++) {
      const current = normalized[i];
      const next = normalized[i + 1];

      if (current >= next) {
        normalized[i] = current - epsilon;
      }
    }
    return normalized;
  }

  /**
   * Gets the set of feature IDs currently visible in the viewport.
   * @returns {Set<string>} Set of visible feature IDs
   */
  getVisibleFeatureIds() {
    const source = sources[this.currentDatasetIndex];
    const sourceLayer = sourceLayerIds[this.currentDatasetIndex];

    try {
      const visibleFeatures = this.map.querySourceFeatures(source.id, {
        sourceLayer: sourceLayer
      });
      return new Set(visibleFeatures.map((f) => f.id));
    } catch (error) {
      return null;
    }
  }

  /**
   * Applies opacity filter to features currently in the viewport.
   * @param {number[]} range - [min, max] income values to show
   */
  applyOpacityToViewport(range) {
    const visibleIds = this.getVisibleFeatureIds();
    if (!visibleIds) return;

    const data = this.dataManager.getIndicatorData(this.currentDatasetIndex, this.incomeIndicator);
    const source = sources[this.currentDatasetIndex];

    for (let i = 0; i < data.length; i++) {
      const d = data[i];
      if (visibleIds.has(d.id)) {
        this.setFeatureOpacity(source, d.id, this.isBetweenRange(d.value, range));
      }
    }
  }

  /**
   * Sets opacity for all features based on income range filter.
   * Uses viewport-based optimization for census sections, full update for others.
   * @param {number[]} range - [min, max] income values to show
   */
  setMapOpacity(range) {
    this.currentIncomeRange = range;

    const data = this.dataManager.getIndicatorData(this.currentDatasetIndex, this.incomeIndicator);
    const source = sources[this.currentDatasetIndex];

    if (this.currentDatasetIndex >= 1) {
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        this.setFeatureOpacity(source, d.id, this.isBetweenRange(d.value, range));
      }
      return;
    }

    const visibleIds = this.getVisibleFeatureIds();

    if (!visibleIds) {
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        this.setFeatureOpacity(source, d.id, this.isBetweenRange(d.value, range));
      }
      return;
    }

    this.applyOpacityToViewport(range);
  }

  /**
   * Efficiently updates opacity when income range changes.
   * Only updates features that changed visibility state.
   * @param {number[]} oldRange - Previous [min, max] range
   * @param {number[]} newRange - New [min, max] range
   */
  updateMapOpacity(oldRange, newRange) {
    this.currentIncomeRange = newRange;

    const data = this.dataManager.getIndicatorData(this.currentDatasetIndex, this.incomeIndicator);
    const source = sources[this.currentDatasetIndex];

    let wasIn, isIn, d;

    if (this.currentDatasetIndex >= 1) {
      for (let i = 0; i < data.length; i++) {
        d = data[i];
        wasIn = this.isBetweenRange(d.value, oldRange);
        isIn = this.isBetweenRange(d.value, newRange);

        if (wasIn !== isIn) {
          this.setFeatureOpacity(source, d.id, isIn);
        }
      }
      return;
    }

    const visibleIds = this.getVisibleFeatureIds();

    if (!visibleIds) {
      this.setMapOpacity(newRange);
      return;
    }

    for (let i = 0; i < data.length; i++) {
      d = data[i];
      if (visibleIds.has(d.id)) {
        wasIn = this.isBetweenRange(d.value, oldRange);
        isIn = this.isBetweenRange(d.value, newRange);

        if (wasIn !== isIn) {
          this.setFeatureOpacity(source, d.id, isIn);
        }
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
          [12, 22],
          [8, 12],
          [0, 8]
        ];
      case 2:
        return [
          [12, 22],
          [0, 12]
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
