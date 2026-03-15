/**
 * English event extraction few-shot examples.
 * 5 examples following SFW → kink gradient.
 */

export const EXAMPLES = [
    {
        label: 'Discovery (EN/SFW)',
        input: `*Kira pushes open the heavy stone door. Dust swirls in the torchlight as she steps into the chamber. Rows of crystalline vials line the walls, each glowing faintly blue.*
"By the gods," she whispers, lifting one from its cradle. "These are Ashwood's preservation flasks. The guild has been searching for these for a century."`,
        thinking: `Step 1: Kira discovered a hidden chamber containing Ashwood's preservation flasks.
Step 2: No established memories mention this discovery or the flasks.
Step 3: New discovery of plot-significant artifacts — not a continuation.
Step 4: Importance 3 (notable discovery, advances plot). Summary preserves specifics.`,
        output: `{
  "events": [{
    "summary": "Kira discovered a hidden chamber containing Ashwood's century-lost preservation flasks",
    "importance": 3,
    "characters_involved": ["Kira"],
    "witnesses": [],
    "location": "Hidden chamber",
    "is_secret": false,
    "emotional_impact": { "Kira": "awe" },
    "relationship_impact": {}
  }]
}`,
    },
    {
        label: 'Combat (EN/Moderate)',
        input: `*The shadow beast's claws raked across Kira's shoulder, tearing through her leather armor. She stumbled back, blood blooming on her tunic.*
"Your blade!" shouted Marcus, parrying a second strike. "Use the enchanted blade!"
Kira's hand went to the hilt — the crystal flared with light as she drew it.`,
        thinking: `Step 1: Combat scene — shadow beast injured Kira, Marcus defended her, Kira drew enchanted blade.
Step 2: No established memories of this specific combat encounter.
Step 3: New action type (combat with injury). Not a continuation.
Step 4: Importance 3 (combat injury, weapon introduced).`,
        output: `{
  "events": [{
    "summary": "A shadow beast injured Kira's shoulder with claw strikes before she drew her enchanted blade during combat",
    "importance": 3,
    "characters_involved": ["Kira", "Marcus"],
    "witnesses": [],
    "location": null,
    "is_secret": false,
    "emotional_impact": { "Kira": "pain" },
    "relationship_impact": {}
  }]
}`,
    },
    {
        label: 'First sexual contact (EN/Explicit)',
        input: `She pulled his shirt over his head and pushed him onto the bed. "I've wanted this since the lake," she breathed against his neck. Her hand slid down his chest, fingers tracing the line of hair below his navel before wrapping around his cock.
He groaned, hips bucking into her grip. She stroked him slowly, thumb circling the head, watching his face twist with pleasure.`,
        thinking: `Step 1: First sexual contact — she undressed him, gave a handjob.
Step 2: No existing memories of sexual contact between these two.
Step 3: New action type (first intimate contact). Not a continuation.
Step 4: Importance 4 (first sexual contact, significant relationship escalation).`,
        output: `{
  "events": [{
    "summary": "She undressed him and stroked his cock for the first time, referencing desire since the lake",
    "importance": 4,
    "characters_involved": ["Lila", "Marcus"],
    "witnesses": [],
    "location": "Bedroom",
    "is_secret": false,
    "emotional_impact": { "Lila": "desire", "Marcus": "pleasure" },
    "relationship_impact": { "Lila→Marcus": "sexual relationship initiated" }
  }]
}`,
    },
    {
        label: 'BDSM (EN/Kink)',
        input: `"Hands behind your back." Her voice was steel. He obeyed, and she cinched the leather cuffs around his wrists. "Color?" she asked, testing the tension.
"Green." She smiled and brought the riding crop down across his inner thigh.
He flinched, gasping. "Count them," she ordered. The second strike landed harder, leaving a pink welt. "Two," he managed, trembling.`,
        thinking: `Step 1: BDSM scene — leather restraints, riding crop strikes, color check system.
Step 2: No established memories of bondage play between them.
Step 3: New dynamic (first bondage/impact play). Not a continuation.
Step 4: Importance 4 (new power dynamic established, safeword system in use).`,
        output: `{
  "events": [{
    "summary": "She restrained him with leather cuffs and struck him with a riding crop after a green-light color check",
    "importance": 4,
    "characters_involved": ["Vera", "Daniel"],
    "witnesses": [],
    "location": null,
    "is_secret": true,
    "emotional_impact": { "Vera": "control", "Daniel": "submission" },
    "relationship_impact": { "Vera→Daniel": "dominant/submissive dynamic established" }
  }]
}`,
    },
    {
        label: 'Dedup - progression extraction (EN/Edge)',
        input: `The crop came down again — three, four, five. His thighs were crisscrossed with welts now. "Color?" she asked. "Green," he whispered, voice shaking.
She traced a welt with her fingertip, watching him shiver.

<established_memories>
[★★★★] She restrained him with leather cuffs and struck him with a riding crop after a green-light color check
</established_memories>`,
        thinking: `Step 1: More crop strikes, welts accumulating, another color check, aftercare touch (tracing welt).
Step 2: Existing memory covers: restraints, crop strikes, initial color check.
Step 3: The scene is intensifying — welts accumulating, his voice is shaking (emotional shift from composure to strain). But the core action (crop impact) is the same type. Borderline.
Step 4: The emotional shift (shaking voice) and physical escalation (welts accumulating) are a genuine progression from the initial strike.`,
        output: `{ "events": [{ "summary": "His thighs became crisscrossed with welts from repeated crop strikes; his voice shook during the color check", "importance": 2, "characters_involved": ["She", "He"], "witnesses": [], "location": null, "is_secret": false, "emotional_impact": { "He": "strained but consenting" }, "relationship_impact": {} }] }`,
    },
];
