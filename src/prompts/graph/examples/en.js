/**
 * English graph extraction few-shot examples.
 */

export const EXAMPLES = [
    {
        label: 'Betrayal setup (EN/SFW)',
        input: `*The war room was empty except for the two of them. General Halverson spread the
map across the table, tracing the northern pass with a gloved finger.*
"The garrison at Ironhold doesn't know the supply line has been rerouted," he said.
"They're expecting reinforcements that won't come."
Captain Yuen stared at the map. *He's not telling command. He's telling me.*
"Why are you showing me this?"
"Because you're the only officer I trust to make the right decision when it matters."

Extracted events:
1. [★★★★] General Halverson revealed to Captain Yuen that Ironhold garrison has been misled — reinforcements rerouted without their knowledge`,
        thinking: `Step 1: Entity scan — General Halverson (PERSON), Captain Yuen (PERSON), Ironhold Garrison (ORGANIZATION), Northern Pass (PLACE), Rerouted Supply Line (CONCEPT).
Step 2: Type validation — All types valid.
Step 3: Relationship map — Halverson→Yuen (disclosed classified information, trust claim), Halverson→Ironhold (withheld supply line reroute), Yuen→Ironhold (now aware of the deception), Halverson→Northern Pass (strategic focus point).
Step 4: Output — 5 entities, 4 relationships.`,
        output: `{"entities":[{"name":"General Halverson","type":"PERSON","description":"Senior officer who rerouted supply lines without informing Ironhold garrison; revealed this selectively to Yuen"},{"name":"Captain Yuen","type":"PERSON","description":"Officer trusted by Halverson with classified information about Ironhold's abandoned reinforcements"},{"name":"Ironhold Garrison","type":"ORGANIZATION","description":"Military garrison stationed at the northern pass, unaware their reinforcements have been rerouted"},{"name":"Northern Pass","type":"PLACE","description":"Strategic chokepoint where Ironhold garrison is stationed"},{"name":"Rerouted Supply Line","type":"CONCEPT","description":"Classified decision to divert reinforcements away from Ironhold, kept from the garrison itself"}],"relationships":[{"source":"General Halverson","target":"Captain Yuen","description":"Disclosed the reroute deception, framing Yuen as the only trusted officer — establishing leverage or complicity"},{"source":"General Halverson","target":"Ironhold Garrison","description":"Withheld supply reroute from the garrison, leaving them expecting reinforcements that won't arrive"},{"source":"Captain Yuen","target":"Ironhold Garrison","description":"Now aware of the deception — positioned as either whistleblower or accomplice"},{"source":"General Halverson","target":"Northern Pass","description":"Strategic focus of his undisclosed operational decision"}]}`,
    },
    {
        label: 'Hunt and fracture (EN/Moderate)',
        input: `The forest swallowed the light. Petra moved through the undergrowth without sound,
crossbow raised, tracking the shape ahead. Then she heard Caio's boot snap a branch.
The quarry bolted. Petra spun and grabbed Caio's collar.
"That was three days of tracking." Her voice was ice.
"I slipped." His jaw was tight. "It won't happen again."
"It better not." She shoved him back. "Because next time I leave you at camp."

Extracted events:
1. [★★★] Petra and Caio lost their quarry after Caio snapped a branch; Petra confronted him with a threat to exclude him from future hunts`,
        thinking: `Step 1: Entity scan — Petra (PERSON), Caio (PERSON), The Quarry (PERSON/CREATURE — unknown), Forest (PLACE).
Step 2: Type validation — Quarry marked as CREATURE (unidentified target). All valid.
Step 3: Relationship map — Petra→Caio (command authority, physical confrontation, conditional threat), Caio→Petra (subordinate, defensive), Petra→Quarry (hunter, three-day track), Forest→Quarry (escape route).
Step 4: Output — 4 entities, 4 relationships.`,
        output: `{"entities":[{"name":"Petra","type":"PERSON","description":"Lead hunter; tracked quarry for three days; physically confronted Caio and threatened to exclude him from future hunts"},{"name":"Caio","type":"PERSON","description":"Petra's partner; snapped a branch that spooked the quarry; defensive under her confrontation"},{"name":"The Quarry","type":"CREATURE","description":"Unidentified target tracked for three days through the forest; bolted on noise"},{"name":"Forest","type":"PLACE","description":"Dense woodland where the three-day hunt took place; swallowed the quarry after the breach"}],"relationships":[{"source":"Petra","target":"Caio","description":"Exerts command authority — physically grabbed, confronted, issued conditional threat of exclusion"},{"source":"Caio","target":"Petra","description":"Operates in subordinate role; offered defence but accepted responsibility under pressure"},{"source":"Petra","target":"The Quarry","description":"Three-day active hunt; lost track after Caio's noise"},{"source":"The Quarry","target":"Forest","description":"Bolted into the forest and escaped after the noise breach"}]}`,
    },
    {
        label: 'First night (EN/Explicit)',
        input: `She pulled the door shut behind them and turned before he could speak. Her hands
went to his belt. He caught her wrists — not stopping her, steadying himself.
"You sure?" he managed.
"I've been sure since the conference." She pushed his hands away and finished
what she started. He was already hard when she wrapped her fingers around his cock.
"Bedroom," he said, voice rough. She walked backward, pulling him by the waistband.

Extracted events:
1. [★★★★] She initiated first sexual contact with him — unbuckled his belt and gripped his cock; he asked for confirmation and she referenced desire since the conference`,
        thinking: `Step 1: Entity scan — Nadia (PERSON), Elias (PERSON), Apartment (PLACE), Conference (EVENT — referenced past context).
Step 2: Type validation — Conference tagged as EVENT (prior context anchor). All valid.
Step 3: Relationship map — Nadia→Elias (initiated first sexual contact, explicit reference to pre-existing desire), Elias→Nadia (confirmed consent, physically yielded control), Nadia→Apartment (location of first encounter), Nadia→Conference (desire origin point).
Step 4: Output — 4 entities, 4 relationships.`,
        output: `{"entities":[{"name":"Nadia","type":"PERSON","description":"Initiated the encounter — unbelted him, gripped his cock, led him toward the bedroom; referenced desire since the conference"},{"name":"Elias","type":"PERSON","description":"Reached for her wrists to steady himself; verbally confirmed consent; yielded physical control to her"},{"name":"Apartment","type":"PLACE","description":"Location of their first sexual encounter; she shut the door and initiated immediately"},{"name":"Conference","type":"EVENT","description":"Prior context event where Nadia's desire for Elias began — referenced by her as the starting point"}],"relationships":[{"source":"Nadia","target":"Elias","description":"Initiated first sexual contact — unbuckled, gripped his cock, pulled him toward the bedroom by waistband"},{"source":"Elias","target":"Nadia","description":"Expressed verbal consent, released physical control, physically aroused before she led him further"},{"source":"Nadia","target":"Apartment","description":"Scene of first encounter — she shut the door and turned on him immediately"},{"source":"Nadia","target":"Conference","description":"Named the conference as the origin of her desire — framing this as delayed intention, not impulse"}]}`,
    },
    {
        label: 'Rope scene (EN/Kink)',
        input: `"Arms out." Sable's voice left no room. Marcus extended both arms and she looped
the jute rope around his wrists in a single fluid motion — wrist cuff, two columns,
frictionless lock. She tested the tension with two fingers.
"Color?"
"Green." His voice was steadier than he felt.
She ran the tail up his forearms, over his elbows, cinched it behind his back.
When she stepped in front of him, she tilted his chin up with one finger.
"Good. Now you stay exactly like that."

Extracted events:
1. [★★★★] Sable bound Marcus's wrists and arms with jute rope using a structured column tie, confirmed green consent, and ordered him to hold position`,
        thinking: `Step 1: Entity scan — Sable (PERSON), Marcus (PERSON), Jute Rope (OBJECT), Color Protocol (CONCEPT).
Step 2: Type validation — All types valid.
Step 3: Relationship map — Sable→Marcus (dominant command, performed rope work, chin-tilt assertion), Marcus→Sable (submitted, voiced consent, obeyed), Sable→Jute Rope (executed structured tie), Marcus→Color Protocol (green response, consent active).
Step 4: Output — 4 entities, 4 relationships.`,
        output: `{"entities":[{"name":"Sable","type":"PERSON","description":"Dominant rigger — executed structured jute column tie on Marcus's wrists and arms; issued commands and asserted control with chin-tilt"},{"name":"Marcus","type":"PERSON","description":"Submissive partner — extended arms on command, gave green color check, held position as ordered"},{"name":"Jute Rope","type":"OBJECT","description":"Bondage implement used by Sable — wrist cuffs, two-column tie, frictionless lock, run up to elbows and behind back"},{"name":"Color Protocol","type":"CONCEPT","description":"Consent check system — green signals proceed; used mid-scene before escalation"}],"relationships":[{"source":"Sable","target":"Marcus","description":"Dominant/rigger role — commanded, tied, tested tension, tilted his chin; physical and psychological control"},{"source":"Marcus","target":"Sable","description":"Submissive role — obeyed arm extension, voiced green consent, held position on order"},{"source":"Sable","target":"Jute Rope","description":"Executed a structured column tie with frictionless lock; tested tension with two fingers"},{"source":"Marcus","target":"Color Protocol","description":"Actively used color system — green response before arm-and-back binding escalation"}]}`,
    },
];
