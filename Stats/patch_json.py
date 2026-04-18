import json
import os

# --- 1. EXACT MAPPINGS FROM YOUR RULES ---

test_updates = {
    # Wicketkeepers
    **{p: "wk" for p in [
        "AB de Villiers", "Adam Gilchrist", "Alan Knott", "Alec Stewart", "Andy Flower", "BJ Watling", 
        "Brad Haddin", "Dinesh Chandimal", "Hashan Tillakaratne", "Ian Healy", "Jeff Dujon", "Jonny Bairstow", 
        "KL Rahul", "Kumar Sangakkara", "Mark Boucher", "Matt Prior", "Mushfiqur Rahim", "Ollie Pope", 
        "Quinton de Kock", "Rishabh Pant", "Rod Marsh", "Rohan Kanhai", "Tom Latham", "Brendon McCullum", 
        "Clyde Walcott", "Mahendra Singh Dhoni", "Kusal Mendis", "Rahul Dravid", "Tillakaratne Dilshan"
    ]},
    # Fast / Medium
    **{p: "Fast" for p in [
        "Ajinkya Rahane", "Allan Lamb", "Andrew Strauss", "Bill Lawry", "Clem Hill", "Darren Bravo", 
        "Dennis Amiss", "Dilip Vengsarkar", "Gordon Greenidge", "Graeme Wood", "Graham Thorpe", 
        "Herbert Sutcliffe", "Herschelle Gibbs", "Ian Redpath", "John Edrich", "John Wright", "Justin Langer", 
        "Kim Hughes", "Marcus Trescothick", "Matthew Hayden", "Michael Slater", "Mohammad Azharuddin", 
        "Navjot Singh Sidhu", "Peter May", "Richie Richardson", "Robin Smith", "Stephen Fleming", 
        "Usman Khawaja", "Zak Crawley"
    ]},
    # Spin
    **{p: "Spin" for p in [
        "David Boon", "Gautam Gambhir", "Inzamam-ul-Haq", "Saeed Anwar", "Tamim Iqbal"
    ]}
}

odi_updates = {
    # Wicketkeepers
    **{p: "wk" for p in [
        "Adam Gilchrist", "Adam Parore", "Alec Stewart", "Andy Flower", "Brad Haddin", "Brendon McCullum", 
        "Jonny Bairstow", "KL Rahul", "Kumar Sangakkara", "Kusal Mendis", "Kusal Perera", "Mark Boucher", 
        "Mohammad Rizwan", "Mohammad Shahzad", "Moin Khan", "Mushfiqur Rahim", "Quinton de Kock", 
        "Romesh Kaluwitharana", "Shai Hope", "Tom Latham", "Umar Akmal", "AB de Villiers", "MS Dhoni", 
        "Rahul Dravid", "Tatenda Taibu", "Tillakaratne Dilshan", "Dinesh Chandimal", "Kamran Akmal",
        "Abraham Benjamin de Villiers", "Jos Buttler" # <-- Newly added
    ]},
    # Fast / Medium
    **{p: "Fast" for p in [
        "Ajinkya Rahane", "Allan Lamb", "Andrew Strauss", "Darren Bravo", "Desmond Haynes", "Dilip Vengsarkar", 
        "Eoin Morgan", "Geoff Marsh", "Hashim Amla", "Herschelle Gibbs", "Jason Roy", "John Wright", 
        "Jonty Rhodes", "Mark Taylor", "Navjot Singh Sidhu", "Nick Knight", "Stuart Carlisle", "Darren Gough", 
        "Ian Bell", "Jacob Oram", "Matthew Hayden", "Tim Southee", "Venkatesh Prasad", "George Bailey", "Roshan Mahanama"
    ]},
    # Spin
    **{p: "Spin" for p in [
        "Craig Ervine", "David Boon", "David Gower", "David Miller", "Gary Kirsten", "Gautam Gambhir", 
        "Imam-ul-Haq", "Pathum Nissanka", "Ramiz Raja", "Salman Butt", "Shikhar Dhawan", "Shubman Gill", 
        "Tamim Iqbal", "Upul Tharanga", "William Porterfield", "Gus Logie", "Shaun Marsh"
    ]}
}

t20_updates = {
    # Wicketkeepers
    **{p: "wk" for p in [
        "Aasif Sheikh", "AB de Villiers", "Brendan Taylor", "Brendon McCullum", "Devon Conway", "Dharma Kesuma", 
        "Didier Ndikubwimana", "Finn Allen", "Gary Wilson", "Imal Liyanage", "Irfan Karim", "Ishan Kishan", 
        "Johnson Charles", "Jos Buttler", "Kannur Lokesh Rahul (KL Rahul)", "Kusal Mendis", "Kusal Perera", 
        "Litton Das", "Lorcan Tucker", "Mahendra Singh Dhoni", "Manpreet Singh", "Matthew Cross", "Matthew Wade", 
        "Meet Bhavsar", "Mohammad Rizwan", "Mohammad Shahzad", "Mushfiqur Rahim", "Nicholas Pooran", 
        "Orchide Manishimwe", "Prashant Kurup", "Quinton de Kock", "Rahmanullah Gurbaz", "Rishabh Pant", 
        "Sanju Samson", "Scott Edwards", "Shaheryar Butt", "Shai Hope", "Simon Ssesazi", "Sulaimon Runsewe", 
        "Tadiwanashe Marumani", "Tim Seifert", "Umar Akmal", "Usman Patel", "Zeeshan Ali",
        "Jonny Bairstow", "Kumar Sangakkara", "Philip Salt" # <-- Newly added
    ]},
    # Fast / Medium
    **{p: "Fast" for p in [
        "Abdul Waheed", "Ahmer Bin Nasir", "Alex Hales", "Alishan Sharafu", "Babar Hayat", "Ben Cooper", 
        "Eoin Morgan", "George Munsey", "Jason Roy", "Kendel Kadowaki-Fleming", "Mahela Jayawardene", 
        "Orchide Tuyisenge", "Pathum Nissanka", "Sahibzada Farhan", "Tony Ura", "Zubaidi Zulkifle", 
        "Johannes Jonathan Smit", "Kyle Coetzer", "Sami Sohail", "Harry Brook", "Ibrahim Zadran", "Razmal Shigiwal",
        "Hashim Amla" # <-- Newly added
    ]},
    # Spin
    **{p: "Spin" for p in [
        "Ahmed Shehzad", "Asif Khan", "Craig Ervine", "Faisal Khan", "Fiaz Ahmed", "Haider Butt", "Hazratullah Zazai", 
        "Ivan Selemani", "Jatinder Singh", "Jonty Jenner", "Martin Guptill", "Reeza Hendricks", "Shikhar Dhawan", 
        "Tamim Iqbal", "Tanzid Hasan", "Roelof van der Merwe", "Yasim Murtaza", "Afif Hossain", 
        "Andrew Balbirnie", "Brandon King", "Shimron Hetmyer"
    ]}
}

# --- 2. PATCH FUNCTION ---

def patch_json(filename, updates_dict):
    if not os.path.exists(filename):
        print(f"Skipped {filename}: File not found in directory.")
        return

    with open(filename, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    updated_count = 0
    for player in data:
        name = player.get("player_name")
        if name in updates_dict:
            player["bowling_type"] = updates_dict[name]
            updated_count += 1
            
    # Save back with identical formatting, leaving everything else untouched
    with open(filename, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        
    print(f"Successfully updated {updated_count} players in {filename}")

# --- 3. EXECUTE ---

if __name__ == "__main__":
    patch_json('testplayers.json', test_updates)
    patch_json('odiplayers.json', odi_updates)
    patch_json('t20players.json', t20_updates)