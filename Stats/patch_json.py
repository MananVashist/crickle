import os
import re
import json
import time
import asyncio
import argparse
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

# ==========================================
# CONFIGURATION
# ==========================================
CDP_URL = "http://127.0.0.1:9222"
STATS_DIR = "."  # Or "stats" depending on where you run the script from
BATCH_SIZE = 10
RESPONSE_WAIT = 60

FORMAT_FILES = {
    "test": {"files": ["testbat.html", "testbowl.html"], "out": "testplayers.json"},
    "odi": {"files": ["odibat.html", "odibowl.html"], "out": "odiplayers.json"},
    "t20": {"files": ["t20bat.html", "t20bowl.html"], "out": "t20players.json"}
}

# These players have hand-written hints from your patch file. 
# We lock them here so Gemini doesn't accidentally overwrite them.
PROTECTED_PLAYERS = {
    "Jacques Kallis", "Pragyan Ojha", "Cheteshwar Pujara", "Ishant Sharma",
    "Sourav Ganguly", "Mitchell Starc", "Viv Richards", "Joe Root",
    "Kane Williamson", "Hashim Amla", "Daniel Vettori", "Allan Border",
    "Muttiah Muralidaran", "Muttiah Muralitharan", "Glenn McGrath", "Steven Smith", 
    "Quinton de Kock", "Aaron Finch", "Haris Rauf", "Ajay Jadeja", "KL Rahul", 
    "Ravichandran Ashwin", "Pat Cummins", "Sanju Samson", "Ishan Kishan", "Travis Head",
    "Varun Chakaravarthy", "Ravi Bishnoi", "Shane Watson", "Kevin Pietersen",
    "Dale Steyn", "Saeed Ajmal", "Umar Gul"
}

# ==========================================
# UTILS & HTML PARSING (To get stats for the prompt)
# ==========================================
def extract_json_from_response(text):
    try:
        marker = chr(96) * 3
        pattern = marker + r"(?:json)?\s*([\s\S]*?)\s*" + marker
        match = re.search(pattern, text)
        clean = match.group(1).strip() if match else text.strip()
        start, end = clean.find('['), clean.rfind(']') + 1
        if start != -1 and end != -1:
            return json.loads(clean[start:end])
        return None
    except Exception as e:
        print(f"⚠️ JSON Parse Error: {e}")
        return None

def parse_html_table(format_key):
    players = {}
    for f_name in FORMAT_FILES[format_key]["files"]:
        full_path = os.path.join(STATS_DIR, f_name)
        if not os.path.exists(full_path): continue
        with open(full_path, "r", encoding="utf-8") as f:
            soup = BeautifulSoup(f.read(), "html.parser")
        for row in soup.select("tr.data1, tr.data2"):
            cells = row.find_all("td")
            if len(cells) < 8: continue
            link = cells[0].find("a")
            if not link: continue
            
            name = link.get_text(strip=True)
            
            def safe_int(text):
                try: return int(text.replace("*", "").strip())
                except: return 0

            players[name] = {
                "bat_avg": cells[5].get_text(strip=True),
                "hundreds": str(safe_int(cells[6].get_text())),
                "bowl_avg": cells[9].get_text(strip=True) if len(cells) > 9 else "-"
            }
    return players

# ==========================================
# GEMINI AUTOMATION
# ==========================================
async def send_batch_to_gemini(page, batch_text, batch_num):
    input_selector = "div[contenteditable='true']"
    await page.wait_for_selector(input_selector, timeout=15000)

    input_el = page.locator(input_selector).first
    await input_el.click()
    await page.wait_for_timeout(300)
    await page.keyboard.press("Control+a")
    await page.keyboard.press("Delete")
    await page.wait_for_timeout(300)
    await input_el.fill(batch_text)
    await page.wait_for_timeout(800)

    send_selector = "button[aria-label*='Send'], button[jsname='V67oNd']"
    try:
        await page.wait_for_selector(send_selector, timeout=5000)
        await page.click(send_selector)
    except:
        await page.keyboard.press("Control+Enter")

    print(f"⏳ Batch {batch_num} sent. Waiting for response...")

    for _ in range(RESPONSE_WAIT):
        await page.wait_for_timeout(1000)
        
        limit_box = page.locator("text=/(usage limit|limit reached|you've reached your limit)/i")
        if await limit_box.count() > 0 and await limit_box.first.is_visible():
            print("\n🚨 PRO LIMIT TRIGGERED: Detected the limit box on screen!")
            return "LIMIT_REACHED_ABORT"

        stop = page.locator("[aria-label*='Stop'], [aria-label*='stop']")
        if await stop.count() == 0:
            resp = page.locator(".model-response-text")
            if await resp.count() > 0: break

    await page.wait_for_timeout(2000)

    response_text = ""
    for selector in [".model-response-text", "message-content", "model-response .markdown"]:
        els = page.locator(selector)
        if await els.count() > 0:
            text = await els.last.inner_text()
            if len(text) > 50:
                response_text = text
                break

    if not response_text:
        body = await page.locator("body").inner_text()
        response_text = body[-5000:] if len(body) > 5000 else body

    return response_text

async def run_hint_updater(format_key):
    print(f"\n🚀 Starting IN-PLACE HINT UPGRADE for: {format_key.upper()}")
    out_file = FORMAT_FILES[format_key]["out"]
    
    if not os.path.exists(out_file):
        print(f"❌ {out_file} not found. You must have existing JSON files to upgrade.")
        return

    # Load existing database
    with open(out_file, "r", encoding="utf-8") as f:
        existing_data = json.load(f)

    # Protect manual overrides so they are skipped
    for player in existing_data:
        if player.get("player_name") in PROTECTED_PLAYERS:
            player["_hints_updated"] = True

    # Parse HTML just to get the full stats to send to Gemini for context
    html_stats_map = parse_html_table(format_key)

    remaining = [p for p in existing_data if not p.get("_hints_updated")]
    print(f"⏭️ {len(existing_data) - len(remaining)} players skipped/protected. {len(remaining)} left to upgrade.")

    if not remaining: 
        print(f"✅ All hints in {out_file} are fully upgraded.")
        return

    async with async_playwright() as pw:
        try:
            browser = await pw.chromium.connect_over_cdp(CDP_URL)
        except Exception as e:
            print(f"❌ CDP Connection Refused. Launch Chrome with --remote-debugging-port=9222")
            return

        page = None
        for context in browser.contexts:
            for p in context.pages:
                if "gemini.google.com" in p.url:
                    page = p
                    break
        if not page:
            page = await browser.contexts[0].new_page()
            await page.goto("https://gemini.google.com")

        batches = [remaining[i:i+BATCH_SIZE] for i in range(0, len(remaining), BATCH_SIZE)]
        
        for batch_num, batch in enumerate(batches, 1):
            lines = [f"BATCH {batch_num} — FORMAT: {format_key.upper()}\n"]
            for idx, p in enumerate(batch, 1):
                abbrev = p["_abbrev"]
                sp = html_stats_map.get(abbrev, {"bat_avg": "-", "hundreds": "-", "bowl_avg": "-"})
                lines.append(f"{idx}. {abbrev} | Tier={p.get('_tier', 5)} | {p['nation']} | Matches={p['matches']} Runs={p['runs']} BatAvg={sp['bat_avg']} 100s={sp['hundreds']} Wkts={p['wickets']} BowlAvg={sp['bowl_avg']}")
            
            batch_text = "\n".join(lines)
            print(f"\n📦 Sending batch {batch_num}/{len(batches)} ({len(batch)} players)...")

            for attempt in range(3):
                response_text = await send_batch_to_gemini(page, batch_text, batch_num)
                if response_text == "LIMIT_REACHED_ABORT":
                    print("🛑 Saving current progress and exiting script.")
                    return

                results = extract_json_from_response(response_text)
                if results and isinstance(results, list):
                    
                    # Update ONLY the hints in the master data
                    for p in batch:
                        res = next((r for r in results if r.get("abbrev") == p["_abbrev"]), None)
                        if res and "hints" in res:
                            for master_p in existing_data:
                                if master_p["_abbrev"] == p["_abbrev"]:
                                    master_p["hints"] = res["hints"]
                                    master_p["_hints_updated"] = True # Mark as completed
                                    break
                        else:
                            print(f"  ⚠️ Gemini skipped {p['_abbrev']}. Will retry next run.")
                    
                    # Save the master file in-place
                    with open(out_file, "w", encoding="utf-8") as f:
                        json.dump(existing_data, f, indent=2, ensure_ascii=False)
                    print(f"💾 Hints patched successfully into {out_file}")
                    break
                else:
                    print(f"⚠️ JSON structure failed. Retry {attempt+1}/3...")
                    await asyncio.sleep(3)

    print(f"🏁 {format_key.upper()} hint upgrade complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=["test", "odi", "t20", "all"], default="all")
    args = parser.parse_args()
    
    formats_to_run = ["test", "odi", "t20"] if args.format == "all" else [args.format]
    for fmt in formats_to_run:
        asyncio.run(run_hint_updater(fmt))