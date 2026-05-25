import io
import json
import logging
import os
import sys
import zipfile

import geopandas as gpd
import pandas as pd
import requests
from shapely.geometry import Point
from sklearn.preprocessing import LabelEncoder

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

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

# Each entry: [column_name, canonical_value, [list of equivalent raw values]]
SAME_MEANING_VALUES = [
    ["us_edifici", "Terciari", ["Terciario"]],
    ["us_edifici", "Bloc d'habitatges", ["Bloque de viviendas"]],
    [
        "us_edifici",
        "Bloc d'habitatges plurifamiliar",
        ["Bloque de viviendas plurifamiliar"],
    ],
    [
        "us_edifici",
        "Habitatge unifamiliar",
        ["Vivienda unifamiliar", "Habitatge Unifamiliar"],
    ],
    [
        "us_edifici",
        "Habitatge individual en bloc d'habitatges",
        ["Vivienda individual en bloque de viviendas"],
    ],
    ["motiu", "Lloguer", ["Alquiler"]],
    [
        "motiu",
        "Sol·licitud d'ajuts",
        [
            "Solicitud de ayudas",
            "Sollicitut d'ajuts",
            "Sol·licitut d'ajuts",
            "Sol�licitut d'ajuts",
            "Solï'½licitut d'ajuts",
        ],
    ],
    ["motiu", "Compravenda", ["Compra o Venda", "Compra o Venta", "Compraventa"]],
    [
        "motiu",
        "Certificació voluntària",
        [
            "Certificación voluntaria",
            "Certificació voluntaria",
            "Certificaci� volunt�ria",
            "Certificaci�n voluntaria",
            "Certificaciï'½ voluntï'½ria",
            "Certificaciï'½n voluntaria",
        ],
    ],
    [
        "motiu",
        "Altres",
        [
            "Altres (cap de les anteriores opcions)",
            "Otros (ninguna de las anteriores opciones)",
            "Nova construcció o gran rehabilitació",
            "Nova construcció",
            "Nueva construcción",
            "Nueva construcción  o gran rehabilitación",
            "Nova construcció - ampliació amb entitat jurídica independent",
            "Nueva construcción - ampliación con entidad jurídica independiente",
            "Renovació (en cas de caducitat de l'antic certificat energètic)",
            "Renovación (en caso de caducidad del antiguo certificado energético)",
            "Edifici existent de l'administració pública",
            "Edifici existent de l¿administració pública",
            "Edificio existente de la administración pública",
            "Edificis o parts d'edificis on es realitzin reformes o ampliacions",
            "Edificis o parts d¿edificis on es realitzin reformes o ampliacions",
            "Edificios o partes de edificis en los que se realicen reformas o ampliaciones",
            "Complement a informe d'avaluació de l'edifici (IEE) o a inspecció tècnica de l'edifici (ITE)",
            "Complement a informe d¿avaluació de l¿edifici (IEE) o a inspecció tècnica de l¿edifici (ITE)",
            "Complemento al informe de evaluación del edificio (IEE) o a inspección técnica del edificio (ITE)",
            "Complement a informe davaluació de l'edifici (IEE) o a inspecció tècnica de l'edifici (ITE)",
            "Edificis o parts d'edificis (+500 m2) amb ús administratiu, sanitari, comercial, docent, restauració",
            "Edificis o parts d¿edificis (+500 m2) amb ús administratiu, sanitari, comercial, docent, restauració",
            "Edificios o partes de edificios (+500 m2) de uso administrativo, sanitario, comercial, docente, restauración...",
            "Edificis o parts d'edificis (+500 m2) amb ús administratiu, sanitari, comercial, docent, restauració",
            "Informe d'avaluació de l'Edifici (IEE)",
            "Informe de evaluación del Edificio (IEE)",
            "Edifici existent de l'Administració pública",
            "Edificio existente de la Administración pública",
            "Edificios o partes de edificios (+500 m²) con uso administrativo, sanitario, comercial, docente, restauración",
            "Edificios o partes de edificios donde se realizan reformas o ampliaciones",
            "Edificis o parts d'edificis (+500 m²) amb ús administratiu, sanitari, comercial, docent, restauració",
            "Complemento a informe de avaluación del edificio (IEE) o a inspección técnica del edificio (ITE)",
        ],
    ],
    ["normativa", "Abans de 1979", ["Antes de 1979"]],
    ["normativa", "Altres", ["0", "anterior a la NBE-CT79", "Anterior a la NBE-CT-79"]],
]

CATEGORICAL_COLUMNS_TO_ENCODE = ["eina", "motiu", "us_edifici", "normativa"]

COLLAPSE_TO_TOP_N = 6
COLLAPSE_ALTRES_VALUES = {
    "motiu": "Altres",
    "normativa": "Altres",
}

QUALIFICATIONS_NUMERICAL_EQUIVALENCE = {
    "A": 1,
    "B": 2,
    "C": 3,
    "D": 4,
    "E": 5,
    "F": 6,
    "G": 7,
}

PROVINCIES_DICT = {
    "08": "Barcelona",
    "17": "Girona",
    "25": "Lleida",
    "43": "Tarragona",
}

# INE table codes for the household income (renda) dataset
RENDES_TABLE_CODES = [30896, 31079, 31016, 31223]

# Year to retain when subsetting the income pivot table
RENDES_YEAR = "2022"

# ---------------------------------------------------------------------------
# Reference-data loading
# ---------------------------------------------------------------------------


def build_municipi_dict() -> dict:
    """Fetch the idescat municipality/comarca hierarchy and return a lookup dict.

    Returns a dict keyed by 6-digit municipality code (``codi_poblacio``), each
    value containing ``"municipi"``, ``"codi_comarca"``, and ``"comarca"`` keys.
    Raises ``requests.HTTPError`` on a non-2xx response.
    """
    url = "https://www.idescat.cat/codis/?id=50&n=10&lang=es&f=ssv"
    response = requests.get(url)
    response.raise_for_status()

    df_comarques = pd.read_csv(io.StringIO(response.text), sep=";", skiprows=3)

    municipi_dict: dict = {}
    current_comarca: dict = {}

    for _, row in df_comarques.iterrows():
        if row["Nivell"] == "Comarca":
            current_comarca = {
                "codi": str(row["Codi"]).zfill(2),
                "nom": row["Nom"],
            }
        elif row["Nivell"] == "Municipi":
            municipi_dict[str(row["Codi"]).zfill(6)] = {
                "municipi": row["Nom"],
                "codi_comarca": current_comarca["codi"],
                "comarca": current_comarca["nom"],
            }

    return municipi_dict


# ---------------------------------------------------------------------------
# Data-cleaning functions
# ---------------------------------------------------------------------------


def delete_nas(df: pd.DataFrame) -> pd.DataFrame:
    """Drop rows that lack GPS coordinates or an entry date."""
    return df.dropna(subset=["utm_x", "utm_y", "data_entrada"])


def generate_mundissec(df: pd.DataFrame) -> pd.DataFrame:
    """Spatially join certificates to census sections and append MUNDISSEC.

    Reads the shapefile bundled in ``static/bseccenv10sh1f1_20240101_0.zip``,
    extracts it, then performs a point-in-polygon join using the UTM-31N
    coordinates stored in ``utm_x`` / ``utm_y``.
    """
    logger.info("Generating MUNDISSEC...")

    zip_path = "static/bseccenv10sh1f1_20240101_0.zip"
    extract_path = "static/seccions-censals"

    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(extract_path)

    shp_files = [
        os.path.join(extract_path, f)
        for f in os.listdir(extract_path)
        if f.endswith(".shp")
    ]
    if not shp_files:
        raise FileNotFoundError(
            f"No shapefile found in {extract_path} after extracting {zip_path}"
        )
    shapefile_path = shp_files[0]
    ceccsen = gpd.read_file(shapefile_path)

    geometry = [Point(xy) for xy in zip(df["utm_x"], df["utm_y"])]
    mundissec_gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:25831")

    full_df_mundissec = gpd.sjoin(mundissec_gdf, ceccsen, how="left", predicate="within")
    full_df_mundissec = full_df_mundissec.drop(columns=["index_right"])

    return full_df_mundissec


def rename_columns(df: pd.DataFrame, renamings: dict) -> pd.DataFrame:
    """Rename raw API column names to shorter, consistent names."""
    logger.info("Renaming columns...")
    rename_dict = {col: renamings[col] for col in renamings if col in df.columns}
    return df.rename(columns=rename_dict)


def reduce_columns(df: pd.DataFrame, columns: list) -> pd.DataFrame:
    """Keep only the columns required for downstream processing."""
    logger.info("Reducing columns...")
    return df[columns]


def cast_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Cast columns to their correct types and apply domain-level data rules.

    Specific rules applied:
    - ``data_entrada`` is parsed as a date and snapped to month-start.
    - Rows with a null MUNDISSEC (no spatial match) are dropped.
    - Energy/emissions qualifications are mapped to an ordinal integer scale.
    - ``cost_energia`` values of 0 when ``energia_primaria`` > 0 are treated as
      missing data, since a building with energy use cannot have zero cost.
    """
    logger.info("Casting columns to their correct types...")
    df = df.copy()

    # format="mixed" is required for pandas 2.x: without it, pandas infers a
    # single format from the first row and silently coerces all non-matching
    # rows to NaT, producing ~800k null dates from the raw API data.
    df["data_entrada"] = pd.to_datetime(df["data_entrada"], format="mixed", dayfirst=True, errors="coerce")
    df["data_entrada"] = df["data_entrada"].apply(pd.offsets.MonthBegin().rollback)
    df = df.dropna(subset=["data_entrada"])

    # Drop the ~24 records that did not match any census section polygon
    df = df.dropna(subset=["MUNDISSEC"])
    df["MUNDISSEC"] = df["MUNDISSEC"].astype(str).str.zfill(11)

    df["qual_emissions"] = df["qual_emissions"].map(QUALIFICATIONS_NUMERICAL_EQUIVALENCE)
    df["qual_energia"] = df["qual_energia"].map(QUALIFICATIONS_NUMERICAL_EQUIVALENCE)

    # A zero cost when primary energy is positive is a data entry error
    df.loc[
        (df["cost_energia"] == 0)
        & (df["energia_primaria"] > 0)
        & df["energia_primaria"].notna(),
        "cost_energia",
    ] = pd.NA

    return df


def normalize_text_encoding(df: pd.DataFrame) -> pd.DataFrame:
    """Normalize encoding artifacts in string columns before label grouping.

    Converts typographic apostrophes (U+2018/U+2019), the corrupted-apostrophe
    artifact (¿), and double-encoded replacement characters (ï¿½ → U+FFFD) so
    that SAME_MEANING_VALUES matching works regardless of source encoding.
    """
    logger.info("Normalizing text encoding in string columns...")
    df = df.copy()
    replacements = {
        "ï¿½": "�",  # ï¿½ (double-encoded REPLACEMENT CHAR) → U+FFFD — must precede ¿ replacement
        "’": "’",          # RIGHT SINGLE QUOTATION MARK → apostrophe
        "’": "’",          # LEFT SINGLE QUOTATION MARK → apostrophe
        "¿": "’",          # ¿ (corrupted apostrophe artifact) → apostrophe
    }
    for col in df.select_dtypes(include="object").columns:
        for bad, good in replacements.items():
            df[col] = df[col].str.replace(bad, good, regex=False)
    return df


def group_same_meaning_values(
    df: pd.DataFrame, same_meaning_values: list
) -> pd.DataFrame:
    """Replace equivalent raw label variants with a single canonical value.

    Works on a copy of the DataFrame to avoid mutating the caller's object.
    ``same_meaning_values`` is a list of ``[column, canonical, [variants]]``
    triples.
    """
    logger.info("Grouping equivalent labels...")
    df = df.copy()
    for column, canonical, variants in same_meaning_values:
        df[column] = df[column].replace(dict.fromkeys(variants, canonical))
    return df


def collapse_to_top_n(
    df: pd.DataFrame, column_altres: dict, n: int = 6
) -> pd.DataFrame:
    """Remap rare categories to 'Altres' so each column has at most n distinct values.

    Categories outside the top-n by frequency are reassigned to the canonical
    'Altres' string for that column before label encoding.
    """
    df = df.copy()
    for col, altres_value in column_altres.items():
        if col not in df.columns:
            continue
        top_n = df[col].value_counts().nlargest(n).index
        df[col] = df[col].where(df[col].isin(top_n), other=altres_value)
    return df


def remove_outliers(df: pd.DataFrame) -> pd.DataFrame:
    """Remove negative emissions and values above the 97.5th percentile.

    Rows where ``emissions_de_co2`` is NaN also fail the ``>= 0`` check and
    are intentionally dropped here.
    """
    logger.info("Removing outliers...")
    df = df[df["emissions_de_co2"] >= 0]
    upper_bound = df["emissions_de_co2"].quantile(0.975)
    df = df[df["emissions_de_co2"] <= upper_bound]
    return df


def regenerate_codes(
    df: pd.DataFrame, municipi_dict: dict, provincies_dict: dict
) -> pd.DataFrame:
    """Derive geographic codes and names from MUNDISSEC.

    MUNDISSEC is an 11-digit code structured as:
    ``[6-digit codi_poblacio][2-digit district][3-digit section]``

    Also normalises ``zona_climatica`` to the most common value per
    municipality, since individual certificates sometimes carry inconsistent
    values.
    """
    logger.info("Regenerating codes...")
    df = df.copy()

    df["codi_poblacio"] = df["MUNDISSEC"].str[:6]

    df["codi_comarca"] = df["codi_poblacio"].map(
        lambda codi: municipi_dict.get(codi, {}).get("codi_comarca", 0)
    )

    most_common_zona = df.groupby("codi_poblacio")["zona_climatica"].agg(
        lambda x: x.mode().iloc[0] if not x.mode().empty else None
    )
    df["zona_climatica"] = df["codi_poblacio"].map(most_common_zona)

    df["codi_provincia"] = df["MUNDISSEC"].str[:2]

    df["poblacio"] = df["codi_poblacio"].map(
        lambda codi: municipi_dict.get(codi, {}).get("municipi")
    )
    df["comarca"] = df["codi_poblacio"].map(
        lambda codi: municipi_dict.get(codi, {}).get("comarca")
    )
    df["provincia"] = df["codi_provincia"].map(provincies_dict)

    return df


def encode_categorical_columns(
    df: pd.DataFrame, categorical_columns: list
) -> tuple[pd.DataFrame, dict]:
    """Label-encode categorical columns and return the mapping for later use.

    Fills NaN values with ``"No definit"`` before encoding so that missing
    data becomes its own category rather than causing an error.

    Returns:
        A tuple of ``(encoded_df, label_mapping)`` where ``label_mapping`` is a
        dict keyed by column name whose values map integer codes back to their
        original label strings.
    """
    logger.info("Encoding categorical columns...")
    df = df.copy()
    label_mapping: dict = {}

    for column in categorical_columns:
        if column not in df.columns:
            continue
        df[column] = df[column].fillna("No definit")
        encoder = LabelEncoder()
        df[column] = encoder.fit_transform(df[column])
        label_mapping[column] = {
            str(i): cls for i, cls in enumerate(encoder.classes_)
        }

    return df, label_mapping


# ---------------------------------------------------------------------------
# Income (renda) dataset functions
# ---------------------------------------------------------------------------


def _remove_sixth_digit_from_right(number_str: str) -> str:
    """Strip the district digit from an INE section code to match idescat codes.

    INE MUNDISSEC codes include a district digit that idescat omits, so the
    6th digit from the right must be removed to align the two sources.

    Example: ``"0801601001"`` -> ``"080160101"``
    """
    if len(number_str) >= 6:
        index_to_remove = len(number_str) - 6
        return number_str[:index_to_remove] + number_str[index_to_remove + 1 :]
    return number_str


def get_sections_dataset() -> pd.DataFrame:
    """Fetch the idescat census sections reference table.

    Returns a DataFrame with a ``mundissec`` column (11-digit code) built by
    concatenating the municipality code and district/section code.
    Raises ``requests.HTTPError`` on a non-2xx response.
    """
    url = (
        "https://www.idescat.cat/codis/"
        "?cin=0&nom=&ambit=a&cic=0&codi=&pobi=&pobf=&id=50"
        "&n=24&inf=c&t=01-01-2024&f=ssv"
    )
    response = requests.get(url)
    response.raise_for_status()

    seccions = pd.read_csv(io.StringIO(response.text), sep=";", skiprows=3)
    seccions["Districte/Secció"] = seccions["Districte/Secció"].astype(str).str.zfill(5)
    seccions["Codi municipi"] = seccions["Codi municipi"].astype(str).str.zfill(6)
    seccions["mundissec"] = seccions["Codi municipi"] + seccions["Districte/Secció"]

    return seccions


def fetch_rendes_data(
    code: int, mundissec_map: dict, municipis_map: dict
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Fetch one INE income table and split records into section/municipality frames.

    Args:
        code: INE table identifier.
        mundissec_map: Mapping from truncated INE section code to idescat MUNDISSEC.
        municipis_map: Mapping from truncated INE municipality code to full code.

    Returns:
        A tuple ``(seccions_df, municipis_df)`` of long-format DataFrames with
        columns ``["codi", "indicador", "any", "valor"]``.

    Raises:
        ``requests.HTTPError`` on a non-2xx response.
    """
    url = f"https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{code}"
    response = requests.get(url, params={"tip": "AM"})
    response.raise_for_status()
    data = response.json()

    seccions_records: list = []
    municipis_records: list = []

    for item in data:
        meta = item.get("MetaData", [])
        if not meta:
            continue

        var = meta[0].get("T3_Variable")
        if var not in ("Secciones", "Municipios"):
            continue

        code_short = meta[0]["Codigo"]
        if var == "Secciones":
            key = mundissec_map.get(code_short, code_short)
            records = seccions_records
        else:
            key = municipis_map.get(code_short, code_short)
            records = municipis_records

        indicador = next(
            (m["Nombre"] for m in meta if m["T3_Variable"] == "SALDOS CONTABLES"),
            None,
        )
        if not indicador:
            continue

        for entry in item.get("Data", []):
            records.append(
                {
                    "codi": key,
                    "indicador": indicador,
                    "any": entry["Anyo"],
                    "valor": entry["Valor"],
                }
            )

    return pd.DataFrame(seccions_records), pd.DataFrame(municipis_records)


def get_rendes_dataset(
    sections_dataset: pd.DataFrame,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Fetch and pivot household income data for census sections and municipalities.

    Fetches the four INE income tables, aligns their codes with the idescat
    reference, concatenates results, and pivots to a wide format retaining only
    the ``RENDES_YEAR`` columns.

    Returns:
        A tuple ``(renta_seccions_df, renta_municipis_df)``.
    """
    # Build code-alignment maps between INE (truncated) and idescat (full) codes
    sections_dataset = sections_dataset.copy()
    sections_dataset["MUNDISSEC_truncated"] = (
        sections_dataset["mundissec"].astype(str).apply(_remove_sixth_digit_from_right)
    )
    mundissec_map = (
        sections_dataset.drop_duplicates("MUNDISSEC_truncated")
        .set_index("MUNDISSEC_truncated")["mundissec"]
        .to_dict()
    )

    sections_dataset["Codi municipi_truncated"] = (
        sections_dataset["Codi municipi"].astype(str).str.slice(0, -1)
    )
    municipis_map = (
        sections_dataset.drop_duplicates("Codi municipi_truncated")
        .set_index("Codi municipi_truncated")["Codi municipi"]
        .to_dict()
    )

    # Fetch all four income tables
    all_results = [
        fetch_rendes_data(code, mundissec_map, municipis_map)
        for code in RENDES_TABLE_CODES
    ]

    seccions_all = pd.concat([r[0] for r in all_results], ignore_index=True)
    municipis_all = pd.concat([r[1] for r in all_results], ignore_index=True)

    def pivot_dataset(df: pd.DataFrame) -> pd.DataFrame:
        df_pivot = df.pivot_table(
            index="codi",
            columns=["indicador", "any"],
            values="valor",
        )
        df_pivot.columns = [f"{col[0]}_{col[1]}" for col in df_pivot.columns]
        return df_pivot.reset_index()

    renta_seccions_df = pivot_dataset(seccions_all)
    renta_municipis_df = pivot_dataset(municipis_all)

    # Retain only the target year plus the join key
    # Split on the last underscore to avoid false matches in indicator names
    year_cols = [
        col
        for col in renta_seccions_df.columns
        if col != "codi" and col.rsplit("_", 1)[-1] == RENDES_YEAR
    ]
    subset_columns = ["codi"] + year_cols

    return renta_seccions_df[subset_columns], renta_municipis_df[subset_columns]


# ---------------------------------------------------------------------------
# Aggregation
# ---------------------------------------------------------------------------


def aggregate_by_level(df: pd.DataFrame, level: str) -> pd.DataFrame:
    """Compute summary statistics for all certificates grouped by geographic level.

    Args:
        df: Cleaned certificates DataFrame containing the aggregation column.
        level: Column name to group by (e.g. ``"MUNDISSEC"``, ``"codi_poblacio"``).

    Returns:
        A DataFrame with one row per group and columns for count, mean/total
        emissions, qualification means, energy, surface area, and cost.
    """
    return (
        df.groupby(level)
        .agg(
            count=pd.NamedAgg(column="emissions_de_co2", aggfunc="count"),
            mean_emissions=pd.NamedAgg(column="emissions_de_co2", aggfunc="mean"),
            total_emissions=pd.NamedAgg(column="emissions_totals", aggfunc="sum"),
            mean_energy_qual=pd.NamedAgg(column="qual_energia", aggfunc="mean"),
            mean_emissions_qual=pd.NamedAgg(column="qual_emissions", aggfunc="mean"),
            total_primary_energy=pd.NamedAgg(column="energia_primaria", aggfunc="sum"),
            mean_primary_energy=pd.NamedAgg(column="energia_primaria", aggfunc="mean"),
            total_surface=pd.NamedAgg(column="metres_cadastre", aggfunc="sum"),
            mean_surface=pd.NamedAgg(column="metres_cadastre", aggfunc="mean"),
            total_cost=pd.NamedAgg(column="cost_energia", aggfunc="sum"),
            mean_cost=pd.NamedAgg(column="cost_energia", aggfunc="mean"),
        )
        .reset_index()
    )


# ---------------------------------------------------------------------------
# Orchestration
# ---------------------------------------------------------------------------


def process_certificates_dataset(
    df: pd.DataFrame, municipi_dict: dict
) -> tuple[pd.DataFrame, dict]:
    """Run the full cleaning pipeline on the raw certificates DataFrame.

    Steps (in order):
    1. Drop rows with missing coordinates or entry date.
    2. Spatial join to census section polygons (generates MUNDISSEC).
    3. Rename raw API columns to short names.
    4. Keep only the columns needed downstream.
    5. Cast types and apply domain rules.
    6. Re-derive geographic codes from MUNDISSEC.
    7. Unify equivalent label variants.
    8. Remove statistical outliers in emissions.
    9. Label-encode categorical columns.

    Returns:
        A tuple ``(cleaned_df, label_mapping)``.
    """
    clean_df = (
        df.pipe(delete_nas)
        .pipe(generate_mundissec)
        .pipe(rename_columns, RENAMINGS)
        .pipe(reduce_columns, COLUMNS_IN_USE)
        .pipe(cast_columns)
        .pipe(regenerate_codes, municipi_dict, PROVINCIES_DICT)
        .pipe(normalize_text_encoding)
        .pipe(group_same_meaning_values, SAME_MEANING_VALUES)
        .pipe(collapse_to_top_n, COLLAPSE_ALTRES_VALUES, COLLAPSE_TO_TOP_N)
        .pipe(remove_outliers)
    )

    return encode_categorical_columns(clean_df, CATEGORICAL_COLUMNS_TO_ENCODE)


def get_aggregated_datasets(
    certificates: pd.DataFrame,
    rendes_datasets: tuple[pd.DataFrame, pd.DataFrame],
) -> list[pd.DataFrame]:
    """Build section-, municipality-, and comarca-level aggregated datasets.

    Computes total emissions (kgCO2 * m²) before aggregating, then merges the
    household income data into the section and municipality frames.

    Returns:
        A list of three DataFrames: ``[by_section, by_mun, by_comarca]``.
    """
    certificates = certificates.copy()
    certificates["emissions_totals"] = (
        certificates["emissions_de_co2"] * certificates["metres_cadastre"]
    )

    certificates_by_section = aggregate_by_level(certificates, "MUNDISSEC")
    certificates_by_mun = aggregate_by_level(certificates, "codi_poblacio")
    certificates_by_com = aggregate_by_level(certificates, "codi_comarca")

    certificates_by_section = (
        certificates_by_section
        .merge(rendes_datasets[0], left_on="MUNDISSEC", right_on="codi", how="outer")
        .drop(columns=["codi"])
    )
    certificates_by_mun = (
        certificates_by_mun
        .merge(rendes_datasets[1], left_on="codi_poblacio", right_on="codi", how="outer")
        .drop(columns=["codi"])
    )

    return [certificates_by_section, certificates_by_mun, certificates_by_com]


def save_data(
    certificates: pd.DataFrame,
    label_mapping: dict,
    aggregated_datasets: list[pd.DataFrame],
    municipi_dict: dict,
) -> None:
    """Persist all output files to ``src/data/``.

    Files written:
    - ``certificats.parquet`` — full cleaned certificates dataset.
    - ``labels.json`` — label encoder mapping for categorical columns.
    - ``municipisDict.json`` — municipality/comarca hierarchy lookup.
    - ``seccen_aggregates.json``, ``mun_aggregates.json``, ``com_aggregates.json`` — geographic aggregations.

    Note:
        pandas >= 2.2 uses Arrow-backed strings by default.  fastparquet
        cannot write Arrow string arrays, so they are cast to ``object`` first.
    """
    data_dir = "src/data"
    os.makedirs(data_dir, exist_ok=True)

    # --- certificats.parquet ---
    parquet_path = os.path.join(data_dir, "certificats.parquet")
    # Cast Arrow-backed string columns to object so fastparquet can serialise them
    str_cols = certificates.select_dtypes(include="string").columns
    if len(str_cols):
        certificates = certificates.copy()
        certificates[str_cols] = certificates[str_cols].astype(object)
    certificates.to_parquet(parquet_path, engine="fastparquet", compression="GZIP")
    logger.info("Data cleaned and saved to %s", parquet_path)

    # --- labels.json ---
    labels_json_path = os.path.join(data_dir, "labels.json")
    with open(labels_json_path, "w") as f:
        json.dump(label_mapping, f)
    logger.info("Label mapping saved to %s", labels_json_path)

    # --- municipisDict.json ---
    municipi_dict_path = os.path.join(data_dir, "municipisDict.json")
    with open(municipi_dict_path, "w") as f:
        json.dump(municipi_dict, f)
    logger.info("Municipis dictionary saved to %s", municipi_dict_path)

    # --- certificats-points.parquet ---
    # Deduplicate by referencia_cadastral, keeping most recent data_entrada
    dedup_df = certificates[["referencia_cadastral", "latitud", "longitud", "qual_energia", "qual_emissions", "emissions_de_co2", "metres_cadastre", "data_entrada"]].copy()
    dedup_df = dedup_df.sort_values("data_entrada", ascending=False)
    dedup_df = dedup_df.drop_duplicates(subset=["referencia_cadastral"], keep="first")
    dedup_df = dedup_df.drop(columns=["data_entrada"])
    dedup_df["latitud"] = dedup_df["latitud"].round(6)
    dedup_df["longitud"] = dedup_df["longitud"].round(6)
    str_cols_pts = dedup_df.select_dtypes(include="string").columns
    if len(str_cols_pts):
        dedup_df[str_cols_pts] = dedup_df[str_cols_pts].astype(object)
    points_path = os.path.join(data_dir, "certificats-points.parquet")
    dedup_df.to_parquet(points_path, engine="fastparquet", compression="GZIP")
    logger.info("Points dataset saved to %s", points_path)

    # --- Geographic aggregation files ---
    aggregate_files = ["seccen_aggregates.json", "mun_aggregates.json", "com_aggregates.json"]
    for df, name in zip(aggregated_datasets, aggregate_files):
        out_path = os.path.join(data_dir, name)
        df.round(3).to_json(out_path, orient="records", indent=2)
        logger.info("Aggregated dataset saved to %s", out_path)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def main() -> None:
    """Run the full data processing pipeline."""
    logger.info("Starting data processing...")

    logger.info("Building municipality dictionary...")
    municipi_dict = build_municipi_dict()

    logger.info("Loading raw certificates from static/raw_data.json...")
    df = pd.read_json("static/raw_data.json")

    certificates, label_mapping = process_certificates_dataset(df, municipi_dict)

    logger.info("Fetching census sections reference data...")
    sections = get_sections_dataset()

    logger.info("Fetching household income (renda) data...")
    rendes_datasets = get_rendes_dataset(sections)

    aggregated_datasets = get_aggregated_datasets(certificates, rendes_datasets)
    save_data(certificates, label_mapping, aggregated_datasets, municipi_dict)

    logger.info("Data processing complete.")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.exception("Data processing failed: %s", e)
        sys.exit(1)
