/**
 * English reflection-domain few-shot examples.
 * Covers questions, unified reflections, and insights.
 */

export const QUESTIONS = [
    {
        label: 'Adventure psychology (EN/SFW)',
        input: `Recent memories for Kira:
1. [★★★] Kira discovered a hidden chamber containing Ashwood's century-lost preservation flasks
2. [★★] Kira argued with guild master about sharing the flask discovery
3. [★★★★] Kira lied to the guild about finding only three flasks, secretly keeping two
4. [★★★] Kira decoded ancient text on the flask labels revealing a resurrection formula
5. [★★] Kira practiced the formula alone at night, burning her fingertips on failed attempts`,
        output: `<thinking>
The memories reveal a clear deception pattern. The discovery (1), argument (2), lie (3), secret formula (4), and self-harming practice (5) form a narrative about betrayal for personal goals. Key questions should probe: why the deception (loyalty vs personal goal), the resurrection motive (unresolved grief), and consequences (discovery impact). Questions should connect the deception to the undisclosed personal goal and explore the emotional stakes.
</thinking>
{
  "questions": [
    "Why is Kira hiding flasks from the guild she pledged loyalty to, and what does this deception reveal about her shifting priorities?",
    "How is Kira's obsession with the resurrection formula connected to her unresolved grief, and is it driving her toward self-destruction?",
    "What will happen to Kira's position in the guild if her theft and secret experiments are discovered?"
  ]
}`,
    },
    {
        label: 'Trauma coping (EN/Moderate)',
        input: `Recent memories for Mara:
1. [★★★★] Mara killed three raiders in ambush, suffering a shoulder wound
2. [★★★] Mara refused healing from the village priest, preferring to bind the wound herself
3. [★★] Mara woke screaming from nightmare about the raid
4. [★★★] Mara flinched when a merchant reached for her sword arm
5. [★★★] Mara confessed to her companion that she feels numb during fights, not brave`,
        output: `<thinking>
Combat trauma with classic symptoms. The killing and wound (1), self-binding (2), nightmares (3), flinch response (4), combat numbness confession (5). Questions should probe: resilience vs trauma (self-isolation), impact on relationships (numbness), processing vs suppression (nightmare trigger). The numbness during fights and refusal of healing suggest deeper issues.
</thinking>
{
  "questions": [
    "Is Mara's refusal of healing and self-isolation after combat a sign of resilience or deepening trauma?",
    "How is the combat numbness Mara describes affecting her ability to form trusting relationships outside of life-or-death situations?",
    "What triggered the raid nightmare, and is Mara processing the violence or suppressing it?"
  ]
}`,
    },
    {
        label: 'Intimacy patterns (EN/Explicit)',
        input: `Recent memories for Lila:
1. [★★★★] Lila initiated sex with Marcus for the first time, stroking his cock while referencing desire since the lake
2. [★★★] Lila asked Marcus to pull her hair during sex, testing his reaction
3. [★★] Lila told Marcus she doesn't want gentle — she wants to feel owned
4. [★★★★] Lila broke down crying after an intense session, saying she doesn't know why
5. [★★★] Lila refused to discuss the crying incident the next morning, deflecting with humor`,
        output: `<thinking>
Escalating intimacy with emotional breakthrough. First time (1), hair-pulling request (2), wanting to feel owned (3), breakdown (4), deflection (5). Questions should probe: the psychological need behind intensity, whether breakdown signals trauma or overwhelm, sustainability of avoidance. The pattern shows using intensity to cope with something unprocessed.
</thinking>
{
  "questions": [
    "What psychological need is Lila fulfilling by escalating physical intensity and requesting dominance from Marcus?",
    "Is Lila's post-sex breakdown a sign of unprocessed trauma surfacing through intimacy, or emotional overwhelm from vulnerability?",
    "How will Lila's refusal to process her emotional reactions affect the sustainability of her sexual relationship with Marcus?"
  ]
}`,
    },
];

export const REFLECTIONS = [
    {
        label: 'Deception pattern (EN/SFW)',
        input: `Recent memories for Kira:
1. [★★★] Kira discovered a hidden chamber containing Ashwood's preservation flasks
2. [★★] Kira argued with guild master about sharing the flask discovery
3. [★★★★] Kira lied to the guild about finding only three flasks, secretly keeping two
4. [★★★] Kira decoded ancient text on the flask labels revealing a resurrection formula
5. [★★] Kira practiced the formula alone at night, burning her fingertips on failed attempts`,
        output: `<thinking>
This pattern shows clear deception: Kira discovered valuable artifacts, lied about the quantity, and is secretly experimenting. The deception (memory 3) combined with secret practice (memory 5) suggests a personal agenda. The resurrection formula (memory 4) explains the motivation. The argument with guild master (memory 2) shows tension around disclosure. The burned fingertips (memory 5) indicate desperation and personal risk. Questions should probe why she's lying and what she wants to resurrect.
</thinking>
{
  "reflections": [
    {
      "question": "Why is Kira hiding flasks from the guild she pledged loyalty to, and what does this deception reveal about her shifting priorities?",
      "insight": "Kira's theft of the flasks is driven by the resurrection formula — she is willing to betray the guild to pursue a deeply personal goal she hasn't disclosed to anyone",
      "evidence_ids": ["1", "3", "4"]
    },
    {
      "question": "How is Kira's obsession with the resurrection formula connected to her unresolved grief?",
      "insight": "The pattern of secrecy and self-harm (burned fingertips from solo practice) suggests Kira is operating under emotional urgency, likely connected to someone she wants to resurrect",
      "evidence_ids": ["4", "5"]
    }
  ]
}`,
    },
    {
        label: 'Trauma processing (EN/Moderate)',
        input: `Recent memories for Mara:
1. [★★★★] Mara killed three raiders in ambush, suffering a shoulder wound
2. [★★★] Mara refused healing from the village priest, preferring to bind the wound herself
3. [★★] Mara woke screaming from nightmare about the raid
4. [★★★] Mara flinched when a merchant reached for her sword arm
5. [★★★] Mara confessed to her companion that she feels numb during fights, not brave`,
        output: `<thinking>
Combat trauma pattern with classic PTSD symptoms. The killing and wound (memory 1) is the traumatic event. Refusal of healing (memory 2) suggests need for control or self-punishment. Nightmares (memory 3) are intrusion symptoms. The flinch response (memory 4) shows hypervigilance. The confession about numbness (memory 5) reveals dissociation during combat. Questions should probe whether her coping mechanisms are healthy or signs of deepening trauma.
</thinking>
{
  "reflections": [
    {
      "question": "Is Mara's refusal of healing and self-isolation after combat a sign of resilience or deepening trauma?",
      "insight": "Mara's trauma manifests as hyper-vigilance (sleeping exposed, nightmares) and a compulsion to push herself to physical exhaustion, suggesting she uses pain as a way to feel in control of her body",
      "evidence_ids": ["2", "3", "5"]
    },
    {
      "question": "How is the combat numbness Mara describes affecting her ability to form trusting relationships?",
      "insight": "Her attachment to combat companions suggests displacement — she may struggle to distinguish past violence from present safety, putting relationships at risk",
      "evidence_ids": ["4", "5"]
    }
  ]
}`,
    },
    {
        label: 'Intimacy as coping (EN/Explicit)',
        input: `Recent memories for Lila:
1. [★★★★] Lila initiated sex with Marcus for the first time, stroking his cock while referencing desire since the lake
2. [★★★] Lila asked Marcus to pull her hair during sex, testing his reaction
3. [★★] Lila told Marcus she doesn't want gentle — she wants to feel owned
4. [★★★★] Lila broke down crying after an intense session, saying she doesn't know why
5. [★★★] Lila refused to discuss the crying incident the next morning, deflecting with humor`,
        output: `<thinking>
Pattern of using sexual intensity to cope with unprocessed emotions. The escalation from first time (memory 1) to hair-pulling (memory 2) to wanting to feel owned (memory 3) shows increasing intensity. The breakdown (memory 4) is the key indicator of emotional overwhelm. Refusing to discuss (memory 5) shows avoidance of processing. Questions should probe what psychological need the intensity serves and why she can't process the emotions that surface.
</thinking>
{
  "reflections": [
    {
      "question": "What psychological need is Lila fulfilling by escalating physical intensity and requesting dominance from Marcus?",
      "insight": "Lila is using sexual intensity and requested dominance as a way to bypass emotional defenses — physical intensity allows her to feel without confronting why she needs intensity to feel at all",
      "evidence_ids": ["1", "2", "3"]
    },
    {
      "question": "Is Lila's post-sex breakdown a sign of unprocessed trauma surfacing through intimacy?",
      "insight": "The post-sex breakdown suggests she's approaching an emotional threshold she can't avoid, but her refusal to process it indicates fear that acknowledging the feelings will break the coping mechanism she's built",
      "evidence_ids": ["4", "5"]
    }
  ]
}`,
    },
];

export const INSIGHTS = [
    {
        label: 'Deception pattern (EN/SFW)',
        input: `Question: "Why is Kira hiding flasks from the guild she pledged loyalty to?"
Relevant memories:
- ev_001: [★★★] Kira discovered a hidden chamber containing Ashwood's preservation flasks
- ev_003: [★★★★] Kira lied to the guild about finding only three flasks, secretly keeping two
- ev_004: [★★★] Kira decoded ancient text revealing a resurrection formula
- ev_005: [★★] Kira practiced the formula alone at night, burning her fingertips`,
        output: `<thinking>
The question asks about deception. The evidence shows a clear pattern: discovery (ev_001), deception (ev_003), and the motivation (ev_004) — the resurrection formula. The secret practice with self-harm (ev_005) suggests emotional urgency. Two key insights emerge: the theft is driven by an undisclosed personal goal related to the resurrection formula, and the self-harm pattern suggests unresolved grief or desperation connected to someone she wants to resurrect.
</thinking>
{
  "insights": [
    {
      "insight": "Kira's theft of the flasks is driven by the resurrection formula — she is willing to betray the guild to pursue a deeply personal goal she hasn't disclosed to anyone",
      "evidence_ids": ["ev_003", "ev_004", "ev_005"]
    },
    {
      "insight": "The pattern of secrecy and self-harm (burned fingertips from solo practice) suggests Kira is operating under emotional urgency, likely connected to someone she wants to resurrect",
      "evidence_ids": ["ev_004", "ev_005"]
    }
  ]
}`,
    },
    {
        label: 'Trauma response (EN/Moderate)',
        input: `Question: "How is the warrior processing the loss of her squad and what coping mechanisms is she using?"
Relevant memories:
- ev_100: [★★★★] Mara watched her entire squad die in the ambush at Blackstone Pass
- ev_101: [★★★] Mara wakes up screaming from nightmares about the ambush three nights a week
- ev_102: [★★] Mara refuses to sleep in a tent, preferring exposed ground where she can see the sky
- ev_103: [★★★] Mara has formed an intense attachment to the new recruit, Theron, who reminds her of her fallen lieutenant
- ev_104: [★★] Mara trains with her sword until her hands bleed, refusing to stop until exhaustion`,
        output: `<thinking>
Question about trauma processing. The traumatic event (ev_100) leads to classic PTSD symptoms: nightmares (ev_101), hypervigilance (ev_102), and displacement (ev_103). The physical self-harm through training (ev_104) suggests using pain for control. Two insights: hyper-vigilance and compulsion to exhaustion suggest using pain to feel in control, and the attachment to Theron is displacement of grief for the fallen lieutenant.
</thinking>
{
  "insights": [
    {
      "insight": "Mara's trauma manifests as hyper-vigilance (sleeping exposed, nightmares) and a compulsion to push herself to physical exhaustion, suggesting she uses pain as a way to feel in control of her body",
      "evidence_ids": ["ev_101", "ev_102", "ev_104"]
    },
    {
      "insight": "Her attachment to Theron is displacement — she's projecting her grief for the fallen lieutenant onto a living surrogate, which puts both of them at risk if she can't distinguish past from present",
      "evidence_ids": ["ev_100", "ev_103"]
    }
  ]
}`,
    },
    {
        label: 'Intimacy as coping (EN/Explicit)',
        input: `Question: "What psychological need is Lila fulfilling through escalating physical intensity with Marcus?"
Relevant memories:
- ev_200: [★★★★] Lila initiated sex with Marcus for the first time, stroking his cock while referencing desire since the lake
- ev_201: [★★★] Lila asked Marcus to pull her hair during sex, testing his reaction
- ev_202: [★★] Lila told Marcus she doesn't want gentle — she wants to feel owned
- ev_203: [★★★★] Lila broke down crying after an intense session, saying she doesn't know why
- ev_204: [★★★] Lila refused to discuss the crying incident the next morning, deflecting with humor`,
        output: `<thinking>
Question about psychological needs behind escalating intensity. The pattern shows progression: first time (ev_200), hair-pulling (ev_201), wanting to feel owned (ev_202). The breakdown (ev_203) is key — emotions surfacing that she can't process. Refusal to discuss (ev_204) shows avoidance. Two insights: using physical intensity to bypass emotional defenses, and the breakdown indicates approaching an emotional threshold she's avoiding.
</thinking>
{
  "insights": [
    {
      "insight": "Lila is using sexual intensity and requested dominance as a way to bypass emotional defenses — physical intensity allows her to feel without confronting why she needs intensity to feel at all",
      "evidence_ids": ["ev_200", "ev_201", "ev_202"]
    },
    {
      "insight": "The post-sex breakdown suggests she's approaching an emotional threshold she can't avoid, but her refusal to process it indicates fear that acknowledging the feelings will break the coping mechanism she's built",
      "evidence_ids": ["ev_203", "ev_204"]
    }
  ]
}`,
    },
];
