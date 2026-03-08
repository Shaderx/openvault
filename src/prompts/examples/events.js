/**
 * Event extraction few-shot examples.
 * 10 bilingual examples (5 EN + 5 RU) following SFW → explicit → kink gradient.
 * All <think> blocks are in English per Language Rule 7.
 */

export const EVENT_EXAMPLES = [
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
        label: 'Emotional conversation (RU/SFW)',
        input: `Лена опустила глаза и тихо сказала: "Я не помню, когда в последний раз кто-то спрашивал, как у меня дела. По-настоящему спрашивал." Она сжала край рукава.
Дима молча сел рядом и положил руку ей на плечо.
"Я здесь," — сказал он. — "Никуда не денусь."`,
        thinking: `Step 1: Input is Russian. Output values must be in Russian. Lena confessed loneliness, Dima supported her physically and verbally.
Step 2: No established memories about this conversation.
Step 3: New event — emotional vulnerability and support. Not a continuation.
Step 4: Importance 3 (meaningful conversation, relationship deepening). Writing summary in Russian.`,
        output: `{
  "events": [{
    "summary": "Лена призналась Диме в глубоком одиночестве, он обнял её за плечо и пообещал остаться",
    "importance": 3,
    "characters_involved": ["Лена", "Дима"],
    "witnesses": [],
    "location": null,
    "is_secret": false,
    "emotional_impact": { "Лена": "уязвимость", "Дима": "сочувствие" },
    "relationship_impact": { "Лена→Дима": "возросшее доверие" }
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
        label: 'Romantic tension (RU/Moderate)',
        input: `*Анна стояла у окна, а Сергей подошёл сзади и положил руки ей на плечи. Она замерла, чувствуя его дыхание у шеи.*
"Я должен был сказать тебе раньше," — прошептал он. — "Я не могу оторвать от тебя глаз."
Анна повернулась. Их лица оказались так близко...
"Сергей," — выдохнула она, но не отстранилась.`,
        thinking: `Step 1: Input is Russian. Output values must be in Russian. Romantic tension — physical proximity, confession of attraction, hesitation before first kiss.
Step 2: No established memories of romantic contact between them.
Step 3: New dynamic (romantic tension escalating). Not a continuation.
Step 4: Importance 4 (first romantic escalation, significant relationship shift). Writing summary in Russian.`,
        output: `{
  "events": [{
    "summary": "Сергей признался Анне в своих чувствах и приблизился к первому поцелую, а она не отстранилась",
    "importance": 4,
    "characters_involved": ["Анна", "Сергей"],
    "witnesses": [],
    "location": null,
    "is_secret": false,
    "emotional_impact": { "Анна": "смущение", "Сергей": "желание" },
    "relationship_impact": { "Анна↔Сергей": "романтическое напряжение" }
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
        label: 'Sexual scene (RU/Explicit)',
        input: `Саша толкнула его на спину и села сверху, медленно опускаясь на его член. Вова схватил её за бёдра, направляя ритм.
"Быстрее," — выдохнул он. Она подчинилась, ускоряя движения, откинув голову назад. Её стоны заполнили комнату.
"Я почти," — прошептал он, сжимая пальцы на её коже.`,
        thinking: `Step 1: Input is Russian. Output values must be in Russian. Sasha and Vova having sex — cowgirl position, rhythm, approaching orgasm.
Step 2: Existing memory: "Sasha pushed Vova against the wall and started kissing" — beginning already recorded.
Step 3: New action type — transition from kissing to penetration. New event.
Step 4: Importance 3 (continuation between established partners). Writing summary in Russian.`,
        output: `{
  "events": [{
    "summary": "Саша села на Вову сверху, они занялись сексом в позе наездницы до близости к оргазму",
    "importance": 3,
    "characters_involved": ["Саша", "Вова"],
    "witnesses": [],
    "location": null,
    "is_secret": false,
    "emotional_impact": { "Саша": "возбуждение", "Вова": "удовольствие" },
    "relationship_impact": {}
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
        label: 'Power dynamic (RU/Kink)',
        input: `"На колени." Маша указала на пол. Кай опустился, не отводя взгляда. Она застегнула кожаный ошейник на его шее и потянула за поводок, заставляя наклониться.
"Ты моя вещь сегодня," — прошептала она, проводя ногтями по его спине. Он вздрогнул.
"Скажи 'малина', если будет слишком." — "Понял."
Она надавила ступнёй ему на спину, прижимая к полу.`,
        thinking: `Step 1: Input is Russian. Output values must be in Russian. Masha put a collar on Kai, established safeword "malina", pressed him to the floor with her foot.
Step 2: No established memories of this dynamic.
Step 3: New power dynamic — collar, leash, safeword. New event.
Step 4: Importance 4 (new domination dynamic, safeword established). Writing summary in Russian.`,
        output: `{
  "events": [{
    "summary": "Маша надела ошейник на Кая, установила стоп-слово 'малина' и прижала его к полу ногой",
    "importance": 4,
    "characters_involved": ["Маша", "Кай"],
    "witnesses": [],
    "location": null,
    "is_secret": true,
    "emotional_impact": { "Маша": "контроль", "Кай": "подчинение" },
    "relationship_impact": { "Маша→Кай": "динамика доминирования установлена" }
  }]
}`,
    },
    {
        label: 'Dedup - continuation (EN/Edge)',
        input: `The crop came down again — three, four, five. His thighs were crisscrossed with welts now. "Color?" she asked. "Green," he whispered, voice shaking.
She traced a welt with her fingertip, watching him shiver.

<established_memories>
[★★★★] She restrained him with leather cuffs and struck him with a riding crop after a green-light color check
</established_memories>`,
        thinking: `Step 1: Continuation of crop impact play. More strikes, another color check.
Step 2: Existing memory already covers: restraints, crop strikes, color check.
Step 3: Same action type continuing (impact play). No reversal, no safeword, no new element. This is a continuation.
Step 4: Output empty events array.`,
        output: `{ "events": [] }`,
    },
    {
        label: 'Dedup - continuation (RU/Edge)',
        input: `Саша ускорила ритм, вцепившись в его плечи. Вова приподнял бёдра ей навстречу, стискивая зубы. "Да, вот так," — простонала она. Их дыхание смешалось, тела двигались в унисон.

<established_memories>
[★★★] Саша села на Вову сверху, они занялись сексом в позе наездницы до близости к оргазму
</established_memories>`,
        thinking: `Step 1: Input is Russian. Continuation of sex in same position. Rhythm acceleration.
Step 2: Existing memory: cowgirl sex — already recorded.
Step 3: Same action type (penetration, same position). No dynamic shift, no new element. This is a continuation.
Step 4: Output empty events array.`,
        output: `{ "events": [] }`,
    },
];
