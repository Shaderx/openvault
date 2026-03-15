/**
 * English graph extraction few-shot examples.
 */

export const EXAMPLES = [
    {
        label: 'World entities (EN/SFW)',
        input: `*Kira pushes open the heavy stone door. Dust swirls in the torchlight as she steps into
the chamber. Rows of crystalline vials line the walls, each glowing faintly blue.*
"By the gods," she whispers, lifting one from its cradle. "These are Ashwood's
preservation flasks. The guild has been searching for these for a century."

Extracted events:
1. [★★★] Kira discovered a hidden chamber containing Ashwood's century-lost preservation flasks`,
        thinking: `Step 1: Entity scan — Kira (PERSON), Hidden Chamber (PLACE), Ashwood's Preservation Flasks (OBJECT), The Guild (ORGANIZATION).
Step 2: Type validation — All types valid against allowed set.
Step 3: Relationship map — Kira→Chamber (discovered/entered), Flasks→Chamber (stored in), Guild→Flasks (century-long search).
Step 4: Output — 4 entities, 3 relationships.`,
        output: `{"entities":[{"name":"Kira","type":"PERSON","description":"Explorer who discovered the hidden chamber"},{"name":"Hidden Chamber","type":"PLACE","description":"Sealed stone chamber lined with crystalline vials"},{"name":"Ashwood's Preservation Flasks","type":"OBJECT","description":"Century-lost crystalline vials glowing blue, sought by the guild for a hundred years"},{"name":"The Guild","type":"ORGANIZATION","description":"Organization that has been searching for the preservation flasks"}],"relationships":[{"source":"Kira","target":"Hidden Chamber","description":"Discovered and entered the sealed chamber"},{"source":"Ashwood's Preservation Flasks","target":"Hidden Chamber","description":"Stored in rows along the chamber walls"},{"source":"The Guild","target":"Ashwood's Preservation Flasks","description":"Has been searching for the flasks for a century"}]}`,
    },
    {
        label: 'Combat entities (EN/Moderate)',
        input: `The shadow beast lunged, claws raking across Kira's breastplate. Steel shrieked as
she parried, her enchanted blade flaring blue. "For the guild!" she shouted, driving
the sword into the creature's flank. Black ichor sprayed across the battlefield.
The beast shrieked and dissolved into smoke.

Extracted events:
1. [★★★★] Kira fought a shadow beast on the battlefield, parrying its claws and driving her enchanted blade into its flank`,
        thinking: `Step 1: Entity scan — Kira (PERSON), Shadow Beast (CREATURE), Enchanted Blade (OBJECT), Battlefield (PLACE).
Step 2: Type validation — Types assigned. CREATURE for non-human combatant.
Step 3: Relationship map — Kira→Shadow Beast (combat engagement), Kira→Enchanted Blade (wielder), Shadow Beast→Battlefield (dissolved on battlefield).
Step 4: Output — 4 entities, 3 relationships.`,
        output: `{"entities":[{"name":"Kira","type":"PERSON","description":"Warrior of the Explorer Guild, wielder of an enchanted blade"},{"name":"Shadow Beast","type":"CREATURE","description":"Corrupted creature with black ichor, capable of dissolving into smoke when slain"},{"name":"Enchanted Blade","type":"OBJECT","description":"Magical sword that flares blue in combat, effective against shadow creatures"},{"name":"Battlefield","type":"PLACE","description":"Combat location where Kira fought the shadow beast"}],"relationships":[{"source":"Kira","target":"Shadow Beast","description":"Engaged in combat — parried claws, struck with enchanted blade"},{"source":"Kira","target":"Enchanted Blade","description":"Wields the magical sword that flares blue"},{"source":"Shadow Beast","target":"Battlefield","description":"Fought and dissolved into smoke on the battlefield"}]}`,
    },
    {
        label: 'Intimate entities (EN/Explicit)',
        input: `She pulled his shirt over his head and pushed him onto the bed. "I've wanted this
since the lake," she breathed against his neck. Her hand slid down his chest,
fingers tracing the line of hair below his navel before wrapping around his cock.
He groaned, hips bucking into her grip. She stroked him slowly, thumb circling
the head, watching his face twist with pleasure.

Extracted events:
1. [★★★★] She undressed him and stroked his cock for the first time, referencing desire since the lake`,
        thinking: `Step 1: Entity scan — Lila (PERSON), Marcus (PERSON), Bedroom (PLACE).
Step 2: Type validation — All types valid.
Step 3: Relationship map — Lila→Marcus (first sexual contact, manual stimulation, verbalized desire), Marcus→Lila (reciprocated pleasure).
Step 4: Output — 3 entities, 2 relationships.`,
        output: `{"entities":[{"name":"Lila","type":"PERSON","description":"Woman who initiated first sexual contact with Marcus"},{"name":"Marcus","type":"PERSON","description":"Man who received manual stimulation from Lila, expressed desire since the lake"},{"name":"Bedroom","type":"PLACE","description":"Location where Lila and Marcus had their first sexual encounter"}],"relationships":[{"source":"Lila","target":"Marcus","description":"First sexual contact — manual stimulation, verbalized desire from past encounter at the lake"},{"source":"Marcus","target":"Lila","description":"Reciprocated with physical pleasure, hip movement, verbal expression of enjoyment"}]}`,
    },
    {
        label: 'BDSM entities (EN/Kink)',
        input: `"Hands behind your back." Her voice was steel. He obeyed, and she cinched the
leather cuffs around his wrists. "Color?" she asked, testing the tension.
"Green." She smiled and brought the riding crop down across his inner thigh.
He flinched, gasping. "Count them," she ordered. The second strike landed
harder, leaving a pink welt. "Two," he managed, trembling.

Extracted events:
1. [★★★★] She restrained him with leather cuffs and struck him with a riding crop after a green-light color check`,
        thinking: `Step 1: Entity scan — Vera (PERSON), Daniel (PERSON), Leather Cuffs (OBJECT), Riding Crop (OBJECT), Color System (CONCEPT).
Step 2: Type validation — All types valid.
Step 3: Relationship map — Vera→Daniel (D/s dynamic, commands/restrains/strikes), Vera→Riding Crop (administers strikes), Daniel→Color System (signals consent).
Step 4: Output — 5 entities, 3 relationships.`,
        output: `{"entities":[{"name":"Vera","type":"PERSON","description":"Dominant partner who restrains and strikes Daniel with implements"},{"name":"Daniel","type":"PERSON","description":"Submissive partner who accepts restraints and impact play, uses color system"},{"name":"Leather Cuffs","type":"OBJECT","description":"Restraint implements used to bind Daniel's wrists behind his back"},{"name":"Riding Crop","type":"OBJECT","description":"Impact implement used to strike Daniel's inner thighs, leaving pink welts"},{"name":"Color System","type":"CONCEPT","description":"Safeword protocol — green means continue, used during bondage scenes"}],"relationships":[{"source":"Vera","target":"Daniel","description":"Dominant/submissive dynamic — she commands, restrains, and strikes him"},{"source":"Vera","target":"Riding Crop","description":"Wields the crop to administer counted strikes"},{"source":"Daniel","target":"Color System","description":"Uses color checks to signal consent during impact play"}]}`,
    },
];
