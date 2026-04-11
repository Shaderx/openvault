/**
 * Russian event extraction few-shot examples.
 * 7 examples following SFW → kink gradient.
 */

export const EXAMPLES = [
    {
        label: 'Confession (RU/SFW)',
        input: `Тоня поставила кружку на стол и не подняла глаз.
«Я уволилась три недели назад,» — сказала она. — «Ты первый, кому я это говорю.»
Рустам замер. Потом тихо спросил: «Ты нормально?»
«Нет.» Она наконец посмотрела на него. «Но теперь немного лучше.»`,
        thinking: `Step 1: Tonya -> resigned(3 weeks ago); Rustam = first to know; she admitted not ok + feels better
Step 2: Cross-ref -> no established memories
Step 3: Progression -> new event; secret disclosed; trust + vulnerability
Step 4: Format -> importance = 4; first disclosure + trust shift; values in Russian`,
        output: `{
  "events": [{
    "summary": "Тоня призналась Рустаму, что уволилась три недели назад — он первый, кому она это рассказала",
    "importance": 4,
    "temporal_anchor": null,
    "is_transient": false,
    "characters_involved": ["Тоня", "Рустам"],
    "witnesses": ["Тоня", "Рустам"],
    "location": null,
    "is_secret": false,
    "emotional_impact": { "Тоня": "уязвимость и облегчение", "Рустам": "тревога" },
    "relationship_impact": { "Тоня→Рустам": "оказанное исключительное доверие" }
  }]
}`,
    },
    {
        label: 'First kiss (RU/Moderate)',
        input: `*Вероника убирала со стола. Арсений подошёл сзади и накрыл её руку своей ладонью.*
«Не уходи ещё,» — сказал он. — «Пожалуйста.»
Она развернулась. Они стояли так близко, что она слышала его дыхание.
«Арсений,» — начала она — но он уже наклонился, и слова пропали.
Поцелуй был долгим. Когда он закончился, она не отступила.`,
        thinking: `Step 1: Arseny -> asked -> stay; hand over hers; she turned; he -> kissed -> first; long; she = didn't pull back
Step 2: Cross-ref -> no romantic contact memories
Step 3: Progression -> new event; first kiss; mutual acceptance
Step 4: Format -> importance = 4; first romantic contact; values in Russian`,
        output: `{
  "events": [{
    "summary": "Арсений поцеловал Веронику первым — долгий поцелуй, она не отстранилась",
    "importance": 4,
    "temporal_anchor": null,
    "is_transient": false,
    "characters_involved": ["Арсений", "Вероника"],
    "witnesses": ["Арсений", "Вероника"],
    "location": null,
    "is_secret": false,
    "emotional_impact": { "Вероника": "смятение и желание", "Арсений": "решимость" },
    "relationship_impact": { "Арсений↔Вероника": "первый романтический контакт" }
  }]
}`,
    },
    {
        label: 'Sexual scene (RU/Explicit)',
        input: `Злата толкнула его на кровать и встала над ним на коленях. Нурлан потянулся к ней, но она поймала его запястья и прижала к подушке.
«Тихо,» — сказала она. — «Моя очередь.»
Она опустилась на его член медленно, до конца, выдыхая сквозь зубы. Нурлан застонал. Она начала двигаться — ровно, с контролем, наблюдая за его лицом.`,
        thinking: `Step 1: Zlata -> pushed -> Nurlan(bed) + pinned wrists + "quiet"; lowered onto cock; rhythm = controlled; watched face
Step 2: Cross-ref -> no sexual contact memories
Step 3: Progression -> new event; first penetration; Zlata = dominant; Nurlan = restrained
Step 4: Format -> importance = 4; power dynamic from first contact; values in Russian`,
        output: `{
  "events": [{
    "summary": "Злата прижала запястья Нурлана и первой опустилась на его член, задав доминирующий ритм",
    "importance": 4,
    "temporal_anchor": null,
    "is_transient": false,
    "characters_involved": ["Злата", "Нурлан"],
    "witnesses": ["Злата", "Нурлан"],
    "location": "Спальня",
    "is_secret": false,
    "emotional_impact": { "Злата": "контроль и возбуждение", "Нурлан": "удовольствие и подчинение" },
    "relationship_impact": { "Злата→Нурлан": "первый сексуальный контакт, инициирован с доминирования" }
  }]
}`,
    },
    {
        label: 'Power dynamic (RU/Kink)',
        input: `«Встань у стены,» — сказала Карина. — «Руки над головой.»
Тимур подчинился. Она зашла за его спину, накинула шёлковый шарф на запястья и завязала на балке. Подтянула узел.
«Цвет?» — спросила тихо.
«Зелёный.»
Она провела ладонью по его спине, не торопясь, сверху вниз — и резко шлёпнула ладонью. Тимур вздрогнул всем телом и выдохнул сквозь зубы.`,
        thinking: `Step 1: Karina -> ordered -> Timur(wall, hands up); tied wrists(scarf, beam); color = green; hand -> back -> slap; Timur -> flinched
Step 2: Cross-ref -> no restraint play memories
Step 3: Progression -> new event; first bondage + color system + first impact
Step 4: Format -> importance = 4; D/s dynamic + restraint + consent; values in Russian`,
        output: `{
  "events": [{
    "summary": "Карина привязала запястья Тимура шарфом к балке, провела цветовую проверку и ударила ладонью по спине после его зелёного ответа",
    "importance": 4,
    "temporal_anchor": null,
    "is_transient": false,
    "characters_involved": ["Карина", "Тимур"],
    "witnesses": ["Карина", "Тимур"],
    "location": null,
    "is_secret": true,
    "emotional_impact": { "Карина": "контроль", "Тимур": "подчинение" },
    "relationship_impact": { "Карина→Тимур": "установлена динамика доминирования с протоколом согласия" }
  }]
}`,
    },
    {
        label: 'Dedup - continuation (RU/Edge)',
        input: `Злата ускорила ритм. Нурлан приподнял бёдра ей навстречу — она резко прижала его обратно.
«Не двигайся,» — выдохнула она. Он замер. Она продолжила — медленнее теперь, намеренно, пока его дыхание не стало рваным.

<established_memories>
[★★★★] Злата прижала запястья Нурлана и первой опустилась на его член, задав доминирующий ритм
</established_memories>`,
        thinking: `Step 1: Zlata -> sped up; Nurlan -> hips rose -> she pressed back; "don't move"; she -> slowed deliberately; breathing = ragged
Step 2: Cross-ref -> existing: "pinned wrists + set dominant rhythm"
Step 3: Progression -> same position; he broke control -> she corrected; slowing = control escalation
Step 4: Format -> importance = 2; minor escalation in established scene; values in Russian`,
        output: `{ "events": [{ "summary": "Нурлан попытался двигать бёдрами, Злата прижала его обратно и приказала не двигаться, замедлив ритм намеренно", "importance": 2, "temporal_anchor": null, "is_transient": false, "characters_involved": ["Злата", "Нурлан"], "witnesses": ["Злата", "Нурлан"], "location": null, "is_secret": false, "emotional_impact": { "Нурлан": "вынужденное подчинение" }, "relationship_impact": {} }] }`,
    },
    {
        label: 'Conversational commitment (RU/SFW)',
        input: `— Я не смогу забирать Матвея из сада по средам, — сказал Глеб, завязывая шнурки. — Совещания сдвинули.
— Ладно. Тогда среды мои, — ответила Ирина, не отрываясь от ноутбука. — Но пятницы твои без исключений. И звони, если задерживаешься — не пиши, именно звони.
— Договорились. — Он встал. — Ключи у тебя?`,
        thinking: `Step 1: Gleb -> can't pick up Matvey(Wed, meetings); Irina -> takes Wed; Gleb -> takes Fri(no exceptions); Irina -> demands -> calls not texts if late; Gleb -> agreed
Step 2: Cross-ref -> no matches
Step 3: Progression -> new schedule + communication rules
Step 4: Format -> pickup split + call rule = durable; standing + keys = momentary; importance = 3; values in Russian`,
        output: `{
  "events": [{
    "summary": "Глеб и Ирина договорились: среды она забирает Матвея, пятницы он — без исключений, при задержке звонить, не писать",
    "importance": 3,
    "temporal_anchor": null,
    "is_transient": false,
    "characters_involved": ["Глеб", "Ирина"],
    "witnesses": ["Глеб", "Ирина"],
    "location": null,
    "is_secret": false,
    "emotional_impact": {},
    "relationship_impact": { "Глеб↔Ирина": "установлен новый график и правило коммуникации при задержках" }
  }]
}`,
    },
    {
        label: 'Timestamp with transient and durable (RU/SFW)',
        input: `[ 🕒 Суббота, 14 сентября 2024. 11:20 | 🏠 Кухня | ☁️ Пасмурно ]
Олег посмотрел на часы. «Выезжаем в два, не позже — иначе встанем в пробке».
Диана налила кофе. «Хорошо. Только я заеду к маме завтра после работы, занесу ей таблетки — она не может сама в аптеку».
«Понял», — кивнул Олег. — «Напиши, когда будешь выезжать оттуда».`,
        thinking: `Step 1: Timestamp header; Oleg -> departure(2 PM, avoid traffic); Diana -> visit mom(tomorrow, medicine); Oleg -> asked -> text when leaving
Step 2: Cross-ref -> no matches
Step 3: Progression -> two commitments; departure = today(transient); mom visit = tomorrow(durable, third person)
Step 4: Format -> anchor strips emojis + location + weather; departure = transient; mom visit = durable; values in Russian`,
        output: `{
  "events": [{
    "summary": "Олег и Диана договорились выехать в 14:00, чтобы не попасть в пробки",
    "importance": 3,
    "temporal_anchor": "Суббота, 14 сентября 2024. 11:20",
    "is_transient": true,
    "characters_involved": ["Олег", "Диана"],
    "witnesses": ["Олег", "Диана"],
    "location": "Кухня",
    "is_secret": false,
    "emotional_impact": {},
    "relationship_impact": {}
  }, {
    "summary": "Диана пообещала заехать к маме завтра после работы и отвезти ей таблетки",
    "importance": 3,
    "temporal_anchor": "Суббота, 14 сентября 2024. 11:20",
    "is_transient": false,
    "characters_involved": ["Диана"],
    "witnesses": ["Олег", "Диана"],
    "location": null,
    "is_secret": false,
    "emotional_impact": {},
    "relationship_impact": { "Диана→Олег": "взяла на себя обязательство, он в курсе графика" }
  }]
}`,
    },
];
