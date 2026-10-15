"""Column constants shared by fetch_certificates.py and data_processing.py.

Kept free of heavy imports so the fetch step stays lightweight.
"""

RENAMINGS = {
    "qualificaci_de_consum_d": "qual_energia",
    "qualificaci_emissions": "qual_emissions",
    "motiu_de_la_certificacio": "motiu",
    "eina_de_certificacio": "eina",
    "energia_prim_ria_no_renovable": "energia_primaria",
    "cost_anual_aproximat_d_energia": "cost_energia",
    "normativa_construcci": "normativa",
}

COLUMNS_IN_USE = [
    "codi_poblacio",
    "codi_comarca",
    "codi_provincia",
    "MUNDISSEC",
    "metres_cadastre",
    "emissions_de_co2",
    "qual_energia",
    "qual_emissions",
    "data_entrada",
    "motiu",
    "us_edifici",
    "zona_climatica",
    "eina",
    "normativa",
    "energia_primaria",
    "cost_energia",
    "latitud",
    "longitud",
    "referencia_cadastral",
]

# Raw API fields the pipeline reads: everything in COLUMNS_IN_USE under its
# original name, plus the UTM coordinates used to derive MUNDISSEC.
RAW_COLUMNS_IN_USE = sorted(
    {"utm_x", "utm_y", "data_entrada", *RENAMINGS}
    | (set(COLUMNS_IN_USE) - {"MUNDISSEC", *RENAMINGS.values()})
)
