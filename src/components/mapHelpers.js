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
 * @returns {Object} {names, incomeData, emissionsData, nCerts}
 */
export function getHoveredInfo(
  hoveredPolygonId,
  currentDatasetIndex,
  datasets,
  valuesByLevel,
  incomeIndicatorData,
  emissionsData,
  municipisDict
) {
  const names = getHoveredNames(hoveredPolygonId, currentDatasetIndex, municipisDict);

  // Get nº Certificates
  const nCerts = datasets[currentDatasetIndex].find(
    (d) => d[valuesByLevel[currentDatasetIndex].id] == hoveredPolygonId
  )?.count;

  const incomeValues = incomeIndicatorData[currentDatasetIndex].values;
  const incomeDataPos = incomeValues.findIndex((obj) => obj.id === hoveredPolygonId);
  const incomeValue = incomeDataPos !== -1 ? incomeValues[incomeDataPos].value : null;

  const emissionsDataPos = emissionsData.findIndex((obj) => obj.id === hoveredPolygonId);
  const emissionsDataValue =
    emissionsDataPos !== -1 ? emissionsData[emissionsDataPos].emissionsValue : null;

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
