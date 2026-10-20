import requests
import json
import os

from columns import RAW_COLUMNS_IN_USE

url = "https://analisi.transparenciacatalunya.cat/resource/j6ii-t3w2.json"
# Only request the fields the pipeline reads, to keep the download and memory small
params = {"$limit": 2000000, "$select": ",".join(RAW_COLUMNS_IN_USE)}

os.makedirs("static", exist_ok=True)

response = requests.get(url, params=params)

if response.status_code != 200:
    print(f"Request failed with status code: {response.status_code}")
    raise SystemExit(1)

data = response.json()
if not data:
    print("Empty response — no certificates fetched.")
    raise SystemExit(1)

with open("static/raw_data.json", "w") as f:
    json.dump(data, f)

print(f"Fetched {len(data)} certificates.")