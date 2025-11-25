import mapboxgl from 'npm:mapbox-gl';

class DataManager {
  /* ------------------
   Datasets
   [seccen, mun, com] 
   ------------------
  */
  static DatasetKeys = [
    { dfId: 'MUNDISSEC', tilesetId: 'MUNDISSEC' },
    { dfId: 'codi_poblacio', tilesetId: 'CODIMUNI' },
    { dfId: 'codi_comarca', tilesetId: 'CODICOMAR' }
  ];

  emissionsIndicatorData = {};
  incomeIndicatorData = {};

  incomeIndicatorValue = {
    min: 0,
    max: 0,
    mean: 0,
    q1: 0,
    q3: 0
  };

  constructor(datasets) {
    this.datasets = datasets;
  }

  getIndicatorData(level, indicator) {
    return this.datasets[level].map((d) => ({
      id: d[DataManager.DatasetKeys[level].dfId],
      value: d[indicator]
    }));
  }

  getIndicatorsData(level, emissionsIndicator, demoIndicator) {
    return this.datasets[level].map((d) => ({
      id: d[DataManager.DatasetKeys[level].dfId],
      emissionsValue: d[emissionsIndicator],
      demoValue: d[demoIndicator]
    }));
  }
}

export class ChoroplethMap {
  static InitialIndicators = ['mean_emissions', 'Mediana de la renta por unidad de consumo_2022'];
  static SourceLayerIds = ['seccen-dgddop', 'municipis-cck7ln', 'comarques-10jgvu'];
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
    // bounds: [
    //   [0.9, 40.8],
    //   [2.7, 42.7]
    // ]
  };

  static Metadata = [
    /* -----------------
    //  Seccions censals
    // ----------------- */
    {
      source: {
        id: 'seccen',
        url: 'mapbox://fndvit.3n29djx2',
        layer: ChoroplethMap.SourceLayerIds[0],
        promoteId: 'MUNDISSEC',
        type: 'vector'
      },

      layers: {
        border: {
          id: 'seccen-line',
          type: 'line',
          source: 'seccen',
          'source-layer': ChoroplethMap.SourceLayerIds[0],
          paint: {
            'line-color': '#000000',
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]
          }
        },

        fill: {
          id: 'seccen-fill',
          type: 'fill',
          source: 'seccen',
          'source-layer': ChoroplethMap.SourceLayerIds[0],
          paint: {
            'fill-opacity': ['case', ['boolean', ['feature-state', 'visible'], false], 0, 1]
          }
        }
      }
    },

    /* -----------------
    //     Municipis
    // ----------------- */
    {
      source: {
        id: 'municipis',
        url: 'mapbox://fndvit.0lp3ykob',
        layer: ChoroplethMap.SourceLayerIds[1],
        promoteId: 'CODIMUNI',
        type: 'vector'
      },

      layers: {
        border: {
          id: 'mun-line',
          type: 'line',
          source: 'municipis',
          'source-layer': ChoroplethMap.SourceLayerIds[1],
          paint: {
            'line-color': '#000000',
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]
          }
        },

        fill: {
          id: 'mun-fill',
          type: 'fill',
          source: 'municipis',
          'source-layer': ChoroplethMap.SourceLayerIds[1],
          paint: {
            'fill-opacity': ['case', ['boolean', ['feature-state', 'visible'], false], 0, 1]
          }
        }
      }
    },

    /* -----------------
    //     Comarques
    // ----------------- */
    {
      source: {
        id: 'comarques',
        url: 'mapbox://fndvit.9mw23qz3',
        layer: ChoroplethMap.SourceLayerIds[2],
        promoteId: 'CODICOMAR',
        type: 'vector'
      },

      layers: {
        border: {
          id: 'com-line',
          type: 'line',
          source: 'comarques',
          'source-layer': ChoroplethMap.SourceLayerIds[2],
          paint: {
            'line-color': '#000000',
            'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]
          }
        },

        fill: {
          id: 'com-fill',
          type: 'fill',
          source: 'comarques',
          'source-layer': ChoroplethMap.SourceLayerIds[2],
          paint: {
            'fill-opacity': ['case', ['boolean', ['feature-state', 'visible'], false], 0, 1]
          }
        }
      }
    }
  ];

  noDataColor = '#d4d4d4';

  emissionsIndicator = {};
  incomeIndicator = '';

  layerColor = [];
  layerColors = [];
  layerOpacity = [];
  zoomLevels = [];
  zoomLevel;
  visibleIndices = [];

  hoveredPolygonId = null;

  constructor(container, datasets) {
    this.accessToken =
      'pk.eyJ1IjoiZm5kdml0IiwiYSI6ImNrYzBzYjhkMDBicG4yc2xrbnMzNXVoeDIifQ.mrdvw_7AIeOwa5IgHLaHJg';

    this.dataManager = new DataManager(datasets);

    this.zoomLevels = ChoroplethMap.SourceLayerZooms;
    this.zoomLevel = 2; // Starts at 1
    this.visibleIndices = [0, 1];
    this.currentDatasetIndex = 1;

    this.map = new mapboxgl.Map({
      container,
      zoom: ChoroplethMap.defaults.zoom,
      center: ChoroplethMap.defaults.center,
      minZoom: ChoroplethMap.defaults.minZoom,
      maxZoom: ChoroplethMap.defaults.maxZoom,
      // maxBounds: ChoroplethMap.defaults.bounds,
      accessToken: this.accessToken,
      style: 'mapbox://styles/fndvit/clvnpq95k01jg01qz1px52jzf'
    });

    this.map.on('load', () => this.onMapLoad());
    this.map.on('zoom', () => this.onMapZoom());
    ChoroplethMap.Metadata.forEach((meta, i) => {
      this.map.on('mousemove', meta.layers.fill.id, (e) => this.onMouseMove(e, i));
      this.map.on('mouseleave', meta.layers.fill.id, () => this.onMouseLeave(i));
    });
  }

  static create(container, datasets) {
    return new ChoroplethMap(container, datasets);
  }

  destroy() {
    this.map.remove();
  }

  async onMapLoad() {
    ChoroplethMap.Metadata.forEach((meta) => {
      this.map.addSource(meta.source.id, meta.source);
    });

    ['border', 'fill'].forEach((type) => {
      this.zoomLevels.forEach((zoomLevel, i) => {
        this.map.addLayer(
          {
            ...ChoroplethMap.Metadata[i].layers[type],
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
    const newZoomLevel = this.zoomLevels.findIndex(
      ([min, max]) => currentZoom >= min && currentZoom < max
    );

    if (newZoomLevel !== this.map.zoomLevel) {
      // Clear highlighted polygons
      if (this.hoveredPolygonId !== null) {
        const prevIndex = this.visibleIndices[this.map.zoomLevel]; // old index
        const prevMeta = ChoroplethMap.Metadata[prevIndex];

        this.map.setFeatureState(
          {
            source: prevMeta.source.id,
            sourceLayer: prevMeta.source.layer,
            id: this.hoveredPolygonId
          },
          { hover: false }
        );

        this.hoveredPolygonId = null;
      }

      this.map.zoomLevel = newZoomLevel;

      // console.log('Visible indices', this.visibleIndices);
      const datasetIndex = this.visibleIndices[newZoomLevel];
      this.currentDatasetIndex = datasetIndex;

      const event = new CustomEvent('zoom-level-changed', {
        detail: { zoomLevel: datasetIndex },
        bubbles: true
      });

      // console.log('DISPATCHING MAP ZOOM EVENT');
      document.dispatchEvent(event);
    }
  }

  async onMouseMove(e, i) {
    if (e.features.length > 0) {
      if (this.hoveredPolygonId !== null) {
        this.map.setFeatureState(
          {
            source: ChoroplethMap.Metadata[i].source.id,
            sourceLayer: ChoroplethMap.SourceLayerIds[i],
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

      // console.log('DISPATCHING POLYGON CHANGE EVENT', e.features[0]);
      document.dispatchEvent(event);
      // mutable hoveredPolygonId = hoveredPolygonId;

      // console.log('Hovered polygon', this.hoveredPolygonId);

      this.map.setFeatureState(
        {
          source: ChoroplethMap.Metadata[i].source.id,
          sourceLayer: ChoroplethMap.SourceLayerIds[i],
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
          source: ChoroplethMap.Metadata[i].source.id,
          sourceLayer: ChoroplethMap.SourceLayerIds[i],
          id: this.hoveredPolygonId
        },
        { hover: false }
      );
    }
    this.hoveredPolygonId = null;
    // mutable hoveredPolygonId = hoveredPolygonId;
  }

  /**
   * Creates a color step expression.
   * @param {{id: string, valueA: number, valueB: number}[]} data
   * @param {string} tilesetId
   * @param {{domain: number[], range: string[]}} scheme
   */
  createCategoricalColorExpression(data, tilesetId, scheme) {
    // console.log('CREATE CATEGORICAL', arguments);
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

    // console.log('CATEGORICAL COLOR EXPRESSION', colorExpression);

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
    // //console.log('Range', range);
    const matchExpression = ['match', ['get', tilesetId]];
    // //console.log(data);
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
    console.log('Entered updateMapOpacity function', [range, this.currentDatasetIndex]);
    const layerOpacity = this.createOpacityExpression(
      this.dataManager.getIndicatorData(this.currentDatasetIndex, this.incomeIndicator),
      DataManager.DatasetKeys[this.currentDatasetIndex].tilesetId,
      range
    );

    this.map.setPaintProperty(
      ChoroplethMap.Metadata[this.currentDatasetIndex].layers.fill.id,
      'fill-opacity',
      layerOpacity
    );
  }

  updateMapPalette() {
    ChoroplethMap.Metadata.forEach((meta, i) => {
      if (this.visibleIndices.includes(i)) {
        this.updateLayerPalette(meta.layers.fill, i);
      }
    });
  }

  updateLayerPalette(fillLayer, level) {
    // Choose between kind of transforms (stored in emissions indicator data)
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
    // console.log('Update income data');
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
      const layerMeta = ChoroplethMap.Metadata[layerIdx];
      const fillLayerId = layerMeta.layers.fill?.id;
      const borderLayerId = layerMeta.layers.border?.id;
      const [minzoom, maxzoom] = zoomLevels[i];

      [fillLayerId, borderLayerId].forEach((layerId, i) => {
        if (!this.map.getLayer(layerId)) {
          this.map.addLayer(
            {
              ...layerMeta.layers.fill,
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

    ChoroplethMap.Metadata.forEach((meta, i) => {
      if (!visibleIndices.includes(i)) {
        if (this.map.getLayer(meta.layers.fill.id)) {
          this.map.removeLayer(meta.layers.fill.id);
        }
      }
    });
  }
}
