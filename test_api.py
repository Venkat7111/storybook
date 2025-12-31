
import urllib.request
import urllib.error
import json

try:
    print("Testing /_test_model...")
    with urllib.request.urlopen("http://127.0.0.1:5000/_test_model") as response:
        print("Status:", response.status)
        print("Body:", response.read().decode())
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Body:", e.read().decode())
except Exception as e:
    print("Error:", e)
