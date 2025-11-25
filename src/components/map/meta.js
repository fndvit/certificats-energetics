export const sourcesLayers = [
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
