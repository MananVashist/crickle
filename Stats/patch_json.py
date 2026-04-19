import json
import os

# --- 1. DEFINE NATION MAPPINGS ---

odi_nations = {
    "Abdul Razzaq": "PAK",
    "Abraham Benjamin de Villiers": "SA",
    "Anil Kumble": "IND",
    "Ashish Nehra": "IND",
    "Boeta Dippenaar": "SA",
    "Chaminda Vaas": "SL",
    "Dale Steyn": "SA",
    "Dilhara Fernando": "SL",
    "Elton Chigumbura": "ZIM",
    "Graeme Smith": "SA",
    "Harbhajan Singh": "IND",
    "Heath Streak": "ZIM",
    "Inzamam-ul-Haq": "PAK",
    "Jacques Kallis": "SA",
    "Kumar Sangakkara": "SL",
    "MS Dhoni": "IND",
    "Mahela Jayawardene": "SL",
    "Mark Boucher": "SA",
    "Mashrafe Mortaza": "BAN",
    "Mohammad Ashraful": "BAN",
    "Mohammad Rafique": "BAN",
    "Mohammad Yousuf": "PAK",
    "Morne Morkel": "SA",
    "Muttiah Muralidaran": "SL",
    "Rahul Dravid": "IND",
    "Sanath Jayasuriya": "SL",
    "Saeed Anwar": "PAK",
    "Shahid Afridi": "PAK",
    "Shaun Pollock": "SA",
    "Shoaib Akhtar": "PAK",
    "Sourav Ganguly": "IND",
    "Steve Tikolo": "KEN",
    "Tatenda Taibu": "ZIM",
    "Thomas Odoyo": "KEN",
    "Upul Tharanga": "SL",
    "Virender Sehwag": "IND",
    "Vusi Sibanda": "ZIM",
    "Yuvraj Singh": "IND",
    "Zaheer Khan": "IND"
}

t20_nations = {
    "David Miller": "SA",
    "Faf du Plessis": "SA",
    "Hashim Amla": "SA",
    "Imran Tahir": "SA",
    "Ross Taylor": "NZ",
    "Sabawoon Davizi": "CZE",
    "Samuel Badree": "WI",
    "Tamim Iqbal": "BAN",
    "Thisara Perera": "SL"
}

# --- 2. PATCH FUNCTION ---

def patch_nations(filename, nation_updates):
    if not os.path.exists(filename):
        print(f"Skipped {filename}: File not found in directory.")
        return

    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    updated_count = 0
    for player in data:
        name = player.get("player_name")
        if name in nation_updates:
            player["nation"] = nation_updates[name]
            updated_count += 1
            
    # Save back with identical formatting, leaving everything else untouched
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully updated nations for {updated_count} players in {filename}")

# --- 3. EXECUTE ---

if __name__ == "__main__":
    patch_nations('odiplayers.json', odi_nations)
    patch_nations('t20players.json', t20_nations)