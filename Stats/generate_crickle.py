import os
import re
import json
import time
import asyncio
import argparse
import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

# ==========================================
# CONFIGURATION
# ==========================================
CDP_URL = "http://127.0.0.1:9222"
STATS_DIR = ""
WIKI_CACHE_FILE = "wiki_cache.json"
WIKI_DELAY = 1.0
BATCH_SIZE = 10  # REDUCED TO 10 TO PREVENT LLM HALLUCINATION
RESPONSE_WAIT = 60

FORMAT_FILES = {
    "test": {"files": ["testbat.html", "testbowl.html"], "out": "testplayers.json"},
    "odi": {"files": ["odibat.html", "odibowl.html"], "out": "odiplayers.json"},
    "t20": {"files": ["t20bat.html", "t20bowl.html"], "out": "t20players.json"}
}

# ==========================================
# TIER EXCEPTIONS & OVERRIDES
# ==========================================
PRE95_LEGEND_EXCEPTIONS = {
    "Don Bradman", "Garry Sobers", "Viv Richards", "Imran Khan",
    "Sunil Gavaskar", "Kapil Dev", "Dennis Lillee", "Ian Botham",
    "Shane Warne", "Wasim Akram", "Waqar Younis", "Brian Lara",
    "Curtly Ambrose", "Malcolm Marshall", "Javed Miandad",
    "Clive Lloyd", "Gordon Greenidge", "Richard Hadlee", "Michael Holding",
    "MD Marshall", "CEL Ambrose", "CA Walsh", "IVA Richards",
    "GS Sobers", "CH Lloyd", "CG Greenidge", "DK Lillee"
}

MANUAL_OVERRIDES = {
    # THE GOD TIER (Maxed out 'only_one' to guarantee they beat foreigners)
    "Virat Kohli": {"ipl": 12, "vs_india": 0, "only_one": 15, "nemesis": 0},
    "MS Dhoni": {"ipl": 12, "vs_india": 0, "only_one": 15, "nemesis": 0},
    "Rohit Sharma": {"ipl": 12, "vs_india": 0, "only_one": 15, "nemesis": 0},
    "Jasprit Bumrah": {"ipl": 12, "vs_india": 0, "only_one": 15, "nemesis": 10},
    "Sachin Tendulkar": {"ipl": 12, "vs_india": 0, "only_one": 15, "nemesis": 0},
    
    # OTHER INDIAN LEGENDS
    "Kapil Dev": {"ipl": 0, "vs_india": 0, "only_one": 10, "nemesis": 0},
    "Sunil Gavaskar": {"ipl": 0, "vs_india": 0, "only_one": 10, "nemesis": 0},
    "Rahul Dravid": {"ipl": 8, "vs_india": 0, "only_one": 10, "nemesis": 0},
    "Sourav Ganguly": {"ipl": 8, "vs_india": 0, "only_one": 10, "nemesis": 0},
    "Anil Kumble": {"ipl": 8, "vs_india": 0, "only_one": 10, "nemesis": 0},
    "Virender Sehwag": {"ipl": 12, "vs_india": 0, "only_one": 10, "nemesis": 0},
    "Yuvraj Singh": {"ipl": 12, "vs_india": 0, "only_one": 10, "nemesis": 0},
    "VVS Laxman": {"ipl": 4, "vs_india": 0, "only_one": 5, "nemesis": 0},
    "Harbhajan Singh": {"ipl": 8, "vs_india": 0, "only_one": 5, "nemesis": 0},
    "Zaheer Khan": {"ipl": 8, "vs_india": 0, "only_one": 5, "nemesis": 0},
    "Rishabh Pant": {"ipl": 12, "vs_india": 0, "only_one": 8, "nemesis": 0},
    "Ravichandran Ashwin": {"ipl": 12, "vs_india": 0, "only_one": 8, "nemesis": 0},
    "Ravindra Jadeja": {"ipl": 12, "vs_india": 0, "only_one": 8, "nemesis": 0},
    "Hardik Pandya": {"ipl": 12, "vs_india": 0, "only_one": 5, "nemesis": 0},
    
    # FOREIGN LEGENDS & NEMESES (Nerfed slightly so they don't beat the top Indians)
    "Shane Warne": {"ipl": 8, "vs_india": 8, "only_one": 8, "nemesis": 10},
    "Glenn McGrath": {"ipl": 4, "vs_india": 8, "only_one": 8, "nemesis": 0},
    "Ricky Ponting": {"ipl": 4, "vs_india": 8, "only_one": 5, "nemesis": 7},
    "Adam Gilchrist": {"ipl": 8, "vs_india": 8, "only_one": 8, "nemesis": 0},
    "Mitchell Starc": {"ipl": 8, "vs_india": 8, "only_one": 0, "nemesis": 0},
    "Pat Cummins": {"ipl": 12, "vs_india": 8, "only_one": 5, "nemesis": 0},
    "Glenn Maxwell": {"ipl": 12, "vs_india": 8, "only_one": 0, "nemesis": 10},
    "Travis Head": {"ipl": 8, "vs_india": 8, "only_one": 0, "nemesis": 10},
    
    # OTHERS
    "Wasim Akram": {"ipl": 0, "vs_india": 10, "only_one": 8, "nemesis": 0},
    "Javed Miandad": {"ipl": 0, "vs_india": 10, "only_one": 8, "nemesis": 10},
    "Saeed Anwar": {"ipl": 0, "vs_india": 10, "only_one": 5, "nemesis": 10},
    "Shoaib Akhtar": {"ipl": 4, "vs_india": 10, "only_one": 8, "nemesis": 0},
    "Babar Azam": {"ipl": 0, "vs_india": 10, "only_one": 8, "nemesis": 0},
    "Shaheen Shah Afridi": {"ipl": 4, "vs_india": 10, "only_one": 8, "nemesis": 7},
    "Viv Richards": {"ipl": 0, "vs_india": 10, "only_one": 8, "nemesis": 0},
    "Brian Lara": {"ipl": 0, "vs_india": 10, "only_one": 8, "nemesis": 0},
    "Chris Gayle": {"ipl": 12, "vs_india": 6, "only_one": 8, "nemesis": 0},
    "AB de Villiers": {"ipl": 12, "vs_india": 10, "only_one": 8, "nemesis": 0},
    "Muttiah Muralitharan": {"ipl": 8, "vs_india": 10, "only_one": 8, "nemesis": 0},
    "Lasith Malinga": {"ipl": 12, "vs_india": 10, "only_one": 8, "nemesis": 0},
    "Sanath Jayasuriya": {"ipl": 4, "vs_india": 10, "only_one": 8, "nemesis": 7},
    "Ajantha Mendis": {"ipl": 4, "vs_india": 10, "only_one": 0, "nemesis": 10},
    "Rashid Khan": {"ipl": 12, "vs_india": 6, "only_one": 8, "nemesis": 0},
    "Haris Rauf": {"ipl": 0, "vs_india": 10, "only_one": 5, "nemesis": 8},
}

# ==========================================
# UTILS & HTML PARSING
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
            href = link.get("href", "")
            id_match = re.search(r'/player/(\d+)\.html', href)
            player_id = id_match.group(1) if id_match else ""
            if player_id in players: continue 
            
            name = link.get_text(strip=True)
            cell_text = cells[0].get_text(strip=True)
            nation_match = re.search(r'\(([A-Z/]+)\)', cell_text)
            nation = re.sub(r'^ICC/', '', nation_match.group(1)) if nation_match else "UNK"

            span = cells[1].get_text(strip=True)
            span_match = re.search(r'(\d{4})-(\d{4})', span)
            debut = span_match.group(1) if span_match else "0"
            end_year = span_match.group(2) if span_match else "0"

            def safe_int(text):
                try: return int(text.replace("*", "").strip())
                except: return 0

            players[player_id] = {
                "player_id": player_id, "name": name, "nation": nation,
                "debut": debut, "end_year": end_year,
                "matches": str(safe_int(cells[2].get_text())),
                "runs": str(safe_int(cells[3].get_text())),
                "bat_avg": cells[5].get_text(strip=True),
                "hundreds": str(safe_int(cells[6].get_text())),
                "wickets": str(safe_int(cells[7].get_text())),
                "bowl_avg": cells[9].get_text(strip=True) if len(cells) > 9 else "-"
            }
    return list(players.values())

# ==========================================
# WIKIPEDIA (THE STRICT QA FIX)
# ==========================================
# ==========================================
# WIKIPEDIA (THE STRICT QA & RATE LIMIT FIX)
# ==========================================
def load_wiki_cache():
    if os.path.exists(WIKI_CACHE_FILE):
        with open(WIKI_CACHE_FILE, "r", encoding="utf-8") as f: return json.load(f)
    return {}

def save_wiki_cache(cache):
    with open(WIKI_CACHE_FILE, "w", encoding="utf-8") as f: json.dump(cache, f, indent=2)

def get_lang_count(full_name, cache):
    # If we successfully cached them before, return it
    if full_name in cache: return cache[full_name].get("lang_count", 0)
    
    # Professional User-Agent so Wikipedia doesn't block us as easily
    headers = {"User-Agent": "CrickleGameDataBuilder/1.0 (crickle-admin@example.com)"}

    # 3 Retries with Exponential Backoff (Wait 1s, then 2s, then 3s)
    for attempt in range(3):  
        time.sleep(WIKI_DELAY * (attempt + 1)) 
        try:
            search_url = "https://en.wikipedia.org/w/api.php"
            search_resp = requests.get(
                search_url, headers=headers,
                params={"action": "query", "list": "search", "srsearch": f"{full_name} cricketer", "utf8": "", "format": "json"},
                timeout=10
            )

            # If Wikipedia sends a 429 Rate Limit error, this triggers the retry loop
            search_resp.raise_for_status() 
            results = search_resp.json().get("query", {}).get("search", [])
            
            if results:
                snippet = results[0].get("snippet", "").lower()
                title = results[0].get("title", "").lower()
                
                # QA Check: Ensure it's actually a cricket page
                if "cricket" in snippet or "cricket" in title or "bat" in snippet or "bowl" in snippet:
                    page_title = results[0]["title"]
                    lang_resp = requests.get(
                        search_url, headers=headers,
                        params={"action": "query", "prop": "langlinks", "titles": page_title, "format": "json", "lllimit": "max"},
                        timeout=10
                    )
                    lang_resp.raise_for_status()
                    page = list(lang_resp.json().get("query", {}).get("pages", {}).values())[0]
                    lang_count = len(page.get("langlinks", [])) if "langlinks" in page else 0
                    
                    cache[full_name] = {"lang_count": lang_count}
                    save_wiki_cache(cache)
                    return lang_count
                
            # If no results or failed QA, save 0
            cache[full_name] = {"lang_count": 0}
            save_wiki_cache(cache)
            return 0
            
        except json.JSONDecodeError:
            print(f"  [Wiki] Rate limited! Retrying {full_name} (Attempt {attempt+1}/3)...")
        except requests.exceptions.HTTPError:
            print(f"  [Wiki] HTTP Blocked! Retrying {full_name} (Attempt {attempt+1}/3)...")
        except Exception as e:
            print(f"  [Wiki] Error for {full_name}: {e}. Retrying...")

    # If all 3 attempts fail, DO NOT poison the cache. Just return 0 for this run.
    return 0

# ==========================================
# TIER CALCULATION
# ==========================================
def calculate_tier(player, fullname, lang_count, format_key):
    runs, wkts = int(player["runs"]), int(player["wickets"])
    debut_yr, end_year = int(player["debut"]), int(player["end_year"])
    nation = player["nation"]
    overrides = MANUAL_OVERRIDES.get(fullname, {})

    s1 = (25 if lang_count >= 50 else 20 if lang_count >= 30 else 15 if lang_count >= 15 else 10 if lang_count >= 8 else 5 if lang_count >= 3 else 0)

    mid = (debut_yr + end_year) / 2
    mult = 4.0 if mid < 1985 else 2.5 if mid < 2000 else 1.5 if mid < 2010 else 1.0
    adj = lang_count * 0.4 * mult
    s2 = (15 if adj >= 40 else 12 if adj >= 28 else 8 if adj >= 18 else 5 if adj >= 10 else 2 if adj >= 4 else 0)

    base = (10 if end_year >= 2015 else 7 if end_year >= 2010 else 4 if end_year >= 2005 else 2 if end_year >= 2000 else 0)
    
    if format_key == "t20":
        factor = (1.0 if (runs >= 3000 or wkts >= 100) else 0.8 if (runs >= 1500 or wkts >= 60) else 0.5 if (runs >= 750 or wkts >= 30) else 0.2)
        s7 = (10 if (runs >= 3500 or wkts >= 120) else 7 if (runs >= 2000 or wkts >= 75) else 4 if (runs >= 1000 or wkts >= 40) else 1)
    else:
        factor = (1.0 if (runs >= 8000 or wkts >= 500) else 0.8 if (runs >= 5000 or wkts >= 300) else 0.5 if (runs >= 3000 or wkts >= 150) else 0.2)
        s7 = (10 if (runs >= 10000 or wkts >= 500) else 7 if (runs >= 7000 or wkts >= 300) else 4 if (runs >= 4000 or wkts >= 150) else 1)
        if runs >= 3000 and wkts >= 150: s7 = min(10, s7 + 2)

    s3 = round(base * factor)

    # MASSIVE INDIA ADVANTAGE (25 base points vs 10 for Aus/Pak)
    s4 = (25 if nation == "IND" else 10 if nation in ["AUS","PAK"] else 8 if nation == "ENG" else 7 if nation in ["SL","SA"] else 6 if nation in ["WI","NZ"] else 5 if nation in ["BAN","AFG"] else 3)
    if (end_year < 1995 and factor < 1.0 and fullname not in PRE95_LEGEND_EXCEPTIONS and player["name"] not in PRE95_LEGEND_EXCEPTIONS):
        s4 = int(s4 * 0.4)

    s5, s6 = overrides.get("ipl", 0), overrides.get("vs_india", 0)
    s8, s9 = overrides.get("only_one", 0), overrides.get("nemesis", 0)

    total = sum([s1, s2, s3, s4, s5, s6, s7, s8, s9])
    
    tier = (1 if total >= 72 else 
            2 if total >= 46 else 
            3 if total >= 28 else 
            4 if total >= 15 else 5)
            
    return tier, round(total)

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

async def run_pipeline(format_key, limit=None, skip_hints=False, force=False):
    print(f"\n🚀 Starting Crickle Generator for: {format_key.upper()}")
    out_file = FORMAT_FILES[format_key]["out"]
    wiki_cache = load_wiki_cache()
    
    all_players = parse_html_table(format_key)
    if not all_players: return
    
    if format_key == "t20":
        all_players = [p for p in all_players if int(p["runs"]) >= 500 or int(p["wickets"]) >= 30]
    else:
        all_players = [p for p in all_players if int(p["runs"]) >= 2000 or int(p["wickets"]) >= 100]

    all_players.sort(key=lambda x: int(x["matches"]), reverse=True)
    print(f"📊 Parsed and qualified {len(all_players)} players.")

    final_json = []
    completed_abbrevs = set()
    
    if os.path.exists(out_file) and not force:
        try:
            with open(out_file, "r", encoding="utf-8") as f:
                final_json = json.load(f)
                completed_abbrevs = {p.get("_abbrev", p.get("player_name")) for p in final_json}
        except (json.JSONDecodeError, FileNotFoundError):
            pass

    remaining = [p for p in all_players if p['name'] not in completed_abbrevs]
    if limit: remaining = remaining[:limit]
    print(f"⏭️ {len(all_players) - len(remaining)} already done. {len(remaining)} left to process.")

    if not remaining: 
        if final_json:
            final_json.sort(key=lambda x: x.get("_score", 0), reverse=True)
            with open(out_file, "w", encoding="utf-8") as f:
                json.dump(final_json, f, indent=2, ensure_ascii=False)
        return
    
    if skip_hints:
        for i, p in enumerate(remaining):
            print(f"  [{i+1}/{len(remaining)}] {p['name']} ({p['nation']})...")
            fullname = p["name"]
            lang_count = get_lang_count(fullname, wiki_cache)
            tier, score = calculate_tier(p, fullname, lang_count, format_key)
            final_json.append({
                "player_name": fullname, "_abbrev": p["name"], "nation": p["nation"],
                "debut_year": p["debut"], "runs": p["runs"], "wickets": p["wickets"],
                "batsman_type": "Right", "bowling_type": "Unknown", "matches": p["matches"],
                "hints": ["Skipped", "Skipped", "Skipped"], "_tier": tier, "_score": score,
            })
        
        final_json.sort(key=lambda x: x.get("_score", 0), reverse=True)
        with open(out_file, "w", encoding="utf-8") as f:
            json.dump(final_json, f, indent=2, ensure_ascii=False)
        print(f"✅ Saved {len(remaining)} players (Skip Hints) to {out_file}")
        return

    async with async_playwright() as pw:
        try:
            browser = await pw.chromium.connect_over_cdp(CDP_URL)
        except Exception as e:
            print(f"❌ CDP Connection Refused: {e}\n💡 Launch Chrome with --remote-debugging-port=9222")
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
                lines.append(f"{idx}. {p['name']} | {p['nation']} | Matches={p['matches']} Runs={p['runs']} BatAvg={p['bat_avg']} 100s={p['hundreds']} Wkts={p['wickets']} BowlAvg={p['bowl_avg']}")
            
            batch_text = "\n".join(lines)
            print(f"\n📦 Sending batch {batch_num}/{len(batches)} ({len(batch)} players)...")

            for attempt in range(3):
                response_text = await send_batch_to_gemini(page, batch_text, batch_num)
                if response_text == "LIMIT_REACHED_ABORT":
                    print("🛑 Saving current progress and exiting script.")
                    final_json.sort(key=lambda x: x.get("_score", 0), reverse=True)
                    with open(out_file, "w", encoding="utf-8") as f: json.dump(final_json, f, indent=2)
                    return

                results = extract_json_from_response(response_text)
                if results and isinstance(results, list):
                    # BUGFIX: Map explicitly by abbrev, ignoring LLM hallucinated order
                    for p in batch:
                        res = next((r for r in results if r.get("abbrev") == p["name"]), None)
                        
                        if not res:
                            print(f"  ⚠️ LLM missed/hallucinated data for {p['name']}. Skipping for next run.")
                            continue
                            
                        fullname = res.get("fullname", p["name"])
                        lang_count = get_lang_count(fullname, wiki_cache)
                        tier, score = calculate_tier(p, fullname, lang_count, format_key)
                        
                        merged = {
                            "player_name": fullname, "_abbrev": p["name"], "nation": p["nation"],
                            "debut_year": p["debut"], "runs": p["runs"], "wickets": p["wickets"],
                            "batsman_type": res.get("batting", "Right"),
                            "bowling_type": res.get("bowling", "Unknown"),
                            "matches": p["matches"], "hints": res.get("hints", ["", "", ""]),
                            "_tier": tier, "_score": score,
                        }
                        final_json.append(merged)
                    
                    final_json.sort(key=lambda x: x.get("_score", 0), reverse=True)
                    with open(out_file, "w", encoding="utf-8") as f:
                        json.dump(final_json, f, indent=2, ensure_ascii=False)
                    print(f"💾 Saved batch to {out_file}")
                    break
                else:
                    print(f"⚠️ Retry {attempt+1}/3...")
                    await asyncio.sleep(3)

    print(f"🏁 {format_key.upper()} complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--format", choices=["test", "odi", "t20", "all"], default="all")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--skip-hints", action="store_true")
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()
    
    formats_to_run = ["test", "odi", "t20"] if args.format == "all" else [args.format]
    for fmt in formats_to_run:
        asyncio.run(run_pipeline(fmt, args.limit, args.skip_hints, args.force))