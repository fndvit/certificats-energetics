import * as d3 from 'npm:d3';

/**
 * Parses geographic codes to human-readable names.
 * Handles census sections, municipalities, and regions.
 *
 * @param {string} hoveredPolygon - Geographic code (varies by level)
 * @param {number} currentDatasetIndex - Level index (0=seccen, 1=mun, 2=com)
 * @param {Object} municipisDict - Municipality lookup dictionary
 * @returns {string[]} Array of [districtCode, sectionCode, municipiName, comarcaName]
 */
export function getHoveredNames(hoveredPolygon, currentDatasetIndex, municipisDict) {
  if (hoveredPolygon) {
    const sectionCode = currentDatasetIndex == 0 ? hoveredPolygon.slice(-3) : '';
    const districtCode = currentDatasetIndex == 0 ? hoveredPolygon.slice(6, 8) : '';
    const municipiCode =
      currentDatasetIndex == 0
        ? hoveredPolygon.slice(0, -5)
        : currentDatasetIndex == 1
          ? hoveredPolygon
          : '';

    if (municipisDict[municipiCode]) {
      const municipiName =
        currentDatasetIndex == 0 || currentDatasetIndex == 1
          ? municipisDict[municipiCode].municipi
          : '';
      const comarcaName =
        currentDatasetIndex == 2
          ? municipisDict.find((d) => d.codi_comarca == hoveredPolygon).comarca
          : municipisDict[municipiCode].comarca;

      return [districtCode, sectionCode, municipiName, comarcaName];
    }
  }
  return [''];
}

/**
 * Aggregates all data for a hovered polygon (used for tooltips/cards).
 * Retrieves emissions data, income data, position in rankings, and certificate count.
 *
 * @param {string} hoveredPolygonId - ID of the hovered feature
 * @param {number} currentDatasetIndex - Level index (0=seccen, 1=mun, 2=com)
 * @param {Array} datasets - Array of datasets
 * @param {Array} valuesByLevel - Geographic level ID configurations
 * @param {Array} incomeIndicatorData - Processed income data
 * @param {Array} emissionsData - Processed emissions data (from getEmissionsData)
 * @param {Object} municipisDict - Municipality lookup dictionary
 * @param {Map} [datasetLookup] - Pre-computed lookup Map for O(1) dataset access
 * @param {Map} [incomeLookup] - Pre-computed lookup Map for O(1) income data access
 * @param {Map} [emissionsLookup] - Pre-computed lookup Map for O(1) emissions data access
 * @returns {Object} {names, incomeData, emissionsData, nCerts}
 */
export function getHoveredInfo(
  hoveredPolygonId,
  currentDatasetIndex,
  datasets,
  valuesByLevel,
  incomeIndicatorData,
  emissionsData,
  municipisDict,
  datasetLookup = null,
  incomeLookup = null,
  emissionsLookup = null
) {
  const names = getHoveredNames(hoveredPolygonId, currentDatasetIndex, municipisDict);

  // Get nº Certificates - O(1) with lookup Map, O(n) fallback
  const nCerts = datasetLookup
    ? datasetLookup.get(hoveredPolygonId)?.count
    : datasets[currentDatasetIndex].find(
        (d) => d[valuesByLevel[currentDatasetIndex].id] == hoveredPolygonId
      )?.count;

  const incomeValues = incomeIndicatorData[currentDatasetIndex].values;

  // Income data - O(1) with lookup Map, O(n) fallback
  let incomeDataPos, incomeValue;
  const incomeData = incomeLookup?.get(hoveredPolygonId);
  if (incomeData) {
    incomeDataPos = incomeData.pos;
    incomeValue = incomeData.value;
  } else {
    incomeDataPos = incomeValues.findIndex((obj) => obj.id === hoveredPolygonId);
    incomeValue = incomeDataPos !== -1 ? incomeValues[incomeDataPos].value : null;
  }

  // Emissions data - O(1) with lookup Map, O(n) fallback
  let emissionsDataPos, emissionsDataValue;
  const emissionsDataEntry = emissionsLookup?.get(hoveredPolygonId);
  if (emissionsDataEntry) {
    emissionsDataPos = emissionsDataEntry.pos;
    emissionsDataValue = emissionsDataEntry.value;
  } else {
    emissionsDataPos = emissionsData.findIndex((obj) => obj.id === hoveredPolygonId);
    emissionsDataValue =
      emissionsDataPos !== -1 ? emissionsData[emissionsDataPos].emissionsValue : null;
  }

  return {
    names,
    incomeData: { value: incomeValue, pos: incomeDataPos, totalValues: incomeValues.length },
    emissionsData: {
      value: emissionsDataValue,
      pos: emissionsDataPos,
      totalValues: emissionsData.length
    },
    nCerts
  };
}

/**
 * Creates a D3 threshold scale for tick colors.
 *
 * @param {number} val - Value to map to color
 * @param {Object} emissionsIndicator - Emissions indicator with colors property
 * @returns {string} Color hex code
 */
export function getTickColor(val, emissionsIndicator) {
  return d3.scaleThreshold(
    Array.from({ length: 7 }, (_, i) => i),
    emissionsIndicator.colors
  )(val);
}

/**
 * Converts first character of string to lowercase.
 *
 * @param {string} str - Input string
 * @returns {string} String with lowercase first character
 */
export function lowercaseFirstLetter(str) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

/**
 * Calculates ranking position for a feature within a dataset.
 * @param {string} featureId - Feature ID to rank
 * @param {Array} data - Array of {id, value} or {id, emissionsValue}
 * @param {string} valueKey - Key to use for value ('value' or 'emissionsValue')
 * @param {boolean} reverseRank - If true, higher values get lower rank numbers (default: false)
 * @returns {Object|null} {position, total, percentile} or null if not found
 */
function calculateRanking(featureId, data, valueKey = 'value', reverseRank = false) {
  if (!data || data.length === 0) return null;

  // Find position (data is already sorted ascending)
  const position = data.findIndex((d) => d.id === featureId);

  if (position === -1) return null;

  const total = data.length;

  // If reverseRank is true, higher values (higher position) get lower rank numbers
  const rank = reverseRank ? total - position : position + 1;

  // Calculate percentile (higher values = higher percentile)
  const percentile =
    total > 1
      ? Math.round((position / (total - 1)) * 1000) / 10 // Round to 1 decimal
      : 50;

  return {
    position: rank,
    total,
    percentile
  };
}

/**
 * Gets comprehensive region data for the clicked feature card.
 * Includes all energy/emissions/buildings indicators and rankings.
 *
 * @param {string} featureId - ID of the clicked feature
 * @param {number} level - Geographic level index (0=seccen, 1=mun, 2=com)
 * @param {Array} incomeIndicatorData - Processed income data with sorted values
 * @param {Array} emissionsData - Processed emissions data (sorted)
 * @param {Object} municipisDict - Municipality lookup dictionary
 * @param {Map} datasetLookup - Pre-computed dataset lookup by feature ID
 * @returns {Object|null} Complete region data for card display
 */
export function getRegionCardData(
  featureId,
  level,
  incomeIndicatorData,
  emissionsData,
  municipisDict,
  datasetLookup
) {
  const names = getHoveredNames(featureId, level, municipisDict);

  // Get raw data for this feature using O(1) lookup
  const rawData = datasetLookup.get(featureId);

  if (!rawData) return '';

  // Extract all energy/emissions/buildings indicators
  const indicators = {
    count: rawData.count,
    meanEmissions: rawData.mean_emissions,
    totalEmissions: rawData.total_emissions,
    meanEnergyQual: rawData.mean_energy_qual,
    meanEmissionsQual: rawData.mean_emissions_qual,
    totalPrimaryEnergy: rawData.total_primary_energy,
    meanPrimaryEnergy: rawData.mean_primary_energy,
    totalSurface: rawData.total_surface,
    meanSurface: rawData.mean_surface,
    totalCost: rawData.total_cost,
    meanCost: rawData.mean_cost
  };

  // Calculate rankings for selected indicators
  // Income ranking (only if level < 2, since regions don't have income data)
  // reverseRank=true because higher income should have lower rank number
  const incomeRanking =
    level < 2 && incomeIndicatorData[level]?.values
      ? calculateRanking(featureId, incomeIndicatorData[level].values, 'value', true)
      : null;

  // Emissions ranking
  const emissionsRanking = calculateRanking(featureId, emissionsData, 'emissionsValue');

  return {
    id: featureId,
    names,
    indicators,
    rankings: {
      income: incomeRanking,
      emissions: emissionsRanking
    }
  };
}
