/**
 * Russian graph extraction few-shot examples.
 */

export const EXAMPLES = [
    {
        label: 'Character entities (RU/SFW)',
        input: `Лена опустила глаза и тихо сказала: "Я не помню, когда в последний раз кто-то
спрашивал, как у меня дела. По-настоящему спрашивал." Она сжала край рукава.
Дима молча сел рядом и положил руку ей на плечо.
"Я здесь," — сказал он. — "Никуда не денусь."

Extracted events:
1. [★★★] Лена призналась Диме в глубоком одиночестве, он обнял её за плечо и пообещал остаться`,
        output: `<thinking>
Step 1: Entity scan — Лена (PERSON), Дима (PERSON).
Step 2: Type validation — All types valid.
Step 3: Relationship map — Дима→Лена (emotional support, physical comfort, verbal promise).
Step 4: Output — 2 entities, 1 relationship.
</thinking>
{"entities":[{"name":"Лена","type":"PERSON","description":"Одинокая девушка, признавшаяся в том, что никто давно не интересовался её состоянием"},{"name":"Дима","type":"PERSON","description":"Поддерживающий друг, пообещавший быть рядом с Леной"}],"relationships":[{"source":"Дима","target":"Лена","description":"Эмоциональная поддержка — обнял за плечо, пообещал не уходить"}]}`,
    },
    {
        label: 'Romantic entities (RU/Moderate)',
        input: `Саша подошла к Вове, не сводя с него взгляда. "Можно ли?" — спросила она шёпотом.
Он кивнул, и она наклонилась, их губы едва коснулись. Сначала осторожно, потом
смелее. Вова обнял её за талию, притянув ближе. Сердце Сашки колотилось так сильно,
что она думала, будто он слышит.

Extracted events:
1. [★★★★] Саша и Вова впервые поцеловались, он обнял её за талию и притянул к себе`,
        output: `<thinking>
Step 1: Entity scan — Саша (PERSON), Вова (PERSON).
Step 2: Type validation — All types valid.
Step 3: Relationship map — Саша→Вова (first kiss, romantic initiative), Вова→Саша (reciprocated, embraced).
Step 4: Output — 2 entities, 2 relationships.
</thinking>
{"entities":[{"name":"Саша","type":"PERSON","description":"Девушка, решившаяся на первый поцелуй с Вовой"},{"name":"Вова","type":"PERSON","description":"Парень, ответивший на поцелуй и обнявший Сашу за талию"}],"relationships":[{"source":"Саша","target":"Вова","description":"Первый поцелуй — зарождающиеся романтические чувства, сердечное волнение"},{"source":"Вова","target":"Саша","description":"Ответил на поцелуй, обнял за талию, проявил взаимность"}]}`,
    },
    {
        label: 'Sexual entities (RU/Explicit)',
        input: `Саша толкнула его на спину и села сверху, медленно опускаясь на его член. Вова
схватил её за бёдра, направляя ритм. "Быстрее," — выдохнул он. Она подчинилась,
ускоряя движения, откинув голову назад. Её стоны заполнили комнату.
"Я почти," — прошептал он, сжимая пальцы на её коже.

Extracted events:
1. [★★★] Саша села на Вову сверху, они занялись сексом в позе наездницы до близости к оргазму`,
        output: `<thinking>
Step 1: Entity scan — Саша (PERSON), Вова (PERSON).
Step 2: Type validation — All types valid.
Step 3: Relationship map — Саша→Вова (cowgirl position, active role), Вова→Саша (hip control, rhythm direction).
Step 4: Output — 2 entities, 2 relationships.
</thinking>
{"entities":[{"name":"Саша","type":"PERSON","description":"Женщина, инициировавшая секс в позе наездницы"},{"name":"Вова","type":"PERSON","description":"Мужчина, активно участвующий в сексе, направляющий ритм движений"}],"relationships":[{"source":"Саша","target":"Вова","description":"Сексуальные отношения — позиция наездницы, взаимное удовольствие, близость к оргазму"},{"source":"Вова","target":"Саша","description":"Активное участие — схватил за бёдра, направлял ритм, выражал приближение оргазма"}]}`,
    },
    {
        label: 'Power entities (RU/Kink)',
        input: `"На колени." Маша указала на пол. Кай опустился, не отводя взгляда. Она
застегнула кожаный ошейник на его шее и потянула за поводок, заставляя
наклониться. "Ты моя вещь сегодня," — прошептала она, проводя ногтями по его
спине. Он вздрогнул. "Скажи 'малина', если будет слишком." — "Понял."
Она надавила ступнёй ему на спину, прижимая к полу.

Extracted events:
1. [★★★★] Маша надела ошейник на Кая, установила стоп-слово 'малина' и прижала его к полу ногой`,
        output: `<thinking>
Step 1: Entity scan — Маша (PERSON), Кай (PERSON), Ошейник (OBJECT), Малина (CONCEPT).
Step 2: Type validation — All types valid.
Step 3: Relationship map — Маша→Кай (D/s: commands, collar, foot on back), Маша→Ошейник (applies to Kai), Кай→Малина (knows safeword).
Step 4: Output — 4 entities, 3 relationships.
</thinking>
{"entities":[{"name":"Маша","type":"PERSON","description":"Доминант — командует, надевает ошейник, прижимает партнёра к полу"},{"name":"Кай","type":"PERSON","description":"Сабмиссив — подчиняется командам, принимает ошейник и поводок"},{"name":"Ошейник","type":"OBJECT","description":"Кожаный ошейник с поводком, используемый для контроля над Каем"},{"name":"Малина","type":"CONCEPT","description":"Стоп-слово, установленное для прекращения сцены при необходимости"}],"relationships":[{"source":"Маша","target":"Кай","description":"Динамика доминирования — командует встать на колени, надевает ошейник, прижимает ногой"},{"source":"Маша","target":"Ошейник","description":"Застёгивает ошейник на шее Кая и тянет за поводок"},{"source":"Кай","target":"Малина","description":"Знает и принимает стоп-слово для обеспечения безопасности"}]}`,
    },
];
