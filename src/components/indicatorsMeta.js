import { mapColorScheme, qualifColorRange } from './colors.js';

export const emissionsIndicatorsMeta = [
  {
    name: "Mitjana d'emissions",
    value: 'mean_emissions',
    binOperation: 'ckmeans',
    colors: mapColorScheme,
    colorScaleType: 'categoric',
    units: 'Kg C02'
  },
  {
    name: 'Emissions totals',
    value: 'total_emissions',
    binOperation: 'logarithmic',
    colors: mapColorScheme,
    colorScaleType: 'categoric',
    units: 'Gg C02'
  },
  {
    name: "Qualificació mitjana d'energia",
    value: 'mean_energy_qual',
    binOperation: 'ckmeans',
    colors: qualifColorRange,
    colorScaleType: 'categoric',
    units: '1-7'
  },
  {
    name: "Qualificació mitjana d'emissions",
    value: 'mean_emissions_qual',
    binOperation: 'ckmeans',
    colors: qualifColorRange,
    colorScaleType: 'categoric',
    units: '1-7'
  }
];

export const socEcIndicatorsMeta = [
  {
    name: 'Mitjana de la renda per unitat de consum (2022)',
    value: 'Media de la renta por unidad de consumo_2022',
    units: '€',
    levels: [true, true, false]
  },
  {
    name: 'Mediana de la renda per unitat de consum (2022)',
    value: 'Mediana de la renta por unidad de consumo_2022',
    units: '€',
    levels: [true, true, false]
  }
];
