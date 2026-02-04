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
 * @param {Object} [datasetLookup] - Pre-computed lookup map for O(1) dataset access
 * @param {Object} [incomeLookup] - Pre-computed lookup map for O(1) income data access
 * @param {Object} [emissionsLookup] - Pre-computed lookup map for O(1) emissions data access
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

  // Get nº Certificates - O(1) with lookup map, O(n) fallback
  const nCerts = datasetLookup
    ? datasetLookup[hoveredPolygonId]?.count
    : datasets[currentDatasetIndex].find(
        (d) => d[valuesByLevel[currentDatasetIndex].id] == hoveredPolygonId
      )?.count;

  const incomeValues = incomeIndicatorData[currentDatasetIndex].values;

  // Income data - O(1) with lookup map, O(n) fallback
  let incomeDataPos, incomeValue;
  if (incomeLookup && incomeLookup[hoveredPolygonId]) {
    incomeDataPos = incomeLookup[hoveredPolygonId].pos;
    incomeValue = incomeLookup[hoveredPolygonId].value;
  } else {
    incomeDataPos = incomeValues.findIndex((obj) => obj.id === hoveredPolygonId);
    incomeValue = incomeDataPos !== -1 ? incomeValues[incomeDataPos].value : null;
  }

  // Emissions data - O(1) with lookup map, O(n) fallback
  let emissionsDataPos, emissionsDataValue;
  if (emissionsLookup && emissionsLookup[hoveredPolygonId]) {
    emissionsDataPos = emissionsLookup[hoveredPolygonId].pos;
    emissionsDataValue = emissionsLookup[hoveredPolygonId].value;
  } else {
    emissionsDataPos = emissionsData.findIndex((obj) => obj.id === hoveredPolygonId);
    emissionsDataValue = emissionsDataPos !== -1 ? emissionsData[emissionsDataPos].emissionsValue : null;
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
