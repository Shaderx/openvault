/**
 * Insight extraction few-shot examples.
 * 6 bilingual examples (3 EN + 3 RU) following SFW → Explicit gradient.
 */

export const INSIGHT_EXAMPLES = [
    // Example 1 (EN/SFW) — Deception pattern
    {
        label: 'Deception pattern (EN/SFW)',
        input: `Question: "Why is Kira hiding flasks from the guild she pledged loyalty to?"
Relevant memories:
- ev_001: [★★★] Kira discovered a hidden chamber containing Ashwood's preservation flasks
- ev_003: [★★★★] Kira lied to the guild about finding only three flasks, secretly keeping two
- ev_004: [★★★] Kira decoded ancient text revealing a resurrection formula
- ev_005: [★★] Kira practiced the formula alone at night, burning her fingertips`,
        output: `{
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

    // Example 2 (RU/SFW) — Isolation pattern
    {
        label: 'Isolation pattern (RU/SFW)',
        input: `Вопрос: "Почему Лена избегает общения и что происходит с её социальной изоляцией?"
Релевантные воспоминания:
- ev_020: [★★★] Лена призналась Диме в глубоком одиночестве, он обнял её за плечо и пообещал остаться
- ev_021: [★★] Лена избегала общей кухни в общежитии три дня подряд
- ev_022: [★★★] Лена впервые улыбнулась за неделю, когда Дима принёс ей чай
- ev_023: [★★] Лена услышала, как соседки обсуждают её за спиной
- ev_024: [★★★★] Лена рассказала Диме о буллинге в школе, впервые упомянув об этом вслух`,
        output: `{
  "insights": [
    {
      "insight": "Изоляция Лены — защитный механизм, сформировавшийся в ответ на школьный буллинг: она избегает социальных пространств, ожидая негатива со стороны окружающих",
      "evidence_ids": ["ev_021", "ev_023", "ev_024"]
    },
    {
      "insight": "Дима становится единственным мостом Лены в социальный мир, что создаёт опасную зависимость — его внимание или отсутствие могут полностью определять её эмоциональное состояние",
      "evidence_ids": ["ev_020", "ev_022"]
    }
  ]
}`,
    },

    // Example 3 (EN/Moderate) — Trauma response
    {
        label: 'Trauma response (EN/Moderate)',
        input: `Question: "How is the warrior processing the loss of her squad and what coping mechanisms is she using?"
Relevant memories:
- ev_100: [★★★★] Mara watched her entire squad die in the ambush at Blackstone Pass
- ev_101: [★★★] Mara wakes up screaming from nightmares about the ambush three nights a week
- ev_102: [★★] Mara refuses to sleep in a tent, preferring exposed ground where she can see the sky
- ev_103: [★★★] Mara has formed an intense attachment to the new recruit, Theron, who reminds her of her fallen lieutenant
- ev_104: [★★] Mara trains with her sword until her hands bleed, refusing to stop until exhaustion`,
        output: `{
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

    // Example 4 (RU/Moderate) — Romantic dependency
    {
        label: 'Romantic dependency (RU/Moderate)',
        input: `Вопрос: "Как развиваются отношения между Аней и Сергеем и что signalling о смене динамики?"
Релевантные воспоминания:
- ev_150: [★★★] Аня и Сергей впервые поцеловались после ссоры у реки
- ev_151: [★★★★] Аня призналась Сергею, что боится своих чувств, потому что "каждый раз заканчивается больно"
- ev_152: [★★★] Сергей сказал, что не собирается никуда уходить, и взял её за руку
- ev_153: [★★] Аня начала замечать, что думает о Сергее постоянно, даже во время работы
- ev_154: [★★★] Аня позвонила Сергею в три часа ночи после кошмара, и он приехал без вопросов`,
        output: `{
  "insights": [
    {
      "insight": "Отношения развиваются от конфликта к глубокой эмоциональной зависимости: Аня переносит на Сергея травматический опыт прошлых отношений, но постепенно учится доверять",
      "evidence_ids": ["ev_151", "ev_152", "ev_154"]
    },
    {
      "insight": "Ночной звонок — переломный момент: Аня выбирает уязвимость вместо изоляции, что signalling о переходе от защитной тактики к реальной близости",
      "evidence_ids": ["ev_150", "ev_153", "ev_154"]
    }
  ]
}`,
    },

    // Example 5 (EN/Explicit) — Intimacy as coping mechanism
    {
        label: 'Intimacy as coping (EN/Explicit)',
        input: `Question: "What psychological need is Lila fulfilling through escalating physical intensity with Marcus?"
Relevant memories:
- ev_200: [★★★★] Lila initiated sex with Marcus for the first time, stroking his cock while referencing desire since the lake
- ev_201: [★★★] Lila asked Marcus to pull her hair during sex, testing his reaction
- ev_202: [★★] Lila told Marcus she doesn't want gentle — she wants to feel owned
- ev_203: [★★★★] Lila broke down crying after an intense session, saying she doesn't know why
- ev_204: [★★★] Lila refused to discuss the crying incident the next morning, deflecting with humor`,
        output: `{
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

    // Example 6 (RU/Explicit) — Submission as emotional regulation
    {
        label: 'Submission regulation (RU/Explicit)',
        input: `Вопрос: "Что стоит за потребностью Кая в постоянном подчинении?"
Релевантные воспоминания:
- ev_250: [★★★★] Маша надела ошейник на Кая, установила стоп-слово 'малина' и прижала его к полу ногой
- ev_251: [★★★] Кай попросил Машу не снимать ошейник после сцены — хотел носить его весь вечер
- ev_252: [★★] Кай приготовил ужин для Маши, стоя на коленях пока она ела
- ev_253: [★★★★] Кай признался, что чувствует себя спокойнее, когда Маша принимает все решения за него`,
        output: `{
  "insights": [
    {
      "insight": "Подчинение для Кая — механизм эмоциональной регуляции: передача контроля Маше снимает тревогу и создаёт ощущение безопасности, что объясняет его нежелание выходить из роли",
      "evidence_ids": ["ev_251", "ev_253"]
    },
    {
      "insight": "Граница между сценой и реальностью стирается — Кай переносит динамику подчинения в бытовые ситуации (ужин на коленях), что может указывать на психологическую зависимость, а не осознанный выбор",
      "evidence_ids": ["ev_252", "ev_253"]
    }
  ]
}`,
    },
];
