import { bin, mean, min, quantile, range } from 'd3-array';
import mapboxgl from 'npm:mapbox-gl';
import { ckmeans } from 'simple-statistics';
import { mapThresholdScheme } from './colors.js';

class DataManager {
  /* ------------------
   Datasets
   [seccen, mun, com] 
   ------------------
  */
  static DatasetKeys = ['MUNDISSEC', 'CODIMUNI', 'CODICOMAR'];

  ckMeansThresholds = [];

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
      id: d[DataManager.DatasetKeys[level]],
      value: d[indicator]
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
        borders: {},
        fill: {}
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
        borders: {},
        fill: {}
      }
    }
  ];

  emissionsIndicator = '';
  incomeIndicator = '';

  layerColor = [];
  layerOpacity = [];

  constructor(container, datasets) {
    this.accessToken =
      'pk.eyJ1IjoiZm5kdml0IiwiYSI6ImNrYzBzYjhkMDBicG4yc2xrbnMzNXVoeDIifQ.mrdvw_7AIeOwa5IgHLaHJg';

    this.dataManager = new DataManager(datasets);

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
  }

  static create(container, datasets) {
    return new ChoroplethMap(container, datasets);
  }

  destroy() {
    this.map.remove();
  }

  async onMapLoad() {
    this.map
      .addSource(ChoroplethMap.Metadata[0].source.id, ChoroplethMap.Metadata[0].source)
      .addLayer(ChoroplethMap.Metadata[0].layers.fill, 'tunnel-simple')
      .addControl(
        new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
        'top-right'
      );

    // //console.log(
    //   'Layers:',
    //   this.map.getStyle().layers.map((l) => l.id)
    // );
    // //console.log('Sources:', this.map.getStyle().sources);

    document.dispatchEvent(new Event('map-loaded', { bubbles: true }));
  }

  /**
   * Creates a color step expression.
   * @param {{id: string, value: number}[]} data
   * @param {string} tilesetId
   * @param {{domain: number[], range: string[]}} scheme
   */
  createColorExpression(data, tilesetId, scheme) {
    console.log('Create color args', { data, tilesetId, scheme });
    const { domain, range } = scheme;
    const colors = range.flatMap((color, index) => {
      return index < domain.length ? [color, domain[index]] : [color];
    });

    const colorExpression = ['step', ...colors];
    const matchExpression = ['match', ['get', tilesetId]];
    data.forEach((entry) => {
      matchExpression.push(entry.id, entry.value);
    });
    matchExpression.push(0);

    colorExpression.splice(1, 0, matchExpression);

    //console.log(colorExpression);

    return colorExpression;
  }

  /**
   * Creates a range treshold opacity expression.
   * Features out of the range will be transparent.
   * @param {{id: string, value: number}[]} data
   * @param {string} tilesetId
   * @param {number[]} range
   */
  createOpacityExpression(data, tilesetId, range) {
    // console.log('Range', range);
    const matchExpression = ['match', ['get', tilesetId]];
    // console.log(data);
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
          'all',
          ['>=', ['var', 'indicatorValue'], range[0]],
          ['<=', ['var', 'indicatorValue'], range[1]]
        ],
        1,
        0
      ]
    ];
  }

  /**
   * Updates the map colors based on the emissions indicator data
   */
  updateMapPalette() {
    this.layerColor = this.createColorExpression(
      this.dataManager.getIndicatorData(0, this.emissionsIndicator),
      DataManager.DatasetKeys[0],
      { domain: this.dataManager.ckMeansThresholds, range: mapThresholdScheme }
    );

    this.map.setPaintProperty('seccen-fill', 'fill-color', this.layerColor);
  }

  /**
   * Update map opacity based on an income value range.
   * @param {number[]} range - An array of two integers: [min, max]
   */
  updateMapOpacity(range) {
    // console.log('Entered updateMapOpacity function', range);
    this.layerOpacity = this.createOpacityExpression(
      this.dataManager.getIndicatorData(0, this.incomeIndicator),
      DataManager.DatasetKeys[0],
      range
    );

    this.map.setPaintProperty('seccen-fill', 'fill-opacity', this.layerOpacity);
  }

  updateEmissionsData(emissionsIndicator, ckmeansThresholds) {
    console.log('Init update emissions data', ckmeansThresholds);
    if (this.emissionsIndicator != emissionsIndicator) {
      console.log('Entered if');
      this.dataManager.ckMeansThresholds = ckmeansThresholds;
      this.emissionsIndicator = emissionsIndicator;
      this.updateMapPalette();
    }
  }

  updateIncomeData(incomeIndicator, incomeIndicatorStats) {
    console.log('Initi update income data', { incomeIndicator, incomeIndicatorStats });
    if (this.incomeIndicator != incomeIndicator) {
      // this.dataManager.updateIncomeData(incomeIndicator);
      this.incomeIndicator = incomeIndicator;
      this.updateMapOpacity([incomeIndicatorStats.q1, incomeIndicatorStats.q3]);
    }
  }

  /**
   * Indicator mean value getter
   */
  get incomeIndicatorMeanValue() {
    return this.dataManager.incomeIndicatorMean;
  }
}
