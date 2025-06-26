import { bin, mean, min } from 'd3-array';
import mapboxgl from 'npm:mapbox-gl';
import { ckmeans } from 'simple-statistics';
// import { mapThresholdScheme } from './components/colors.js';

class DataManager {
  static DatasetKeys = ['MUNDISSEC', 'CODIMUNI', 'CODICOMAR'];

  /* ------------------
   Datasets
   [seccen, mun, com] 
   ------------------
  */
  emissionsCKMeans = [];
  ckMeansThresholds = [];
  incomeIndicatorMeanValue = 0;

  constructor(datasets) {
    this.datasets = datasets;
  }

  updateData(emissionsIndicator, incomeIndicator) {
    console.log('Update Data Start ---------------------');
    console.log('Datasets:', this.datasets);
    console.log('Emissions indicator:', emissionsIndicator);

    let emissionsIndicatorArray = this.datasets[0].map((d) => d[emissionsIndicator]);

    this.incomeIndicatorMeanValue = mean(this.datasets[0].map((d) => d[incomeIndicator]));

    this.emissionsCKMeans = bin()
      .thresholds(ckmeans(emissionsIndicatorArray, 7).map((d) => min(d)))
      .value((d) => d)(emissionsIndicatorArray);

    this.ckMeansThresholds = this.emissionsCKMeans
      .map((d) => d.x1)
      .slice(0, this.emissionsCKMeans.length - 1);

    // return this.datasets[level].map((d) => ({
    //   code: d[DataManager.DatasetKeys[level]],
    //   valueA: d[indicatorA],
    //   valueB: d[indicatorB]
    // }));
    console.log('Income Indicator Mean Value:', this.incomeIndicatorMeanValue);
    console.log('Emissions CKMeans:', this.emissionsCKMeans);
    console.log('CKMeans Thresholds:', this.ckMeansThresholds);
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
    zoom: 6.5,
    minZoom: 6.5,
    maxZoom: 14,
    center: [2.5, 41.5]
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
      accessToken: this.accessToken,
      style: 'mapbox://styles/fndvit/clvnpq95k01jg01qz1px52jzf'
    });

    this.map.on('load', () => this.onMapLoad());

    //   this.map.on('load', () => {
    //     this.map.addSource('seccen', {
    //       type: 'geojson',
    //       data: options.geojson,
    //       generateId: true
    //     });

    //     this.map.addLayer({
    //       id: 'choropleth',
    //       type: 'fill',
    //       source: 'seccen',
    //       paint: {
    //         'fill-color': options.colorExpr,
    //         'fill-opacity': [
    //           'case',
    //           ['boolean', ['feature-state', 'visible'], false],
    //           1,
    //           0.1
    //         ]
    //       }
    //     });

    //     this.updateOpacity(options.threshold || 0);
    //   });
  }

  // updateOpacity(threshold) {
  //   const features = this.map.getSource('seccen')._data.features;
  //   for (const f of features) {
  //     const visible = f.properties.renta > threshold;
  //     this.map.setFeatureState(
  //       { source: 'seccen', id: f.id },
  //       { visible }
  //     );
  //   }
  // }

  static create(container, datasets) {
    return new ChoroplethMap(container, datasets);
  }

  destroy() {
    this.map.remove();
  }

  updateData(emissionsIndicator, incomeIndicator) {
    if (this.emissionsIndicator != emissionsIndicator || this.incomeIndicator != incomeIndicator) {
      this.dataManager.updateData(emissionsIndicator, incomeIndicator);
    }
  }

  async onMapLoad() {
    this.map
      .addSource(ChoroplethMap.Metadata[0].source.id, ChoroplethMap.Metadata[0].source)
      .addLayer(ChoroplethMap.Metadata[0].layers.fill)
      .addControl(
        new mapboxgl.NavigationControl({ showCompass: false, showZoom: true }),
        'top-right'
      );

    // console.log(
    //   'Layers:',
    //   this.map.getStyle().layers.map((l) => l.id)
    // );
    // console.log('Sources:', this.map.getStyle().sources);

    this.updateData(ChoroplethMap.InitialIndicators[0], ChoroplethMap.InitialIndicators[1]);
  }

  get incomeIndicatorMeanValue() {
    return this.dataManager.incomeIndicatorMeanValue;
  }
}
