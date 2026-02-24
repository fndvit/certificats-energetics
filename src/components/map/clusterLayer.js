import { qualifColorRange } from '../colors.js';

const ZOOM_THRESHOLD = 11;
const SOURCE_ID = 'certificates-points';
const LAYER_IDS = [
  'cluster-under',
  'cluster-over',
  'unclustered-under',
  'unclustered-over',
  'cluster-count'
];

const belowRoadsOpacity = [
  'interpolate',
  ['linear'],
  ['zoom'],
  ZOOM_THRESHOLD - 1,
  1,
  ZOOM_THRESHOLD,
  0
];
const aboveRoadsOpacity = [
  'interpolate',
  ['linear'],
  ['zoom'],
  ZOOM_THRESHOLD - 1,
  0,
  ZOOM_THRESHOLD,
  1
];

function clusterPaint(opacity) {
  return {
    'circle-color': [
      'interpolate',
      ['linear'],
      ['/', ['get', 'sum'], ['get', 'point_count']],
      1,
      qualifColorRange[0],
      2,
      qualifColorRange[1],
      3,
      qualifColorRange[2],
      4,
      qualifColorRange[3],
      5,
      qualifColorRange[4],
      6,
      qualifColorRange[5],
      7,
      qualifColorRange[6]
    ],
    'circle-radius': [
      'interpolate',
      ['linear'],
      ['sqrt', ['get', 'point_count']],
      Math.sqrt(1),
      4,
      Math.sqrt(10),
      8,
      Math.sqrt(100),
      16,
      Math.sqrt(1000),
      32,
      Math.sqrt(10000),
      64,
      Math.sqrt(100000),
      128
    ],
    'circle-opacity': opacity,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#fff',
    'circle-stroke-opacity': opacity
  };
}

function pointPaint(opacity) {
  return {
    'circle-color': [
      'match',
      ['get', 'val'],
      1,
      qualifColorRange[0],
      2,
      qualifColorRange[1],
      3,
      qualifColorRange[2],
      4,
      qualifColorRange[3],
      5,
      qualifColorRange[4],
      6,
      qualifColorRange[5],
      7,
      qualifColorRange[6],
      '#d4d4d4'
    ],
    'circle-radius': 5,
    'circle-opacity': opacity,
    'circle-stroke-width': 1,
    'circle-stroke-color': '#fff',
    'circle-stroke-opacity': opacity
  };
}

export class ClusterLayer {
  constructor(mapBase, pointsData) {
    this.map = mapBase.map;
    this.features = this._arrowToGeoJSON(pointsData);
  }

  _arrowToGeoJSON(pointsData) {
    const latCol = pointsData.getChild('latitud');
    const lonCol = pointsData.getChild('longitud');
    const valCol = pointsData.getChild('val');
    const refCol = pointsData.getChild('referencia_cadastral');

    return Array.from({ length: pointsData.numRows }, (_, i) => ({
      type: 'Feature',
      properties: {
        referencia_cadastral: refCol.get(i),
        val: Number(valCol.get(i))
      },
      geometry: {
        type: 'Point',
        coordinates: [Number(lonCol.get(i)), Number(latCol.get(i))]
      }
    }));
  }

  async onMapLoad() {
    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: this.features },
      cluster: true,
      clusterRadius: 80,
      clusterMaxZoom: 22,
      clusterProperties: { sum: ['+', ['get', 'val']] }
    });

    this.map.addLayer(
      {
        id: 'cluster-under',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: clusterPaint(belowRoadsOpacity)
      },
      'tunnel-simple'
    );

    this.map.addLayer(
      {
        id: 'unclustered-under',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: pointPaint(belowRoadsOpacity)
      },
      'tunnel-simple'
    );

    this.map.addLayer({
      id: 'cluster-over',
      type: 'circle',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: clusterPaint(aboveRoadsOpacity)
    });

    this.map.addLayer({
      id: 'unclustered-over',
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: pointPaint(aboveRoadsOpacity)
    });

    this.map.addLayer({
      id: 'cluster-count',
      type: 'symbol',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      layout: {
        'text-field': '{point_count_abbreviated}',
        'text-size': 12,
        'text-font': ['DIN Offc Pro Medium', 'Arial Unicode MS Bold']
      },
      paint: { 'text-color': '#ffffff' }
    });
  }

  show() {
    LAYER_IDS.forEach((id) => {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', 'visible');
    });
  }

  hide() {
    LAYER_IDS.forEach((id) => {
      if (this.map.getLayer(id)) this.map.setLayoutProperty(id, 'visibility', 'none');
    });
  }

  destroy() {
    LAYER_IDS.forEach((id) => {
      if (this.map.getLayer(id)) this.map.removeLayer(id);
    });
    if (this.map.getSource(SOURCE_ID)) this.map.removeSource(SOURCE_ID);
  }
}
