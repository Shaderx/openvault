/**
 * English reflection few-shot examples.
 */

export const REFLECTIONS = [
    {
        label: 'Deception pattern (EN/SFW)',
        input: `Recent memories for Kira:
1. [★★★] Kira discovered a hidden chamber containing Ashwood's preservation flasks
2. [★★] Kira argued with guild master about sharing the flask discovery
3. [★★★★] Kira lied to the guild about finding only three flasks, secretly keeping two
4. [★★★] Kira decoded ancient text on the flask labels revealing a resurrection formula
5. [★★] Kira practiced the formula alone at night, burning her fingertips on failed attempts`,
        thinking: `Step 1: Deception [1,3]; obsession [4,5]; conflict [2]
Step 2: Discovery(1) -> lie(3) -> decoded(4) -> burns(5)
Step 3: Q1: betray guild? -> resurrection drives theft; Q2: grief link? -> secrecy + harm = urgency
Step 4: Q1: [1,3,4]; Q2: [4,5]; no IDs in Q/insight`,
        output: `{
  "reflections": [
    {
      "question": "Why is Kira hiding flasks from the guild she pledged loyalty to, and what does this deception reveal about her shifting priorities?",
      "insight": "Kira's theft of the flasks is driven by the resurrection formula — she is willing to betray the guild to pursue a deeply personal goal she hasn't disclosed to anyone",
      "importance": 4,
      "evidence_ids": ["1", "3", "4"]
    },
    {
      "question": "How is Kira's obsession with the resurrection formula connected to her unresolved grief?",
      "insight": "The pattern of secrecy and self-harm (burned fingertips from solo practice) suggests Kira is operating under emotional urgency, likely connected to someone she wants to resurrect",
      "importance": 3,
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
        thinking: `Step 1: Trauma [1]; isolation [2]; intrusion [3]; hypervigilance [4]; dissociation [5]
Step 2: Killing(1) -> refused healing(2) -> nightmares(3) -> flinch(4) -> numbness(5)
Step 3: Q1: resilience or trauma? -> pain = control; Q2: numbness impact? -> displacement risk
Step 4: Q1: [2,3,5]; Q2: [4,5]; no IDs in Q/insight`,
        output: `{
  "reflections": [
    {
      "question": "Is Mara's refusal of healing and self-isolation after combat a sign of resilience or deepening trauma?",
      "insight": "Mara's trauma manifests as hyper-vigilance (sleeping exposed, nightmares) and a compulsion to push herself to physical exhaustion, suggesting she uses pain as a way to feel in control of her body",
      "importance": 4,
      "evidence_ids": ["2", "3", "5"]
    },
    {
      "question": "How is the combat numbness Mara describes affecting her ability to form trusting relationships?",
      "insight": "Her attachment to combat companions suggests displacement — she may struggle to distinguish past violence from present safety, putting relationships at risk",
      "importance": 3,
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
        thinking: `Step 1: Escalation [1,2,3]; emotional break [4]; avoidance [5]
Step 2: First time(1) -> hair(2) -> "owned"(3) -> breakdown(4) -> deflection(5)
Step 3: Q1: why escalate? -> intensity bypasses defenses; Q2: breakdown = trauma? -> threshold + fear of losing cope
Step 4: Q1: [1,2,3]; Q2: [4,5]; no IDs in Q/insight`,
        output: `{
  "reflections": [
    {
      "question": "What psychological need is Lila fulfilling by escalating physical intensity and requesting dominance from Marcus?",
      "insight": "Lila is using sexual intensity and requested dominance as a way to bypass emotional defenses — physical intensity allows her to feel without confronting why she needs intensity to feel at all",
      "importance": 4,
      "evidence_ids": ["1", "2", "3"]
    },
    {
      "question": "Is Lila's post-sex breakdown a sign of unprocessed trauma surfacing through intimacy?",
      "insight": "The post-sex breakdown suggests she's approaching an emotional threshold she can't avoid, but her refusal to process it indicates fear that acknowledging the feelings will break the coping mechanism she's built",
      "importance": 5,
      "evidence_ids": ["4", "5"]
    }
  ]
}`,
    },
    {
        label: 'Control as safety (EN/Kink)',
        input: `Recent memories for Daniel:
1. [★★★★] Vera restrained Daniel with leather cuffs and struck him with a riding crop after a green-light color check
2. [★★★] Daniel thanked Vera after the scene and asked when they could do it again
3. [★★] Daniel struggled to make decisions at work the day after a scene — described feeling "untethered"
4. [★★★★] Daniel told Vera he only feels fully present when she's in control; outside scenes he feels scattered
5. [★★★] Vera asked Daniel directly whether he wanted to expand the dynamic into daily life, and he didn't say no`,
        thinking: `Step 1: First scene [1]; reinforcement [2]; withdrawal [3]; dependency [4]; expansion [5]
Step 2: Scene(1) -> gratitude(2) -> scatter(3) -> "only present" confession(4) -> Vera offers(5)
Step 3: Q1: "untethered"? -> submission = anxiety-reg; void without it; Q2: choice or avoidance? -> non-answer = ambivalence != consent
Step 4: Q1: [3,4]; Q2: [4,5]; no IDs in Q/insight`,
        output: `{
  "reflections": [
    {
      "question": "What does Daniel's 'untethered' feeling between scenes reveal about what submission is actually doing for him psychologically?",
      "insight": "Submission functions as an anxiety-regulation mechanism for Daniel — Vera's control provides external structure that quiets his internal scatter; without it, the baseline anxiety returns and feels more pronounced by contrast",
      "importance": 4,
      "evidence_ids": ["3", "4"]
    },
    {
      "question": "When Vera offered to expand the dynamic into daily life and Daniel didn't say no, was that a choice or an avoidance of one?",
      "insight": "Daniel's non-answer is itself a data point — someone who actively wants expansion says yes; his silence suggests he desires the outcome but can't yet take responsibility for choosing it, which places the decision burden on Vera",
      "importance": 3,
      "evidence_ids": ["4", "5"]
    }
  ]
}`,
    },
    {
        label: 'Loyalty under fracture (EN/SFW)',
        input: `Recent memories for Captain Yuen:
1. [★★★★] General Halverson revealed to Yuen that Ironhold garrison has been misled — reinforcements rerouted without their knowledge
2. [★★★] Yuen said nothing to command after the revelation, spending the night alone in the war room
3. [★★] Yuen wrote a letter to his brother — an officer stationed at Ironhold — and did not send it
4. [★★★★] Yuen told Halverson he understood, and asked to be reassigned to the northern pass personally
5. [★★] Yuen burned the unsent letter the following morning without explanation`,
        thinking: `Step 1: Complicity [1]; silence [2]; private conflict [3]; public alignment [4]; evidence destroyed [5]
Step 2: Disclosure(1) -> silence(2) -> unsent letter(3) -> alignment(4) -> letter burned(5)
Step 3: Q1: align while conflicted? -> reassignment != loyalty, = info control; Q2: burn letter? -> commitment point; brother = collateral
Step 4: Q1: [2,4]; Q2: [3,5]; no IDs in Q/insight`,
        output: `{
  "reflections": [
    {
      "question": "Why did Yuen publicly align with Halverson and request reassignment to the northern pass when he spent the night in private conflict?",
      "insight": "Yuen's request for reassignment is not loyalty — it's a tactical move toward proximity and information control; by going north himself, he can manage what happens to Ironhold on his own terms rather than report and lose agency entirely",
      "importance": 4,
      "evidence_ids": ["2", "4"]
    },
    {
      "question": "What does Yuen's decision to write and then burn the unsent letter to his brother reveal about the line he crossed?",
      "insight": "The letter was the last point at which Yuen could have chosen his brother over Halverson — burning it is the moment of full complicity; his brother at Ironhold has become acceptable collateral, and Yuen knows it",
      "importance": 5,
      "evidence_ids": ["3", "5"]
    }
  ]
}`,
    },
];
