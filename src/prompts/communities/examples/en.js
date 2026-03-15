/**
 * English community and global synthesis few-shot examples.
 */

export const COMMUNITIES = [
    {
        label: 'Political faction (EN/SFW)',
        input: `Entities:
- Kira (PERSON): Explorer who discovered the hidden chamber
- Guild Master Aldric (PERSON): Leader of the Explorer Guild
- The Explorer Guild (ORGANIZATION): Organization seeking Ashwood's artifacts
- Ashwood's Preservation Flasks (OBJECT): Century-lost artifacts with resurrection formula

Relationships:
- Kira → Guild Master Aldric: Lied about number of flasks found
- Kira → Ashwood's Flasks: Secretly kept two flasks, practicing resurrection formula
- Guild Master Aldric → The Explorer Guild: Commands operations and assigns missions
- The Explorer Guild → Ashwood's Flasks: Has been searching for a century`,
        thinking: `This is a political intrigue community centered on deception. Kira has betrayed the guild by hiding artifacts. The key finding is that Kira's deception creates an unstable power dynamic - Guild Master Aldric doesn't know about the theft. The resurrection formula is the true prize, making Kira's personal goal potentially catastrophic for the organization. The community structure shows clear conflict potential.`,
        output: `{
  "title": "Explorer Guild Flask Conflict",
  "summary": "A brewing internal conflict centered on Ashwood's preservation flasks. Kira, a guild member, has stolen two flasks and is secretly experimenting with a resurrection formula, directly deceiving Guild Master Aldric. The guild has invested a century into finding these artifacts, making Kira's betrayal a critical threat to the organization's trust structure.",
  "findings": [
    "Kira is a mole within the guild — she has the artifacts they've sought for a century and is hiding them",
    "Guild Master Aldric is unaware of the deception, creating an unstable power dynamic that will likely escalate",
    "The resurrection formula is the true prize — the flasks are means to an undisclosed personal goal for Kira",
    "Discovery of the theft would likely result in Kira's expulsion or worse, given the century-long search investment"
  ]
}`,
    },
    {
        label: 'Combat alliance (EN/Moderate)',
        input: `Entities:
- Captain Harlan (PERSON): Battle-hardened mercenary leader
- Lyra (PERSON): Young mage with healing magic
- Thorne (PERSON): Heavily armored tank fighter
- Shadowbeast Pack (ORGANIZATION): Hostile creature group attacking the party
- Enchanted Blade (OBJECT): Harlan's magical sword

Relationships:
- Harlan → Lyra: Protective mentor relationship, pushes her to use magic despite fear
- Harlan → Thorne: Bickering allies who respect each other's combat roles
- Lyra → Thorne: Healing support during battles
- Thorne → Shadowbeast Pack: Frontline defender taking damage
- Harlan → Enchanted Blade: Wields with expert skill against multiple enemies`,
        thinking: `Combat party with clear role division. Harlan leads, Thorne tanks, Lyra heals. The external threat (Shadowbeast Pack) binds them together. Harlan's mentorship of Lyra is protective but potentially overbearing. Thorne and Harlan have friction but mutual respect. Lyra is the emotional center and potential vulnerability. Key findings: functional combat synergy, protective mentorship that may be overbearing, and external threat as binding force.`,
        output: `{
  "title": "Mercenary Combat Party",
  "summary": "A three-person combat unit with defined roles and interpersonal tensions. Harlan leads with experience, Thorne absorbs damage, and Lyra provides healing support. The party faces external threat from Shadowbeast Pack while internal dynamics include mentorship, bickering camaraderie, and Lyra's struggle with combat fear. Harlan's protective but demanding approach to Lyra creates both growth and pressure.",
  "findings": [
    "Clear role division: Harlan (leader/damage), Thorne (tank), Lyra (healer) — functional combat synergy",
    "Harlan's mentorship of Lyra is supportive but potentially overbearing — he pushes her past comfort zones",
    "Thorne and Harlan's bickering suggests mutual respect tested by stress of constant combat",
    "Lyra is the emotional center and potential vulnerability — her healing is essential but her fear creates risk",
    "External threat (Shadowbeast Pack) binds the party together despite internal friction"
  ]
}`,
    },
    {
        label: 'Intimate network (EN/Explicit)',
        input: `Entities:
- Lila (PERSON): Woman exploring dominant sexuality with Marcus
- Marcus (PERSON): Man becoming sexually submissive to Lila
- Julia (PERSON): Lila's close friend who knows about the dynamic
- Bedroom (PLACE): Private space where their encounters occur
- Hair Pulling (CONCEPT): Sexual act Lila introduced and enjoys

Relationships:
- Lila → Marcus: Sexual dominance, hair-pulling, requests for rougher treatment
- Marcus → Lila: Sexual submission, compliance with her requests, escalating intensity
- Lila → Julia: Confides about sexual encounters, discusses desires
- Julia → Lila: Supportive listener, validates her exploration
- Marcus → Hair Pulling: Initially resisted, now accepts and responds to`,
        thinking: `Intimate relationship network with inverted power dynamics. Lila dominates, Marcus submits. Julia is external confidant providing validation. The escalation pattern (first contact → hair-pulling → feeling owned) shows deepening exploration. Key findings: power inversion with Lila directing, Marcus accepting submission, Julia providing external validation, and escalation suggesting deeper needs being explored.`,
        output: `{
  "title": "Lila and Marcus Intimate Circle",
  "summary": "A sexual dynamic between Lila and Marcus where traditional roles are reversed — Lila dominates and Marcus submits. Their encounters have escalated from first sexual contact to rough play including hair-pulling and requests for feeling 'owned.' Julia serves as Lila's confidant outside the bedroom. Marcus shows increasing comfort with submission while Lila explores her dominant desires.",
  "findings": [
    "Power dynamic has inverted: Lila directs the sexual encounters and makes requests",
    "Marcus accepts submission — initial resistance to hair-pulling transformed into response",
    "Lila uses Julia as emotional outlet to process her dominant sexuality",
    "Escalation pattern: from first contact to hair-pulling to requests for 'feeling owned' suggests deepening exploration",
    "Julia's role as confidant provides Lila validation but also creates secrecy from Marcus about their discussions"
  ]
}`,
    },
];

export const GLOBAL_SYNTHESIS = [
    {
        label: 'Political intrigue (EN)',
        input: `Communities:
- Explorer Guild Flask Conflict: Kira has stolen two of Ashwood's preservation flasks and is secretly experimenting with a resurrection formula, deceiving Guild Master Aldric.
- Royal Court Politics: Queen Elena navigates treacherous court politics while hiding her alliance with the northern rebels.
- Merchant Trade Network: The eastern merchants have formed an embargo against the kingdom, threatening economic collapse.`,
        thinking: `Three separate communities that form a cohesive political narrative. The key connection is the resurrection formula — Kira's theft could be connected to either the court intrigue or the rebellion. Queen Elena's secret alliance with rebels combined with economic pressure from merchants creates a three-way crisis. The synthesis should connect these threads: Kira's theft is the linchpin, the rebellion may need the formula, and economic collapse weakens the monarchy's ability to respond.`,
        output: `{
  "global_summary": "The kingdom faces internal collapse on three fronts. Kira's theft of the resurrection flasks threatens the Explorer Guild's century-long mission and will likely trigger a leadership crisis when discovered. Queen Elena secretly supports northern rebels while maintaining court appearance, creating a powder keg if exposed. Simultaneously, the eastern merchant embargo has begun economic strangulation. These threads connect through the resurrection formula—Kira's goal likely involves reviving someone central to either the court intrigue or the rebellion, making her deception the linchpin holding the entire fragile state together."
}`,
    },
    {
        label: 'War narrative (EN)',
        input: `Communities:
- Mercenary Combat Party: Harlan, Lyra, and Thorne fight Shadowbeast Pack with defined roles but internal tension.
- Northern Rebellion: Rebels prepare to overthrow the monarchy, secretly allied with Queen Elena.
- Ancient Magic Order: Preserves knowledge of Ashwood's resurrection formula, seeking to prevent its misuse.`,
        thinking: `Three communities connected by looming conflict. The mercenary party is ground-level, the rebellion is political, and the Magic Order holds forbidden knowledge. Queen Elena's secret alliance with rebels (from previous context) connects to the threat to the monarchy. The resurrection formula is the key artifact that could change everything. The synthesis should show how these levels connect: the mercenaries may become unwitting players in a larger game, the rebellion will need magical power, and the Order's knowledge will be contested.`,
        output: `{
  "global_summary": "A kingdom on the brink of transformation through war and forbidden magic. The mercenary party serves as the ground-level lens, their survival against Shadowbeasts tied to the larger conflict. Above them, Queen Elena's secret alliance with rebels suggests the monarchy will fall from within, not from external attack. The Ancient Magic Order holds the true power—the resurrection formula—that both sides will likely seek. Harlan's mentorship of Lyra parallels the kingdom's generational transition, with both the party and the nation undergoing identity crises. The narrative trajectory points toward a revelation of the queen's betrayal, a scramble for the resurrection artifact, and the mercenaries caught in the center as survivors of a regime collapse."
}`,
    },
];
