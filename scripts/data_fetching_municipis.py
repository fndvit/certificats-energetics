import requests
import json
import time

def fetch_all_municipis():
    poblacions = []
    posicio = 0
    limit = 50

    while True:
        url = f"https://api.idescat.cat/pob/v1/cerca.json?p=tipus/mun;posicio/{posicio}"
        try:
            response = requests.get(url)
            response.raise_for_status()
            data = response.json()
        except requests.exceptions.RequestException as e:
            print(f"Request failed at posicio={posicio}: {e}")
            break
        except json.JSONDecodeError as e:
            print(f"JSON decode failed at posicio={posicio}: {e}")
            break

        entries = data.get("feed", {}).get("entry")
        if not entries:
            break

        for e in entries:
            section = e.get("cross:DataSet", {}).get("cross:Section", {})
            obs = section.get("cross:Obs", [])
            total = next((d["OBS_VALUE"] for d in obs if d["SEX"] == "T"), None)

            poblacions.append({
                "nom": e.get("title"),
                "codi": int(section.get("AREA")),
                "poblacio": int(total) if total is not None else None
            })

        posicio += limit
        time.sleep(0.3)

    return poblacions

data = fetch_all_municipis()
with open("src/data/municipis.json", "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Saved municipis file")