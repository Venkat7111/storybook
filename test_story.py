
import urllib.request
import urllib.error
import json

url = "http://127.0.0.1:5000/generate_story"
data = {
    "story_idea": "A brave little toaster going to mars",
    "cartoon_style": "Pixar",
    "language": "English",
    "edu_mode": False
}
json_data = json.dumps(data).encode('utf-8')

try:
    print(f"Testing {url} with payload {data}...")
    req = urllib.request.Request(url, data=json_data, headers={'Content-Type': 'application/json'})
    with urllib.request.urlopen(req) as response:
        print("Status:", response.status)
        print("Body:", response.read().decode()[:500]) # First 500 chars

except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)

    body = e.read().decode()
    print("Body:", body)
    with open("debug_output.txt", "w", encoding="utf-8") as f:
        f.write(body)
    try:
        j = json.loads(body)
        if 'raw' in j:
            print("RAW OUTPUT:", j['raw'])
    except:
        pass
except Exception as e:
    print("Error:", e)
