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

export const clusterIndicatorsMeta = [
  { key: 'qual_energia', name: 'Qualificació energètica', units: '(1–7)', type: 'qual' },
  { key: 'qual_emissions', name: 'Qualificació d\'emissions', units: '(1–7)', type: 'qual' },
  { key: 'emissions_de_co2', name: 'Emissions de CO₂', units: 'kg CO₂/m²', type: 'continuous' }
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

const CLUSTER_RADIUS_EXPR = [
  'interpolate',
  ['linear'],
  ['sqrt', ['get', 'point_count']],
  Math.sqrt(1), 4,
  Math.sqrt(10), 8,
  Math.sqrt(100), 16,
  Math.sqrt(1000), 32,
  Math.sqrt(10000), 64,
  Math.sqrt(100000), 128
];

function clusterPaint(colorExpr, opacity) {
  return {
    'circle-color': colorExpr,
    'circle-radius': CLUSTER_RADIUS_EXPR,
    'circle-opacity': opacity,
    'circle-stroke-width': 1.5,
    'circle-stroke-color': '#fff',
    'circle-stroke-opacity': opacity
  };
}

function pointPaint(colorExpr, opacity) {
  return {
    'circle-color': colorExpr,
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
    this.currentIndicator = clusterIndicatorsMeta[0];
    const { features, emissionsRange } = this._parseData(pointsData);
    this.features = features;
    this.emissionsRange = emissionsRange;
  }

  _parseData(pointsData) {
    const latCol = pointsData.getChild('latitud');
    const lonCol = pointsData.getChild('longitud');
    const qualEnergiaCol = pointsData.getChild('qual_energia');
    const qualEmissionsCol = pointsData.getChild('qual_emissions');
    const emissionsCol = pointsData.getChild('emissions_de_co2');
    const refCol = pointsData.getChild('referencia_cadastral');

    let emissionsMin = Infinity;
    let emissionsMax = -Infinity;

    const features = Array.from({ length: pointsData.numRows }, (_, i) => {
      const emissions = Number(emissionsCol.get(i));
      if (isFinite(emissions)) {
        if (emissions < emissionsMin) emissionsMin = emissions;
        if (emissions > emissionsMax) emissionsMax = emissions;
      }
      return {
        type: 'Feature',
        properties: {
          referencia_cadastral: refCol.get(i),
          qual_energia: Number(qualEnergiaCol.get(i)),
          qual_emissions: Number(qualEmissionsCol.get(i)),
          emissions_de_co2: isFinite(emissions) ? emissions : null
        },
        geometry: {
          type: 'Point',
          coordinates: [Number(lonCol.get(i)), Number(latCol.get(i))]
        }
      };
    });

    return { features, emissionsRange: { min: emissionsMin, max: emissionsMax } };
  }

  _clusterColorExpr(indicator) {
    if (indicator.type === 'qual') {
      return [
        'interpolate', ['linear'],
        ['/', ['get', `sum_${indicator.key}`], ['get', 'point_count']],
        1, qualifColorRange[0],
        2, qualifColorRange[1],
        3, qualifColorRange[2],
        4, qualifColorRange[3],
        5, qualifColorRange[4],
        6, qualifColorRange[5],
        7, qualifColorRange[6]
      ];
    } else {
      const { min, max } = this.emissionsRange;
      return [
        'interpolate', ['linear'],
        ['/', ['get', 'sum_emissions_de_co2'], ['get', 'point_count']],
        min, qualifColorRange[0],
        max, qualifColorRange[6]
      ];
    }
  }

  _pointColorExpr(indicator) {
    if (indicator.type === 'qual') {
      return [
        'match', ['get', indicator.key],
        1, qualifColorRange[0],
        2, qualifColorRange[1],
        3, qualifColorRange[2],
        4, qualifColorRange[3],
        5, qualifColorRange[4],
        6, qualifColorRange[5],
        7, qualifColorRange[6],
        '#d4d4d4'
      ];
    } else {
      const { min, max } = this.emissionsRange;
      return [
        'interpolate', ['linear'],
        ['get', 'emissions_de_co2'],
        min, qualifColorRange[0],
        max, qualifColorRange[6]
      ];
    }
  }

  async onMapLoad() {
    this.map.addSource(SOURCE_ID, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: this.features },
      cluster: true,
      clusterRadius: 80,
      clusterMaxZoom: 22,
      clusterProperties: {
        sum_qual_energia: ['+', ['get', 'qual_energia']],
        sum_qual_emissions: ['+', ['get', 'qual_emissions']],
        sum_emissions_de_co2: ['+', ['coalesce', ['get', 'emissions_de_co2'], 0]]
      }
    });

    const initialClusterColor = this._clusterColorExpr(this.currentIndicator);
    const initialPointColor = this._pointColorExpr(this.currentIndicator);

    this.map.addLayer(
      {
        id: 'cluster-under',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['has', 'point_count'],
        paint: clusterPaint(initialClusterColor, belowRoadsOpacity)
      },
      'tunnel-simple'
    );

    this.map.addLayer(
      {
        id: 'unclustered-under',
        type: 'circle',
        source: SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        paint: pointPaint(initialPointColor, belowRoadsOpacity)
      },
      'tunnel-simple'
    );

    this.map.addLayer({
      id: 'cluster-over',
      type: 'circle',
      source: SOURCE_ID,
      filter: ['has', 'point_count'],
      paint: clusterPaint(initialClusterColor, aboveRoadsOpacity)
    });

    this.map.addLayer({
      id: 'unclustered-over',
      type: 'circle',
      source: SOURCE_ID,
      filter: ['!', ['has', 'point_count']],
      paint: pointPaint(initialPointColor, aboveRoadsOpacity)
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

    // Click: expand cluster or show modal
    this.map.on('click', 'cluster-over', (e) => {
      const feature = e.features[0];
      const clusterId = feature.properties.cluster_id;
      const coords = feature.geometry.coordinates;
      const source = this.map.getSource(SOURCE_ID);

      source.getClusterExpansionZoom(clusterId, (err, zoom) => {
        if (err) return;
        if (zoom > this.map.getMaxZoom()) {
          source.getClusterLeaves(clusterId, Infinity, 0, (err, leaves) => {
            if (err) return;
            const refs = leaves.map(f => f.properties.referencia_cadastral);
            const vals = leaves.map(f => f.properties[this.currentIndicator.key]);
            document.dispatchEvent(new CustomEvent('cluster-click', {
              detail: { refs, vals, indicator: this.currentIndicator },
              bubbles: true
            }));
          });
        } else {
          this.map.easeTo({ center: coords, zoom });
        }
      });
    });

    // Click: show modal for individual point
    this.map.on('click', 'unclustered-over', (e) => {
      const props = e.features[0].properties;
      document.dispatchEvent(new CustomEvent('cluster-click', {
        detail: {
          refs: [props.referencia_cadastral],
          vals: [props[this.currentIndicator.key]],
          indicator: this.currentIndicator
        },
        bubbles: true
      }));
    });

    // Cursor: pointer on clusters and points
    this.map.on('mouseenter', 'cluster-over', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'cluster-over', () => {
      this.map.getCanvas().style.cursor = '';
    });
    this.map.on('mouseenter', 'unclustered-over', () => {
      this.map.getCanvas().style.cursor = 'pointer';
    });
    this.map.on('mouseleave', 'unclustered-over', () => {
      this.map.getCanvas().style.cursor = '';
    });
  }

  setIndicator(indicator) {
    this.currentIndicator = indicator;
    const clusterColor = this._clusterColorExpr(indicator);
    const pointColor = this._pointColorExpr(indicator);

    for (const id of ['cluster-over', 'cluster-under']) {
      if (this.map.getLayer(id)) this.map.setPaintProperty(id, 'circle-color', clusterColor);
    }
    for (const id of ['unclustered-over', 'unclustered-under']) {
      if (this.map.getLayer(id)) this.map.setPaintProperty(id, 'circle-color', pointColor);
    }
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
