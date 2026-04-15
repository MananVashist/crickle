import google.generativeai as genai
import json
import time

# WARNING: Delete this key from your Google AI Studio account after using it and generate a new one.
API_KEY = "AIzaSyBdRVZ102r3awYYOfe-ZTdNssFC1csNZtA"
genai.configure(api_key=API_KEY)

def upload_to_gemini(path, mime_type="application/pdf"):
    print(f"Uploading {path}...")
    file = genai.upload_file(path, mime_type=mime_type)
    print(f"Uploaded {file.display_name} as: {file.uri}")
    return file

def generate_crickle_json():
    # Upload your PDFs (make sure these match the filenames on your computer)
    batsmen_file = upload_to_gemini("Batsmen test.pdf")
    bowlers_file = upload_to_gemini("Bowlers test.pdf")

    # We use the Pro model because it handles large documents and complex reasoning best
    model = genai.GenerativeModel('gemini-2.0-flash')

    prompt = """
    Create a JSON array for my Crickle game based ONLY on the provided PDFs. 
    
    Conditions:
    1. Only test playing nations players to be included. Also include top recognisable players from associate nations like AFG, BAN, and Ireland.
    2. Format: Test matches.
    3. Include only top players from 1970 to 1990. For 1990+, include all players in the pdf.
    4. Provide exactly 3 hints per player.
    5. Hints must be as brutal, insulting, and creative as possible. Hit the ego of the user. Expletives are allowed. Do not be repetitive.
    
    Data to include per player:
    - player_name
    - runs
    - wickets
    - debut_year (extract or infer starting span year)
    - nation
    - batsman_type (left/right)
    - bowling_type (spin/medium/fast)
    - hints (array of 3 strings)
    
    Output ONLY valid JSON. Do not include markdown blocks like ```json.
    Generate as many players as you can fit in your output limit.
    """

    print("Sending request to Gemini... This might take a minute.")
    
    try:
        response = model.generate_content(
            [batsmen_file, bowlers_file, prompt],
            request_options={"timeout": 600} # 10 minute timeout for large processing
        )
        
        # Clean up the response text just in case the model adds markdown
        raw_text = response.text.strip()
        if raw_text.startswith("```json"):
            raw_text = raw_text[7:]
        if raw_text.endswith("```"):
            raw_text = raw_text[:-3]
            
        # Validate and save
        json_data = json.loads(raw_text)
        
        with open("test_players.json", "w", encoding="utf-8") as f:
            json.dump(json_data, f, indent=4)
            
        print(f"Success! Saved {len(json_data)} players to test_players.json")
        
    except Exception as e:
        print(f"An error occurred: {e}")
        print("Raw response (if available):", getattr(response, 'text', 'No text returned'))

if __name__ == "__main__":
    generate_crickle_json()