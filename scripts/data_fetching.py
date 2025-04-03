import requests
import json

url = "https://analisi.transparenciacatalunya.cat/resource/j6ii-t3w2.json"
params = {"$limit": 100}

response = requests.get(url, params=params)

if response.status_code == 200:
    data = response.json()
    with open("data/raw_data.json", "w") as f:
        json.dump(data, f)
else:
    print(f"Request failed with status code: {response.status_code}")