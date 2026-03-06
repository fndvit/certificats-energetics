# com_aggregates.json

| | |
|---|---|
| **Nombre** | `com_aggregates.json` |
| **Descripción** | Dataset tabular de agregaciones estadísticas de certificados de eficiencia energética de inmuebles residenciales por comarca, extraído del registro oficial de certificados energéticos gestionado por el ICAEN (Institut Català d'Energia), filtrado, validado y agregado mediante estadísticos descriptivos (medias aritméticas y sumas). Cubre las 42 comarcas de Cataluña con al menos un certificado registrado e incorpora métricas de emisiones de CO₂, consumo de energía primaria, calificaciones energéticas (energía y emisiones), superficie construida certificada y coste de certificación. Cada registro representa una comarca y agrega la totalidad de los certificados vigentes asociados a su ámbito territorial. |
| **Tamaño medio** | 42 registros · ~16 KB |
| **Frecuencia de actualización** | Semanal (pipeline automatizado) |
| **Metadatos** | Formato: JSON (array de objetos, UTF-8)<br>Fuente certificados: Registre de certificats d'eficiència energètica d'edificis — ICAEN / Portal de dades obertes de la Generalitat de Catalunya<br>Codificación geográfica: Codi comarca Idescat (2 dígitos)<br>Método de agregación: Estadísticos descriptivos (media aritmética y suma) por `codi_comarca`<br>Redondeo: 3 decimales<br>Pipeline: Procesamiento automatizado (GitHub Actions) |

## Campos

| Nombre del campo | Descripción del campo | Tipo de campo | Anonimizado (S/N) | Proceso de anonimización |
|---|---|---|---|---|
| `codi_comarca` | Código identificador de la comarca (Idescat) | `string` | N | — |
| `count` | Número de certificados energéticos registrados en la comarca | `number` | S | Agregación estadística por comarca |
| `mean_emissions` | Media de emisiones de CO₂ por unidad de superficie (kgCO₂/m²·año) | `number` | S | Agregación estadística por comarca |
| `total_emissions` | Suma total de emisiones de CO₂ de todos los certificados (kgCO₂/año) | `number` | S | Agregación estadística por comarca |
| `mean_energy_qual` | Media de la calificación de consumo de energía primaria (escala 1–7; 1=A, 7=G) | `number` | S | Agregación estadística por comarca |
| `mean_emissions_qual` | Media de la calificación de emisiones de CO₂ (escala 1–7; 1=A, 7=G) | `number` | S | Agregación estadística por comarca |
| `total_primary_energy` | Suma total del consumo de energía primaria de todos los certificados (kWh/año) | `number` | S | Agregación estadística por comarca |
| `mean_primary_energy` | Media del consumo de energía primaria por unidad de superficie (kWh/m²·año) | `number` | S | Agregación estadística por comarca |
| `total_surface` | Suma total de la superficie certificada en la comarca (m²) | `number` | S | Agregación estadística por comarca |
| `mean_surface` | Media de la superficie de los inmuebles certificados (m²) | `number` | S | Agregación estadística por comarca |
| `total_cost` | Suma total del coste declarado de certificación en la comarca (€) | `number` | S | Agregación estadística por comarca |
| `mean_cost` | Media del coste declarado por certificado (€) | `number` | S | Agregación estadística por comarca |
