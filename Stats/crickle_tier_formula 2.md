# Crickle Tier Formula — Reference Document

## Overview
9 signals, 100 points total. Maps to 5 tiers based on recognizability to an Indian cricket fan aged 20–40.

**Tier thresholds:**
| Score | Tier | Audience |
|---|---|---|
| 72+ | 1 | Household names — embarrassing not to guess |
| 52–71 | 2 | Regular fans |
| 35–51 | 3 | Serious fans |
| 18–34 | 4 | Students of the game |
| <18 | 5 | Historians only |

---

## Signal 1 — Wikipedia Language Editions (max 25 pts)

Count of langlinks from the player's Wikipedia page.

| Editions | Points |
|---|---|
| 50+ | 25 |
| 30–49 | 20 |
| 15–29 | 15 |
| 8–14 | 10 |
| 3–7 | 5 |
| <3 | 0 |

---

## Signal 2 — Era-Adjusted Pageview Proxy (max 15 pts)

Players from before the internet era accumulate fewer Wikipedia views unfairly. Apply an era multiplier.

```
mid_year = (debut_year + end_year) / 2
era_mult = 4.0  if mid_year < 1985
         = 2.5  if mid_year < 2000
         = 1.5  if mid_year < 2010
         = 1.0  otherwise

adjusted = lang_count × 0.4 × era_mult
```

| Adjusted value | Points |
|---|---|
| 40+ | 15 |
| 28–39 | 12 |
| 18–27 | 8 |
| 10–17 | 5 |
| 4–9 | 2 |
| <4 | 0 |

---

## Signal 3 — Recency × Career Significance Cap (max 10 pts)

**CRITICAL: The cap must be applied.** Prevents obscure recent players from scoring too high.

**Step 1 — Base from end_year:**
| end_year | Base |
|---|---|
| 2015+ | 10 |
| 2010–2014 | 7 |
| 2005–2009 | 4 |
| 2000–2004 | 2 |
| Before 2000 | 0 |

**Step 2 — Career significance factor:**
| Career level | Factor |
|---|---|
| 8000+ runs OR 500+ wickets | 1.0 |
| 5000+ runs OR 300+ wickets | 0.8 |
| 3000+ runs OR 150+ wickets | 0.5 |
| Below that | 0.2 |

**S3 = round(base × factor)**

Example: A recent pacer with 80 wickets → base 10 × factor 0.2 = 2 pts, not 10.

---

## Signal 4 — Nation (max 10 pts)

| Nation | Points |
|---|---|
| IND | 10 |
| AUS, PAK | 9 |
| ENG | 8 |
| SL, SA | 7 |
| WI, NZ | 6 |
| BAN, AFG | 5 |
| ZIM, IRE, others | 3 |

**Pre-1995 penalty:** If end_year < 1995 AND factor < 1.0 AND player NOT in legend exceptions → multiply nation score by 0.4.

**Pre-1995 Legend Exceptions** (exempt from penalty):
Don Bradman, Garry Sobers, Viv Richards, Imran Khan, Sunil Gavaskar, Kapil Dev, Dennis Lillee, Ian Botham, Shane Warne, Wasim Akram, Waqar Younis, Brian Lara, Curtly Ambrose, Malcolm Marshall, Javed Miandad, Clive Lloyd, Gordon Greenidge, Michael Holding

Also check abbreviated Statsguru forms: MD Marshall, CEL Ambrose, CA Walsh, IVA Richards, GS Sobers, CH Lloyd, CG Greenidge, DK Lillee

---

## Signal 5 — IPL Involvement (max 12 pts) — MANUAL

| Level | Points |
|---|---|
| Marquee player, 5+ seasons, household name in India | 12 |
| Regular, 3–5 seasons, well-known | 8 |
| Appeared 1–3 seasons | 4 |
| No IPL or pre-IPL era | 0 |

---

## Signal 6 — Performance vs India (max 10 pts) — MANUAL

| Level | Points |
|---|---|
| 10+ matches vs India AND memorable specific moment | 10 |
| 10+ matches vs India, no particular standout | 6 |
| 5–10 matches vs India | 3 |
| Rarely or never played India | 0 |

---

## Signal 7 — Career Significance (max 10 pts) — AUTO

Allrounder bonus: if 3000+ runs AND 150+ wickets, add 2 pts (capped at 10).

| Achievement | Points |
|---|---|
| 10,000+ runs OR 500+ wickets | 10 |
| 7,000+ runs OR 300+ wickets | 7 |
| 4,000+ runs OR 150+ wickets | 4 |
| Below that | 1 |

---

## Signal 8 — "Only One" Factor (max 8 pts) — MANUAL

Is this player THE person associated with something in fan recognition? Not statistical uniqueness — how fans identify them. Shakib = Bangladesh cricket. Malinga = that action.

| Level | Points |
|---|---|
| Defines their nation/era/role — you think of them first | 8 |
| Strong association with something specific | 5 |
| One of many similar players | 0 |

---

## Signal 9 — Nemesis/Meme Bonus (max 15 pts) — MANUAL

Award only when a player burned themselves into Indian fan memory through a specific cultural moment. This is rare.

| Level | Points |
|---|---|
| Defines a cultural moment: WC final heroics vs India, viral meme, infamous incident | 15 |
| Memorable but not defining | 7 |
| None | 0 |

---

## Manual Override Values

For all players NOT listed, use 0 for signals 5, 6, 8, 9.

```
# India
Virat Kohli:              ipl=12  vs_india=0   only_one=8  nemesis=0
MS Dhoni:                 ipl=12  vs_india=0   only_one=8  nemesis=0
Rohit Sharma:             ipl=12  vs_india=0   only_one=8  nemesis=0
Jasprit Bumrah:           ipl=12  vs_india=0   only_one=8  nemesis=0
Sachin Tendulkar:         ipl=12  vs_india=0   only_one=8  nemesis=0
Kapil Dev:                ipl=0   vs_india=0   only_one=8  nemesis=0
Sunil Gavaskar:           ipl=0   vs_india=0   only_one=8  nemesis=0
Rahul Dravid:             ipl=8   vs_india=0   only_one=8  nemesis=0
Sourav Ganguly:           ipl=8   vs_india=0   only_one=8  nemesis=0
Anil Kumble:              ipl=8   vs_india=0   only_one=8  nemesis=0
Virender Sehwag:          ipl=12  vs_india=0   only_one=8  nemesis=0
VVS Laxman:               ipl=4   vs_india=0   only_one=5  nemesis=0
Yuvraj Singh:             ipl=12  vs_india=0   only_one=8  nemesis=15
Harbhajan Singh:          ipl=8   vs_india=0   only_one=5  nemesis=0
Zaheer Khan:              ipl=8   vs_india=0   only_one=5  nemesis=0
Rishabh Pant:             ipl=12  vs_india=0   only_one=5  nemesis=0
Ravichandran Ashwin:      ipl=12  vs_india=0   only_one=8  nemesis=0
Ravindra Jadeja:          ipl=12  vs_india=0   only_one=8  nemesis=0
Hardik Pandya:            ipl=12  vs_india=0   only_one=5  nemesis=0
Suresh Raina:             ipl=12  vs_india=0   only_one=5  nemesis=0
Shikhar Dhawan:           ipl=8   vs_india=0   only_one=5  nemesis=0
KL Rahul:                 ipl=12  vs_india=0   only_one=5  nemesis=0
Mohammed Shami:           ipl=12  vs_india=0   only_one=5  nemesis=7
Ishant Sharma:            ipl=8   vs_india=0   only_one=0  nemesis=0
Cheteshwar Pujara:        ipl=4   vs_india=0   only_one=5  nemesis=0
Yuzvendra Chahal:         ipl=8   vs_india=0   only_one=0  nemesis=0
Gautam Gambhir:           ipl=12  vs_india=0   only_one=5  nemesis=0
Javagal Srinath:          ipl=0   vs_india=0   only_one=8  nemesis=0
Mohammad Azharuddin:      ipl=0   vs_india=0   only_one=5  nemesis=0
Suryakumar Yadav:         ipl=12  vs_india=0   only_one=8  nemesis=0
Kuldeep Yadav:            ipl=8   vs_india=0   only_one=5  nemesis=0
Arshdeep Singh:           ipl=12  vs_india=0   only_one=5  nemesis=0

# Australia
Shane Warne:              ipl=8   vs_india=10  only_one=8  nemesis=15
Glenn McGrath:            ipl=4   vs_india=10  only_one=8  nemesis=0
Ricky Ponting:            ipl=4   vs_india=10  only_one=5  nemesis=7
Matthew Hayden:           ipl=8   vs_india=10  only_one=5  nemesis=0
Adam Gilchrist:           ipl=8   vs_india=10  only_one=8  nemesis=0
Steve Waugh:              ipl=0   vs_india=10  only_one=5  nemesis=0
Allan Border:             ipl=0   vs_india=10  only_one=5  nemesis=0
Michael Clarke:           ipl=4   vs_india=10  only_one=5  nemesis=0
Mitchell Johnson:         ipl=8   vs_india=10  only_one=0  nemesis=0
Mitchell Starc:           ipl=8   vs_india=10  only_one=0  nemesis=0
Pat Cummins:              ipl=12  vs_india=10  only_one=5  nemesis=0
Josh Hazlewood:           ipl=8   vs_india=10  only_one=5  nemesis=0
Nathan Lyon:              ipl=0   vs_india=10  only_one=8  nemesis=7
David Warner:             ipl=12  vs_india=10  only_one=5  nemesis=0
Steve Smith:              ipl=8   vs_india=10  only_one=5  nemesis=0
Glenn Maxwell:            ipl=12  vs_india=10  only_one=0  nemesis=15
Travis Head:              ipl=8   vs_india=10  only_one=0  nemesis=15
Andrew Symonds:           ipl=8   vs_india=10  only_one=0  nemesis=15
Brett Lee:                ipl=8   vs_india=10  only_one=5  nemesis=7
Marnus Labuschagne:       ipl=4   vs_india=6   only_one=5  nemesis=0
Usman Khawaja:            ipl=0   vs_india=6   only_one=5  nemesis=0
Aaron Finch:              ipl=4   vs_india=6   only_one=5  nemesis=0
Dennis Lillee:            ipl=0   vs_india=6   only_one=8  nemesis=0

# England
Ian Botham:               ipl=0   vs_india=6   only_one=8  nemesis=0
James Anderson:           ipl=0   vs_india=6   only_one=8  nemesis=0
Stuart Broad:             ipl=0   vs_india=6   only_one=5  nemesis=0
Ben Stokes:               ipl=12  vs_india=10  only_one=8  nemesis=0
Alastair Cook:            ipl=0   vs_india=6   only_one=8  nemesis=0
Joe Root:                 ipl=4   vs_india=10  only_one=5  nemesis=0
Kevin Pietersen:          ipl=4   vs_india=10  only_one=5  nemesis=0
Jofra Archer:             ipl=12  vs_india=6   only_one=0  nemesis=0
Jos Buttler:              ipl=12  vs_india=6   only_one=0  nemesis=0
Eoin Morgan:              ipl=4   vs_india=6   only_one=8  nemesis=0
Andrew Flintoff:          ipl=0   vs_india=6   only_one=8  nemesis=0
Adil Rashid:              ipl=0   vs_india=6   only_one=5  nemesis=0

# Pakistan
Wasim Akram:              ipl=0   vs_india=10  only_one=8  nemesis=0
Waqar Younis:             ipl=0   vs_india=10  only_one=5  nemesis=0
Imran Khan:               ipl=0   vs_india=10  only_one=8  nemesis=0
Javed Miandad:            ipl=0   vs_india=10  only_one=8  nemesis=15
Inzamam-ul-Haq:           ipl=0   vs_india=10  only_one=5  nemesis=0
Saeed Anwar:              ipl=0   vs_india=10  only_one=5  nemesis=10
Shoaib Akhtar:            ipl=4   vs_india=10  only_one=8  nemesis=0
Younis Khan:              ipl=0   vs_india=10  only_one=8  nemesis=0
Mohammad Yousuf:          ipl=0   vs_india=10  only_one=5  nemesis=0
Babar Azam:               ipl=0   vs_india=10  only_one=8  nemesis=0
Shaheen Shah Afridi:      ipl=4   vs_india=10  only_one=8  nemesis=7
Mohammad Rizwan:          ipl=4   vs_india=10  only_one=5  nemesis=0
Shahid Afridi:            ipl=4   vs_india=10  only_one=8  nemesis=7
Shoaib Malik:             ipl=4   vs_india=10  only_one=5  nemesis=0
Mohammad Hafeez:          ipl=4   vs_india=10  only_one=5  nemesis=0
Saqlain Mushtaq:          ipl=0   vs_india=10  only_one=8  nemesis=0
Yasir Shah:               ipl=0   vs_india=10  only_one=5  nemesis=0
Azhar Ali:                ipl=0   vs_india=10  only_one=5  nemesis=0
Shadab Khan:              ipl=4   vs_india=10  only_one=5  nemesis=0

# West Indies
Viv Richards:             ipl=0   vs_india=10  only_one=8  nemesis=0
Malcolm Marshall:         ipl=0   vs_india=10  only_one=5  nemesis=0
Curtly Ambrose:           ipl=0   vs_india=10  only_one=5  nemesis=0
Courtney Walsh:           ipl=0   vs_india=10  only_one=0  nemesis=0
Brian Lara:               ipl=0   vs_india=10  only_one=8  nemesis=0
Chris Gayle:              ipl=12  vs_india=6   only_one=8  nemesis=0
Kieron Pollard:           ipl=12  vs_india=6   only_one=0  nemesis=0
Andre Russell:            ipl=12  vs_india=6   only_one=0  nemesis=0
Sunil Narine:             ipl=12  vs_india=6   only_one=0  nemesis=0
Shivnarine Chanderpaul:   ipl=0   vs_india=6   only_one=5  nemesis=0

# Sri Lanka
Muttiah Muralitharan:     ipl=8   vs_india=10  only_one=8  nemesis=0
Lasith Malinga:           ipl=12  vs_india=10  only_one=8  nemesis=0
Kumar Sangakkara:         ipl=8   vs_india=10  only_one=5  nemesis=0
Mahela Jayawardene:       ipl=8   vs_india=10  only_one=5  nemesis=0
Sanath Jayasuriya:        ipl=4   vs_india=10  only_one=8  nemesis=7
Rangana Herath:           ipl=0   vs_india=10  only_one=8  nemesis=0
Chaminda Vaas:            ipl=0   vs_india=10  only_one=5  nemesis=0
Aravinda de Silva:        ipl=0   vs_india=6   only_one=5  nemesis=7
Tillakaratne Dilshan:     ipl=4   vs_india=10  only_one=8  nemesis=0
Angelo Mathews:           ipl=4   vs_india=6   only_one=5  nemesis=0
Ajantha Mendis:           ipl=4   vs_india=10  only_one=0  nemesis=15
Arjuna Ranatunga:         ipl=0   vs_india=10  only_one=8  nemesis=7
Wanindu Hasaranga de Silva:ipl=8  vs_india=6   only_one=8  nemesis=0

# South Africa
Dale Steyn:               ipl=8   vs_india=10  only_one=8  nemesis=0
AB de Villiers:           ipl=12  vs_india=10  only_one=8  nemesis=0
Graeme Smith:             ipl=4   vs_india=10  only_one=8  nemesis=0
Hashim Amla:              ipl=8   vs_india=10  only_one=8  nemesis=0
Kagiso Rabada:            ipl=12  vs_india=6   only_one=0  nemesis=0
Faf du Plessis:           ipl=12  vs_india=6   only_one=0  nemesis=0
Quinton de Kock:          ipl=12  vs_india=6   only_one=0  nemesis=0
Shaun Pollock:            ipl=0   vs_india=10  only_one=8  nemesis=0
Allan Donald:             ipl=0   vs_india=10  only_one=5  nemesis=0
Makhaya Ntini:            ipl=0   vs_india=10  only_one=5  nemesis=0

# New Zealand
Kane Williamson:          ipl=8   vs_india=10  only_one=8  nemesis=0
Brendon McCullum:         ipl=12  vs_india=6   only_one=8  nemesis=0
Trent Boult:              ipl=12  vs_india=6   only_one=0  nemesis=0
Tim Southee:              ipl=8   vs_india=6   only_one=0  nemesis=0
Ross Taylor:              ipl=4   vs_india=6   only_one=5  nemesis=0
Richard Hadlee:           ipl=0   vs_india=6   only_one=8  nemesis=0
Martin Guptill:           ipl=0   vs_india=6   only_one=5  nemesis=0
Ish Sodhi:                ipl=0   vs_india=6   only_one=5  nemesis=0
Adam Zampa:               ipl=0   vs_india=6   only_one=5  nemesis=0

# Bangladesh
Shakib Al Hasan:          ipl=8   vs_india=6   only_one=8  nemesis=0
Tamim Iqbal:              ipl=0   vs_india=6   only_one=8  nemesis=0
Mushfiqur Rahim:          ipl=0   vs_india=6   only_one=0  nemesis=7
Mahmudullah:              ipl=0   vs_india=6   only_one=0  nemesis=0
Mustafizur Rahman:        ipl=4   vs_india=6   only_one=5  nemesis=0

# Afghanistan
Rashid Khan:              ipl=12  vs_india=6   only_one=8  nemesis=0

# Ireland
Kevin O'Brien:            ipl=0   vs_india=0   only_one=0  nemesis=7
Paul Stirling:            ipl=0   vs_india=0   only_one=5  nemesis=0
```

---

## Notes

- S1 and S2 require Wikipedia lang_count. If Wikipedia fails, both default to 0.
- S5, S6, S8, S9 are manual only. Any player not listed gets 0 for all four.
- S7 is derived from stats automatically.
- The formula is intentionally biased toward Indian fan recognition. Nation scores and vs_india values reflect this.
- When adding new players, only add to MANUAL_OVERRIDES if they have meaningful IPL/India history or a nemesis moment. Otherwise leave them out — they default to 0.
