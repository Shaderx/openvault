/**
 * Russian event extraction few-shot examples.
 * 5 examples following SFW → kink gradient.
 */

export const EXAMPLES = [
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
        label: 'Dedup - continuation (RU/Edge)',
        input: `Саша ускорила ритм, вцепившись в его плечи. Вова приподнял бёдра ей навстречу, стискивая зубы. "Да, вот так," — простонала она. Их дыхание смешалось, тела двигались в унисон.

<established_memories>
[★★★] Саша села на Вову сверху, они занялись сексом в позе наездницы до близости к оргазму
</established_memories>`,
        thinking: `Step 1: Input is Russian. Continuation of sex in same position. Rhythm acceleration.
Step 2: Existing memory: cowgirl sex, near-orgasm — already recorded.
Step 3: Same position, same act. The rhythm acceleration and mutual intensity are continuation, not a new phase. No dynamic shift, no new element.
Step 4: This is a continuation of the exact same action with no shift, escalation, or conclusion. Output empty.`,
        output: `{ "events": [] }`,
    },
];
