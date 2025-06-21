import os
import io
import json
import zipfile
import requests
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from sklearn.preprocessing import LabelEncoder

#region **** Dictionaries ****
# Municipis dictionary
comarques_file = pd.read_csv("static/comarques.csv")

municipi_dict = {}
current_comarca = {}

for _, row in comarques_file.iterrows():
    if row["Nivell"] == "Comarca":
        # Store comarca info
        current_comarca = {"codi": row["Codi"], "nom": row["Nom"]}
    elif row["Nivell"] == "Municipi":
        municipi_dict[row["Codi"]] = {
            "municipi": row["Nom"],
            "codi_comarca": current_comarca["codi"],
            "comarca": current_comarca["nom"],
        }
#endregion

#region **** Data cleaning and formatting functions ****

#region ** CONSTANTS **
RENAMINGS = {
      'qualificaci_de_consum_d': 'qual_energia',
      'qualificaci_emissions': 'qual_emissions',
      'motiu_de_la_certificacio': 'motiu',
      'eina_de_certificacio':'eina'
      };
COLUMNS_IN_USE = ['codi_poblacio', 'codi_comarca', 'codi_provincia', 'MUNDISSEC', 'metres_cadastre', 'emissions_de_co2', 'qual_energia', 'qual_emissions', 'data_entrada', 'motiu', 'us_edifici', 'zona_climatica']
SAME_MEANING_VALUES = [
  ['us_edifici', "Terciari", ['Terciario']],
  ['us_edifici', "Bloc d'habitatges", ['Bloque de viviendas']],
  ['us_edifici', "Bloc d'habitatges plurifamiliar", [
    'Bloque de viviendas plurifamiliar'
  ]],
  ['us_edifici', 'Habitatge unifamiliar', ['Vivienda unifamiliar',
    'Habitatge Unifamiliar'
  ]],
  ['us_edifici', "Habitatge individual en bloc d'habitatges", [
    'Vivienda individual en bloque de viviendas'
  ]],
  ['motiu', 'Lloguer', ['Alquiler']],
  ['motiu', "Sol·licitud d'ajuts", ['Solicitud de ayudas']],
  ['motiu', 'Compravenda', ['Compra o Venda', 'Compra o Venta']],
  ['motiu', 'Certificació voluntària', ['Certificación voluntaria',
    'Certificació voluntaria'
  ]],
  ['motiu',
    "Altres (cap de les anteriores opcions)",
    ['Otros (ninguna de las anteriores opciones)',
      'Nova construcció o gran rehabilitació', 'Nova construcció',
      'Nueva construcción',
      'Nueva construcción  o gran rehabilitación',
      'Nova construcció - ampliació amb entitat jurídica independent',
      'Nueva construcción - ampliación con entidad jurídica independiente',
      "Renovació (en cas de caducitat de l'antic certificat energètic)",
      'Renovación (en caso de caducidad del antiguo certificado energético)',
      "Edifici existent de l’administració pública",
      'Edifici existent de l¿administració pública',
      'Edificio existente de la administración pública',
      "Edificis o parts d’edificis on es realitzin reformes o ampliacions",
      'Edificis o parts d¿edificis on es realitzin reformes o ampliacions',
      'Edificios o partes de edificis en los que se realicen reformas o ampliaciones',
      "Complement a informe d’avaluació de l’edifici (IEE) o a inspecció tècnica de l’edifici (ITE)",
      'Complement a informe d¿avaluació de l¿edifici (IEE) o a inspecció tècnica de l¿edifici (ITE)',
      'Complemento al informe de evaluación del edificio (IEE) o a inspección técnica del edificio (ITE)',
      'Complement a informe davaluació de l’edifici (IEE) o a inspecció tècnica de l’edifici (ITE)',
      "Edificis o parts d’edificis (+500 m2) amb ús administratiu, sanitari, comercial, docent, restauració",
      'Edificis o parts d¿edificis (+500 m2) amb ús administratiu, sanitari, comercial, docent, restauració',
      'Edificios o partes de edificios (+500 m2) de uso administrativo, sanitario, comercial, docente, restauración...',
      "Edificis o parts d'edificis (+500 m2) amb ús administratiu, sanitari, comercial, docent, restauració",
      "Informe d'avaluació de l'Edifici (IEE)",
      'Informe de evaluación del Edificio (IEE)'
    ]
  ],
]
CATEGORICAL_COLUMNS_TO_ENCODE = ['eina', 'motiu', 'us_edifici']
QUALIFICATIONS_NUMERICAL_EQUIVALENCE = {
   'A': 1,
   'B': 2,
   'C': 3,
   'D': 4,
   'E': 5,
   'F': 6,
   'G': 7,
}
#endregion
def deleteNAs(df):
    return df.dropna(subset=['utm_x', 'utm_y', 'data_entrada'])


def generateMundissec(df):
    print("Generating MUNDISSEC...")

    zip_path = "static/bseccenv10sh1f1_20240101_0.zip"
    extract_path = "static/seccions-censals"

    with zipfile.ZipFile(zip_path, "r") as zip_ref:
        zip_ref.extractall(extract_path)

    shapefile_path = [os.path.join(extract_path, f) for f in os.listdir(extract_path) if f.endswith(".shp")][0]
    ceccsen = gpd.read_file(shapefile_path)

    # Convert to GeoDataFrame
    geometry = [Point(xy) for xy in zip(df["utm_x"], df["utm_y"])]
    mundissec_gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:25831")

    # Perform spatial join
    full_df_mundissec = gpd.sjoin(mundissec_gdf, ceccsen, how="left", predicate="within")

    # Drop index column from the join
    full_df_mundissec = full_df_mundissec.drop(columns=["index_right"])

    return full_df_mundissec


def renameColumns(df, renamings):
    print("Renaming columns...")
    dataset_columns = df.columns
    rename_dict = {col: renamings[col] for col in renamings if col in dataset_columns}
    return df.rename(columns=rename_dict)


def reduceColumns(df, columns):
    print("Reducing columns...")
    reduced_dataset = df[columns]
    return reduced_dataset


def castColumns(df):
    print("Casting the columns to their correct type...")
    df = df.copy()
    
    intColumns = ['codi_provincia', 'codi_poblacio', 'codi_comarca']
    
    for col in intColumns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.dropna(subset=[col])
        df[col] = df[col].astype("Int64")

    df['data_entrada'] = pd.to_datetime(df['data_entrada'], errors='coerce')
    df['data_entrada'] = df['data_entrada'].apply(pd.offsets.MonthBegin().rollback)

    df = df.dropna(subset=['MUNDISSEC']) # Eliminem els 24 registres amb MUNDISSEC nan
    df['MUNDISSEC'] = df['MUNDISSEC'].astype(str).str.zfill(11)

    df['qual_emissions'] = df['qual_emissions'].map(QUALIFICATIONS_NUMERICAL_EQUIVALENCE)
    df['qual_energia'] = df['qual_energia'].map(QUALIFICATIONS_NUMERICAL_EQUIVALENCE)
    
    return df


def groupSameMeaningValues(df, same_meaning_values):
    print("Grouping the same meaning labels...")
    for field_values in same_meaning_values:
        for value in field_values[2]:
          df.loc[df[field_values[0]] == value, field_values[0]] = field_values[1]

    return df


def removeOutliers(df):
    print("Removing outliers...")
    Q1 = df['emissions_de_co2'].quantile(0.10)
    Q3 = df['emissions_de_co2'].quantile(0.90)
    IQR = Q3 - Q1

    upper_bound = Q3 + 1.5 * IQR

    df = df.loc[df['emissions_de_co2'] < upper_bound]

    return df


def regenerateCodes(df, municipi_dict):
    print("Regenerating codes...")
    df['MUNDISSEC_AUX'] = pd.to_numeric(df['MUNDISSEC'], errors='coerce').fillna(0).astype('Int64')
    df['codi_poblacio'] = df['MUNDISSEC_AUX'] // 100000

    def get_comarca(codi_poblacio):
        dict_entry = municipi_dict.get(codi_poblacio)
        if dict_entry:
            return dict_entry['codi_comarca']
        else:
            return 0

    df['codi_comarca'] = df['codi_poblacio'].map(get_comarca).apply(pd.Series)

    most_common_zona = df.groupby('codi_poblacio')['zona_climatica'].agg(lambda x: x.mode().iloc[0] if not x.mode().empty else None)

    df['zona_climatica'] = df['codi_poblacio'].map(most_common_zona)

    df['codi_provincia'] = df['codi_poblacio'] // 10000

    df = df.drop(columns=["MUNDISSEC_AUX"])

    return df


def encode_categorical_columns(df, categorical_columns):
    print("Encoding categorical columns...")
    encoders = {}
    label_mapping = {}

    df_columns = df.columns

    for column in categorical_columns:
        if column in df_columns:
            encoders[column] = LabelEncoder()
            df[column] = encoders[column].fit_transform(df[column])
            label_mapping[column] = dict(zip(range(len(encoders[column].classes_)), encoders[column].classes_))

    return df, label_mapping
#endregion ****


def process_certificates_dataset(df, municipi_dict):
    clean_df = (
        df.pipe(deleteNAs)
          .pipe(generateMundissec)
          .pipe(renameColumns, RENAMINGS)
          .pipe(reduceColumns, COLUMNS_IN_USE)
          .pipe(castColumns)
          .pipe(regenerateCodes, municipi_dict)
          .pipe(groupSameMeaningValues, SAME_MEANING_VALUES)
          .pipe(removeOutliers)
    )

    return encode_categorical_columns(clean_df, CATEGORICAL_COLUMNS_TO_ENCODE)


def get_sections_dataset():
    url = 'https://www.idescat.cat/codis/?cin=0&nom=&ambit=a&cic=0&codi=&pobi=&pobf=&id=50&n=24&inf=c&t=01-01-2024&f=ssv'

    response = requests.get(url)
    response.raise_for_status()

    seccions = pd.read_csv(io.StringIO(response.text), sep=";", skiprows=3)
    seccions['Districte/Secció'] = seccions['Districte/Secció'].astype(str).str.zfill(5)
    seccions['Codi municipi'] = seccions['Codi municipi'].astype(str).str.zfill(6)
    seccions['mundissec'] = seccions['Codi municipi'] + seccions['Districte/Secció']

    return seccions



def remove_sixth_digit_from_right(number_str):
    if len(number_str) >= 6:
        index_to_remove = len(number_str) - 6
        return number_str[:index_to_remove] + number_str[index_to_remove+1:]
    else:
        return number_str
  

def fetch_and_flatten(code, mundissec_map):
    url = f"https://servicios.ine.es/wstempus/js/ES/DATOS_TABLA/{code}"
    params = {"tip": "AM"}
    response = requests.get(url, params=params)
    data = response.json()

    records = []
    for item in data:
        meta = item.get("MetaData", [])
        if not meta or meta[0].get("T3_Variable") != "Secciones":
            continue

        mundissecShort = meta[0]["Codigo"]
        mundissec = mundissec_map.get(mundissecShort)

        if not mundissec:
          mundissec = mundissecShort

        indicador = None
        for m in meta:
            if m["T3_Variable"] == "SALDOS CONTABLES":
                indicador = m["Nombre"]
                break
        if not indicador:
            continue

        for entry in item.get("Data", []):
            records.append({
                "MUNDISSEC": mundissec,
                "indicador": indicador,
                "any": entry["Anyo"],
                "valor": entry["Valor"]
            })

    return pd.DataFrame(records)


def get_rendes_dataset(sections_dataset):
    codes = [30896, 31079, 31016, 31223]

    sections_dataset['MUNDISSEC_truncated'] = sections_dataset['mundissec'].astype(str).apply(remove_sixth_digit_from_right)
    mundissec_map = sections_dataset.drop_duplicates('MUNDISSEC_truncated').set_index('MUNDISSEC_truncated')['mundissec'].to_dict()

    df_all = pd.concat([fetch_and_flatten(code, mundissec_map) for code in codes], ignore_index=True)

    renta_df = df_all.pivot_table(
        index="MUNDISSEC",
        columns=["indicador", "any"],
        values="valor"
    )

    renta_df.columns = [f"{col[0]}_{col[1]}" for col in renta_df.columns]
    renta_df = renta_df.reset_index()
    subsetColumns = [column for column in renta_df.columns[1:] if ('_' in str(column) and str(column).split('_')[1] == '2022')]
    subsetColumns.append('MUNDISSEC')

    return renta_df[subsetColumns]


def aggregateByLevel(df, level):
  aggDf = df.groupby(level).agg(
      mean_emissions=pd.NamedAgg(column='emissions_de_co2', aggfunc='mean'),
      total_emissions=pd.NamedAgg(column='emissions_totals', aggfunc='sum'),
      mean_energy_qual=pd.NamedAgg(column='qual_energia', aggfunc='mean'),
      mean_emissions_qual=pd.NamedAgg(column='qual_emissions', aggfunc='mean'),
      ).reset_index()

  return aggDf


def get_aggregated_datasets(certificates, rendes):
    # Secció censal
    certificates['emissions_totals'] = certificates['emissions_de_co2'] * certificates['metres_cadastre']
    certificates_by_section = aggregateByLevel(certificates, 'MUNDISSEC')
    certificates_by_section = certificates_by_section.merge(rendes, on="MUNDISSEC", how="outer")

    # Municipi i comarca
    census_levels = ['codi_poblacio' ,'codi_comarca']
    aggregated_datasets = []

    for level in census_levels:
      aggDf = aggregateByLevel(certificates, level)
      aggregated_datasets.append(aggDf)

    aggregated_datasets.insert(0, certificates_by_section)

    # Rename de columnes perquè coincideixin amb els IDs dels tilesets de Mapbox
    aggregated_datasets[1] = aggregated_datasets[1].rename(columns={'codi_poblacio': 'CODIMUNI'})
    aggregated_datasets[2] = aggregated_datasets[2].rename(columns={'codi_comarca': 'CODICOMAR'})

    return aggregated_datasets


def save_data(certificates, label_mapping, aggregated_datasets):
    data_dir = "src/data"
    parquet_path = os.path.join(data_dir, "certificats.parquet")
    json_path = os.path.join(data_dir, "labels.json")
    
    os.makedirs(data_dir, exist_ok=True)

    certificates.to_parquet(parquet_path, engine="fastparquet", compression="GZIP")
    print("✅ Data cleaned and saved to", parquet_path)
    
    with open(json_path, "w") as f:
        json.dump(label_mapping, f)
    print("✅ Label mapping saved to", json_path)

    aggregateFiles = ["seccen.json", "mun.json", "com.json"]
    
    for df, name in zip(aggregated_datasets, aggregateFiles):
        out_path = os.path.join(data_dir, name)
        df.to_json(out_path, orient="records", indent=2)
        print(f"✅ Aggregated dataset saved to {out_path}")


df = pd.read_json("static/raw_data.json")
certificates, label_mapping = process_certificates_dataset(df, municipi_dict)
sections = get_sections_dataset()
rendes = get_rendes_dataset(sections)
aggregated_datasets = get_aggregated_datasets(certificates, rendes)
save_data(certificates, label_mapping, aggregated_datasets)