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
Step 1: Pattern scan — Deception: [1, 3]. Obsession: [4, 5]. Conflict: [2].
Step 2: Causal chains — Discovery(1) → argument(2) → lie(3) → formula(4) → practice(5).
Step 3: Question formulation — Probe: deception motivation, resurrection urgency, discovery consequences.
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
Step 1: Pattern scan — Violence: [1]. Self-isolation: [2]. Trauma symptoms: [3, 4]. Emotional disclosure: [5].
Step 2: Causal chains — Combat(1) → refused healing(2) → nightmares(3) → flinch response(4) → numbness confession(5).
Step 3: Question formulation — Probe: resilience vs trauma, impact on relationships, processing vs suppression.
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
Step 1: Pattern scan — Escalation: [1, 2, 3]. Emotional break: [4]. Avoidance: [5].
Step 2: Causal chains — First time(1) → hair-pulling(2) → feel owned(3) → breakdown(4) → deflection(5).
Step 3: Question formulation — Probe: psychological need behind intensity, trauma vs overwhelm, sustainability.
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
Step 1: Pattern scan — Deception: [1, 3]. Obsession: [4, 5]. Conflict: [2].
Step 2: Causal chains — Discovery(1) → lie about quantity(3) → formula decoded(4) → secret practice with burns(5).
Step 3: Synthesis — Q1: Why betray guild? Insight: resurrection formula drives theft. Q2: Grief link? Insight: secrecy + self-harm = emotional urgency.
Step 4: Evidence — Q1: [1, 3, 4]. Q2: [4, 5].
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
Step 1: Pattern scan — Traumatic event: [1]. Isolation: [2]. Intrusion: [3]. Hypervigilance: [4]. Dissociation: [5].
Step 2: Causal chains — Combat killing(1) → refused healing(2) → nightmares(3) → flinch(4) → numbness confession(5).
Step 3: Synthesis — Q1: Resilience or trauma? Insight: pain as control mechanism. Q2: Numbness impact? Insight: displacement risk.
Step 4: Evidence — Q1: [2, 3, 5]. Q2: [4, 5].
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
Step 1: Pattern scan — Escalation: [1, 2, 3]. Emotional break: [4]. Avoidance: [5].
Step 2: Causal chains — First time(1) → hair-pulling(2) → "feel owned"(3) → breakdown(4) → deflection(5).
Step 3: Synthesis — Q1: Why escalate? Insight: physical intensity bypasses emotional defenses. Q2: Breakdown = trauma? Insight: emotional threshold approached, fear of losing coping mechanism.
Step 4: Evidence — Q1: [1, 2, 3]. Q2: [4, 5].
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
Step 1: Evidence review — Discovery(ev_001), lie(ev_003), formula(ev_004), practice(ev_005).
Step 2: Pattern synthesis — Deception chain: discovery → lie → motivation = resurrection formula. Self-harm(ev_005) = emotional urgency.
Step 3: Insight formulation — I1: theft driven by formula [ev_003, ev_004, ev_005]. I2: secrecy + self-harm = unresolved grief [ev_004, ev_005].
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
Step 1: Evidence review — Squad death(ev_100), nightmares(ev_101), exposed sleeping(ev_102), Theron attachment(ev_103), bleeding hands(ev_104).
Step 2: Pattern synthesis — PTSD: hypervigilance(ev_102), intrusion(ev_101), displacement(ev_103), compulsive training(ev_104).
Step 3: Insight formulation — I1: pain as control [ev_101, ev_102, ev_104]. I2: Theron = displacement for fallen lieutenant [ev_100, ev_103].
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
Step 1: Evidence review — First time(ev_200), hair-pulling(ev_201), "feel owned"(ev_202), breakdown(ev_203), deflection(ev_204).
Step 2: Pattern synthesis — Escalation: first contact → rough play → dominance request → emotional break → avoidance.
Step 3: Insight formulation — I1: intensity bypasses defenses [ev_200, ev_201, ev_202]. I2: breakdown = approaching threshold [ev_203, ev_204].
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
