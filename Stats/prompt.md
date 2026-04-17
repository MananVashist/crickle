I am building a trivia game pipeline. I have attached the system instructions, persona, and constraints for generating trivia hints in the document crickle_hint_prompt 2.md.

I will shortly begin sending you large batches of cricket player stats. For every batch, you must process each player using the persona, tone, and difficulty arc logic in the attached prompt document.

You must return a single, valid JSON array containing objects for all players in that batch.

CRUCIAL INSTRUCTION FOR NAME RESOLUTION: The input I send will contain abbreviated names from a database (e.g. "SR Tendulkar" or "JM Anderson"). You MUST resolve this to their widely recognized full name (e.g. "Sachin Tendulkar", "James Anderson") and output it under the exact JSON key "fullname". You must also copy the original abbreviation exactly as I sent it under the key "abbrev".

The objects must map exactly to this structure:

"abbrev": The exact abbreviation from the input.

"fullname": The resolved full name.

"batting": Right/Left

"bowling": Fast/Spin/Unknown

"hints": The array of exactly 3 generated hints based on their Tier.

CRITICAL: You must not include any introductory text, pleasantries, or concluding remarks—only the raw JSON block. Do not format it with markdown if you can avoid it, just output the JSON.
JSON VALIDATION RULE: You are writing a strict JSON array. If you need to use quotes inside your hints (for nicknames, quotes, or emphasis), you MUST use single quotes ('like this'). Do NOT use double quotes inside your hint strings, or you will break the JSON parser.

If you understand the persona constraints, the JSON formatting rules, the name resolution rule, and the difficulty arc rules outlined in the document, reply with the single word: "Ready".