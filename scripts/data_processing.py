import os
import json
import zipfile
import requests
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point
from sklearn.preprocessing import LabelEncoder

#region **** Dictionaries ****
# Municipis dictionary
comarques_file = pd.read_csv("data/comarques.csv")

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
#endregion
def deleteNAs(df):
    return df.dropna(subset=['utm_x', 'utm_y', 'data_entrada'])

def generateMundissec(df):
  print("Generating MUNDISSEC...")
  shapefile_url = "https://datacloud.icgc.cat/datacloud/bseccen_etrs89/shp/bseccenv10sh1f1_20240101_0.zip" # 2024 shapefile

  zip_path = "data/seccions-censals.zip"
  extract_path = "data/seccions-censals"

  response = requests.get(shapefile_url)
  with open(zip_path, "wb") as f:
      f.write(response.content)

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
    
    intColumns = ['codi_provincia', 'codi_poblacio', 'codi_comarca', 'MUNDISSEC']
    
    for col in intColumns:
        df[col] = pd.to_numeric(df[col], errors="coerce")
        df = df.dropna(subset=[col])
        df[col] = df[col].astype("Int64")

    df['data_entrada'] = pd.to_datetime(df['data_entrada'], errors='coerce')
    df['data_entrada'] = df['data_entrada'].apply(pd.offsets.MonthBegin().rollback)
    
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
  df['MUNDISSEC'] = pd.to_numeric(df['MUNDISSEC'], errors='coerce').fillna(0).astype('Int64')
  df['codi_poblacio'] = df['MUNDISSEC'] // 100000

  def get_comarca(codi_poblacio):
      dict_entry = municipi_dict.get(codi_poblacio)
      if dict_entry:
          return dict_entry['codi_comarca']
      else:
          return 0

  df['codi_comarca'] = df['codi_poblacio'].map(get_comarca).apply(pd.Series)

  df['codi_provincia'] = df['codi_poblacio'] // 10000

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

def process_dataset(df, municipi_dict):
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

    reduced_dataset, label_mapping = encode_categorical_columns(clean_df, CATEGORICAL_COLUMNS_TO_ENCODE)

    data_dir = "src/data"
    parquet_path = os.path.join(data_dir, "certificats.parquet")
    json_path = os.path.join(data_dir, "labels.json")
    
    os.makedirs(data_dir, exist_ok=True)

    reduced_dataset.to_parquet(parquet_path, engine="fastparquet", compression="GZIP")
    
    with open(json_path, "w") as f:
        json.dump(label_mapping, f)

    print("✅ Data cleaned and saved to", parquet_path)
    print("✅ Label mapping saved to", json_path)

df = pd.read_json("data/raw_data.json")
process_dataset(df, municipi_dict)
