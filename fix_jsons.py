"""
Run from project root: python check_jsons.py
Checks stats against PDF source using last name matching. Read-only.
"""
import json, os, re

JSON_FILES = {
    'Test': 'src/testplayers.json',
    'ODI':  'src/odiplayers.json',
    'T20':  'src/t20players.json',
}

INITIALS_OK = {
    'MS Dhoni','VVS Laxman','KL Rahul','AB de Villiers',
    'JP Duminy','BJ Watling','GD McGrath','MS Wade',
}

def is_abbreviated(name):
    if name in INITIALS_OK: return False
    parts = name.strip().split()
    return len(parts) >= 2 and len(parts[0]) <= 4 and parts[0].isupper() and parts[0].isalpha()

PDF_STATS_PATH = 'pdf_stats.json'
pdf_stats = None
if os.path.exists(PDF_STATS_PATH):
    with open(PDF_STATS_PATH, encoding='utf-8') as f:
        raw_pdf = json.load(f)
    # Re-key by last name
    pdf_stats = {}
    for fmt, players in raw_pdf.items():
        pdf_stats[fmt] = {}
        for pdf_name, data in players.items():
            last = pdf_name.split()[-1].lower()
            ex = pdf_stats[fmt].get(last)
            # Keep the one with more runs (avoids overwriting Tendulkar with someone else)
            if ex is None or data['runs'] > ex['runs']:
                pdf_stats[fmt][last] = {**data, 'pdf_name': pdf_name}
    print("PDF stats loaded.\n")
else:
    print("pdf_stats.json not found — skipping stat cross-check.\n")

fmt_key_map = {'Test':'test','ODI':'odi','T20':'t20'}
REQUIRED = ['player_name','nation','debut_year','runs','wickets',
            'matches','batsman_type','bowling_type','hints']

total_issues = 0

for fmt, path in JSON_FILES.items():
    print(f"\n{'='*60}")
    print(f"  {fmt}  —  {path}")
    print(f"{'='*60}")

    if not os.path.exists(path):
        print("  ERROR: file not found"); continue

    with open(path,'rb') as f: raw = f.read()
    try:    players = json.loads(raw.decode('utf-8-sig'))
    except: players = json.loads(raw.decode('latin-1'))

    name_key = 'player_name' if 'player_name' in players[0] else 'name'
    print(f"  Players: {len(players)}")

    # Duplicates
    seen = {}
    for i, p in enumerate(players):
        n = p.get(name_key,'')
        if n in seen:
            print(f"  ⚠ DUPLICATE: '{n}' at index {seen[n]} and {i}")
            total_issues += 1
        seen[n] = i

    pdf_fmt = pdf_stats.get(fmt_key_map[fmt], {}) if pdf_stats else {}
    issues = []

    for p in players:
        name = p.get(name_key,'???')
        row = []

        # Missing fields
        for field in REQUIRED:
            val = p.get(field)
            if val is None or str(val).strip() in ('','null','None'):
                row.append(f"missing {field}")

        # Hints
        hints = p.get('hints',[])
        if not isinstance(hints, list) or len(hints) < 3:
            row.append(f"hints: only {len(hints) if isinstance(hints,list) else 0}")
        else:
            for i,h in enumerate(hints[:3]):
                if not str(h).strip():
                    row.append(f"hint{i+1} blank")

        # Numeric
        for field in ['runs','wickets','matches','debut_year']:
            val = p.get(field,'')
            try: int(str(val))
            except: row.append(f"{field} not numeric ({val!r})")

        # Abbreviated
        if is_abbreviated(name):
            row.append("name looks abbreviated")

        # Stat cross-check by last name
        if pdf_fmt:
            last = name.split()[-1].lower()
            pdf = pdf_fmt.get(last)
            if pdf:
                try:
                    j_r = int(str(p.get('runs',0)))
                    j_w = int(str(p.get('wickets',0)))
                    j_m = int(str(p.get('matches',0)))
                    j_d = int(str(p.get('debut_year',0)))
                    if j_r != pdf['runs']:
                        row.append(f"runs: json={j_r} pdf={pdf['runs']} (pdf name: {pdf['pdf_name']})")
                    if j_w != pdf['wickets']:
                        row.append(f"wickets: json={j_w} pdf={pdf['wickets']} (pdf name: {pdf['pdf_name']})")
                    if j_m != pdf['matches']:
                        row.append(f"matches: json={j_m} pdf={pdf['matches']} (pdf name: {pdf['pdf_name']})")
                    if j_d != pdf['debut']:
                        row.append(f"debut: json={j_d} pdf={pdf['debut']} (pdf name: {pdf['pdf_name']})")
                except: pass
            else:
                row.append(f"last name '{last}' not in PDF — manual check")

        if row:
            issues.append((name, row))

    total_issues += len(issues)
    if not issues:
        print("  ✓ All good")
    else:
        print(f"  Issues in {len(issues)} players:\n")
        for name, probs in issues:
            print(f"  ✗  {name}")
            for pr in probs:
                print(f"       → {pr}")

print(f"\n{'='*60}")
print(f"  TOTAL ISSUES: {total_issues}")
print(f"{'='*60}\n")