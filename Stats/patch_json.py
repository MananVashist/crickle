"""
manual_patch2.py — second round of hint rewrites.

Run from your stats folder:
  python manual_patch2.py
"""

import json, os

HINT_CHANGES = {
    "odiplayers.json": {
        "Wasim Akram": [
            "Redefined how late movement could be weaponized in white-ball cricket.",
            "Could dismantle batting lineups in short bursts under pressure.",
            "The Sultan of Swing."
        ],
        "Yuvraj Singh": [
            "Played through a major health battle while performing at the highest level.",
            "Delivered multiple match-winning performances in a single global tournament.",
            "Hit six sixes in an over."
        ],
        "Ricky Ponting": [
            "Built dominance through both batting and an almost confrontational leadership style.",
            "Led one of the most complete teams the format has seen.",
            "Destroyed India in the 2003 World Cup final."
        ],
        "Virat Kohli": [
            "Built his white-ball game around controlled aggression and chase pacing.",
            "Turned run chases into repeatable processes rather than one-off performances.",
            "India's greatest modern ODI chaser."
        ],
        "Chaminda Vaas": [
            "Relied on accuracy and swing rather than pace to dominate early overs.",
            "Often carried the new-ball responsibility for his team.",
            "Sri Lanka's left-arm swing spearhead."
        ],
        "Stephen Fleming": [
            "Known more for tactical intelligence than individual dominance.",
            "Built a reputation as a calm, methodical leader.",
            "New Zealand's long-time captain and elegant left-hander."
        ],
        "Mark Waugh": [
            "Possessed one of the smoothest batting styles of his era.",
            "Often frustrated fans by throwing away starts.",
            "The more elegant but less driven Waugh twin."
        ],
        "Alec Stewart": [
            "Balanced dual roles in the team across formats.",
            "Played through a transitional period for his side.",
            "England's wicketkeeper-opener in the 90s."
        ],
    },
    "t20players.json": {
        "David Miller": [
            "Built a reputation as a finisher through clean ball striking rather than improvisation.",
            "Often turned games late with minimal footwork and maximum power.",
            "Killer Miller."
        ],
        "Mitchell Santner": [
            "Operates through control rather than wicket-taking bursts.",
            "Trusted in tight phases due to consistency and temperament.",
            "New Zealand's left-arm spinner and utility all-rounder."
        ],
        "Shadab Khan": [
            "Balances multiple roles depending on team requirements.",
            "Often contributes in key moments despite inconsistent phases.",
            "Pakistan's leg-spinning all-rounder."
        ],
        "Martin Guptill": [
            "Relied heavily on power hitting within specific scoring zones.",
            "Was once among the most feared openers in white-ball cricket.",
            "New Zealand's explosive opening batter."
        ],
        "Eoin Morgan": [
            "Changed how his team approached white-ball batting philosophy.",
            "Led a cultural reset that prioritized aggression over caution.",
            "England's World Cup-winning captain."
        ],
    },
    "testplayers.json": {
        "Jacques Kallis": [
            "Delivered elite contributions across disciplines without dramatic flair.",
            "Maintained consistency across conditions for over a decade.",
            "South Africa's complete Test all-rounder."
        ],
        "Rahul Dravid": [
            "Thrived in difficult conditions where survival mattered more than scoring.",
            "Was relied upon when the rest of the lineup struggled.",
            "The Wall."
        ],
        "Joe Root": [
            "Adapted his technique to remain productive across formats and conditions.",
            "Often carried batting responsibility during unstable phases.",
            "Part of the Fab 4."
        ],
        "Alastair Cook": [
            "Built his career around discipline rather than dominance.",
            "Accumulated runs by outlasting rather than overpowering bowlers.",
            "England's most consistent Test opener."
        ],
        "Mark Waugh": [
            "Combined elegance with inconsistency throughout his career.",
            "Often looked in control before losing focus.",
            "Australia's stylish middle-order batter of the 90s."
        ],
        "Inzamam-ul-Haq": [
            "Played spin and pace with unusual calmness under pressure.",
            "Built a reputation for timing rather than movement.",
            "Pakistan's composed middle-order anchor."
        ],
    },
}


def main():
    for filename in ["testplayers.json", "odiplayers.json", "t20players.json"]:
        if not os.path.exists(filename):
            print(f"  ⚠️  {filename} not found")
            continue

        with open(filename, "r", encoding="utf-8") as f:
            data = json.load(f)

        hint_map = HINT_CHANGES.get(filename, {})
        changed = 0

        for p in data:
            name = p["player_name"]
            if name in hint_map:
                p["hints"] = hint_map[name]
                print(f"  [{filename}] {name}: hints updated")
                changed += 1

        with open(filename, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

        print(f"  [{filename}] {changed} players updated.\n")

    print("✅ Done.")


if __name__ == "__main__":
    main()