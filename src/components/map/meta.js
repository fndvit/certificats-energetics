export const sourceLayerIds = ['seccen-dgddop', 'municipis-cck7ln', 'comarques-10jgvu'];

export const layers = [
  {
    border: {
      id: 'seccen-line',
      type: 'line',
      source: 'seccen',
      'source-layer': sourceLayerIds[0],
      paint: {
        'line-color': '#000000',
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]
      }
    },
    fill: {
      id: 'seccen-fill',
      type: 'fill',
      source: 'seccen',
      'source-layer': sourceLayerIds[0],
      paint: {
        'fill-opacity': ['case', ['boolean', ['feature-state', 'visible'], true], 1, 0]
      }
    }
  },
  {
    border: {
      id: 'mun-line',
      type: 'line',
      source: 'municipis',
      'source-layer': sourceLayerIds[1],
      paint: {
        'line-color': '#000000',
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]
      }
    },
    fill: {
      id: 'mun-fill',
      type: 'fill',
      source: 'municipis',
      'source-layer': sourceLayerIds[1],
      paint: {
        'fill-opacity': ['case', ['boolean', ['feature-state', 'visible'], true], 1, 0]
      }
    }
  },
  {
    border: {
      id: 'com-line',
      type: 'line',
      source: 'comarques',
      'source-layer': sourceLayerIds[2],
      paint: {
        'line-color': '#000000',
        'line-width': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0]
      }
    },
    fill: {
      id: 'com-fill',
      type: 'fill',
      source: 'comarques',
      'source-layer': sourceLayerIds[2],
      paint: {
        'fill-opacity': ['case', ['boolean', ['feature-state', 'visible'], true], 1, 0]
      }
    }
  }
];

export const sources = [
  {
    id: 'seccen',
    url: 'mapbox://fndvit.3n29djx2',
    layer: sourceLayerIds[0],
    promoteId: 'MUNDISSEC',
    type: 'vector'
  },
  {
    id: 'municipis',
    url: 'mapbox://fndvit.0lp3ykob',
    layer: sourceLayerIds[1],
    promoteId: 'CODIMUNI',
    type: 'vector'
  },
  {
    id: 'comarques',
    url: 'mapbox://fndvit.9mw23qz3',
    layer: sourceLayerIds[2],
    promoteId: 'CODICOMAR',
    type: 'vector'
  }
];
