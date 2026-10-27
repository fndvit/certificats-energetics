import { emissionsColorScheme, qualifColorScheme } from './colors.js';

export const emissionsIndicatorsMeta = [
  {
    name: "Mitjana d'emissions",
    value: 'mean_emissions',
    binOperation: 'ckmeans',
    colors: emissionsColorScheme,
    colorScaleType: 'categoric',
    units: 'Kg C02',
    info: 'Mitjana de les emissions de CO2 per unitat de superfície de l’habitatge (Kg CO2/m²) calculada a partir de les emissions totals i la superfície construïda de cada habitatge.'
  },
  {
    name: 'Emissions totals',
    value: 'total_emissions',
    binOperation: 'logarithmic',
    colors: emissionsColorScheme,
    colorScaleType: 'categoric',
    units: 'Gg C02',
    info: 'Emissions totals de CO2 per unitat de superfície de l’habitatge (Gg CO2/m²) calculada a partir de les emissions totals i la superfície construïda de cada habitatge.'
  },
  {
    name: "Qualificació mitjana d'energia",
    value: 'mean_energy_qual',
    binOperation: 'ckmeans',
    colors: qualifColorScheme,
    colorScaleType: 'categoric',
    units: '1-7',
    info: ''
  },
  {
    name: "Qualificació mitjana d'emissions",
    value: 'mean_emissions_qual',
    binOperation: 'ckmeans',
    colors: qualifColorScheme,
    colorScaleType: 'categoric',
    units: '1-7',
    info: ''
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
