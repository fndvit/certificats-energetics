# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an **Observable Framework** project that visualizes energy certificate data for Catalonia. The application displays interactive choropleth maps showing emissions indicators alongside socioeconomic data at three geographic levels: census sections (seccions censals), municipalities (municipis), and regions (comarques).

## Commands

```bash
# Install dependencies
npm install

# Start development server (opens at http://localhost:3000)
npm run dev

# Build static site to ./dist
npm run build

# Deploy to Observable
npm run deploy

# Run Observable CLI commands
npm run observable
```

## Architecture

### Data Flow

1. **Raw data**: Parquet files in [src/data/](src/data/). These are generated in the /.github/workflows/data-processing.yml workflow
   - `certificats.parquet` - Main energy certificates dataset
   - `municipis.parquet` - Municipality-level data
   - Aggregations at geographic levels: `seccen.json` for cesnus sections, `mun.json` for municipalities, `com.json` for regions.

2. **Components**: Reusable JavaScript modules in [src/components/](src/components/)
   - `map/choropleth.js` - Core `ChoroplethMap` class managing Mapbox GL interactive maps
   - `dataProcessing.js` - Data processing functions for emissions and income indicators
   - `mapHelpers.js` - Helper utilities for hover info, geographic name parsing, and color scales
   - `indicatorsMeta.js` - Metadata for emissions and socioeconomic indicators
   - `colors.js` - Color scheme definitions

3. **Pages**: Markdown files in [src/](src/) that compose the application
   - `index.md` - Landing page
   - `observatori.md` - Observatory view
   - `eina.md` - Decision tool with interactive map

### Key Components

#### ChoroplethMap Class ([src/components/map/choropleth.js](src/components/map/choropleth.js))

The central component managing the interactive map visualization:

- **DataManager**: Handles data access for different geographic levels
- **Three-level zoom system**: Automatically switches between census sections (zoom 11-22), municipalities (zoom 8.5-11), and regions (zoom 0-8.5)
- **Dual indicators**: Simultaneously displays emissions data via color and filters by socioeconomic data via opacity
- **Custom events**: Dispatches `map-loaded`, `zoom-level-changed`, and `polygon-change` events for coordination with UI controls

Key methods:
- `initializeData()` - Initialize both emissions and income indicators
- `updateMapPalette()` - Update colors based on emissions indicator changes
- `setMapOpacity()` / `updateMapOpacity()` - Filter features by income range
- `updateLayerVisibilityAndZoom()` - Adjust visible layers when income indicator availability changes across levels

#### Data workflow ([.github/workflows]

A workflow runs every sunday to fetch for the newest data via an open data portal endpoint. The data is then treated inside `data_processing.py`. There, aggregates at the different geographic levels are computed to feed the map.

#### Indicator Metadata ([src/components/indicatorsMeta.js](src/components/indicatorsMeta.js))

Defines available indicators with their properties:
- `emissionsIndicatorsMeta` - Mean/total emissions, energy/emissions qualifications with binning strategies
- `socEcIndicatorsMeta` - Income indicators with availability flags per geographic level

### Observable Framework Specifics

- **File-based routing**: Each `.md` file in `src/` becomes a page
- **Reactive cells**: Code blocks in Markdown files are reactive JavaScript cells
- **Mutables**: Observable's state management using `Mutable()` for values that change (e.g., current zoom level, hovered polygon)
- **FileAttachment**: Load data files with `FileAttachment('./data/file.json').json()`
- **Custom events**: Components communicate via DOM events since Observable cells can't directly share references

## Working with the Map

The map uses **Mapbox GL JS** with custom vector tiles hosted on Mapbox. The access token is embedded in [src/components/map/choropleth.js:58-59](src/components/map/choropleth.js#L58-L59).

When modifying map behavior:
1. The map style is `mapbox://styles/fndvit/clvnpq95k01jg01qz1px52jzf`
2. Three sources are defined in `map/meta.js` corresponding to the three geographic levels
3. Feature state is used for hover effects and opacity filtering
4. Zoom-based layer visibility is critical - respect the `ChoroplethMap.SourceLayerZooms` ranges

## Notes

- The project is in Catalan - file names, labels, and data use Catalan terminology
- Currently working on a new layout (`eina.md`) with updated styling.
- The codebase uses ES modules (`type: "module"` in package.json)
- Requires Node.js >= 18

## Recent Refactors

A 5-phase refactor was completed:
- **Phase 1-2**: Extracted helper functions from `eina.md` into reusable modules (`dataProcessing.js`, `mapHelpers.js`), reducing code by ~200 lines
- **Phase 3-4**: Optimized map performance by implementing O(1) hash map lookups for hover interactions, achieving ~500x improvement on census sections
- **Phase 5**: Code cleanup - removed commented code, unused imports, added JSDoc comments, improved consistency

**Viewport-based rendering optimization** (2026-02-11):
- Implemented viewport-based feature state updates in `setMapOpacity()` and `updateMapOpacity()`
- Only processes features visible in the current viewport (~100-500 instead of ~15,000 for census sections)
- Achieves ~30-150x improvement on slider interactions at the census section level
- Added `moveend` event handler to update opacity for newly visible features when panning
