# seccen_aggregates.json

| | |
|---|---|
| **Nombre** | `seccen_aggregates.json` |
| **Descripción** | Dataset tabular de agregaciones estadísticas de certificados de eficiencia energética de inmuebles residenciales por sección censal, extraído del registro oficial de certificados energéticos gestionado por el ICAEN (Institut Català d'Energia), filtrado, validado y agregado mediante estadísticos descriptivos (medias aritméticas y sumas) a la máxima resolución espacial disponible. Cubre las 5.156 secciones censales de Cataluña con al menos un certificado registrado, enriquecido con indicadores socioeconómicos de renta procedentes del Atlas de distribución de renta de los hogares del INE (2022): renta media y mediana por unidad de consumo, renta bruta y neta media por hogar y por persona. Cada registro representa una sección censal, identificada mediante el código MUNDISSEC de 11 dígitos de Idescat, e incorpora métricas de emisiones de CO₂, consumo de energía primaria, calificaciones energéticas (energía y emisiones), superficie construida certificada, coste de certificación y nivel de renta del hogar, permitiendo análisis de correlación entre eficiencia energética y condición socioeconómica a escala inframunicipal. |
| **Tamaño medio** | 5 156 registros · ~3,4 MB |
| **Frecuencia de actualización** | Semanal para datos energéticos; anual para indicadores de renta (fuente INE) |
| **Metadatos** | Formato: JSON (array de objetos, UTF-8)<br>Fuente certificados: Registre de certificats d'eficiència energètica d'edificis — ICAEN / Portal de dades obertes de la Generalitat de Catalunya<br>Fuente renta: Atlas de distribución de renta de los hogares — INE (2022)<br>Codificación geográfica: MUNDISSEC — código Idescat de sección censal (11 dígitos: 6 municipio + 5 distrito/sección), asignado mediante unión espacial con la cartografía de secciones censales de Idescat (01-01-2024)<br>Método de agregación: Estadísticos descriptivos (media aritmética y suma) por `MUNDISSEC`; indicadores de renta incorporados mediante cruce con códigos INE convertidos al formato Idescat<br>Redondeo: 3 decimales<br>Pipeline: Procesamiento automatizado (GitHub Actions) |

## Campos

| Nombre del campo | Descripción del campo | Tipo de campo | Anonimizado (S/N) | Proceso de anonimización |
|---|---|---|---|---|
| `MUNDISSEC` | Código Idescat de la sección censal (11 dígitos: 6 municipio + 5 distrito/sección). Asignado mediante unión espacial con la cartografía de secciones censales de Idescat (01-01-2024) | `string` | N | — |
| `count` | Número de certificados energéticos registrados en la sección censal | `number` | S | Agregación estadística por sección censal |
| `mean_emissions` | Media de emisiones de CO₂ por unidad de superficie (kgCO₂/m²·año) | `number` | S | Agregación estadística por sección censal |
| `total_emissions` | Suma total de emisiones de CO₂ de todos los certificados (kgCO₂/año) | `number` | S | Agregación estadística por sección censal |
| `mean_energy_qual` | Media de la calificación de consumo de energía primaria (escala 1–7; 1=A, 7=G) | `number` | S | Agregación estadística por sección censal |
| `mean_emissions_qual` | Media de la calificación de emisiones de CO₂ (escala 1–7; 1=A, 7=G) | `number` | S | Agregación estadística por sección censal |
| `total_primary_energy` | Suma total del consumo de energía primaria de todos los certificados (kWh/año) | `number` | S | Agregación estadística por sección censal |
| `mean_primary_energy` | Media del consumo de energía primaria por unidad de superficie (kWh/m²·año) | `number` | S | Agregación estadística por sección censal |
| `total_surface` | Suma total de la superficie certificada en la sección censal (m²) | `number` | S | Agregación estadística por sección censal |
| `mean_surface` | Media de la superficie de los inmuebles certificados (m²) | `number` | S | Agregación estadística por sección censal |
| `total_cost` | Suma total del coste declarado de certificación en la sección censal (€) | `number` | S | Agregación estadística por sección censal |
| `mean_cost` | Media del coste declarado por certificado (€) | `number` | S | Agregación estadística por sección censal |
| `Media de la renta por unidad de consumo_2022` | Media de la renta disponible por unidad de consumo del hogar en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Mediana de la renta por unidad de consumo_2022` | Mediana de la renta disponible por unidad de consumo del hogar en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Renta bruta media por hogar_2022` | Renta bruta media por hogar antes de impuestos y cotizaciones en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Renta bruta media por persona_2022` | Renta bruta media por persona antes de impuestos y cotizaciones en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Renta neta media por hogar_2022` | Renta neta media por hogar después de impuestos y cotizaciones en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
| `Renta neta media por persona_2022` | Renta neta media por persona después de impuestos y cotizaciones en 2022 (€) | `number` | N | Dato publicado por el INE de forma agregada |
