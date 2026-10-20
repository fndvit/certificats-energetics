# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

An **Observable Framework** project visualizing energy certificate data for Catalonia. The application displays interactive maps with two modes:
- **Choropleth mode**: Aggregated emissions indicators by census section, municipality, or region, filtered by socioeconomic data
- **Cluster/Points mode**: Individual certificate points clustered by energy or emissions qualification

## Commands

```bash
npm install        # Install dependencies
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Build static site to ./dist
npm run deploy     # Deploy to Observable
```

## Architecture

### Data Flow

1. **Raw data** in `src/data/` (generated weekly by `.github/workflows/data-processing.yml`):
   - `certificats-points.parquet` — Individual certificates with coordinates and qualifications
   - Aggregated JSON by level: `seccen_aggregates.json` (census sections), `mun_aggregates.json` (municipalities), `com_aggregates.json` (regions)

2. **Components** in `src/components/`:
   - `map/mapBase.js` — `MapBase` class: initializes Mapbox GL map instance
   - `map/mapManager.js` — `MapManager`: orchestrates choropleth and cluster layers, exposes unified API
   - `map/choroplethLayer.js` — `ChoroplethLayer`: fills/borders at three zoom levels, income opacity filtering
   - `map/clusterLayer.js` — `ClusterLayer`: GeoJSON point clustering, analysis zone stats
   - `map/meta.js` — Layer/source definitions and `sourceLayerIds` for the three Mapbox tilesets
   - `dataProcessing.js` — `getEmissionsIndicatorData`, `getIncomeIndicatorData`, `getEmissionsData`
   - `mapHelpers.js` — `getHoveredInfo`, `getRegionCardData`, `getTickColor`, etc.
   - `indicatorsMeta.js` — `emissionsIndicatorsMeta`, `socEcIndicatorsMeta`
   - `colors.js` — `qualifColorScheme`, `emissionsColorScheme`
   - `sliderState.js` — Singleton preserving slider percentile range across level changes

3. **Pages** in `src/`:
   - `index.md` — Landing page
   - `observatori.md` — Observatory view
   - `eina.md` — Decision tool (main interactive page)

### Map Architecture

The map is composed of three classes:

```
MapManager
├── MapBase          (Mapbox GL instance, access token in mapBase.js:12)
├── ChoroplethLayer  (choropleth fills, hover, click, income opacity)
└── ClusterLayer     (GeoJSON points/clusters, viewport stats)
```

`MapManager.create(container, datasets, pointsData)` is the entry point from `eina.md`.

**Two map modes** (toggled via `map.setMode('choropleth' | 'cluster')`):
- `choropleth` — shows `ChoroplethLayer`, hides `ClusterLayer`
- `cluster` — shows `ClusterLayer`, hides `ChoroplethLayer`

### ChoroplethLayer

- **Three geographic levels**: census sections (seccen), municipalities (mun), regions (com)
- **Zoom-based layer switching**: thresholds in `ChoroplethLayer.SourceLayerZooms`, dynamically adjusted by `updateLayerVisibilityAndZoom()` based on which income indicators have data at each level
- **Income opacity filtering**: features whose income value falls outside the slider range get `visible: false` feature state → `fill-opacity: 0`. Optimized: viewport-only updates for census sections, full update for mun/com
- **Feature states used**: `hover`, `clicked`, `visible`
- **Custom events dispatched**: `map-loaded`, `zoom-level-changed`, `polygon-change`, `polygon-click`
- **O(1) hover performance**: `eina.md` builds `datasetLookup`, `incomeLookup`, `emissionsLookup` Maps for fast tooltip data access

### ClusterLayer

- Source: `certificats-points.parquet` loaded as GeoJSON in `eina.md`, passed to `ClusterLayer`
- Cluster properties aggregated: `sum_qual_energia`, `sum_qual_emissions`, `sum_emissions_de_co2`, `sum_metres_cadastre`
- Two render layers per geometry type (clusters/points), split above/below roads via zoom interpolation on `circle-opacity` at `ZOOM_THRESHOLD = 11`
- **Analysis zone**: a pixel rectangle (set by `map.setClusterAnalysisRect()`) defines the area for viewport stats, shown as a CSS overlay (`cluster-analysis-zone` div) with `box-shadow` to dim outside the zone
- **Viewport stats**: `_computeAndDispatchStats()` fires `cluster-viewport-stats` on pan/zoom/rect change
- **Custom events dispatched**: `cluster-click`, `cluster-viewport-stats`

### Layer Definitions (`map/meta.js`)

Three Mapbox vector tile sources (seccen, municipis, comarques). Fill layers use:
```js
'fill-opacity': ['case', ['boolean', ['feature-state', 'visible'], true], 1, 0]
```
Border layers use `line-width` driven by `hover` and `clicked` feature states.

### Observable Framework Specifics

- **Reactive cells**: code blocks in `.md` files are reactive — they re-run when dependencies change
- **Mutables**: `Mutable()` for values changed by DOM events (e.g., `currentDatasetIndex`, `hoveredPolygonId`, `mapMode`)
- **Custom events**: bridge between Mapbox (imperative) and Observable (reactive) — map fires DOM events, Observable cells listen and update Mutables
- **FileAttachment**: `FileAttachment('./data/file.json').json()` for data loading

## Working with the Map

- Map style: `mapbox://styles/fndvit/clvnpq95k01jg01qz1px52jzf`
- Access token: `src/components/map/mapBase.js:12`
- Three Mapbox vector tile sources defined in `map/meta.js`, each with a `promoteId` for feature state

## Notes

- The project is in **Catalan** — file names, labels, and data use Catalan terminology
- ES modules throughout (`type: "module"` in package.json)
- Requires Node.js >= 18
- Use `npm:` prefix for npm imports in component files: `import * as d3 from 'npm:d3'`
