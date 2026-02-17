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
    [11.5, 22],
    [8.5, 11.5],
    [0, 8.5]
  ];

  static defaults = {
    zoom: 7.6,
    minZoom: 7,
    maxZoom: 14,
    center: [1.5, 41.7],
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

  constructor(container, datasets) {
    this.accessToken =
      'pk.eyJ1IjoiZm5kdml0IiwiYSI6ImNrYzBzYjhkMDBicG4yc2xrbnMzNXVoeDIifQ.mrdvw_7AIeOwa5IgHLaHJg';

    this.dataManager = new DataManager(datasets);

    this.zoomLevels = ChoroplethMap.SourceLayerZooms;
    this.visibleIndices = [0, 1];
    this.currentDatasetIndex = 1;
    this.currentIncomeRange = null; // Track current income range for viewport updates

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
    this.map.on('moveend', () => this.onMapMoveEnd());
    this.map.on('click', (e) => this.onMapClick(e));
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
   * All event listeners are automatically cleaned up by Mapbox.
   */
  destroy() {
    this.map.remove();
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

      this.map.addControl(
        new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
        'top-right'
      );

      document.dispatchEvent(new Event('map-loaded', { bubbles: true }));
    } catch (error) {
      console.error('Failed to initialize map layers:', error);
      document.dispatchEvent(
        new CustomEvent('map-error', {
          detail: { error: error.message },
          bubbles: true
        })
      );
    }
  }

  async onMapZoom() {
    const currentZoom = this.map.getZoom();
    const currentZoomIndex = this.zoomLevels.findIndex(
      ([min, max]) => currentZoom >= min && currentZoom < max
    );

    if (currentZoomIndex !== this.currentDatasetIndex) {
      this.clearHighlightedFeatures();
      this.currentDatasetIndex = currentZoomIndex;

      // Apply opacity to the new layer immediately to avoid flash of old state
      // Uses smart logic: full update for muni/regions, viewport for census sections
      if (this.currentIncomeRange !== null) {
        this.setMapOpacity(this.currentIncomeRange);
      }

      // Clear clicked feature if it's from a different level
      if (this.clickedPolygonLevel !== null && this.clickedPolygonLevel !== currentZoomIndex) {
        this.clearClickedFeature();
        document.dispatchEvent(
          new CustomEvent('polygon-click', {
            detail: { polygonId: null, level: null },
            bubbles: true
          })
        );
      }

      const event = new CustomEvent('zoom-level-changed', {
        detail: { zoomLevel: currentZoomIndex },
        bubbles: true
      });

      document.dispatchEvent(event);
    }
  }

  /**
   * Handles map moveend event to update opacity for newly visible features.
   * Only needed for census sections (viewport optimization).
   * Municipalities and regions are fully updated, so no action needed on pan.
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
      // Clicked outside a feature - close card
      this.clearClickedFeature();
      document.dispatchEvent(
        new CustomEvent('polygon-click', {
          detail: { polygonId: null, level: null },
          bubbles: true
        })
      );
      return;
    }

    // Clear previous clicked feature highlight
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

    // Set new clicked feature state for border highlight
    this.map.setFeatureState(
      {
        source: clickedFeature.source,
        sourceLayer: clickedFeature.sourceLayer,
        id: clickedId
      },
      { clicked: true }
    );

    // Navigate to feature (pass the feature directly for reliable bounds calculation)
    this.flyToFeature(clickedFeature, i);

    // Dispatch event for UI
    document.dispatchEvent(
      new CustomEvent('polygon-click', {
        detail: { polygonId: clickedId, level: i },
        bubbles: true
      })
    );
  }

  /**
   * Flies to a clicked feature, positioning its center with a configurable offset.
   * Positions at the lowest zoom level available for the geographic layer.
   * The offset shifts the feature center to the right and bottom of the viewport.
   * @param {Object} feature - The clicked Mapbox feature with geometry
   * @param {number} level - Geographic level index (0=census, 1=muni, 2=regions)
   */
  flyToFeature(feature, level) {
    if (!feature || !feature.geometry) return;

    // Calculate bounds of the feature
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

    // Always use the geometric center of the feature for consistent positioning
    const center = bounds.getCenter();

    // Use lowest zoom level for this layer (slightly above minimum for padding)
    const targetZoom = ChoroplethMap.SourceLayerZooms[level][1] - 0.1;

    // Apply offset to position the feature center to the right and bottom
    // Positive x shifts map right (feature appears on the left side of screen)
    // Positive y shifts map down (feature appears on the top side of screen)
    // Negate values to achieve right/bottom positioning
    const offsetX = ChoroplethMap.defaults.clickedFeatureOffsetX;
    const offsetY = ChoroplethMap.defaults.clickedFeatureOffsetY;

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
      this.noDataColor, // color for 0 (unmatched)
      1,
      ...colors
    ];

    return colorExpression;
  }

  /**
   * Ensures domain values are strictly increasing for Mapbox step expressions.
   * Adjusts any equal adjacent values by subtracting epsilon from the lower one.
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
      // Fallback if querySourceFeatures fails (e.g., map not ready)
      return null;
    }
  }

  /**
   * Applies opacity filter to features currently in the viewport.
   * Much more efficient than updating all features.
   * @param {number[]} range - [min, max] income values to show
   */
  applyOpacityToViewport(range) {
    const visibleIds = this.getVisibleFeatureIds();
    if (!visibleIds) return; // Map not ready yet

    const data = this.dataManager.getIndicatorData(this.currentDatasetIndex, this.incomeIndicator);
    const source = sources[this.currentDatasetIndex];

    // Only update features visible in viewport (~100-500 instead of ~15,000)
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

    // For municipalities (900 features) and regions (40 features), update all features
    // This ensures smooth zoom transitions without flickering
    if (this.currentDatasetIndex >= 1) {
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        this.setFeatureOpacity(source, d.id, this.isBetweenRange(d.value, range));
      }
      return;
    }

    // For census sections (15,000+ features), use viewport optimization
    const visibleIds = this.getVisibleFeatureIds();

    if (!visibleIds) {
      // Fallback: update all features if viewport query not available
      for (let i = 0; i < data.length; i++) {
        const d = data[i];
        this.setFeatureOpacity(source, d.id, this.isBetweenRange(d.value, range));
      }
      return;
    }

    // Viewport-based optimization: only update visible features
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

    // For municipalities and regions, update all features that changed
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

    // For census sections, use viewport optimization
    const visibleIds = this.getVisibleFeatureIds();

    if (!visibleIds) {
      // Fallback to full update
      this.setMapOpacity(newRange);
      return;
    }

    // Only update visible features that changed state
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
