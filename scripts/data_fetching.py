import requests
import json
import os

url = "https://analisi.transparenciacatalunya.cat/resource/j6ii-t3w2.json"
params = {"$limit": 1400000}

response = requests.get(url, params=params)

if response.status_code == 200:
    data = response.json()

    os.makedirs("data", exist_ok=True)

    with open("data/raw_data.json", "w") as f:
        json.dump(data, f)
else:
    print(f"Request failed with status code: {response.status_code}")