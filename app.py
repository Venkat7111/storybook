import os
import json
import re
import traceback
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app)

# Config
API_KEY = os.getenv("GEMINI_API_KEY")
MODEL_NAME = "gemini-2.5-flash"
if API_KEY:
	os.environ.setdefault('GOOGLE_API_KEY', API_KEY)

# Try to import new genai client
genai = None
try:
    from google import genai
except Exception as e:
    genai = None
    print("google-genai not available:", e)

# Try to import legacy client as fallback
legacy_gen = None
try:
	import google.generativeai as legacy_gen_import
	legacy_gen = legacy_gen_import
except Exception:
	legacy_gen = None

# Detect supported flavor
genai_api_flavor = None
genai_client = None
genai_model_obj = None

if genai:
	# Try TextGenerationModel
	if hasattr(genai, 'TextGenerationModel'):
		try:
			genai_model_obj = genai.TextGenerationModel.from_pretrained(MODEL_NAME)
			genai_api_flavor = 'TextGenerationModel'
			print('Detected genai.TextGenerationModel API')
		except Exception as e:
			print('TextGenerationModel init failed:', e)

	# Try TextGenerationClient
	if not genai_api_flavor and hasattr(genai, 'TextGenerationClient'):
		try:
			genai_client = genai.TextGenerationClient()
			genai_api_flavor = 'TextGenerationClient'
			print('Detected genai.TextGenerationClient API')
		except Exception as e:
			print('TextGenerationClient init failed:', e)

	# Try simple generate function
	if not genai_api_flavor and hasattr(genai, 'generate'):
		genai_api_flavor = 'genai.generate'
		print('Detected genai.generate convenience API')

# If no new client flavor found, but legacy present
if not genai_api_flavor and legacy_gen:
	try:
		legacy_gen.configure(api_key=API_KEY)
		genai_api_flavor = 'legacy'
		print('Using legacy google.generativeai API')
	except Exception as e:
		print('legacy configure failed:', e)

print('API flavor:', genai_api_flavor)



def clean_json_text(text):
	"""Clean markdown code blocks from text to extract JSON."""
	if not text:
		return ""
	# Remove ```json ... ``` or just ``` ... ```
	text = re.sub(r'```json\s*', '', text, flags=re.IGNORECASE)
	text = re.sub(r'```\s*', '', text)
	return text.strip()


def call_model(prompt_text, max_tokens=1200, temperature=0.7, safety_settings=None):
	"""Call the available model using detected client flavor. Returns response object or raises."""
	# Common config for JSON response where supported
	json_config = {"response_mime_type": "application/json"}
	
	if genai_api_flavor == 'TextGenerationModel' and genai_model_obj is not None:
		return genai_model_obj.generate(prompt=prompt_text, max_output_tokens=max_tokens, temperature=temperature)

	if genai_api_flavor == 'TextGenerationClient' and genai_client is not None:
		# Try common signatures
		try:
			return genai_client.generate(model=MODEL_NAME, prompt=prompt_text, max_output_tokens=max_tokens, temperature=temperature)
		except TypeError:
			return genai_client.generate(prompt=prompt_text, max_output_tokens=max_tokens)

	if genai_api_flavor == 'genai.generate' and genai:
		return genai.generate(model=MODEL_NAME, prompt=prompt_text, max_output_tokens=max_tokens, temperature=temperature)

	if genai_api_flavor == 'legacy' and legacy_gen:
		m = legacy_gen.GenerativeModel(MODEL_NAME)
		# Add response_mime_type to generation_config for legacy client (gemini-1.5/2.5 supports it)
		gen_config = {"max_output_tokens": max_tokens, "temperature": temperature, "response_mime_type": "application/json"}
		return m.generate_content(prompt_text, safety_settings=safety_settings or [], generation_config=gen_config)

	raise RuntimeError('No supported genai client available')


def extract_text_from_response(resp):
	"""Robust extraction of text from various response shapes."""
	try:
		# common attributes
		if resp is None:
			return None
		if hasattr(resp, 'text') and isinstance(resp.text, str) and resp.text.strip():
			return resp.text.strip()
		if hasattr(resp, 'output_text') and isinstance(resp.output_text, str) and resp.output_text.strip():
			return resp.output_text.strip()
		if hasattr(resp, 'output') and resp.output:
			# try first element
			first = resp.output[0]
			if isinstance(first, str):
				return first
			if isinstance(first, dict):
				# nested content
				if 'content' in first and isinstance(first['content'], list) and first['content']:
					c0 = first['content'][0]
					if isinstance(c0, dict) and 'text' in c0:
						return c0['text']
				if 'text' in first and isinstance(first['text'], str):
					return first['text']
		# legacy generations
		if hasattr(resp, 'generations') and resp.generations:
			gen = resp.generations[0]
			if isinstance(gen, dict) and 'text' in gen:
				return gen['text']
			if hasattr(gen, 'text'):
				return gen.text
		# fallback to str
		try:
			s = str(resp)
			if s and s.strip():
				return s.strip()
		except Exception:
			pass
	except Exception as e:
		print('Error extracting text:', e)
	return None


@app.route('/', methods=['GET'])
def index():
	return render_template('index.html')


@app.route('/generate_story', methods=['POST'])
def generate_story():
	data = request.get_json(silent=True)
	if not data:
		return jsonify({"error": "Invalid JSON"}), 400

	story_idea = data.get('story_idea')
	cartoon_style = data.get('cartoon_style') or ''
	language = data.get('language') or 'English'
	edu_mode = bool(data.get('edu_mode', False))

	if not story_idea:
		return jsonify({"error": "story_idea is required"}), 400

	# Minimal compact prompt to reduce size and safety filtering
	mode = 'EDUCATIONAL' if edu_mode else 'CREATIVE'
	prompt = (
		f"Return ONLY valid JSON for a children's storybook."
		f" Topic: {story_idea}."
		f" Language: {language}. Style: {cartoon_style}. Mode: {mode}."
		" JSON keys required: book_title, topic, learning_goal, pages(5) with page_number, concept_name, story_text, simple_explanation, image_prompt, narration_text, summary, translations, speech_metadata."
	)


	safety_settings = [
		{"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE"},
		{"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE"},
		{"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE"},
		{"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE"},
	]

	try:
		resp = call_model(prompt, max_tokens=8192, temperature=0.7, safety_settings=safety_settings)
	except Exception as e:
		print('Model invocation failed:', e)
		traceback.print_exc()
		return jsonify({"error": "Model call failed on server. See logs."}), 503

	text = extract_text_from_response(resp)
	if not text:
		print('Empty response from model. resp repr:', repr(resp))
		return jsonify({"error": "Empty response from model"}), 502

	# Clean the text
	cleaned_text = clean_json_text(text)
	
	# Attempt to find JSON if there is still surrounding junk, but clean_json_text should handle the blocks
	m = re.search(r"\{.*\}", cleaned_text, re.DOTALL)
	json_str = m.group(0) if m else cleaned_text

	try:
		story_data = json.loads(json_str)
		return jsonify(story_data)
	except Exception as e:
		print('Failed to parse JSON from model output:', e)
		print('Original text snippet:', text[:500])
		print('Cleaned text snippet:', cleaned_text[:500])
		return jsonify({"error": "AI response was not valid JSON", "raw": text[:800]}), 500


@app.route('/_test_model', methods=['GET'])
def test_model():
	try:
		resp = call_model('Say hello in one short sentence.', max_tokens=50, temperature=0.2)
	except Exception as e:
		print('Test call failed:', e)
		traceback.print_exc()
		return jsonify({"ok": False, "error": "Model call failed"}), 503

	text = extract_text_from_response(resp) or ''
	return jsonify({"ok": True, "text_snippet": text.strip()[:300]})


if __name__ == '__main__':
	app.run(debug=True)
