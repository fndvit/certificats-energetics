import pandas as pd

df = pd.read_csv("data/raw_data.csv")
df.to_parquet("data/processed_data.parquet", engine="fastparquet", compression="GZIP")
print("✅ Data cleaned and saved to data/processed_data.parquet")