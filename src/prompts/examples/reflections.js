/**
 * Unified reflection few-shot examples.
 * 6 bilingual examples: 3 English + 3 Russian.
 * Progresses from SFW → Moderate → Explicit content.
 */

export const UNIFIED_REFLECTION_EXAMPLES = [
    {
        label: 'Deception pattern (EN/SFW)',
        input: `Recent memories for Kira:
1. [★★★] Kira discovered a hidden chamber containing Ashwood's preservation flasks
2. [★★] Kira argued with guild master about sharing the flask discovery
3. [★★★★] Kira lied to the guild about finding only three flasks, secretly keeping two
4. [★★★] Kira decoded ancient text on the flask labels revealing a resurrection formula
5. [★★] Kira practiced the formula alone at night, burning her fingertips on failed attempts`,
        output: `{
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
        label: 'Изоляция и зависимость (RU/SFW)',
        input: `Последние воспоминания для Лены:
1. [★★★] Лена призналась Диме в глубоком одиночестве, он обнял её за плечо и пообещал остаться
2. [★★] Лена избегала общей кухни в общежитии три дня подряд
3. [★★★] Лена впервые улыбнулась за неделю, когда Дима принёс ей чай
4. [★★] Лена услышала, как соседки обсуждают её за спиной
5. [★★★★] Лена рассказала Диме о буллинге в школе, впервые упомянув об этом вслух`,
        output: `{
  "reflections": [
    {
      "question": "Как детский опыт буллинга формирует нынешнюю изоляцию Лены и её неспособность доверять окружающим?",
      "insight": "Изоляция Лены — защитный механизм, сформировавшийся в ответ на школьный буллинг: она избегает социальных пространств, ожидая негатива со стороны окружающих",
      "evidence_ids": ["2", "4", "5"]
    },
    {
      "question": "Становится ли зависимость Лены от Димы здоровой привязанностью или опасной созависимостью?",
      "insight": "Дима становится единственным мостом Лены в социальный мир, что создаёт опасную зависимость — его внимание или отсутствие могут полностью определять её эмоциональное состояние",
      "evidence_ids": ["1", "3"]
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
        output: `{
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
        label: 'Романтическая уязвимость (RU/Moderate)',
        input: `Последние воспоминания для Ани:
1. [★★★★] Аня впервые поцеловала Сергея на крыше, дрожа от страха и возбуждения
2. [★★★] Аня провела ночь, размышляя о поцелуе, и не смогла уснуть
3. [★★] Аня избегала взгляда Сергея на следующее утро, краснея при встрече
4. [★★★] Аня написала в дневнике, что боится всё испортить, если признается в своих чувствах
5. [★★] Аня спросила подругу, как понять, что это любовь, а не просто влюблённость`,
        output: `{
  "reflections": [
    {
      "question": "Почему Аня так боится признаться в своих чувствах Сергею, даже после взаимного поцелуя?",
      "insight": "Отношения развиваются от конфликта к глубокой эмоциональной уязвимости: Аня переносит на Сергея травматический опыт прошлых отношений, но постепенно учится доверять",
      "evidence_ids": ["1", "4"]
    },
    {
      "question": "Что стоит за страхом Ани 'всё испортить' — прошлый опыт или неуверенность в себе?",
      "insight": "Ночной звонок стал бы переломным моментом — Аня выбирает уязвимость вместо изоляции, что signalling о переходе от защитной тактики к реальной близости",
      "evidence_ids": ["2", "3"]
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
        output: `{
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
    {
        label: 'Субмиссия как регуляция (RU/Explicit)',
        input: `Последние воспоминания для Кая:
1. [★★★★] Маша надела ошейник на Кая, установила стоп-слово 'малина' и прижала его к полу ногой
2. [★★★] Кай попросил Машу не снимать ошейник после сцены — хотел носить его весь вечер
3. [★★] Кай приготовил ужин для Маши, стоя на коленях пока она ела
4. [★★★★] Кай признался, что чувствует себя спокойнее, когда Маша принимает все решения за него
5. [★★★] Маша выразила беспокойство, что Кай теряет собственную волю за пределами сцен`,
        output: `{
  "reflections": [
    {
      "question": "Является ли стремление Кая к постоянному подчинению здоровым выражением его натуры или попыткой избежать ответственности?",
      "insight": "Подчинение для Кая — механизм эмоциональной регуляции: передача контроля Маше снимает тревогу и создаёт ощущение безопасности, что объясняет его нежелание выходить из роли",
      "evidence_ids": ["2", "4"]
    },
    {
      "question": "Как размывание границ между сценами и повседневной жизнью влияет на равноправие отношений?",
      "insight": "Граница между сценой и реальностью стирается — Кай переносит динамику подчинения в бытовые ситуации (ужин на коленях), что может указывать на психологическую зависимость, а не осознанный выбор",
      "evidence_ids": ["3", "5"]
    }
  ]
}`,
    },
];
