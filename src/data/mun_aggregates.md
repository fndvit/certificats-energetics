# mun_aggregates.json

| | |
|---|---|
| **Nombre** | `mun_aggregates.json` |
| **Descripción** | Dataset tabular de agregaciones estadísticas de certificados de eficiencia energética de inmuebles residenciales por municipio, extraído del registro oficial de certificados energéticos gestionado por el ICAEN (Institut Català d'Energia), filtrado, validado y agregado mediante estadísticos descriptivos (medias aritméticas y sumas). Cubre los 947 municipios de Cataluña con al menos un certificado registrado, enriquecido con indicadores socioeconómicos de renta procedentes del Atlas de distribución de renta de los hogares del INE (2022): renta media y mediana por unidad de consumo, renta bruta y neta media por hogar y por persona. Cada registro representa un municipio e incorpora métricas de emisiones de CO₂, consumo de energía primaria, calificaciones energéticas (energía y emisiones), superficie construida certificada, coste de certificación y nivel de renta del hogar. |
| **Tamaño medio** | 947 registros · ~633 KB |
| **Frecuencia de actualización** | Semanal para datos energéticos; anual para indicadores de renta (fuente INE) |
| **Metadatos** | Formato: JSON (array de objetos, UTF-8)<br>Fuente certificados: Registre de certificats d'eficiència energètica d'edificis — ICAEN / Portal de dades obertes de la Generalitat de Catalunya<br>Fuente renta: Atlas de distribución de renta de los hogares — INE (2022)<br>Codificación geográfica: Código de población INE (6 dígitos)<br>Método de agregación: Estadísticos descriptivos (media aritmética y suma) por `codi_poblacio`; indicadores de renta incorporados mediante cruce por código INE<br>Redondeo: 3 decimales<br>Pipeline: Procesamiento automatizado (GitHub Actions) |

## Campos

| Nombre del campo | Descripción del campo | Tipo de campo | Anonimizado (S/N) | Proceso de anonimización |
|---|---|---|---|---|
| `codi_poblacio` | Código INE del municipio (6 dígitos) | `string` | N | — |
| `count` | Número de certificados energéticos registrados en el municipio | `number` | S | Agregación estadística por municipio |
| `mean_emissions` | Media de emisiones de CO₂ por unidad de superficie (kgCO₂/m²·año) | `number` | S | Agregación estadística por municipio |
| `total_emissions` | Suma total de emisiones de CO₂ de todos los certificados (kgCO₂/año) | `number` | S | Agregación estadística por municipio |
| `mean_energy_qual` | Media de la calificación de consumo de energía primaria (escala 1–7; 1=A, 7=G) | `number` | S | Agregación estadística por municipio |
| `mean_emissions_qual` | Media de la calificación de emisiones de CO₂ (escala 1–7; 1=A, 7=G) | `number` | S | Agregación estadística por municipio |
| `total_primary_energy` | Suma total del consumo de energía primaria de todos los certificados (kWh/año) | `number` | S | Agregación estadística por municipio |
| `mean_primary_energy` | Media del consumo de energía primaria por unidad de superficie (kWh/m²·año) | `number` | S | Agregación estadística por municipio |
| `total_surface` | Suma total de la superficie certificada en el municipio (m²) | `number` | S | Agregación estadística por municipio |
| `mean_surface` | Media de la superficie de los inmuebles certificados (m²) | `number` | S | Agregación estadística por municipio |
| `total_cost` | Suma total del coste declarado de certificación en el municipio (€) | `number` | S | Agregación estadística por municipio |
| `mean_cost` | Media del coste declarado por certificado (€) | `number` | S | Agregación estadística por municipio |
| `Media de la renta por unidad de consumo_2022` | Media de la renta disponible por unidad de consumo del hogar en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Mediana de la renta por unidad de consumo_2022` | Mediana de la renta disponible por unidad de consumo del hogar en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Renta bruta media por hogar_2022` | Renta bruta media por hogar antes de impuestos y cotizaciones en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Renta bruta media por persona_2022` | Renta bruta media por persona antes de impuestos y cotizaciones en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Renta neta media por hogar_2022` | Renta neta media por hogar después de impuestos y cotizaciones en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Renta neta media por persona_2022` | Renta neta media por persona después de impuestos y cotizaciones en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
