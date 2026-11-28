/* Раздел «Карточки» приложения «Расписание»: наборы карточек для запоминания.
   Источники: свои карточки (любой предмет, с фото и записью голоса), термины Словаря (поиск и вставка списка),
   готовые наборы (главы Словаря; для китайских студентов — «Учёба по-русски» и «Мои предметы»).
   Учёба — коробки Лейтнера: «Знаю» — карточка уходит на всё больший срок, «Ещё учу» — вернётся сейчас же и опустится на 2 коробки.
   Новых карточек в день — не больше лимита (cardDaily, общий на все наборы); повторения без лимита. В готовых наборах-главах учим
   только отмеченное на экране «Что я учу» (cardPick). Три состояния термина в наборе: «Учу» (и новые), «Выучено» (коробка ≥ LEARNED
   или отметка «уже знаю» — |k в cardProg) и «Корзина» (cardHide: бывшее «не учу», по наборам; прогресс сохраняется).
   Размер захода — cardSess, порядок новых — cardOrder (по учебнику / вперемешку).
   У китайских студентов два навыка: 🎧 услышать (понять на слух) и 🗣 сказать (произнести по-русски).
   Текст и прогресс — в localStorage (cardSets, cardOwn, cardProg, cardHide, cardPick, cardDaily, cardSess, cardOrder) и синхронизируются с аккаунтом;
   фото и записи голоса — только в IndexedDB этого телефона.
   Пользуется общим из app.js: state, LS, sfetch, openSheet, pushSheet, refreshSheet, closeSheet, toast, render, esc, icon, $, SPIN, myGroup, NO_DICT, GYM_V. */
(function(){
const Zh = () => state.lang==="zh";
if(typeof DORD==="undefined") window.DORD = {sort:(k, ids) => ids.slice(), hid:() => false, toggle(){}, open(){}, on(){}, tt:() => ({h:"", hidden:""})};   // старый app.js из кэша — без порядка и скрытых
const plain = s => (s||"").replace(/[`́]/g, "");
const norm = s => plain(s).toLowerCase().replace(/ё/g,"е");
// ударение рисуем сами (в шрифте приложения знак U+0301 съезжает)
const sth = s => esc(s||"").replace(/([аеёиоуыэюяАЕЁИОУЫЭЮЯ])`/g, '<span class="cdv">$1</span>').replace(/`/g, "");
const CJK = /[㐀-鿿]/;
const today = () => Math.floor((Date.now() + 3*3600e3) / 864e5);   // день по Москве
const BOX = [0, 1, 3, 7, 14, 30];                                   // через сколько дней снова показать (по коробке)
const LEARNED = 4;                                                  // с этой коробки слово считается выученным (интервал 14 дней)
const SESS = [10, 20, 30, 0];                                       // карточек (разных) за один заход; 0 — весь список
const DAILY = [5, 10, 15, 20];                                      // сколько новых в день можно выбрать (по умолчанию 10)
const DUE_CAP = 50;                                                 // если к повтору больше — новых не даём
const SPK = `<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>`;
const MIC = `<svg class="cmic" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/></svg>`;

const T = {
  ru:{ due:n=>`Повторить: ${n}`, dueBy:n=>`по ${n} за раз`, dueNone:"На сегодня всё повторено", study:"Учить", review:"Повторить",
    mine:"Мои наборы", ready:"Готовые наборы", newSet:"＋ Новый набор", empty:"Своих наборов пока нет. Создайте набор на любую тему — или начните с готового.",
    learned:(a,b)=>`выучено ${a} из ${b}`, nCards:n=>`${n} ${n%10===1&&n%100!==11?"карточка":n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"карточки":"карточек"}`,
    back:"Все наборы", add:"＋ Добавить", fromDict:"Из Словаря", fromDictSub:"Найти термины и отметить галочками",
    paste:"Вставить список", pasteSub:"Список слов от преподавателя — приложение найдёт их само", own:"Своя карточка", ownSub:"Любой предмет: вопрос и ответ, можно с фото",
    setEmpty:"В наборе пока нет карточек. Добавьте их одним из способов ниже.",
    setName:"Название набора", setNamePh:"Например: Анатомия — кости", create:"Создать", save:"Сохранить", del:"Удалить набор", delQ:"Удалить набор? Карточки из Словаря останутся в Словаре, свои карточки этого набора удалятся.",
    rename:"Переименовать", needName:"Напишите название", setMenu:"Набор",
    search:"Поиск: выпад, дугами, 弓步…", found:n=>`Найдено: ${n}`, none:"Ничего не нашлось. Проверьте слово или сделайте свою карточку.",
    browse:"Или выберите главу:", allCh:"Отметить все", inSet:"уже в наборе", addN:n=>n?`Добавить (${n})`:"Отметьте карточки", more:"Показать ещё",
    pasteHint:"Каждое слово с новой строки. Слово — найдётся в Словаре. «Термин — определение» (через тире или двоеточие) — станет своей карточкой с ответом, так удобно переносить конспект.", pasteFind:"Разобрать список", pasteOwn:"Свои карточки с ответом",
    pasteFound:"Нашлось в Словаре", pasteMiss:"Не нашлось — сделать своей карточкой", maybe:"похоже на",
    ownNew:"Своя карточка", ownEdit:"Карточка", ownF:"Термин или вопрос", ownB:"Ответ или определение", photo:"📷 Фото", photoDel:"Убрать фото", voice:"🎤 Записать произношение", voiceAgain:"🎤 Перезаписать", voiceDel:"Убрать запись",
    ttsSent:"Сохранено. Слово отправлено на озвучку — голос появится примерно через 4–5 часов", ttsReady:"🔊 Озвучено — можно слушать", ttsSentN:"свои слова отправлены на озвучку — голос появится примерно через 4–5 часов",
    ttsWait:d=>`⏳ Отправлено на озвучку ${d}. Голос появится примерно через 4–5 часов после отправки; пока звучит голос телефона или ваша запись`,
    ttsNew:"🔊 После сохранения слово отправится на озвучку: голос появится примерно через 4–5 часов. Можно и записать своё произношение", ttsBad:"Озвучить можно только русский текст (без латиницы)",
    rec:"Говорите… нажмите, чтобы остановить", needF:"Заполните первую сторону", saved:"Сохранено", added:n=>`Добавлено: ${n}`,
    local:"Фото и записи голоса хранятся только на этом телефоне: в аккаунт они не попадают и на новый телефон не переедут. Текст карточек и прогресс сохраняются в аккаунте.",
    localShort:"📱 Фото и голос — только на этом телефоне", mediaAway:"фото на другом телефоне",
    know:"Знаю", again:"Ещё учу", flip:"Нажмите, чтобы перевернуть", known:"Уже знаю — не показывать", knownOn:"Отмечено: уже знаю", knownOff:"Снова в учёбе",
    remove:"Удалить из набора", removed:"Убрано из набора", hidden:n=>`Не учу (${n})`, restore:"Вернуть", edit:"Изменить",
    done:"Готово!", doneSub:(a,b)=>`Знаю: ${a} · ещё учу: ${b}`, againAll:"Ещё раз", toSet:"К набору", toHome:"Ко всем наборам",
    dayNew:(a,b)=>`Сегодня новых: ${a} из ${b}`, tomorrow:n=>n ? `Завтра повторить: ${n}` : "Завтра повторять нечего", moreNew:n=>`Ещё ${n} новых`,
    newLeft:(a,b)=>`Новых сегодня: ${a} из ${b}`, newOver:"Новые на сегодня закончились — продолжим завтра. Лимит можно поменять в настройках.",
    tooMany:n=>`К повтору накопилось ${n}. Новые карточки подождут, пока повторений не станет меньше ${DUE_CAP}.`,
    settings:"Настройки", dailyH:"Новых карточек в день", dailySub:"Сразу на все наборы. Повторения — без ограничений: карточки возвращаются, когда пора.",
    learnT:"Я изучаю", learnSub:(n,k)=>`${n} · выучено ${k}`, learnNone:"Пока ничего не изучается. Откройте готовый набор и отметьте, что учить, или создайте свой.",
    off:"В корзину", offSub:"Не попадётся в учёбе и не войдёт в счёт; прогресс сохранится. Вернуть — внизу набора", offDone:"В корзине", knownSub:"Считается выученной и больше не показывается", resetT:"Начать заново", notYet:"Пока не учу", notYetSub:"Плашка «учу» уберётся — термин снова «новое»", resetSub:"Прогресс сотрётся — термин снова «новое»", resetDone:"Снова новое",
    knownT:"уже знаю", pickT:"Что я учу", pickBtn:"Выбрать, что учу", pickSub:"Отметьте подразделы целиком или отдельные термины. Новые карточки пойдут по порядку учебника. Редкие термины и статьи-обзоры отмечены серым — их можно добавить.",
    pickGo:n=>`Готово · ${n}`, pickAll:"Отметить всё", pickNone:"Снять всё", pickMain:"Основное", rare:"редкий", ovw:"обзор", pickN:(a,b)=>`${a} из ${b}`,
    sel:"Выбрать", selDone:"Отмена", selOff:n=>`В корзину (${n})`, selKnown:n=>`Уже знаю (${n})`, selHint:"Отметьте карточки",
    rep:n=>`↻ ещё ${n}`, qL:"Вопрос", aL:"Ответ", howSay:"Как сказать", moreD:"подробнее", whatName:"Как называется?", whatMean:"Что значит?",
    swipe:"← ещё учу · смахните карточку · знаю →", noAns:"Ответа пока нет", addAns:"✎ Дописать ответ", listen:"Послушать", ansPh:"ответ — можно дописать позже",
    print:"🖨 Печать", printT:"Напечатать карточки", prFold:"Сложить пополам", prFoldSub:"Лицо и оборот рядом: печать на одной стороне листа, вырезать по пунктиру и сложить по середине. Проще всего.",
    prDup:"Двусторонняя печать", prDupSub:"Лица на одном листе, обороты — на обратной стороне. Принтер должен уметь печатать с двух сторон (переворот по длинному краю).",
    prWhat:"Какие карточки", prAll:"Все, что учу", prLeft:"Только невыученные", prSel:n=>`Отмеченные (${n})`, prMany:p=>`Это ${p} листов — много бумаги. Можно напечатать только невыученные или отметить нужные карточки в списке («Выбрать»).`, prFront:"На лицевой стороне", prGo:"Напечатать", prN:(n,p)=>`${n} ${n%10===1&&n%100!==11?"карточка":n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"карточки":"карточек"} · ${p} ${p===1?"лист":p<5?"листа":"листов"} A4`,
    prWait:"Готовим рисунки…", prHint:"В окне печати выберите «Сохранить как PDF», если принтера нет рядом — файл можно распечатать потом.",
    exT:"Связка ОРУ", exSub:"По рисункам написать упражнение — как на мини-зачёте", exPose:"Одна поза", exChain:"Связка", exTip:"Посмотрите на рисунки и запишите упражнение своими словами: исходное положение, потом что делаем на каждый счёт.", exTipPose:"Опишите исходное положение своими словами.",
    exPh:"что делаем?", exCheck:"Проверить", exNew:"Новое упражнение", exYou:"Вы", exRight:"Правильно", exMiss:"пропущено", exExtra:"лишнее", exTypo:"опечатка",
    exScore:(a,b)=>`Верно: ${a} из ${b}`, exOk:"✓ верно", exNear:"≈ почти", exNo:"✕ не так", exEmpty:"не заполнено", exLegend:"Цветом — совпало, волнистой линией — опечатка, в рамке — пропущено, зачёркнуто — лишнее. Одно и то же можно сказать по-разному — если по смыслу верно, засчитайте себе сами.", exFix:"✎ Исправить", hardH:"Трудные в этот раз", undo:"Отменить", speed:{"0.75":"🐢 медленно","1":"обычно","1.25":"быстрее"}, pickPic:"Что услышали? Выберите рисунок", nextC:"Дальше", right:"Верно!", wrong:"Не то — правильно так:", meVs:"▶ Я и образец", hard:"Трудные слова", hardSub:"2+ раза «Ещё учу» и ещё не выучены", nothing:"Сейчас учить нечего: всё выучено или отмечено «уже знаю». Загляните завтра.",
    modeH:"Что на лицевой стороне", modeA:"Рисунок → термин", modeB:"Термин → что это", modeC:"Определение → термин",
    st:{n:"новое", l:"учу", k:"✓", kn:"знаю"}, sayIt:"Термин", whatIs:"Что это?",
    noDict:"Словарь не загрузился — проверьте интернет.", studyAll:"Все наборы",
    sessH:"За один заход", sessAll:"весь список", sessSub:"Сколько разных карточек в одном заходе. Остальные — в следующем.",
    orderH:"Новые карточки", orderBook:"По порядку учебника", orderMix:"Вперемешку", orderSub:"По порядку — похожие термины идут рядом, их легче сравнить и запомнить. Повторения всегда первыми: сначала те, что ждут дольше всех.",
    full:"Пройти весь список", fullSub:n=>`${n} подряд, без лимита новых`,
    blkLearn:"Учу", blkKnown:"Выучено ✓", blkTrash:"Корзина 🗑", trashSub:"Эти термины не попадаются в учёбе и не входят в счёт. Прогресс сохраняется — их можно вернуть.",
    restoreAll:"Вернуть все", toLearn:"Вернуть в учу", toTrash:"В корзину", fromTrash:"Вернуть из корзины", trashed:"В корзине", backLearn:"Снова в учёбе", restored:"Возвращено",
    swHint:"← в корзину · знаю →", stNew:"новое", stStep:b=>`учу · ${b}/4`,
    stInfoN:"Новое — ещё ни разу не попадалось в учёбе.", stInfoL:b=>`Ступень ${b} из 4. Каждое «Знаю» вовремя — шаг вперёд, «Ещё учу» — на 2 ступени назад. На 4-й термин уходит в «Выучено».`, stInfoK:"Выучено: показывается редко, только чтобы не забылось.",
    hardWhy:"Сюда сами попадают слова, на которых вы 2 и больше раз нажали «Ещё учу» и которые ещё не выучены.",
    againTip:"«Ещё учу» — карточка вернётся в этом заходе; в общий счёт не добавляется.",
    emH:"Значок", emPh:"Вставьте или наберите любой эмодзи",
    secDue:n=>`повторить ${n}`, secNone:"всё повторено", secNew:"можно начать", reviewSec:n=>`Повторить сегодня: ${n}`, reviewAll:n=>`Повторить всё · ${n}`, toTopic:"К разделу",
    sets:n=>`${n} ${n%10===1&&n%100!==11?"набор":n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"набора":"наборов"}` , heroDue:"к повтору сегодня", heroNone:"На сегодня всё повторено", heroNoneSub:"Можно взять новые карточки в любом разделе", heroStart:"С чего начать?", heroStartSub:"Откройте раздел и выберите, что учить", secH:"Разделы", studyN:(n,k)=>`учу ${n} · выучено ${k}` },
  zh:{ due:n=>`要复习：${n}`, dueBy:n=>`每次 ${n} 张`, dueNone:"今天的都复习完了", study:"学习", review:"复习",
    mine:"我的卡片组", ready:"现成的卡片组", newSet:"＋ 新建卡片组", empty:"还没有自己的卡片组。可以建一个任何主题的，也可以从现成的开始。",
    learned:(a,b)=>`已掌握 ${a}/${b}`, nCards:n=>`${n} 张卡片`,
    back:"全部卡片组", add:"＋ 添加", fromDict:"从词典添加", fromDictSub:"搜索术语，打勾选择",
    paste:"粘贴词表", pasteSub:"老师发的词表——应用会自动在词典里找到", own:"自己的卡片", ownSub:"任何科目：俄语词和中文意思，可以加照片和录音",
    setEmpty:"这个卡片组还没有卡片。用下面任一方式添加。",
    setName:"卡片组名称", setNamePh:"例如：解剖学——骨骼", create:"创建", save:"保存", del:"删除卡片组", delQ:"删除这个卡片组吗？词典里的术语不受影响，这个组里自己做的卡片会被删除。",
    rename:"重命名", needName:"请写名称", setMenu:"卡片组",
    search:"搜索：выпад、弓步、叉腰…", found:n=>`找到 ${n} 个`, none:"没有找到。检查一下拼写，或者做一张自己的卡片。",
    browse:"或者选择章节：", allCh:"全选", inSet:"已在组里", addN:n=>n?`添加（${n}）`:"请打勾选择", more:"显示更多",
    pasteHint:"每行一个。只有俄语词——会在词典里查找。“俄语 — 中文”（用破折号或冒号隔开）——会变成带答案的自己的卡片。", pasteFind:"整理词表", pasteOwn:"带答案的自己的卡片",
    pasteFound:"在词典里找到了", pasteMiss:"没有找到——做成自己的卡片", maybe:"可能是",
    ownNew:"自己的卡片", ownEdit:"卡片", ownF:"俄语（要记住的词）", ownB:"中文意思", photo:"📷 照片", photoDel:"删除照片", voice:"🎤 录发音", voiceAgain:"🎤 重新录", voiceDel:"删除录音",
    ttsSent:"已保存。这个词已送去配音，大约 4–5 小时后就能听到", ttsReady:"🔊 已配音，可以听了", ttsSentN:"自己写的词已送去配音，大约 4–5 小时后就能听到",
    ttsWait:d=>`⏳ ${d} 已送去配音，大约 4–5 小时后能听到；在这之前播放的是手机自带的声音或你的录音`,
    ttsNew:"🔊 保存后这个词会送去配音，大约 4–5 小时后就能听到。也可以自己录发音", ttsBad:"只能给俄语配音（不能有拉丁字母）",
    rec:"请说…再点一下停止", needF:"请填写俄语", saved:"已保存", added:n=>`已添加 ${n} 张`,
    local:"照片和录音只保存在这部手机上：不会进入账号，换手机后也不会转过去。卡片文字和学习进度会保存在账号里。",
    localShort:"📱 照片和录音只在这部手机上", mediaAway:"照片在另一部手机上",
    know:"会了", again:"还不会", flip:"点一下翻面", known:"已经会了——不再出现", knownOn:"已标记：已经会了", knownOff:"重新加入学习",
    remove:"从组里删除", removed:"已移除", hidden:n=>`不学的（${n}）`, restore:"恢复", edit:"修改",
    done:"完成！", doneSub:(a,b)=>`会了：${a} · 还不会：${b}`, againAll:"再来一遍", toSet:"回到卡片组", toHome:"回到全部卡片组",
    dayNew:(a,b)=>`今天新学：${a}/${b}`, tomorrow:n=>n ? `明天要复习：${n}` : "明天没有要复习的", moreNew:n=>`再学 ${n} 张新的`,
    newLeft:(a,b)=>`今天新学：${a}/${b}`, newOver:"今天的新卡片学完了，明天继续。每天的数量可以在设置里改。",
    tooMany:n=>`要复习的已经有 ${n} 张。先复习，少于 ${DUE_CAP} 张后再学新的。`,
    settings:"设置", dailyH:"每天学几张新卡片", dailySub:"所有卡片组加起来。复习没有限制：到时间卡片会自己回来。",
    learnT:"我在学的", learnSub:(n,k)=>`${n} · 已掌握 ${k}`, learnNone:"还没有在学的。打开一个现成的卡片组选出要学的，或者自己建一个。",
    off:"放进回收站", offSub:"不再出现，也不计入进度；学习记录会保留。可以在卡片组最下面恢复", offDone:"已放进回收站", knownSub:"算作已掌握，不再出现", resetT:"从头开始", notYet:"暂时不学", notYetSub:"去掉“学习中”标记，重新算作「新的」", resetSub:"清除学习记录，重新算作「新的」", resetDone:"已重新算作新的",
    knownT:"已经会了", pickT:"我要学的", pickBtn:"选择要学的", pickSub:"可以整节选，也可以一个一个选。新卡片按教材顺序出现。少见的术语和概述是灰色的——需要的话可以加上。",
    pickGo:n=>`完成 · ${n}`, pickAll:"全选", pickNone:"全不选", pickMain:"基本的", rare:"少见", ovw:"概述", pickN:(a,b)=>`${a}/${b}`,
    sel:"选择", selDone:"取消", selOff:n=>`回收站（${n}）`, selKnown:n=>`已经会了（${n}）`, selHint:"请选择卡片",
    rep:n=>`↻ 还有 ${n}`, qL:"问题", aL:"答案", howSay:"怎么说", moreD:"详细", whatName:"这叫什么？", whatMean:"什么意思？",
    swipe:"← 还不会 · 左右滑动 · 会了 →", noAns:"还没有答案", addAns:"✎ 补写答案", listen:"听一听", ansPh:"中文意思——可以以后再写",
    print:"🖨 打印", printT:"打印卡片", prFold:"对折", prFoldSub:"正面和背面并排：单面打印，沿虚线剪开，从中间对折。最简单。",
    prDup:"双面打印", prDupSub:"正面印在一页，背面印在纸的另一面。打印机需要支持双面打印（长边翻转）。",
    prWhat:"打印哪些卡片", prAll:"全部在学的", prLeft:"只打还没掌握的", prSel:n=>`选中的（${n}）`, prMany:p=>`一共 ${p} 页，纸很多。可以只打还没掌握的，或者在列表里“选择”需要的卡片。`, prFront:"正面", prGo:"打印", prN:(n,p)=>`${n} 张卡片 · ${p} 页 A4`,
    prWait:"正在准备图片…", prHint:"如果身边没有打印机，在打印窗口选择“另存为PDF”，以后再打印。",
    exT:"徒手操组合", exSub:"看图用俄语写出练习——像小测验一样", exPose:"一个姿势", exChain:"组合", exTip:"看图，用俄语写出练习：先写预备姿势，再写每一拍做什么。",  exTipPose:"用俄语写出这个预备姿势。",
    exPh:"做什么？（俄语）", exCheck:"检查", exNew:"换一个练习", exYou:"你写的", exRight:"正确", exMiss:"漏了", exExtra:"多余", exTypo:"拼写错误",
    exScore:(a,b)=>`正确：${a}/${b}`, exOk:"✓ 正确", exNear:"≈ 差不多", exNo:"✕ 不对", exEmpty:"没有填写", exLegend:"彩色——对了，波浪线——拼写错误，方框——漏写，划线——多余。同一个意思可以有不同说法——意思对就算对。", exFix:"✎ 修改", hardH:"这次比较难的", undo:"撤销", speed:{"0.75":"🐢 慢速","1":"正常","1.25":"快一点"}, pickPic:"听到的是哪个？选出正确的图", nextC:"下一张", right:"对了！", wrong:"不对——正确的是：", meVs:"▶ 我和标准发音", hard:"难记的词", hardSub:"点过 2 次以上“还不会”、还没掌握的", nothing:"现在没有要学的：都已掌握或标记为“已经会了”。明天再来看看。",
    skill:{mix:"🎧+🗣 都练", l:"🎧 听", s:"🗣 说"}, skillH:"练什么",
    lFront:"听一听：这是什么意思？", lNoAud:"这张卡片没有录音", sFront:"用俄语大声说出来，然后翻面", recMe:"录下我的发音", recAgain:"🎤 再录一次", myRec:"▶ 我的录音", playAgain:"再听一遍",
    st:{n:"新", l:"学习中", k:"✓", kn:"会了"}, sayIt:"俄语", whatIs:"什么意思？",
    noDict:"词典没有加载，请检查网络。", studyAll:"全部卡片组",
    sessH:"每次学几张", sessAll:"全部", sessSub:"一次学习里有几张不同的卡片，其余的下次再学。",
    orderH:"新卡片的顺序", orderBook:"按教材顺序", orderMix:"打乱顺序", orderSub:"按教材顺序——相似的术语挨在一起，容易比较和记住。复习的卡片总是先出现：等得最久的最先。",
    full:"整个列表学一遍", fullSub:n=>`连续 ${n} 张，不受每天新卡片数量限制`,
    blkLearn:"在学", blkKnown:"已掌握 ✓", blkTrash:"回收站 🗑", trashSub:"这些术语不会出现在学习里，也不计入进度。学习记录会保留，可以随时恢复。",
    restoreAll:"全部恢复", toLearn:"重新学习", toTrash:"放进回收站", fromTrash:"从回收站恢复", trashed:"已放进回收站", backLearn:"重新加入学习", restored:"已恢复",
    swHint:"← 回收站 · 会了 →", stNew:"新", stStep:b=>`在学 · ${b}/4`,
    stInfoN:"新卡片——还没有学过。", stInfoL:b=>`第 ${b} 级，共 4 级。按时点“会了”——升一级，点“还不会”——降两级。到第 4 级就算掌握了。`, stInfoK:"已掌握：偶尔出现，免得忘记。",
    hardWhy:"这里会自动收集你点过 2 次及以上“还不会”、而且还没掌握的词。",
    againTip:"“还不会”——这张卡片在这次学习里还会出现，不计入总数。",
    emH:"图标", emPh:"粘贴或输入任意表情",
    secDue:n=>`要复习 ${n}`, secNone:"都复习完了", secNew:"可以开始", reviewSec:n=>`今天复习：${n}`, reviewAll:n=>`全部复习 · ${n}`, toTopic:"回到这个部分",
    sets:n=>`${n} 个卡片组`, heroDue:"今天要复习", heroNone:"今天的都复习完了", heroNoneSub:"可以在任何部分学新的卡片", heroStart:"从哪里开始？", heroStartSub:"打开一个部分，选出要学的", secH:"分类", studyN:(n,k)=>`在学 ${n} · 已掌握 ${k}` }
};
const TL = () => T[Zh()?"zh":"ru"];

/* ---------- готовые слова для китайских студентов: «Учёба по-русски» ---------- */
const STUDY = [
  ["па`ра","一节大课（两节连上，90分钟）"],["расписа`ние","课表"],["ле`кция","理论课，讲座"],["пра`ктика","实践课"],["семина`р","研讨课"],
  ["зачёт","考查（通过／不通过）"],["зачёт с оце`нкой","带分数的考查"],["экза`мен","考试"],["се`ссия","考试周"],["пересда`ча","补考"],
  ["долг","没通过的科目（欠考）"],["отрабо`тка","补课（补缺勤）"],["про`пуск","缺勤"],["опозда`ть","迟到"],["переры`в","课间休息"],
  ["ауди`тория","教室"],["ко`рпус","教学楼"],["спорти`вный зал","体育馆"],["раздева`лка","更衣室"],["спорти`вная фо`рма","运动服"],
  ["сме`нная о`бувь","换的鞋"],["преподава`тель","老师"],["ста`роста","班长"],["гру`ппа","班级"],["декана`т","院系办公室"],
  ["студе`нческий биле`т","学生证"],["зачётная кни`жка","成绩册"],["дома`шнее зада`ние","作业"],["рефера`т","小论文，报告"],["конспе`кт","笔记"],
  ["сдать зачёт","通过考查"],["па`ру отмени`ли","这节课取消了"],["па`ру перенесли`","这节课改时间了"],["дистанцио`нно","线上上课"],["спра`вка","证明"],
  ["больни`чный","病假证明"],["стипе`ндия","奖学金"],["общежи`тие","宿舍"],["библиоте`ка","图书馆"],["столо`вая","食堂"],
  ["вопро`с","问题"],["отве`т","回答"],["Повтори`те, пожа`луйста.","请再说一遍。"],["Я не по`нял.","我没听懂。（男）"],["Я не поняла`.","我没听懂。（女）"],
  ["Мо`жно вы`йти?","可以出去一下吗？"],["Я заболе`л.","我生病了。（男）"],["Я заболе`ла.","我生病了。（女）"],["Где ауди`тория?","教室在哪里？"],["Мо`жно сдать по`зже?","可以晚一点交吗？"]
];

/* ---------- хранилище ----------
   Чтение из localStorage и всё посчитанное по нему (статусы, наборы, счётчики) кешируем до следующей записи или отрисовки:
   раньше cardProg разбирался заново на каждый вопрос — главный экран с тысячами карточек рисовался секундами. */
let MEMO = {};
const memo = (k, f) => k in MEMO ? MEMO[k] : (MEMO[k] = f());
const fresh = () => { MEMO = {}; };
if(typeof DORD!=="undefined") DORD.on(fresh);   // порядок и скрытое в Словаре поменялись — пересчитать наборы
const put = (k, v) => { LS.set(k, v); MEMO = {}; };
const lsArr = k => memo(k, () => { const v = LS.get(k, []); return Array.isArray(v) ? v : []; });
const lsObj = k => memo(k, () => { const v = LS.get(k, {}); return v && typeof v==="object" && !Array.isArray(v) ? v : {}; });
const sets = () => lsArr("cardSets");
const owns = () => lsArr("cardOwn");
const prog = () => lsObj("cardProg");
const hides = () => lsObj("cardHide");
const picks = () => lsObj("cardPick");    // готовые наборы-главы: {id набора: [ссылки, которые учу]}; нет записи — ещё не выбирали
const daily = () => { const v = +LS.get("cardDaily", 10); return DAILY.includes(v) ? v : 10; };
const sessN = () => { const v = LS.get("cardSess", 20); return SESS.includes(+v) ? +v : 20; };   // 0 — весь список
const sessCap = () => sessN() || 1e9;
const mixNew = () => LS.get("cardOrder", "book")==="mix";
const setOf = id => sets().find(s => s.id===id);
const ownOf = id => memo("own", () => new Map(owns().map(o => [o.id, o]))).get(id);
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,5);

// фото и голос — IndexedDB только этого телефона
let DB = null;
const db = () => DB || (DB = new Promise((ok, no) => { const r = indexedDB.open("cardsMedia", 1); r.onupgradeneeded = () => r.result.createObjectStore("m"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
const mtx = (mode, fn) => db().then(d => new Promise((ok, no) => { const tx = d.transaction("m", mode), st = tx.objectStore("m"), r = fn(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => no(tx.error); }));
const mget = k => mtx("readonly", s => s.get(k)).catch(() => null);
const mput = (k, v) => mtx("readwrite", s => s.put(v, k));
const mdel = k => mtx("readwrite", s => s.delete(k)).catch(() => {});
const MEDIA = {};   // ключ → objectURL (или null, если на этом телефоне нет)
function media(k){
  if(k in MEDIA) return MEDIA[k];
  MEDIA[k] = undefined;
  mget(k).then(b => { MEDIA[k] = b ? URL.createObjectURL(b) : null; redraw(); });
  return undefined;
}
function forget(k){ if(MEDIA[k]) URL.revokeObjectURL(MEDIA[k]); delete MEDIA[k]; }

/* ---------- данные словаря ---------- */
let D = null, ITEM = {}, CAT = {}, CHAP = {}, FIG = {}, FIGL = {}, AUD = null, dLoading = false, dFailed = false, SAUD = null;
let CHREFS = {}, CATREFS = {}, TITLE = new Map(), FIGUSE = {}, NUM = {};   // NUM — карточки «цифры» (вопрос → число) по видам спорта   // индексы: глава → ссылки, подраздел → ссылки, название → термин, сколько терминов у рисунка
const dictOk = () => typeof NO_DICT==="undefined" || !NO_DICT.includes(String(state.group));
function loadDict(){
  if(D || dLoading || !dictOk()) return; dLoading = true; dFailed = false;
  sfetch("gym/data.json").then(r => r.ok ? r.json() : null).then(d => {
    dLoading = false; if(!d || !d.items){ dFailed = true; redraw(); return; }
    D = d; FIG = Object.assign({}, d.fig || {}); AUD = d.audio || null;
    (d.cats||[]).forEach(c => CAT[c.id] = c); (d.chapters||[]).forEach(c => CHAP[c.id] = c);
    // разделы с zh:1 («Русский для учёбы») — только для китайского языка (язык меняется на ходу — фильтр при каждом обращении)
    ALLT = d.topics || []; const zoCh = new Set([].concat(...ALLT.filter(t => t.zh).map(t => t.chapters)));
    Object.defineProperty(D, "topics", {get:() => Zh() ? ALLT : ALLT.filter(t => !t.zh), configurable:true});
    d.items.forEach(it => { if(zoCh.has((CAT[it.c]||{}).ch)) it._zo = 1; indexItem(it); });
    (d.chapters||[]).forEach(ch => { CHREFS[ch.id] = [].concat(...ch.cats.map(c => CATREFS[c] || [])); });
    if(window.MYCH){ applyMy(); MYCH.on(() => { applyMy(); fresh(); redraw(); }); }
    (d.numSets||[]).forEach(ns => ns.items.forEach(x => { NUM[x.id] = x; }));
    if(d.fig) FIGL.oru = true;
    redraw();
  }).catch(() => { dLoading = false; dFailed = true; redraw(); });
}
fetch("cards-audio/audio.json").then(r => r.ok ? r.json() : null).then(a => { SAUD = a; redraw(); }).catch(() => {});
// озвучка своих карточек китайских студентов: слово уходит в очередь (Supabase tts_add, scripts/tts.sql),
// раз в 4 часа «Обновить расписание» озвучивает его голосом Словаря (scripts/tts.py) и кладёт в tts/
let TAUD = null;
fetch("tts/audio.json", {cache:"no-cache"}).then(r => r.ok ? r.json() : {}).then(a => { TAUD = a || {}; redraw(); ttsSync(); }).catch(() => { TAUD = {}; });
const ttsText = f => (f||"").replace(/\s+/g, " ").trim();
const ttsOkText = f => { const x = ttsText(f); return x.length > 0 && x.length <= 500 && /[А-Яа-яЁё]/.test(x) && !/[A-Za-z]/.test(x) && /^[А-Яа-яЁё0-9 .,!?;:()«»"'’\/№%+–—`\u0301-]+$/.test(x); };
const ttsHas = f => !!(TAUD && TAUD[audioKey(f)]);
const ttsQ = () => { const v = LS.get("cardTtsQ", {}); return v && typeof v==="object" ? v : {}; };   // слово → когда отправлено (только этот телефон)
let ttsBusy = false;
async function ttsSync(){   // отправить на озвучку свои карточки, которых ещё нет; повторно — если за 2 дня так и не озвучилось
  if(!Zh() || TAUD===null || ttsBusy || typeof rpc!=="function") return;
  const q = ttsQ(), now = Date.now(), seen = new Set();
  const todo = owns().map(o => ttsText(o.f)).filter(f => { const k = audioKey(f); if(seen.has(k) || !ttsOkText(f) || ttsHas(f) || (q[k] && now - q[k] < 2*864e5)) return false; seen.add(k); return true; }).slice(0, 50);
  if(!todo.length) return;
  let dev = localStorage.getItem("devId"); if(!dev){ dev = Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(36)).join(""); localStorage.setItem("devId", dev); }
  ttsBusy = true;
  try{ await rpc("tts_add", {p_items:todo, p_dev:dev}); const q2 = ttsQ(); todo.forEach(f => q2[audioKey(f)] = now); LS.set("cardTtsQ", q2); }catch(e){}
  ttsBusy = false;
}
const chOf = it => (CAT[it.c]||{}).ch;
function indexItem(it){
  ITEM[it.id] = it; it.fig = [...new Set(it.fig || [])];
  it._w = words([it.t, ...(it.say||[])].join(" ")); it._d = words(it.d||""); it._z = (it.zh||"")+" "+(it.dz||""); it._t = norm(it.t).replace(/\s*\([^)]*\)/g,"").trim();
  (CATREFS[it.c] = CATREFS[it.c] || []).push("g:"+it.id); it.fig.forEach(f => FIGUSE[f] = (FIGUSE[f]||0) + 1);
  const k = norm(it.t).replace(/[^a-zа-я0-9 ]+/g," ").replace(/\s+/g," ").trim(); if(!TITLE.has(k)) TITLE.set(k, it); if(!TITLE.has(it._t)) TITLE.set(it._t, it);
}
// «Мои главы» (mych.js) — готовые наборы, как главы Словаря; при каждом изменении убираем старое и добавляем заново
let ALLT = [];
function applyMy(){
  if(!D || !window.MYCH) return; const p = MYCH.parts();
  D.items = D.items.filter(it => { if(it.my){ delete ITEM[it.id]; return false; } return true; });
  for(const [k, it] of [...TITLE]) if(it.my) TITLE.delete(k);
  (D.cats||[]).filter(c => c.my).forEach(c => { delete CAT[c.id]; delete CATREFS[c.id]; });
  (D.chapters||[]).filter(c => c.my).forEach(c => { delete CHAP[c.id]; delete CHREFS[c.id]; });
  D.cats = (D.cats||[]).filter(c => !c.my).concat(p.cats); D.chapters = (D.chapters||[]).filter(c => !c.my).concat(p.chapters);
  ALLT = ALLT.filter(t => !t.my).concat([p.topic]);
  p.cats.forEach(c => CAT[c.id] = c); p.chapters.forEach(c => { CHAP[c.id] = c; FIGL[c.id] = true; });
  Object.keys(FIG).forEach(k => { if(k.startsWith("u-")) delete FIG[k]; }); Object.assign(FIG, MYCH.figs());
  p.items.forEach(it => { D.items.push(it); indexItem(it); });
  p.chapters.forEach(ch => { CHREFS[ch.id] = [].concat(...ch.cats.map(c => CATREFS[c] || [])); });
}
function words(s){ return norm(s).replace(/[^a-zа-я0-9]+/g," ").trim().split(" ").filter(Boolean); }
function loadFigs(ch){
  if(!D || !ch || FIGL[ch] || !D.figFiles || !D.figFiles[ch]) return; FIGL[ch] = "…";
  sfetch(D.figFiles[ch]).then(r => r.ok ? r.json() : null).then(f => { if(!f) return; Object.assign(FIG, f); FIGL[ch] = true; clearTimeout(loadFigs.t); loadFigs.t = setTimeout(redraw, 60); }).catch(() => { FIGL[ch] = false; });
}
// рисунки ОРУ «по описанию» рисует манекен из gym.js — подгружаем его, если нужен
let figLib = false;
function genFig(it){
  const key = "g:" + it.id; if(FIG[key]) return key;
  if(!window.Figure){ if(!figLib && typeof GYM_V!=="undefined"){ figLib = true; const sc = document.createElement("script"); sc.src = "gym.js?v=" + GYM_V; sc.onload = redraw; document.head.appendChild(sc); } return null; }
  try{ const cv = Figure.render(it.gen.map(code => { const [leg, arm, view] = code.split("|"); return Figure.pose(leg, arm||undefined, view!==undefined && view!=="" ? {view:+view} : {}); }));
    FIG[key] = [cv.toDataURL("image/png"), cv.width, cv.height]; return key; }catch(e){ return null; }
}
function figsOf(it){
  if(it.fig.length){ loadFigs(chOf(it)); return it.fig.filter(f => FIG[f]); }
  if(it.gen){ const k = genFig(it); return k ? [k] : []; }
  return [];
}
// рисунок — маской через класс: data-URL кладём в таблицу стилей один раз, а не в style каждой миниатюры
const FCLS = {}; let fSheet = null;
function figCls(id){
  if(FCLS[id]) return FCLS[id];
  if(!fSheet){ const st = document.createElement("style"); st.id = "cardsfig"; document.head.appendChild(st); fSheet = st.sheet; }
  const c = "cf" + Object.keys(FCLS).length; try{ fSheet.insertRule(`.${c}{--m:url("${FIG[id][0]}")}`, fSheet.cssRules.length); }catch(e){ return null; }
  return FCLS[id] = c;
}
const figHTML = id => { const f = FIG[id]; if(!f) return ""; const ar = (f[1]/f[2]).toFixed(3);
  if(f[3]) return `<img class="cfig cfimg" src="${f[0]}" alt="" style="aspect-ratio:${ar}">`;   // цветная картинка (своё фото, жест судьи) — как есть
  const c = figCls(id);
  return c ? `<i class="cfig ${c}" style="aspect-ratio:${ar}"></i>` : `<i class="cfig" style="--m:url(${f[0]});aspect-ratio:${ar}"></i>`; };

/* ---------- «Экзерсис на слух»: команды из танцевального конструктора словаря ----------
   Фраза та же, что в конструкторе (и та же запись голоса); на обороте — схема стоп сверху (рисует gym.js) или рисунок позиции рук из учебника. */
const XS = {r:["пра`вую","右脚"], l:["ле`вую","左脚"]}, XD = {f:["вперёд","向前"], s:["в сто`рону","向旁"], b:["наза`д","向后"]};
const XH = {t:["на носо`к","擦地点地"], j:["бросо`ком","小踢"], g:["ма`хом","大踢"]};
const DANCE = (() => { const o = {};
  ["t","j","g"].forEach(h => ["r","l"].forEach(sd => ["f","s","b"].forEach(d => {
    o[h+sd+d] = {t:`${XS[sd][0]} ${XD[d][0]} ${XH[h][0]}, закры\`ть в пе\`рвую пози\`цию`, zh:`${XS[sd][1]}${XD[d][1]}${XH[h][1]}，收回一位`, foot:{l:0, side:sd, d}}; })));
  o.rs = {t:"носко`м по по`лу в сто`рону", zh:"脚尖沿地面划向旁", foot:{l:0, side:"r", d:"s", rond:"fsb"}};
  o.rb = {t:"носко`м по по`лу наза`д", zh:"脚尖沿地面划向后", foot:{l:0, side:"r", d:"b", rond:"fsb"}};
  o.rf = {t:"носко`м по по`лу вперёд", zh:"脚尖沿地面划向前", foot:{l:0, side:"r", d:"f", rond:"bsf"}};
  [["1","пе`рвую","手到一位","298b"],["3","тре`тью","手到三位","298g"],["2","втору`ю","手到二位","298v"],["0","подготови`тельную","手回预备位","298a"]].forEach(([k,w,z,f]) => { o["a"+k] = {t:`ру\`ки в ${w} пози\`цию`, zh:z, fig:[f]}; });
  o.pr = {t:"ру`ки че`рез пе`рвую пози`цию во втору`ю", zh:"手经过一位打开到二位（准备动作）", fig:["298b","298v"]};
  return o; })();
function footPic(c, small){
  if(c.x.fig){ loadFigs("hr"); const f = c.x.fig.filter(k => FIG[k]); return f.length ? (small ? figHTML(f[0]) : f.map(figHTML).join("")) : ""; }
  if(!window.GYM || !GYM.foot){ if(!figLib && typeof GYM_V!=="undefined"){ figLib = true; const sc = document.createElement("script"); sc.src = "gym.js?v=" + GYM_V; sc.onload = redraw; document.head.appendChild(sc); } return ""; }
  return GYM.foot(Object.assign({mini:small?1:0}, c.x.foot));
}

/* ---------- карточка по ссылке ----------
   g:<термин словаря>  o:<своя карточка>  w:<номер слова «Учёба по-русски»>  s:<название предмета по-русски> */
function card(ref){
  const k = ref.slice(0,1), v = ref.slice(2);
  if(k==="g"){ const it = ITEM[v]; if(!it) return null;
    return {ref, kind:"g", t:it.t, zh:it.zh||"", d:Zh() ? (it.dz||it.d||"") : (it.d||""), say:(it.say||[]).filter(s => plain(s)!==plain(it.t)).slice(0,2), it, ch:chOf(it)}; }
  if(k==="o"){ const o = ownOf(v); if(!o) return null; return {ref, kind:"o", t:o.f, zh:o.b||"", d:o.b||"", o}; }
  if(k==="n"){ const n = NUM[v]; if(!n) return null; return {ref, kind:"n", t:n.q, zh:n.qz||"", d:n.a, n}; }
  if(k==="w"){ const w = STUDY[+v]; if(!w) return null; return {ref, kind:"w", t:w[0], zh:w[1], d:w[1]}; }
  if(k==="s") return {ref, kind:"s", t:v, zh:subjZh(v), d:subjZh(v)};
  if(k==="x"){ const x = DANCE[v]; if(!x) return null; return {ref, kind:"x", t:x.t, zh:x.zh, d:"", x}; }
  return null;
}
const subjects = () => { const g = typeof myGroup==="function" ? myGroup() : null, m = new Map();
  ((g && g.lessons) || []).forEach(l => { if(l.subject && l.subject.ru && !m.has(l.subject.ru)) m.set(l.subject.ru, l.subject.zh||""); }); return m; };
const subjZh = ru => subjects().get(ru) || "";
const audioKey = t => plain(t).replace(/\s+/g," ").trim().toLowerCase();
function audioOf(c){
  if(c.kind==="o") return c.o.voice && media(c.o.id+":voice") ? {url:media(c.o.id+":voice")} : ttsHas(c.t) ? {url:"tts/" + TAUD[audioKey(c.t)]} : c.o.voice ? null : ttsOk() ? {tts:c.t} : null;
  if(c.kind==="n") return null;
  if((c.kind==="g" || c.kind==="x") && AUD && AUD[audioKey(c.t)]) return {url:"gym-audio/" + AUD[audioKey(c.t)]};
  if(SAUD && SAUD[audioKey(c.t)]) return {url:"cards-audio/" + SAUD[audioKey(c.t)]};
  return ttsOk() ? {tts:c.t} : null;
}
let RUV = null;
function ttsOk(){ try{ if(RUV===null){ const v = speechSynthesis.getVoices(); if(!v.length) return false; RUV = v.find(x => /^ru/i.test(x.lang)) || false; } return !!RUV; }catch(e){ return false; } }
try{ speechSynthesis.onvoiceschanged = () => { RUV = null; }; }catch(e){}
let PLAYING = null, PLAYJOB = 0;
const SPEEDS = [0.75, 1, 1.25];
const speed = () => { const v = +LS.get("cardSpeed", 1); return SPEEDS.includes(v) ? v : 1; };
// один звук: запись (с выбранной скоростью, голос не «пищит») или синтез речи; по окончании — done
function play(a, done, own){
  const job = ++PLAYJOB; try{ if(PLAYING) PLAYING.pause(); speechSynthesis.cancel(); }catch(e){}
  if(!a){ if(done) done(); return; }
  const fin = () => { if(job===PLAYJOB && done) done(); };
  if(a.url){ const x = new Audio(a.url); PLAYING = x; if(!own){ x.playbackRate = speed(); x.preservesPitch = true; } x.onended = fin; x.onerror = fin; x.play().catch(fin); return; }
  try{ const u = new SpeechSynthesisUtterance(plain(a.tts)); u.lang = "ru-RU"; u.rate = .8 * speed(); if(RUV) u.voice = RUV; u.onend = fin; speechSynthesis.speak(u); }catch(e){ fin(); }
}
// «Я и образец»: сначала своя запись, потом правильное произношение
function playPair(mine, sample){ play({url:mine}, () => setTimeout(() => play(sample), 350), true); }

/* ---------- прогресс ---------- */
const skills = () => Zh() ? (C.skill==="l" ? ["l"] : C.skill==="s" ? ["s"] : ["l","s"]) : ["r"];
const allSkills = () => Zh() ? ["l","s"] : ["r"];
// 🎧 — только если есть настоящая запись: синтез речи есть не на каждом телефоне и появляется не сразу
function canListen(c){ const k = audioKey(c.t); if(c.kind==="n") return false; return c.kind==="o" ? !!c.o.voice || ttsHas(c.t) : !!(((c.kind==="g" || c.kind==="x") && AUD && AUD[k]) || (SAUD && SAUD[k])); }
function cardSkills(c, list){ return (list || skills()).filter(s => s!=="l" || canListen(c)); }
const isKnown = ref => !!prog()[ref+"|k"];
function boxOf(ref, s){ const p = prog()[ref+"|"+s]; return p ? p[0] : -1; }
// n — новое, l — учу, k — выучено (по выбранным навыкам) или отмечено «уже знаю»
function status(ref){
  const M = memo("st", () => new Map()); if(M.has(ref)) return M.get(ref);
  let r = "k";
  if(!isKnown(ref)){ const c = card(ref); let sk = c ? cardSkills(c) : skills(); if(c && !sk.length) sk = cardSkills(c, allSkills());
    const b = sk.map(s => boxOf(ref, s)); r = b.length && b.every(x => x >= LEARNED) ? "k" : b.some(x => x >= 0) ? "l" : "n"; }
  M.set(ref, r); return r;
}
// ступень «учу»: 0…4 (4 — выучено) — по самому слабому навыку
function stepOf(ref){ const c = card(ref); let sk = c ? cardSkills(c) : skills(); if(c && !sk.length) sk = cardSkills(c, allSkills());
  return Math.max(0, Math.min(LEARNED, ...sk.map(s => boxOf(ref, s)))); }
// «Вернуть в учу»: снять «уже знаю», выученные навыки — на ступень ниже выученной и к повтору сегодня
function unlearn(ref){ const P = prog(); delete P[ref+"|k"];
  allSkills().forEach(s => { const p = P[ref+"|"+s]; if(p && p[0] >= LEARNED){ const v = [LEARNED-1, today()]; if(p[2]!=null) v.push(p[2]); P[ref+"|"+s] = v; } });
  put("cardProg", P); }
function setProg(key, val){ const p = prog(); if(val===null) delete p[key]; else p[key] = val; put("cardProg", p); }
// запись: [коробка, день следующего показа, день первого показа (для лимита новых)]; «Ещё учу» — на 2 коробки ниже и снова сегодня
function grade(ref, s, ok){
  const P = prog(), p = P[ref+"|"+s], b = p ? p[0] : 0, nb = ok ? Math.min(BOX.length-1, (p ? b : 0) + 1) : Math.max(0, b - 2);
  const v = [nb, today() + (ok ? BOX[nb] : 0)], first = p ? p[2] : today(); if(first!=null) v.push(first);
  P[ref+"|"+s] = v;
  if(!ok) P[ref+"|f"] = (P[ref+"|f"] || 0) + 1;   // сколько раз не вспомнилось — для набора «Трудные слова»
  put("cardProg", P);
}
// трудные: не вспомнились хотя бы 2 раза, ещё не выучены и есть в наборах, которые учу
function hardRefs(){ return memo("hard", () => { const P = prog(), vis = new Set(visRefs()), out = [];
  for(const k in P){ if(!k.endsWith("|f") || P[k] < 2) continue; const r = k.slice(0, -2); if(vis.has(r) && status(r)!=="k") out.push(r); }
  return out.sort((a, b) => P[b+"|f"] - P[a+"|f"]); }); }
// ссылки, у которых уже есть прогресс; сколько новых начато сегодня (по всем наборам)
const startedSet = () => memo("began", () => { const o = new Set(); for(const k in prog()) if(!/\|[fk]$/.test(k)) o.add(k.slice(0, k.lastIndexOf("|"))); return o; });
const newToday = () => memo("newT", () => { const P = prog(), d = today(), o = new Set(); for(const k in P){ const v = P[k]; if(Array.isArray(v) && v[2]===d) o.add(k.slice(0, k.lastIndexOf("|"))); } return o.size; });

/* ---------- наборы ---------- */
// главы, где рисунок-поза крупно — вопрос (стиль «стопка»): гимнастика, хореография, техника лёгкой атлетики
const BCH = new Set(["ob","st","oru","ak","sk","sn","br","bs","bv","kl","kn","pk","pr","ss","pm","hg","ae","tn","hr","lr","lw","lb","lm","lj","ls","ly","ll","le","lh","lk"]);
function baseSets(){ return memo("rsb", () => {
  const out = [];
  if(Zh()){ out.push({id:"r:study", em:"🏫", name:"Учёба по-русски", nz:"大学常用俄语", refs:STUDY.map((_,i) => "w:"+i)});
    const subj = [...subjects().keys()]; if(subj.length) out.push({id:"r:subj", em:"📚", name:"Мои предметы", nz:"我的课程", refs:subj.map(s => "s:"+s)}); }
  const fav = (LS.get("gymFav", []) || []).map(id => "g:" + id);   // избранное из словаря (кнопка «Учить избранное карточками» в словаре)
  if(fav.length) out.push({id:"r:fav", em:"★", name:"Избранное из словаря", nz:"词典收藏", refs:fav});
  if(D){ const tp = D.topics.find(x => x.id==="dance"); if(tp) out.push({id:"r:dance-ex", em:"🎵", name:"Экзерсис на слух", nz:"舞蹈基训：听懂口令", refs:Object.keys(DANCE).map(k => "x:"+k), topic:tp}); }
  if(D) D.topics.forEach(tp => (D.numSets||[]).filter(ns => ns.topic===tp.id).forEach(ns => out.push({id:"r:num:"+ns.id, em:"🔢", name:ns.name, nz:ns.nz, refs:ns.items.map(x => "n:"+x.id), topic:tp, num:1})));   // «цифры» — первыми в теме
  if(D) D.topics.forEach(tp => DORD.sort("t:"+tp.id, tp.chapters).forEach(chId => { const ch = CHAP[chId], refs = CHREFS[chId]; if(!ch || !refs || !refs.length || DORD.hid("c:"+chId)) return;
    out.push({id:"r:ch:"+chId, em:ch.em||"", name:ch.name, nz:ch.nz, refs, topic:tp, ch:chId}); }));
  return out; }); }
const readySets = () => memo("rs", () => { const hard = hardRefs();
  return (hard.length ? [{id:"r:hard", em:"🔁", name:"Трудные слова", nz:"难记的词", refs:hard, sub:TL().hardSub}] : []).concat(baseSets()); });
function anySet(id){ return id && id.startsWith("r:") ? readySets().find(s => s.id===id) : setOf(id); }
const setTitle = s => Zh() && s.nz ? s.nz : s.name;
const isCh = s => !!s && s.id.startsWith("r:ch:");
function has(ref){ const k = ref.slice(0,1), v = ref.slice(2); return k==="g" ? !!ITEM[v] && !DORD.hid("i:"+v) && !DORD.hid("k:"+ITEM[v].c) : k==="o" ? !!ownOf(v) : k==="w" ? !!STUDY[+v] : k==="x" ? !!DANCE[v] : k==="n" ? !!NUM[v] : k==="s"; }
// по умолчанию в главе учим основное: без редких (x) и статей-обзоров (ov)
const defOn = r => { const it = ITEM[r.slice(2)]; return !!it && !it.x && !it.ov; };
// выбор «что я учу» в наборе-главе (Set) или null — ещё не выбирали.
// Кто учил главу до появления выбора, тому выбор создаём сами: основное + всё начатое; убранное раньше («не учу», cardHide) остаётся в корзине
function pickOf(s){
  if(!isCh(s)) return null;
  return memo("pk:"+s.id, () => {
    const P = picks(); if(Array.isArray(P[s.id])) return new Set(P[s.id]);
    const st = startedSet(); if(!s.refs.some(r => st.has(r) || isKnown(r))) return null;
    const h = new Set(hides()[s.id] || []), on = s.refs.filter(r => defOn(r) || st.has(r) || isKnown(r) || h.has(r));
    savePick(s.id, on); return new Set(on); });
}
function savePick(id, refs){ const P = picks(); P[id] = refs; put("cardPick", P); }
// карточки набора, которые учу: в главе — отмеченные (пока не выбирали — основное); без корзины
function refsOf(s){ if(!s) return []; return memo("rf:"+s.id, () => {
  const h = new Set(hides()[s.id] || []), ch = isCh(s), pk = ch ? pickOf(s) : null;
  return s.refs.filter(r => (!ch || (pk ? pk.has(r) : defOn(r))) && !h.has(r) && has(r)); }); }
const trashOf = s => (hides()[s.id] || []).filter(has);
function toTrash(sid, refs){ const h = hides(); h[sid] = [...new Set([...(h[sid]||[]), ...refs])]; put("cardHide", h); }
function fromTrash(sid, refs){ const h = hides(), out = new Set(refs); h[sid] = (h[sid]||[]).filter(r => !out.has(r)); if(!h[sid].length) delete h[sid]; put("cardHide", h);
  const s = anySet(sid); if(isCh(s)){ const pk = pickOf(s); if(pk && refs.some(r => !pk.has(r))) savePick(s.id, s.refs.filter(r => pk.has(r) || out.has(r))); } }   // в главе — вернуть и в «Что я учу»
function counts(s){ return memo("ct:"+s.id, () => { const r = refsOf(s); let learned = 0, started = false;
  r.forEach(x => { const st = status(x); if(st==="k") learned++; if(st!=="n") started = true; }); return {all:r.length, learned, started}; }); }
// набор «учится»: свой — всегда, глава — если выбрано, что учить, остальные готовые — если уже начат
const studying = s => !s.id.startsWith("r:") || (isCh(s) ? !!pickOf(s) : counts(s).started);
const visRefs = () => memo("vis", () => { const o = new Set(); sets().concat(baseSets()).forEach(s => { if(studying(s)) refsOf(s).forEach(r => o.add(r)); }); return [...o]; });
// разделы главного экрана: темы словаря + «Мои наборы» (свои и, у китайских студентов, «Учёба по-русски», «Мои предметы»)
const TEM = {gym:"🤸", dance:"💃", athl:"🏃", games:"⚽", swim:"🏊", rus:"🗣", my:"🗂", mych:"📝"};
// значок раздела: нарисованная картинка плитки из словаря (g-tile-*, как в «Словаре»), пока словарь не загружен — эмодзи
const tIc = (id, big) => FIG["g-tile-"+id] ? `<span class="ctill${big ? " big" : ""}">${figHTML("g-tile-"+id)}</span>` : `<span class="${big ? "cem big" : "ctem"}">${TEM[id] || "📘"}</span>`;
const topicIds = () => (D ? DORD.sort("root", D.topics.map(tp => tp.id)).filter(id => !DORD.hid("t:"+id)) : []).concat("my");
const topicName = id => { if(id==="my") return TL().mine; const tp = D && D.topics.find(x => x.id===id); return tp ? (Zh() && tp.nz ? tp.nz : tp.name) : ""; };
const topicSets = id => id==="my" ? sets().concat(baseSets().filter(s => s.id==="r:study" || s.id==="r:subj")) : baseSets().filter(s => s.topic && s.topic.id===id);
const topicRefs = id => memo("tr:"+id, () => { const o = new Set(); topicSets(id).forEach(s => { if(studying(s)) refsOf(s).forEach(r => o.add(r)); }); return [...o]; });
const topicDue = id => memo("td:"+id, () => new Set(queue(topicRefs(id), "due", 1e9).map(x => x.ref)).size);
const topicOfSet = s => !s ? null : s.topic ? s.topic.id : (s.id==="r:fav" || s.id==="r:hard") ? null : "my";
// откуда учим: набор, раздел ("due:<раздел>") или всё ("due")
const studyRefs = id => id==="due" ? visRefs() : id.startsWith("due:") ? topicRefs(id.slice(4)) : refsOf(anySet(id));
// очередь: сначала подошедшие повторения, потом новые (не больше дневного лимита); в заходе — не больше cap разных карточек
// mode: "all" — повторения и новые, "due" — только повторения, "new" — только новые,
// "full" — весь список «Учу» подряд: повторения, потом начатые (ещё не пора), потом новые — без лимита новых и размера захода
function queue(refs, mode, cap){
  const full = mode==="full"; cap = full ? 1e9 : cap || sessCap(); const P = prog(), td = today(), rev = [], early = [], cont = [], newRefs = [], fresh = new Map();
  refs.forEach(ref => { if(isKnown(ref)) return; const c = card(ref); if(!c) return; const sk = cardSkills(c), begun = sk.some(s => P[ref+"|"+s]);
    if(full && status(ref)==="k") return;
    sk.forEach(s => { const p = P[ref+"|"+s];
      if(p){ if(p[1] <= td && mode!=="new") rev.push({ref, s, due:p[1], b:p[0]}); else if(full && p[0] < LEARNED) early.push({ref, s, due:p[1], b:p[0]}); }
      else if(mode==="due") return;
      else if(begun) cont.push({ref, s});   // второй навык уже начатой карточки — не новая
      else { if(!fresh.has(ref)){ newRefs.push(ref); fresh.set(ref, []); } fresh.get(ref).push({ref, s}); } }); });
  // сначала самые просроченные, при равенстве — что хуже знаю
  const byDue = (a, b) => a.due - b.due || a.b - b.b; rev.sort(byDue); early.sort(byDue);
  const seen = new Set(), take = list => list.filter(x => { if(seen.has(x.ref)) return true; if(seen.size >= cap) return false; seen.add(x.ref); return true; });
  const out = take(rev).concat(full ? take(early) : []); if(mode==="due") return out;
  if(mixNew()) for(let i = newRefs.length - 1; i > 0; i--){ const j = Math.floor(Math.random() * (i + 1)); [newRefs[i], newRefs[j]] = [newRefs[j], newRefs[i]]; }
  const lim = full ? newRefs.length : Math.min(Math.max(0, cap - seen.size), newAllowed());
  const more = take(cont).concat(...newRefs.slice(0, lim).map(r => fresh.get(r)));
  // новое слово: сначала услышать, а сказать — через пару карточек
  const mix = a => { const ls = a.filter(x => x.s!=="s"), ss = a.filter(x => x.s==="s"), o = [];
    ls.forEach((x, i) => { o.push(x); const k = ss.findIndex(y => ls[i-2] && y.ref===ls[i-2].ref); if(k>=0) o.push(ss.splice(k, 1)[0]); });
    return o.concat(ss); };
  return out.concat(mix(more));
}
const allDue = () => memo("due", () => queue(visRefs(), "due", 1e9));
const dueCount = () => new Set(allDue().map(x => x.ref)).size;
const newAllowed = () => dueCount() > DUE_CAP ? 0 : Math.max(0, daily() - newToday());
const freshIn = refs => refs.filter(r => status(r)==="n" && !isKnown(r) && !startedSet().has(r)).length;
// завтра к повтору (по наборам, которые учу)
const dueTomorrow = () => { const P = prog(), d = today() + 1, o = new Set(); visRefs().forEach(r => { if(isKnown(r)) return; allSkills().forEach(s => { const p = P[r+"|"+s]; if(p && p[1] <= d) o.add(r); }); }); return o.size; };

/* ---------- состояние экрана ---------- */
const C = {exKind:LS.get("cardExKind","chain"), ex:null, v:"home", id:null, skill:LS.get("cardSkill","mix"), mode:LS.get("cardMode","a"), q:"", pick:new Set(), chf:null, more:0, paste:null, s:null, draft:null, rec:null, myRec:null, sel:null, pk:null};
if(!["a","b","c"].includes(C.mode)) C.mode = "a";
// replace — не добавлять запись в историю (новый заход внутри учёбы, выбор сохранён)
function nav(v, id, replace){ C.v = v; C.id = id || null; C.sel = null; const st = {screen:"cards", cards:{v:C.v, id:C.id}};
  if(replace) history.replaceState(st, ""); else history.pushState(st, ""); window.scrollTo(0,0); render(); }
function restore(c){ C.v = c && c.v || "home"; C.id = c && c.id || null; C.sel = null;
  if(C.v==="study" && !C.s){ if(C.id && C.id.startsWith("due:")){ C.v = "topic"; C.id = C.id.slice(4); } else C.v = C.id && C.id!=="due" ? "set" : "home"; }
  if(C.v!=="pick") C.pk = null; }
let redrawT = null;
function redraw(){ clearTimeout(redrawT); redrawT = setTimeout(() => { if(state.screen!=="cards") return;
  if($("modal").classList.contains("open") && document.querySelector("#sheet .csheet")){ const r = $("cres"); if(r && C.sheetRes) r.innerHTML = C.sheetRes(); else refreshSheet(); }
  else render(); }, 40); }

/* ---------- главный экран ---------- */
const bar = (a, b) => `<div class="cbar"><i style="width:${b ? Math.round(a/b*100) : 0}%"></i></div>`;
function setRow(s){
  const n = counts(s), t = TL();
  return `<button class="crow" data-cset="${esc(s.id)}"><span class="cem">${emH(s.em, icon("cards","sm"))}</span>
    <span class="cct"><b>${esc(setTitle(s))}</b><small>${n.started || n.learned ? t.learned(n.learned, n.all) : t.nCards(n.all)}</small>${n.started||n.learned ? bar(n.learned, n.all) : ""}</span>${icon("chev","sm muted")}</button>`;
}
// сколько новых сегодня осталось — или почему новых нет
function newNote(){
  const t = TL(), n = dueCount();
  if(n > DUE_CAP) return `<p class="cnote">${t.tooMany(n)}</p>`;
  return `<p class="cnote">${newAllowed() ? t.newLeft(newToday(), daily()) : t.newOver}</p>`;
}
// главный экран (не как в Словаре): сверху «на сегодня» — сколько повторить; ниже разделы списком с прогрессом
function secRow(id){
  const t = TL(), due = topicDue(id), refs = topicRefs(id), k = refs.filter(r => status(r)==="k").length, ns = topicSets(id).length;
  const sub = refs.length ? t.studyN(refs.length, k) : id==="my" && !sets().length ? t.newSet.replace("＋ ","") : t.sets(ns) + " · " + t.secNew;
  return `<button class="csec" data-ctp="${esc(id)}">${tIc(id)}<span class="cct"><b>${esc(topicName(id))}</b><small>${sub}</small>${refs.length ? bar(k, refs.length) : ""}</span>`
    + (due ? `<span class="cdpill">${due}</span>` : refs.length ? `<span class="cdok">✓</span>` : icon("chev","sm muted")) + `</button>`;
}
function hero(due, vis){
  const t = TL();
  if(due) return `<div class="chero"><div class="chnum"><b>${due}</b><span>${t.heroDue}</span></div><button class="btn" data-cgo="due">${t.review}</button></div>`;
  return `<div class="chero calm"><div><b>${vis ? t.heroNone : t.heroStart}</b><small>${vis ? t.heroNoneSub : t.heroStartSub}</small></div></div>`;
}
function home(){
  const t = TL(), due = dueCount();
  if(dictOk() && !D) loadDict();
  const vis = visRefs(), lk = vis.filter(r => status(r)==="k").length;
  let h = hero(due, vis.length);
  if(vis.length) h += `<div class="cline">${newNote()}</div>`;
  h += `<h3 class="ch3">${t.secH}</h3><div class="csecs">${topicIds().map(secRow).join("")}</div>`;
  if(D){ const nh = D.topics.filter(tp => DORD.hid("t:"+tp.id)).length; h += `<button class="csetb cordb" data-cord="root">⇅ ${DORD.tt().h}${nh ? " · " + DORD.tt().hidden + " " + nh : ""}</button>`; }
  if(dLoading && !D) h += `<div class="loading">${typeof SPIN!=="undefined"?SPIN:"…"}</div>`;
  if(dFailed && dictOk()) h += `<p class="muted small">${t.noDict}</p>`;
  h += `<div class="chome2">`;
  if(vis.length) h += `<button class="crow" data-clearn><span class="cem">${picSvg("book-open")}</span><span class="cct"><b>${t.learnT}</b><small>${t.learnSub(t.nCards(vis.length), lk)}</small>${bar(lk, vis.length)}</span>${icon("chev","sm muted")}</button>`;
  h += readySets().filter(s => s.id==="r:hard" || s.id==="r:fav").map(setRow).join("");
  h += `<div class="cline"><span></span><button class="csetb" data-csettings>⚙ ${t.settings}</button></div>`;
  return h + `</div>`;
}
// раздел: «Повторить сегодня» только по нему и его наборы
function topicView(){
  const t = TL(), id = C.id; if(!id || (id!=="my" && !topicIds().includes(id))){ if(!D && id!=="my"){ loadDict(); return `<div class="loading">${SPIN}</div>`; } C.v = "home"; return home(); }
  const due = topicDue(id), list = topicSets(id);
  let h = `<button class="ccrumb" data-cback>${icon("back","sm")} ${t.back}</button><div class="chead">${tIc(id, 1)}<div><h2>${esc(topicName(id))}</h2><small class="muted">${t.sets(list.length)}</small></div></div>`;
  if(topicRefs(id).length) h += `<div class="cdue"><div><b>${due ? t.reviewSec(due) : t.dueNone}</b>${due > sessCap() ? `<small>${t.dueBy(sessN())}</small>` : ""}</div>${due ? `<button class="btn" data-cgo="due:${esc(id)}">${t.review}</button>` : ""}</div>`;
  if(id==="gym" && dictOk()) h += `<button class="crow" data-cex><span class="cem">🧩</span><span class="cct"><b>${t.exT}</b><small>${t.exSub}</small></span>${icon("chev","sm muted")}</button>`;
  if(id==="my"){
    const my = sets(); h += my.length ? my.map(setRow).join("") : `<p class="muted small cempty">${t.empty}</p>`;
    h += `<button class="btn ghost wide" data-cnewset>${t.newSet}</button>`;
    const zh = list.filter(s => s.id.startsWith("r:")); if(zh.length) h += `<h3 class="ch3">${t.ready}</h3>` + zh.map(setRow).join("");
  } else {
    // сначала то, что уже учу, потом остальные главы — по порядку учебника
    const on = list.filter(studying), off = list.filter(s => !studying(s));
    h += on.map(setRow).join("") + (on.length && off.length ? `<h3 class="ch3">${t.ready}</h3>` : "") + off.map(setRow).join("");
    const tp = D && D.topics.find(x => x.id===id), nh = tp ? tp.chapters.filter(c => CHAP[c] && DORD.hid("c:"+c)).length : 0;
    if(tp && !tp.my) h += `<button class="csetb cordb" data-cord="${esc(id)}">⇅ ${DORD.tt().h}${nh ? " · " + DORD.tt().hidden + " " + nh : ""}</button>`;
  }
  return h;
}
function openSettings(){
  pushSheet(() => { const t = TL(), v = daily(), n = sessN(), mx = mixNew();
    openSheet(`<div class="csheet"><h2>${t.settings}</h2><label class="clab">${t.dailyH}</label>
      <div class="seg">${DAILY.map(k => `<button class="${v===k?"on":""}" data-cdaily="${k}">${k}</button>`).join("")}</div>
      <p class="muted small">${t.dailySub}</p>
      <label class="clab">${t.sessH}</label>
      <div class="seg">${SESS.map(k => `<button class="${n===k?"on":""}" data-csess="${k}">${k || t.sessAll}</button>`).join("")}</div>
      <p class="muted small">${t.sessSub}</p>
      <label class="clab">${t.orderH}</label>
      <div class="seg">${[["book", t.orderBook], ["mix", t.orderMix]].map(([k, l]) => `<button class="${(k==="mix")===mx?"on":""}" data-corder="${k}">${l}</button>`).join("")}</div>
      <p class="muted small">${t.orderSub}</p></div>`); });
}

/* ---------- «Я изучаю»: всё, что учу, по наборам ---------- */
function learnView(){
  const t = TL();
  let h = `<button class="ccrumb" data-cback>${icon("back","sm")} ${t.back}</button><div class="chead"><span class="cem big">📖</span><div><h2>${t.learnT}</h2></div></div>`;
  const groups = sets().concat(baseSets()).filter(studying).map(s => [s, refsOf(s)]).filter(x => x[1].length);
  if(!groups.length) return h + `<p class="muted small cempty">${t.learnNone}</p>`;
  h += newNote();
  groups.forEach(([s, refs], i) => { const n = counts(s);
    h += `<details class="ctopic clearn" ${i===0 ? "open" : ""}><summary>${icon("chev","sm")}<b>${esc(setTitle(s))}</b><small>${t.pickN(n.learned, n.all)}</small></summary>`
      + refs.map(r => { const c = card(r); if(!c) return ""; const st = status(r);
        return `<div class="crow"><span class="cct"><b>${sth(c.t)}</b>${Zh() && c.zh ? `<small>${esc(c.zh)}</small>` : ""}</span>${chip(r)}<button class="coffb" data-coff="${esc(s.id)}|${esc(r)}">${t.off}</button></div>`; }).join("")
      + `<button class="cprintb" data-cset="${esc(s.id)}">${t.toSet} →</button></details>`; });
  return h;
}
// «в корзину» (бывшее «не учить») — в любом наборе, прогресс остаётся
function offRef(sid, ref){ const s = anySet(sid); if(s) toTrash(s.id, [ref]); }

/* ---------- «Что я учу» в главе: подразделы с галочками ---------- */
const shortD = (it, n) => { const d = Zh() ? it.zh || "" : splitDef(it.d)[0]; return n && d.length > n ? d.slice(0, n).replace(/\s+\S*$/, "") + "…" : d; };
function pkRow(r){
  const it = ITEM[r.slice(2)], t = TL(); if(!it) return ""; const on = C.pk.sel.has(r);
  return `<button class="crow cpick ${on?"on":""} ${defOn(r)?"":"cdim"}" data-cpkr="${esc(r)}"><span class="cbox">${on?"✓":""}</span><span class="cct"><b>${sth(it.t)}</b><small>${esc(shortD(it, 90))}</small></span>${it.x ? `<span class="ctag">${t.rare}</span>` : it.ov ? `<span class="ctag">${t.ovw}</span>` : ""}</button>`;
}
function pkGroup(cid){
  const refs = CATREFS[cid] || [], cat = CAT[cid], t = TL(); if(!refs.length || !cat) return "";
  const n = refs.filter(r => C.pk.sel.has(r)).length, all = n===refs.length;
  return `<details class="cpkg" data-cpkg="${esc(cid)}" ${C.pk.open.has(cid) ? "open" : ""}><summary><span class="cbox ${all?"on":n?"part":""}" data-cpkcat="${esc(cid)}" role="checkbox" aria-checked="${all?"true":n?"mixed":"false"}">${all?"✓":n?"–":""}</span><b>${esc(Zh() && cat.nz ? cat.nz : cat.name)}</b><small>${t.pickN(n, refs.length)}</small>${icon("chev","sm")}</summary>${refs.map(pkRow).join("")}</details>`;
}
function pickView(){
  const t = TL(), s = anySet(C.id); if(!isCh(s)){ C.v = "home"; return home(); }
  if(!C.pk || C.pk.id!==s.id){ const pk = pickOf(s); C.pk = {id:s.id, sel:new Set(pk ? [...pk] : s.refs.filter(defOn)), open:new Set(), first:!pk}; }
  const ch = CHAP[s.ch];
  let h = `<button class="ccrumb" data-cback>${icon("back","sm")} ${C.pk.first ? t.back : esc(setTitle(s))}</button>`;
  h += `<div class="chead"><span class="cem big">${emH(s.em, icon("cards"))}</span><div><h2>${t.pickT}</h2><small class="muted">${esc(setTitle(s))}</small></div></div>`;
  h += `<p class="muted small cpksub">${t.pickSub}</p><div class="cpkall"><button data-cpkset="main">${t.pickMain}</button><button data-cpkset="all">${t.pickAll}</button><button data-cpkset="none">${t.pickNone}</button></div>`;
  h += `<div class="cpkl">${DORD.sort("c:"+ch.id, ch.cats).filter(k => !DORD.hid("k:"+k)).map(pkGroup).join("")}</div>`;
  h += `<div class="cpkfoot"><button class="btn wide" data-cpksave>${t.pickGo(t.nCards(C.pk.sel.size))}</button></div>`;
  return h;
}
function pkUpdate(cids){
  cids.forEach(cid => { const g = document.querySelector(`[data-cpkg="${CSS.escape(cid)}"]`); if(g) g.outerHTML = pkGroup(cid); });
  const b = document.querySelector("[data-cpksave]"); if(b) b.textContent = TL().pickGo(TL().nCards(C.pk.sel.size));
}
function pickSave(){
  const s = anySet(C.pk.id); if(!s) return; savePick(s.id, s.refs.filter(r => C.pk.sel.has(r)));
  const first = C.pk.first; C.pk = null; toast(TL().saved);
  if(first) nav("set", s.id, true); else history.back();
}

/* ---------- экран набора ---------- */
const thumb = c => { if(c.kind==="g"){   // выжимки-схемы (nt) тоже картинкой, как в Словаре
    const f = figsOf(c.it); if(f.length) return `<span class="cth">${figHTML(f[0])}</span>`;
    const em = (CHAP[c.ch]||{}).em; return em ? `<span class="cth ctx">${emH(em)}</span>` : ""; }
  if(c.kind==="o" && c.o.img){ const u = media(c.o.id+":img"); if(u) return `<span class="cth"><img src="${u}" alt=""></span>`; }
  if(c.kind==="x"){ const p = footPic(c, true); if(p) return `<span class="cth cfs">${p}</span>`; }
  return `<span class="cth ctx">${c.kind==="o" ? "✎" : c.kind==="s" ? "📚" : c.kind==="n" ? "🔢" : "🏫"}</span>`; };
// подпись статуса: «новое», «учу · 2/4» (ступень до «выучено»), «✓»; по нажатию — пояснение
function chip(ref){ const t = TL(), st = status(ref);
  return `<span class="cst ${st}" data-cstinfo="${esc(ref)}" role="button" tabindex="0">${st==="k" ? "✓" : st==="n" ? t.stNew : t.stStep(stepOf(ref))}</span>`; }
// kind: learn — «Учу» (в списке набора смахивается: вправо — знаю, влево — в корзину), known — «Выучено», trash — «Корзина»
function cardRow(ref, kind){
  const c = card(ref), t = TL(); if(!c) return ""; kind = kind || "learn";
  const sub = Zh() ? c.zh : c.kind==="g" ? shortD(c.it, 120) : c.d, inSet = C.v==="set", sel = C.sel && inSet && kind==="learn", on = sel && C.sel.has(ref);
  const body = `${thumb(c)}<span class="cct"><b>${sth(c.t)}</b>${sub ? `<small>${esc(sub)}</small>` : ""}</span>`;
  if(kind==="known") return `<div class="crow ccard" data-copen="${esc(ref)}" role="button" tabindex="0">${body}<button class="cmini" data-cunlearn="${esc(ref)}">${t.toLearn}</button></div>`;
  if(kind==="trash") return `<div class="crow ccard ctrash" data-copen="${esc(ref)}" role="button" tabindex="0">${body}<button class="cmini" data-cunhide="${esc(ref)}">${t.restore}</button></div>`;
  if(!inSet || sel) return `<button class="crow ccard ${sel ? "cpick" : ""} ${on ? "on" : ""}" ${sel ? `data-cselr="${esc(ref)}"` : `data-copen="${esc(ref)}"`}>${sel ? `<span class="cbox">${on?"✓":""}</span>` : ""}${body}${chip(ref)}</button>`;
  // на ПК (мышь) вместо смахивания — две кнопки при наведении
  return `<div class="cswrow" data-cswr="${esc(ref)}"><div class="cswbg"><span class="k">✓ ${t.know}</span><span class="x">${t.toTrash} 🗑</span></div>`
    + `<div class="crow ccard" data-copen="${esc(ref)}" role="button" tabindex="0">${body}<span class="crowact"><button data-cswk="${esc(ref)}" title="${esc(t.known)}" aria-label="${esc(t.known)}">✓</button><button data-cswt="${esc(ref)}" title="${esc(t.toTrash)}" aria-label="${esc(t.toTrash)}">🗑</button></span>${chip(ref)}</div></div>`;
}
const BLK = new Set();   // какие блоки «Выучено» / «Корзина» раскрыты — чтобы не схлопывались после «Вернуть»
const crumbBack = s => { const tp = topicOfSet(s); return tp ? esc(topicName(tp)) : TL().back; };
function setView(){
  const t = TL(), s = anySet(C.id); if(!s){ C.v = "home"; return home(); }
  const own = !s.id.startsWith("r:"), refs = refsOf(s), n = counts(s), trash = trashOf(s);
  const learn = refs.filter(r => status(r)!=="k"), known = refs.filter(r => status(r)==="k");
  if(!own && !D && s.id.startsWith("r:ch:")) loadDict();
  let h = `<button class="ccrumb" data-cback>${icon("back","sm")} ${crumbBack(s)}</button>`;
  h += `<div class="chead"><span class="cem big">${emH(s.em, icon("cards"))}</span><div><h2>${esc(setTitle(s))}</h2><small class="muted">${t.learned(n.learned, n.all)}</small></div>${own ? `<button class="iconbtn" data-cmenu aria-label="${t.setMenu}">${icon("edit","sm")}</button>` : ""}</div>${bar(n.learned, n.all)}`;
  if(s.id==="r:hard") h += `<p class="ctip chardw">${t.hardWhy}</p>`;
  if(isCh(s)) h += `<button class="cpickb" data-cpickopen>☑ ${t.pickBtn}</button>`;
  if(refs.length){
    if(!s.num) h += Zh() ? `<div class="seg cseg">${["mix","l","s"].map(k => `<button class="${C.skill===k?"on":""}" data-cskill="${k}">${t.skill[k]}</button>`).join("")}</div>`
              : `<div class="seg cseg cseg3">${["a","b","c"].map(k => `<button class="${C.mode===k?"on":""}" data-cmode="${k}">${t["mode"+k.toUpperCase()]}</button>`).join("")}</div>`;
    h += `<button class="btn wide cstart" data-cgo="${esc(s.id)}">${t.study}</button>`;
    if(learn.length > 1) h += `<button class="btn ghost wide cfull" data-cgofull="${esc(s.id)}"><span>${t.full}</span><small>${t.fullSub(learn.length)}</small></button>`;
    h += newNote() + `<button class="cprintb" data-cprint>${t.print}</button>`;
  }
  if(own) h += `<div class="cadd"><button data-cadd="dict" ${dictOk()?"":"hidden"}>🔎<b>${t.fromDict}</b><small>${t.fromDictSub}</small></button><button data-cadd="paste">📋<b>${t.paste}</b><small>${t.pasteSub}</small></button><button data-cadd="own">✎<b>${t.own}</b><small>${t.ownSub}</small></button></div>`;
  if(!refs.length && !trash.length) h += `<p class="muted small cempty">${own ? t.setEmpty : ""}</p>`;
  if(learn.length){
    h += `<div class="clisth"><span>${t.blkLearn} · ${learn.length}</span><button data-csel>${C.sel ? t.selDone : t.sel}</button></div>`;
    const tip = !C.sel && !LS.get("cardSwTip", 0);
    if(tip) h += `<p class="cswtip">${t.swHint}</p>`;
    h += `<div class="clist ${tip ? "cnudge" : ""}">${learn.map(r => cardRow(r, "learn")).join("")}</div>`;
  }
  if(C.sel) h += `<div class="cselbar"><button class="btn ghost" data-cseloff ${C.sel.size?"":"disabled"}>${t.selOff(C.sel.size)}</button><button class="btn" data-cselknown ${C.sel.size?"":"disabled"}>${t.selKnown(C.sel.size)}</button></div>`;
  if(known.length) h += `<details class="ctopic cblk" data-cblk="${esc(s.id)}:k" ${BLK.has(s.id+":k") ? "open" : ""}><summary>${icon("chev","sm")}<b>${t.blkKnown}</b><small>${known.length}</small></summary>${known.map(r => cardRow(r, "known")).join("")}</details>`;
  if(trash.length) h += `<details class="ctopic cblk cbin" data-cblk="${esc(s.id)}:t" ${BLK.has(s.id+":t") ? "open" : ""}><summary>${icon("chev","sm")}<b>${t.blkTrash}</b><small>${trash.length}</small></summary><p class="muted small cbinsub">${t.trashSub}</p><button class="cprintb" data-cunhideall>${t.restoreAll}</button>${trash.map(r => cardRow(r, "trash")).join("")}</details>`;
  if(own && refs.some(r => { const c = card(r); return c && c.kind==="o" && (c.o.img || c.o.voice); })) h += `<p class="muted small">${t.localShort}</p>`;
  return h;
}

/* ---------- учёба ---------- */
// определение: первое предложение (для лицевой стороны и списков) и остальное (на обороте под «подробнее»)
function splitDef(d){
  d = (d||"").trim(); if(d.length <= 160) return [d, ""];
  for(let i = 30; i < d.length - 2 && i < 260; i++){ const ch = d[i];
    if(ch==="•" && d[i-1]===" ") return [d.slice(0, i).trim().replace(/[:;,—–-]\s*$/, "") + "…", d.slice(i)];
    if(!".!?".includes(ch) || d[i+1]!==" " || !/[А-ЯЁA-Z0-9«"(•]/.test(d[i+2])) continue;
    const w = d.slice(d.lastIndexOf(" ", i-1) + 1, i); if(w.length <= 2) continue;   // инициалы и сокращения: «Г. В.», «т. е.», «им.»
    return [d.slice(0, i+1), d.slice(i+2)]; }
  const cut = d.slice(0, 200).replace(/\s+\S*$/, ""); return [cut + "…", d.slice(cut.length).trim()];
}
const hasPic = it => !!(it.fig.length || it.gen);
// рисунок годится как вопрос: поза без подписей словами, не табличка, не обзор и не общий с другим термином
const qOK = c => c.kind==="g" ? hasPic(c.it) && !c.it.cap && !c.it.nt && !c.it.ov && (!c.it.pk || c.it.pk==="pose") && !(c.it.fig[0] && FIGUSE[c.it.fig[0]] > 1)
  : c.kind==="x" || (c.kind==="o" && !!c.o.img);
// вид карточки: b — «стопка» с крупным рисунком-вопросом (позы в гимнастике, хореографии, технике л/а; экзерсис; свои с фото), a — «чёткая карточка»
const styleOf = c => c.kind==="x" || (c.kind==="o" && c.o.img) || (c.kind==="g" && BCH.has(c.ch) && qOK(c)) ? "b" : "a";
// рисунок карточки: size — big (вопрос в «стопке»), mid, sm (на обороте)
function picHTML(c, size){
  if(c.kind==="x"){ const p = footPic(c); return p ? `<div class="cpic cfs ${size}">${p}</div>` : `<div class="cpic ${size} cwait"></div>`; }
  if(c.kind==="o"){ if(!c.o.img) return ""; const u = media(c.o.id+":img"); return u ? `<div class="cpic ${size}"><img src="${u}" alt=""></div>` : u===null ? `<div class="cmuted">📷 ${TL().mediaAway}</div>` : `<div class="cpic ${size} cwait"></div>`; }
  if(c.kind==="g" && hasPic(c.it)){ const f = figsOf(c.it); return f.length ? `<div class="cpic ${size}">${f.slice(0,2).map(figHTML).join("")}</div>` : FIGL[c.ch]===false ? "" : `<div class="cpic ${size} cwait"></div>`; }
  return "";
}
// рисунок карточки (для выбора на слух): {key, html} или null
function picOf(c){
  if(c.kind==="g"){ if(!qOK(c)) return null; const f = figsOf(c.it); return f.length ? {key:f[0], html:figHTML(f[0])} : null; }
  if(c.kind==="x"){ const h = footPic(c, true); return h ? {key:c.ref, html:h} : null; }
  return null;
}
// 3 других рисунка: из того же набора, иначе из той же главы словаря
function choices(c, pool){
  const me = picOf(c); if(!me) return null;
  const seen = new Set([me.key, plain(c.t).toLowerCase()]), out = [];
  const tryRef = r => { if(out.length >= 3 || r===c.ref) return; const o = card(r); if(!o) return; const p = picOf(o);
    if(!p || seen.has(p.key) || seen.has(plain(o.t).toLowerCase())) return; seen.add(p.key); seen.add(plain(o.t).toLowerCase()); out.push(r); };
  const sh = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(v => v[1]);
  sh(pool).forEach(tryRef);
  if(out.length < 3 && c.kind==="g" && D) sh(CHREFS[c.ch] || []).forEach(tryRef);
  if(out.length < 3) return null;
  return sh([c.ref, ...out]);
}
// mode: "all" — повторения и новые, "new" — только новые («Ещё N новых»), "full" — весь список «Учу»; id "due" / "due:<раздел>" — только повторения
// новый заход из учёбы не добавляет запись в историю
function startStudy(id, mode){
  const set = id.startsWith("due") ? null : anySet(id), refs = studyRefs(id), q = set ? queue(refs, mode || "all") : queue(refs, "due");
  const tipN = +LS.get("cardTipN", 0) || 0, tip = q.length > 0 && tipN < 3; if(tip) LS.set("cardTipN", tipN + 1);   // пояснение «Ещё учу» — в первых трёх заходах
  C.s = {id, mode:mode || "all", q, i:0, flip:false, seen:false, tip, ok:0, bad:0, again:{}, hist:[], opts:{}, pool:[...new Set(q.map(x => x.ref).concat(set ? refs : []))], tot:new Set(q.map(x => x.ref))};
  C.myRec = null; nav("study", id, C.v==="study");
}
function face(c, s, back){
  const t = TL(), a = audioOf(c), spk = a ? `<button class="cspk" data-cplay aria-label="${t.listen}">${SPK}</button>` : "";
  const term = `<div class="cterm">${sth(c.t)}</div>`, st = styleOf(c);
  if(c.kind==="n"){   // «цифры»: вопрос → короткий ответ; на обороте — из какой статьи словаря
    const q = `<div class="cd big">${esc(Zh() && c.zh ? c.zh : c.t)}</div>` + (Zh() && c.zh ? `<div class="czh">${esc(c.t)}</div>` : "");
    if(!back) return q + `<div class="chint">${Zh() ? "答案？" : "Ответ?"}</div>`;
    const src = c.n.ref && ITEM[c.n.ref] ? `<div class="cmuted">${Zh() ? "词条：" : "Из статьи: "}${sth(ITEM[c.n.ref].t)}</div>` : "";
    return `<div class="cd">${esc(Zh() && c.zh ? c.zh : c.t)}</div><div class="cterm">${esc(c.d)}</div>` + (Zh() && c.n.az && c.n.az!==c.d ? `<div class="czh">${esc(c.n.az)}</div>` : "") + src;
  }
  const say = c.say && c.say.length ? `<div class="csay"><small>${t.howSay}</small><ul>${c.say.map(x => `<li>${sth(x)}</li>`).join("")}</ul></div>` : "";
  if(s==="l"){   // 🎧 услышать → понять (если есть рисунки — выбрать правильный из четырёх)
    const S = C.s, opts = S && S.q[S.i] && S.q[S.i].ref===c.ref ? S.opts[S.i] : null;
    if(opts && !back) return `<div class="chint">${t.pickPic}</div><button class="cspk big" data-cplay aria-label="${t.listen}">${SPK}</button>
      <div class="cchoice">${opts.map(r => `<button class="cch" data-cchoose="${esc(r)}">${picOf(card(r)).html}</button>`).join("")}</div>`;
    if(opts && back) return `<div class="chint ${S.pickOk?"cok":"cno"}">${S.pickOk ? t.right : t.wrong}</div>`
      + `<div class="cchoice done">${opts.map(r => `<span class="cch ${r===c.ref?"ok":r===S.picked?"no":"off"}">${picOf(card(r)).html}</span>`).join("")}</div>` + term + (c.zh ? `<div class="czh">${esc(c.zh)}</div>` : "") + spk;
    if(!back) return `<div class="chint">${t.lFront}</div><button class="cbigspk" data-cplay aria-label="${t.listen}">${SPK}</button>`;
    return picHTML(c, "sm") + term + (c.zh ? `<div class="czh">${esc(c.zh)}</div>` : "") + spk;
  }
  if(s==="s"){   // 🗣 рисунок/перевод → сказать по-русски
    if(!back) return (qOK(c) ? picHTML(c, st==="b" ? "big" : "mid") : "") + (c.zh ? `<div class="czh big">${esc(c.zh)}</div>` : "") + `<div class="chint">${t.sFront}</div>`
      + `<button class="btn small ghost crecb ${C.rec?"on":""}" data-crec="me">${MIC} ${C.rec ? t.rec : t.recMe}</button>`;
    return term + say + `<div class="crowbtn">${spk}${C.myRec ? `<button class="btn small ghost" data-cmyrec>${t.myRec}</button>${a ? `<button class="btn small" data-cpair>${t.meVs}</button>` : ""}` : ""}</div>`
      + `<button class="btn small ghost crecb ${C.rec?"on":""}" data-crec="me">${MIC} ${C.rec ? t.rec : C.myRec ? t.recAgain : t.recMe}</button>` + (c.zh ? `<div class="czh">${esc(c.zh)}</div>` : "");
  }
  // русские студенты: на лицевой — рисунок, определение или термин (по режиму и по тому, что есть у карточки)
  const own = c.kind==="o", [d1, d2] = own ? [c.d, ""] : splitDef(c.d);
  const more = x => x ? `<details class="cmore"><summary>${t.moreD}</summary><div>${esc(x)}</div></details>` : "";
  const def = c.d ? `<div class="cd ${own ? "big" : ""}">${esc(d1)}</div>${more(d2)}`
    : own ? `<div class="cmuted">${t.noAns}</div><button class="btn small ghost" data-cedit="${esc(c.o.id)}">${t.addAns}</button>` : "";
  const fr = C.mode==="a" && qOK(c) ? "pic" : C.mode==="c" && c.d ? "def" : "term";
  if(!back){
    if(fr==="pic") return picHTML(c, st==="b" ? "big" : "mid") + `<div class="chint">${c.kind==="x" ? "Как это скомандовать?" : t.whatName}</div>`;
    if(fr==="def") return `<div class="cd big">${esc(own ? c.d : d1)}</div><div class="chint">${t.whatName}</div>`;
    return term + `<div class="chint">${t.whatMean}</div>`;
  }
  if(fr==="pic") return picHTML(c, "sm") + term + say + def;
  if(fr==="def") return term + say + picHTML(c, "sm") + (d2 ? more(c.d) : "");
  return `<div class="cterm sm">${sth(c.t)}</div>` + picHTML(c, "mid") + def + say;
}
function doneView(S, set){
  const t = TL(), hard = [...new Set(Object.keys(S.again).map(k => k.replace(/[lsr]$/, "")))].filter(has);
  const refs = studyRefs(S.id), na = set ? Math.min(newAllowed(), freshIn(refs), sessCap()) : 0, nd = new Set(queue(refs, "due", 1e9).map(x => x.ref)).size;
  return `<div class="cdone"><div class="cdoneem">🎉</div><h2>${t.done}</h2><p class="muted">${t.doneSub(S.ok, S.bad)}</p>
    <div class="cday"><div>${t.dayNew(newToday(), daily())}</div><div>${t.tomorrow(dueTomorrow())}</div></div>
    <div class="btnrow">${nd ? `<button class="btn" data-cgo="${esc(S.id)}">${t.review}: ${nd}</button>` : ""}${na ? `<button class="btn ${nd?"ghost":""}" data-cgonew="${esc(S.id)}">${t.moreNew(na)}</button>` : ""}<button class="btn ${nd||na?"ghost":""}" data-cback>${set ? t.toSet : S.id!=="due" ? t.toTopic : t.toHome}</button></div></div>`
    + (hard.length ? `<h3 class="ch3">${t.hardH}</h3>` + hard.map(cardRow).join("") : "");
}
function studyView(){
  const t = TL(), S = C.s; if(!S){ C.v = "home"; return home(); }
  const set = S.id.startsWith("due") ? null : anySet(S.id), tp = S.id.startsWith("due:") ? S.id.slice(4) : null;
  const back = `<button class="ccrumb" data-cback>${icon("back","sm")} ${set ? esc(setTitle(set)) : tp ? esc(topicName(tp)) : t.studyAll}</button>`;
  if(!S.q.length){ const why = set && freshIn(refsOf(set)) && !newAllowed() ? (dueCount() > DUE_CAP ? t.tooMany(dueCount()) : t.newOver) : t.nothing;
    return back + `<div class="cdone"><p>${why}</p><button class="btn" data-cback>${set ? t.toSet : tp ? t.toTopic : t.toHome}</button></div>`; }
  if(S.i >= S.q.length) return back + doneView(S, set);
  const x = S.q[S.i], c = card(x.ref);
  if(!c){ S.i++; return studyView(); }
  const turn = S.turn; setTimeout(() => { if(C.s===S && S.turn===turn) S.turn = false; }, 0);   // анимация переворота — только в этот раз
  if(x.s==="l" && !(S.i in S.opts)){ const o = choices(c, S.pool); if(o || !Object.values(FIGL).includes("…")) S.opts[S.i] = o; }   // рисунки ещё грузятся — решим после
  const opts = x.s==="l" && S.opts[S.i];
  if(!S.flip && x.s==="l" && !S.autoplayed){ S.autoplayed = true; setTimeout(() => play(audioOf(c)), 250); }
  const sp = speed(), hasAud = Zh() && !!audioOf(c), st = styleOf(c);
  // счёт — по разным карточкам; карточка «Ещё учу», которая вернётся, — отдельной меткой
  const left = new Set(S.q.slice(S.i).map(y => y.ref)), tot = S.tot.size, done = tot - [...S.tot].filter(r => left.has(r)).length, reps = S.q.slice(S.i).filter(y => y.rep).length;
  return back + `<div class="cprog">${S.hist.length ? `<button class="cundo" data-cundo>↶ ${t.undo}</button>` : `<span></span>`}<span>${Math.min(tot, done + 1)} / ${tot}${reps ? ` · ${t.rep(reps)}` : ""}${Zh() ? ` · ${x.s==="l" ? "🎧" : "🗣"}` : ""}</span>
      ${hasAud ? `<button class="cspeed" data-cspeed>${t.speed ? t.speed[String(sp)] : sp+"×"}</button>` : `<span></span>`}</div>${bar(done, tot)}
    ${S.tip && S.i===0 ? `<p class="cagaintip">${t.againTip}</p>` : ""}
    <div class="cstack ${st}"><div class="cflip st-${st} ${S.flip?"back":""} ${S.turn?"turn":""} ${opts ? "nochoose" : ""}" ${opts ? "" : "data-cflip"} role="button" tabindex="0" aria-label="${t.flip}">${st==="a" ? `<div class="cqa">${S.flip ? t.aL : t.qL}</div>` : ""}<div class="cface">${face(c, x.s, S.flip)}</div>${opts || (S.seen && S.flip) ? "" : `<div class="cflipnote">${t.flip}</div>`}
      <i class="cswl">${t.again}</i><i class="cswr">${t.know}</i></div></div>
    ${opts ? (S.flip ? `<div class="canswer one"><button class="btn" data-cnext>${t.nextC}</button></div>` : "") : S.seen ? `<div class="canswer"><button class="btn ghost" data-cans="0">← ${t.again}</button><button class="btn" data-cans="1">${t.know} →</button></div>${st==="b" ? `<p class="cswhint">${t.swipe}</p>` : ""}` : ""}
    <button class="cknown" data-cknown>${t.known}</button>`;
}
// снимок перед ответом — чтобы «↶ Отменить» вернул карточку и прогресс как было
function snap(){ const S = C.s, x = S.q[S.i], P = prog(), keys = [x.ref+"|"+x.s, x.ref+"|f", x.ref+"|k"];
  S.hist.push({i:S.i, q:S.q.slice(), ok:S.ok, bad:S.bad, again:Object.assign({}, S.again), prog:keys.map(k => [k, k in P ? P[k] : null])}); if(S.hist.length > 30) S.hist.shift(); }
function undo(){ const S = C.s, h = S.hist.pop(); if(!h) return; const P = prog();
  h.prog.forEach(([k, v]) => { if(v===null) delete P[k]; else P[k] = v; }); put("cardProg", P);
  Object.assign(S, {i:h.i, q:h.q, ok:h.ok, bad:h.bad, again:h.again, flip:false, seen:false, turn:false, autoplayed:false}); delete S.opts[S.i]; render(); }
// оценка: «Ещё учу» — карточка вернётся через несколько карточек (метка ↻, в счёт не добавляется)
function rate(ok){ const S = C.s, x = S.q[S.i]; grade(x.ref, x.s, ok);
  if(ok){ if(!S.again[x.ref+x.s]) S.ok++; }
  else { if(!S.again[x.ref+x.s]){ S.bad++; S.again[x.ref+x.s] = 1; } S.q.splice(Math.min(S.q.length, S.i + 4), 0, Object.assign({}, x, {rep:1})); } }
function answer(ok){ snap(); rate(ok); next(); }
function next(){ const S = C.s; S.i++; S.flip = false; S.seen = false; S.turn = false; S.autoplayed = false; S.picked = null; if(C.myRec){ URL.revokeObjectURL(C.myRec); C.myRec = null; } render(); }

/* ---------- «Связка ОРУ»: по рисункам написать упражнение (как на мини-зачёте) ----------
   Упражнение придумывает конструктор словаря (GYM.randomEx); ответ сравниваем по словам и подсвечиваем расхождения. */
function gymReady(){
  if(!window.GYM || !GYM.randomEx){ if(!figLib && typeof GYM_V!=="undefined"){ figLib = true; const sc = document.createElement("script"); sc.src = "gym.js?v=" + GYM_V; sc.onload = () => { GYM.load(); redraw(); }; document.head.appendChild(sc); } return false; }
  return true;
}
function exGen(){
  if(!gymReady()) return null;
  for(let i = 0; i < 5; i++){ const x = GYM.randomEx(C.exKind); if(x && (C.exKind==="pose" || x.lines.length)) return x; }
  GYM.load(); return null;   // данные конструктора ещё грузятся
}
const figD = (f, mir) => f ? `<i class="cfig" style="--m:url(${f[0]});aspect-ratio:${(f[1]/f[2]).toFixed(3)}${mir?";transform:scaleX(-1)":""}"></i>` : "";
// слова для сравнения: без ударений, «и. п.» / «исходное положение» — одно слово
const exWords = s => norm(s).replace(/исходное положение/g, "ип").replace(/(^|[^а-яa-z])и\.?[\s~]*п\.?(?=[^а-яa-z]|$)/g, "$1ип").replace(/[^a-zа-я0-9]+/g, " ").trim().split(" ").filter(Boolean);
const stripLead = s => s.replace(/^\s*(и\.?\s*п\.?|исходное положение)\s*[—–:-]\s*/i, "").replace(/^\s*\d+(\s*[–-]\s*\d+)?\s*([—–:.)-]\s*|\s+)/, "");   // «И. п. — …», «1 — …», «3–4. …»
function wsame(a, b){ if(a===b) return 2; const max = b.length >= 8 ? 2 : b.length >= 4 ? 1 : 0; return max && lev(a, b, max) <= max ? 1 : 0; }   // 2 — совпало, 1 — опечатка
function exDiff(user, right){
  const u = exWords(stripLead(user)), r = exWords(right), n = u.length, m = r.length;
  const L = Array.from({length:n+1}, () => new Array(m+1).fill(0));
  for(let i = n-1; i >= 0; i--) for(let j = m-1; j >= 0; j--) L[i][j] = wsame(u[i], r[j]) ? L[i+1][j+1] + 1 : Math.max(L[i+1][j], L[i][j+1]);
  const U = [], R = []; let i = 0, j = 0, typos = 0;
  while(i < n && j < m){ const w = wsame(u[i], r[j]);
    if(w && L[i][j]===L[i+1][j+1]+1){ U.push([u[i], w===2 ? "ok" : "typo"]); R.push([r[j], w===2 ? "ok" : "typo"]); if(w===1) typos++; i++; j++; }
    else if(L[i+1][j] >= L[i][j+1]){ U.push([u[i], "extra"]); i++; } else { R.push([r[j], "miss"]); j++; } }
  while(i < n) U.push([u[i++], "extra"]); while(j < m) R.push([r[j++], "miss"]);
  const bad = U.some(x => x[1]==="extra") || R.some(x => x[1]==="miss");
  return {U, R, verdict: !n ? "empty" : bad ? "no" : typos ? "near" : "ok"};
}
// правильный ответ с ударениями: подсветку переносим на слова исходной фразы
function exRightHTML(right, R){
  const t = TL(); let k = 0;
  return right.replace(/([иИ]\.) (п\.)/g, "$1~$2").split(/( +)/).map(w => { w = w.replace("~", " "); if(/^\s*$/.test(w) || !exWords(w).length) return esc(w.replace(/`/g, ""));
    const st = (R[k] || [])[1]; k += exWords(w).length; const cls = st==="miss" ? "cmiss" : st==="typo" ? "ctypo" : "cokw";
    const m = w.match(/^(.*?)([,.;:!?]*)$/);   // запятую не подсвечиваем
    return `<span class="${cls}" ${st==="miss" ? `title="${t.exMiss}"` : ""}>${sth(m[1])}</span>${esc(m[2])}`; }).join("");
}
function exView(){
  const t = TL(), E = C.ex || (C.ex = {kind:C.exKind, data:null, ans:{}, checked:false});
  if(!E.data){ E.data = exGen(); E.ans = {}; E.checked = false; }
  let h = `<button class="ccrumb" data-cback>${icon("back","sm")} ${t.back}</button><div class="chead"><span class="cem big">🧩</span><div><h2>${t.exT}</h2><small class="muted">${t.exSub}</small></div></div>`;
  h += `<div class="seg cseg">${["pose","chain"].map(k => `<button class="${C.exKind===k?"on":""}" data-cexkind="${k}">${k==="pose" ? t.exPose : t.exChain}</button>`).join("")}</div>`;
  if(!E.data) return h + `<div class="loading">${SPIN}</div>`;
  const x = E.data, rows = [{key:"ip", n:"И. п.", txt:x.ip.txt, fig:x.ip.fig, notes:x.ip.rule ? [x.ip.rule] : []}];
  let firstFig = null;
  x.lines.forEach((l, i) => { if(l.fig && !firstFig) firstFig = l.fig; rows.push({key:"l"+i, n:l.n, txt:l.txt, fig:l.fig || firstFig, mir:!l.fig, notes:l.notes}); });
  h += `<div class="ctip">${C.exKind==="pose" ? t.exTipPose : t.exTip}</div>`;
  let good = 0;
  rows.forEach(r => {
    const a = E.ans[r.key] || "", dif = E.checked ? exDiff(a, r.txt) : null; if(dif && dif.verdict==="ok") good++;
    h += `<div class="cexr ${dif ? "v-"+dif.verdict : ""}"><div class="cexf">${figD(r.fig, r.mir)}</div><div class="cexb"><div class="cexn"><b>${esc(r.n)}</b>${dif ? `<span class="cexv">${dif.verdict==="ok" ? t.exOk : dif.verdict==="near" ? t.exNear : dif.verdict==="empty" ? t.exEmpty : t.exNo}</span>` : ""}</div>`;
    if(!dif) h += `<textarea class="cexin" rows="2" data-cexi="${r.key}" placeholder="${esc(t.exPh)}" autocomplete="off" autocapitalize="off" spellcheck="false">${esc(a)}</textarea>`;
    else {
      if(dif.U.length) h += `<div class="cexu"><small>${t.exYou}:</small> ${dif.U.map(([w, s]) => `<span class="${s==="extra" ? "cextra" : s==="typo" ? "ctypo" : "cokw"}">${esc(w==="ип" ? "и. п." : w)}</span>`).join(" ")}</div>`;
      const aud = Zh() && AUD && AUD[audioKey(r.txt)];
      h += `<div class="cexok"><small>${t.exRight}:</small> ${exRightHTML(r.txt, dif.R)}${aud ? ` <button class="cspk sm" data-cexsay="${esc(r.txt)}" aria-label="${t.listen}">${SPK}</button>` : ""}</div>`;
      if(dif.verdict!=="ok" && r.notes && r.notes.length) h += r.notes.map(nt => `<div class="cexnote">💡 ${Zh() ? esc(nt.zh||nt.ru) : sth(nt.ru)}</div>`).join("");
    }
    h += `</div></div>`;
  });
  if(E.checked) h += `<p class="cexsc"><b>${t.exScore(good, rows.length)}</b></p><p class="muted small">${t.exLegend}</p><button class="btn wide" data-cexnew>${t.exNew}</button>${good < rows.length ? `<button class="btn ghost wide" data-cexfix>${t.exFix}</button>` : ""}`;
  else h += `<button class="btn wide" data-cexcheck>${t.exCheck}</button><button class="btn ghost wide" data-cexnew>${t.exNew}</button>`;
  return h;
}

/* ---------- печать на A4 ----------
   «Сложить пополам»: строка = лицо | оборот, 5 строк на листе; «двусторонняя»: 2×5 лиц, на следующем листе обороты в зеркальном порядке колонок. */
const PR = {lay:"fold", what:"all"};
function prFaces(c){
  const figs = c.kind==="g" && hasPic(c.it) ? figsOf(c.it).map(f => FIG[f]).filter(Boolean) : [], img = c.kind==="o" && c.o.img ? media(c.o.id+":img") : null;
  const pic = c.kind==="x" ? `<div class="pp">${footPic(c)}</div>` : figs.length ? `<div class="pp">${figs.slice(0,2).map(f => `<i class="pf" style="--m:url(${f[0]});aspect-ratio:${(f[1]/f[2]).toFixed(3)}"></i>`).join("")}</div>` : img ? `<div class="pp"><img src="${img}" alt=""></div>` : "";
  const term = `<div class="pt">${sth(c.t)}</div>`, zh = c.zh ? `<div class="pz">${esc(c.zh)}</div>` : "", d1 = c.kind==="o" ? c.d : splitDef(c.d)[0], d = d1 && c.kind!=="o" && !Zh() ? `<div class="pd">${esc(d1)}</div>` : "";
  if(c.kind==="o") return C.mode==="c" && c.d ? [`<div class="pd big">${esc(c.d)}</div>`, term + pic] : [term + (C.mode==="a" ? pic : ""), `<div class="pd big">${esc(c.d||"")}</div>` + (C.mode==="a" ? "" : pic)];
  if(Zh()) return [(qOK(c) ? pic : "") + zh, term];                     // китайцы: рисунок и перевод → русский термин
  if(C.mode==="a" && qOK(c)) return [pic, term + d];                     // рисунок → термин
  if(C.mode==="c" && d) return [d, term + pic];                          // определение → термин
  return [term, pic + d];                                                // термин → что это
}
// что печатать: все, что учу; только невыученные; отмеченные в списке набора
function prRefs(){ const s = anySet(C.id), r = refsOf(s); return PR.what==="sel" && C.sel ? r.filter(x => C.sel.has(x)) : r.filter(x => PR.what!=="left" || status(x)!=="k"); }
function openPrint(){
  if(PR.what==="sel" && !(C.sel && C.sel.size)) PR.what = "all";
  pushSheet(() => { const t = TL(), n = prRefs().length, per = PR.lay==="fold" ? 5 : 10, pages = Math.ceil(n/per) * (PR.lay==="fold" ? 1 : 2);
    const whats = ["all","left"].concat(C.sel && C.sel.size ? ["sel"] : []);
    openSheet(`<div class="csheet"><h2>${t.printT}</h2>
      <div class="list">${["fold","dup"].map(k => `<button class="row" data-cprlay="${k}"><span class="cdot ${PR.lay===k?"on":""}">✓</span><span><b>${k==="fold" ? t.prFold : t.prDup}</b><small>${k==="fold" ? t.prFoldSub : t.prDupSub}</small></span></button>`).join("")}</div>
      <label class="clab">${t.prWhat}</label><div class="seg">${whats.map(k => `<button class="${PR.what===k?"on":""}" data-cprwhat="${k}">${k==="all" ? t.prAll : k==="left" ? t.prLeft : t.prSel(C.sel.size)}</button>`).join("")}</div>
      ${Zh() ? "" : `<label class="clab">${t.prFront}</label><div class="seg cseg3">${["a","b","c"].map(k => `<button class="${C.mode===k?"on":""}" data-cprmode="${k}">${t["mode"+k.toUpperCase()]}</button>`).join("")}</div>`}
      <p class="muted small">${t.prN(n, pages)}</p>${pages > 10 ? `<p class="cnote">${t.prMany(pages)}</p>` : ""}<p class="muted small">${t.prHint}</p>
      <button class="btn wide" data-cprgo ${n?"":"disabled"}>${t.prGo}</button></div>`); });
}
async function doPrint(){
  const t = TL(), refs = prRefs(); if(!refs.length) return;
  toast(t.prWait);
  // рисунки глав и свои фото — дождаться загрузки (до 6 секунд)
  const cs = refs.map(card).filter(Boolean);
  cs.forEach(c => { if(c.kind==="g") figsOf(c.it); if(c.kind==="x") footPic(c); if(c.kind==="o" && c.o.img) media(c.o.id+":img"); });
  for(let i = 0; i < 30; i++){ const busy = Object.values(FIGL).includes("…") || cs.some(c => c.kind==="o" && c.o.img && MEDIA[c.o.id+":img"]===undefined); if(!busy) break; await new Promise(r => setTimeout(r, 200)); }
  const faces = cs.map(prFaces), cell = h => `<div class="pc"><div class="pi">${h}</div></div>`;
  let html = "";
  if(PR.lay==="fold"){
    for(let i = 0; i < faces.length; i += 5) html += `<section class="pg fold">${faces.slice(i, i+5).map(f => `<div class="pr">${cell(f[0])}${cell(f[1])}</div>`).join("")}</section>`;
  } else {
    for(let i = 0; i < faces.length; i += 10){ const part = faces.slice(i, i+10);
      html += `<section class="pg dup">${part.map(f => cell(f[0])).join("")}</section>`;
      const back = []; for(let r = 0; r < part.length; r += 2){ back.push(part[r+1] ? cell(part[r+1][1]) : `<div class="pc empty"></div>`, cell(part[r][1])); }   // зеркально по колонкам
      html += `<section class="pg dup">${back.join("")}</section>`; }
  }
  let root = document.getElementById("cprint"); if(!root){ root = document.createElement("div"); root.id = "cprint"; document.body.appendChild(root); }
  root.innerHTML = html; document.documentElement.classList.add("cprinting");
  const done = () => { document.documentElement.classList.remove("cprinting"); root.innerHTML = ""; window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  closeSheet(); setTimeout(() => { try{ window.print(); }catch(e){ done(); } }, 400);
}

/* ---------- окна: открыть карточку ---------- */
function openCard(ref){
  pushSheet(() => { const t = TL(), c = card(ref); if(!c) return closeSheet(); const s = C.v==="set" ? anySet(C.id) : null, k = status(ref)==="k", bin = s && (hides()[s.id] || []).includes(ref);
    openSheet(`<div class="csheet"><h2>${sth(c.t)}</h2><div class="cprev">${face(c, Zh() ? "l" : "r", true)}</div>
      <div class="list">
        ${bin ? "" : k ? `<button class="row" data-cunlearn="${esc(ref)}"><span class="cdot on">✓</span><span><b>${t.toLearn}</b><small>${t.stInfoK}</small></span></button>`
          : `<button class="row" data-cswk="${esc(ref)}"><span class="cdot">✓</span><span><b>${t.known}</b><small>${t.knownSub}</small></span></button>`}
        ${s ? bin ? `<button class="row" data-cunhide="${esc(ref)}"><span class="cdot on">↩</span><span><b>${t.fromTrash}</b></span></button>`
          : `<button class="row" data-cswt="${esc(ref)}"><span class="cdot">🗑</span><span><b>${t.off}</b><small>${t.offSub}</small></span></button>` : ""}
        ${!bin && status(ref)!=="n" ? `<button class="row" data-creset="${esc(ref)}"><span class="cdot">↺</span><span><b>${k ? t.resetT : t.notYet}</b><small>${k ? t.resetSub : t.notYetSub}</small></span></button>` : ""}
        ${c.kind==="o" ? `<button class="row" data-cedit="${esc(c.o.id)}">${icon("edit")}<span><b>${t.edit}</b></span></button>` : ""}
        ${s && !s.id.startsWith("r:") ? `<button class="row" data-cremove="${esc(ref)}">${icon("trash")}<span><b>${t.remove}</b></span></button>` : ""}
      </div></div>`); });
}

/* ---------- окна: добавить из Словаря (поиск) ---------- */
// расстояние между словами; гласные путаются чаще (безударные о/а, е/и), их замена стоит полбуквы
const VOWS = "аеиоуыэюяё";
function lev(a, b, max){
  if(Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({length:b.length+1}, (_, i) => i);
  for(let i = 1; i <= a.length; i++){ const cur = [i]; let best = i;
    for(let j = 1; j <= b.length; j++){ const x = a[i-1], y = b[j-1], sub = x===y ? 0 : VOWS.includes(x) && VOWS.includes(y) ? .5 : 1;
      cur[j] = Math.min(prev[j]+1, cur[j-1]+1, prev[j-1] + sub); best = Math.min(best, cur[j]); }
    if(best > max) return max + 1; prev = cur; }
  return prev[b.length];
}
// цена совпадения слова запроса со словом термина: 0 — начало слова, иначе число «ошибок» (до 1 в коротких словах, до 2 — в длинных)
function wcost(q, w){
  if(w.startsWith(q)) return 0;
  const max = q.length >= 7 ? 2 : q.length >= 4 ? 1 : 0; if(!max) return 9;
  const c = Math.min(lev(q, w.slice(0, q.length), max), lev(q, w, max)); return c <= max ? c : 9;
}
// {cost, rank}: cost — сколько опечаток; rank — насколько хорошо совпало при равных опечатках
function match(it, q){
  if(CJK.test(q)){ const z = q.trim(), zh = (it.zh||"").split(/[，,；;、（(]/)[0].trim(); return it._z.includes(z) ? {cost:0, rank: zh===z ? 100 : zh.startsWith(z) ? 60 : 50 - zh.length/100} : null; }
  const qn = norm(q).replace(/[^a-zа-я0-9 ]+/g," ").replace(/\s+/g," ").trim(); if(!qn) return null;
  if(it._t===qn) return {cost:0, rank:100};
  let cost = 0, rank = 0;
  for(const x of qn.split(" ")){ let c = 9; for(const w of it._w){ c = Math.min(c, wcost(x, w)); if(!c) break; }
    if(c < 9){ cost += c; rank += 10; continue; }
    if(it._d.some(w => w.startsWith(x))){ rank += 1; continue; }   // только в определении — в конце списка
    return null; }
  return {cost, rank: rank + (it._t.startsWith(qn) ? 20 : 0) - it._t.length/100};
}
function search(q){
  const m = D.items.filter(it => Zh() || !it._zo).map(it => [it, match(it, q)]).filter(x => x[1]); if(!m.length) return [];
  const best = Math.min(...m.map(x => x[1].cost));   // есть точные совпадения — опечаточные не показываем
  return m.filter(x => x[1].cost <= best + .5).sort((a, b) => a[1].cost - b[1].cost || b[1].rank - a[1].rank).map(x => x[0]);
}
function chName(id){ const ch = CHAP[id]; return ch ? (Zh() && ch.nz ? ch.nz : ch.name) : ""; }
function pickRow(it, inSet){
  const t = TL(), r = "g:"+it.id, on = inSet || C.pick.has(r), f = figsOf(it);
  return `<button class="crow cpick ${on?"on":""}" data-cpick="${esc(r)}" ${inSet?"disabled":""}><span class="cbox">${on?"✓":""}</span>${f.length ? `<span class="cth">${figHTML(f[0])}</span>` : ""}<span class="cct"><b>${sth(it.t)}</b><small>${inSet ? t.inSet : esc(shortD(it, 110))}</small></span></button>`;
}
function dictRes(){
  const t = TL(), s = setOf(C.id), have = new Set(s ? s.refs : []);
  if(!D) return dFailed ? `<p class="muted">${t.noDict}</p>` : `<div class="loading">${SPIN}</div>`;
  const q = C.q.trim();
  let list;
  if(q) list = search(q);
  else if(C.chf){ const ch = CHAP[C.chf]; list = ch ? D.items.filter(it => ch.cats.includes(it.c)) : []; }
  else return `<p class="muted small">${t.browse}</p>` + D.topics.map(tp => `<div class="cgh">${esc(Zh() && tp.nz ? tp.nz : tp.name)}</div>` + tp.chapters.filter(c => CHAP[c]).map(c => `<button class="crow" data-cchf="${esc(c)}"><span class="cct"><b>${esc(chName(c))}</b></span>${icon("chev","sm muted")}</button>`).join("")).join("");
  if(!list.length) return `<p class="muted">${t.none}</p>`;
  const lim = 60 + C.more*60, shown = list.slice(0, lim), groups0 = new Map();
  shown.forEach((it, i) => { const ch = chOf(it); if(!groups0.has(ch)) groups0.set(ch, {best:i, n:0, its:[]}); const g = groups0.get(ch); g.its.push(it); g.n++; });
  // главы — по лучшему совпадению (у кого лучшее место в выдаче), при равенстве — где совпадений больше
  const groups = new Map([...groups0].sort((a, b) => a[1].best - b[1].best || b[1].n - a[1].n).map(([ch, g]) => [ch, g.its]));
  let h = q ? `<p class="muted small">${t.found(list.length)}</p>` : `<button class="ccrumb" data-cchf="">${icon("back","sm")} ${esc(chName(C.chf))}</button>`;
  groups.forEach((its, ch) => { const free = its.filter(it => !have.has("g:"+it.id));
    h += `<div class="cgh"><span>${esc(chName(ch))}</span>${free.length ? `<button data-cpickall="${esc(free.map(it => "g:"+it.id).join(","))}">${t.allCh}</button>` : ""}</div>` + its.map(it => pickRow(it, have.has("g:"+it.id))).join(""); });
  if(list.length > lim) h += `<button class="btn ghost wide" data-cmore>${t.more}</button>`;
  return h;
}
function openDict(){
  C.q = ""; C.chf = null; C.more = 0; C.pick = new Set(); loadDict();
  C.sheetRes = dictRes;
  pushSheet(() => { const t = TL();
    openSheet(`<div class="csheet cdict"><h2>${t.fromDict}</h2><div class="search">${icon("search","sm")}<input id="csq" placeholder="${esc(t.search)}" value="${esc(C.q)}" autocomplete="off" enterkeyhint="search"></div>
      <div id="cres">${dictRes()}</div><div class="cfoot"><button class="btn wide" data-caddpick ${C.pick.size?"":"disabled"}>${t.addN(C.pick.size)}</button></div></div>`); });
  setTimeout(() => { const i = $("csq"); if(i) i.focus(); }, 300);
}
function addRefs(refs){
  const all = sets(), s = all.find(x => x.id===C.id); if(!s) return 0;
  const before = s.refs.length; refs.forEach(r => { if(!s.refs.includes(r)) s.refs.push(r); }); put("cardSets", all); return s.refs.length - before;
}
function updPickBtn(){ const b = document.querySelector("[data-caddpick]"); if(b){ b.disabled = !C.pick.size; b.textContent = TL().addN(C.pick.size); } }

/* ---------- окна: вставить список ---------- */
function splitList(txt){
  let lines = txt.split(/\n/);
  if(lines.filter(x => x.trim()).length===1 && /;/.test(txt)) lines = txt.split(";");
  if(lines.filter(x => x.trim()).length===1 && /,/.test(txt) && txt.split(",").length > 2) lines = txt.split(",");
  return lines.map(x => x.replace(/^\s*(\d+[.)]|[-–—•*·])\s*/, "").replace(/\s+/g," ").trim()).filter(x => x.length > 1);
}
// «Ключица — парная кость…», «термин: определение», «термин<Tab>определение» → своя карточка с ответом
function splitPair(line){ const m = line.match(/^(.{1,120}?)\s*(?:\s[—–-]\s|\t|:\s)\s*(.+)$/); return m && m[2].trim() ? [m[1].trim(), m[2].trim()] : null; }
const lineKey = line => norm(line).replace(/[^a-zа-я0-9 ]+/g," ").replace(/\s+/g," ").trim();
// строка целиком — название термина? (быстро, по готовому списку названий; «Стойка ноги врозь - руки на пояс» — термин, а не «термин — ответ»)
const exactLine = line => { if(!D) return null; const it = TITLE.get(lineKey(line)) || TITLE.get(lineKey(line.replace(/\s*\([^)]*\)/g, ""))) || null; return it && it._zo && !Zh() ? null : it; };
function matchLine(line){
  const ex = exactLine(line); if(ex) return {it:ex, exact:true};
  const res = search(line); if(!res.length) return null;
  const top = res[0], exact = top._t===norm(line).replace(/[^a-zа-я0-9 ]+/g," ").replace(/\s+/g," ").trim() || CJK.test(line);
  return {it:top, exact};
}
function pasteRes(){
  const t = TL(), P = C.paste; if(!P || !P.rows) return "";
  const pairs = P.rows.filter(r => r.pair), found = P.rows.filter(r => r.it), miss = P.rows.filter(r => !r.it && !r.pair);
  let h = "";
  if(pairs.length) h += `<div class="cgh">✎ ${t.pasteOwn} · ${pairs.length}</div>` + pairs.map(r => `<button class="crow cpick ${r.on?"on":""}" data-cprow="${r.i}"><span class="cbox">${r.on?"✓":""}</span><span class="cct"><b>${esc(r.pair[0])}</b><small>${esc(r.pair[1])}</small></span></button>`).join("");
  if(found.length) h += `<div class="cgh">${t.pasteFound} · ${found.length}</div>` + found.map(r => `<button class="crow cpick ${r.on?"on":""}" data-cprow="${r.i}"><span class="cbox">${r.on?"✓":""}</span><span class="cct"><b>${sth(r.it.t)}</b><small>${r.exact ? esc(chName(chOf(r.it))) : `${t.maybe}: «${esc(r.line)}»`}</small></span></button>`).join("");
  // без ответа — сразу предлагаем дописать его (можно и потом)
  if(miss.length) h += `<div class="cgh">${t.pasteMiss} · ${miss.length}</div>` + miss.map(r => `<div class="crow cpick ${r.on?"on":""}"><button class="cbox" data-cprow="${r.i}" aria-pressed="${r.on}">${r.on?"✓":""}</button><span class="cct"><b>${esc(r.line)}</b><input class="cpans" data-cpans="${r.i}" value="${esc(r.ans||"")}" placeholder="${esc(t.ansPh)}" autocomplete="off"></span></div>`).join("");
  return h;
}
function openPaste(){
  C.paste = {txt:"", rows:null}; loadDict(); C.sheetRes = null;
  pushSheet(() => { const t = TL(), P = C.paste, n = P.rows ? P.rows.filter(r => r.on).length : 0;
    openSheet(`<div class="csheet"><h2>${t.paste}</h2><p class="muted small">${t.pasteHint}</p>
      <textarea id="cpaste" rows="6" placeholder="${Zh() ? "Выпад правой&#10;Ключица — 锁骨" : "Выпад правой&#10;Наклон вперёд&#10;Ключица — парная кость плечевого пояса"}">${esc(P.txt)}</textarea>
      <button class="btn ghost wide" data-cfind>${t.pasteFind}</button><div id="cpres">${pasteRes()}</div>
      ${P.rows ? `<div class="cfoot"><button class="btn wide" data-cpasteadd ${n?"":"disabled"}>${t.addN(n)}</button></div>` : ""}</div>`); });
}

/* ---------- окна: своя карточка ---------- */
function openOwn(id){
  const o = id ? ownOf(id) : null;
  C.draft = {id: o ? o.id : uid("o"), f: o ? o.f : "", b: o ? o.b : "", img: o ? !!o.img : false, voice: o ? !!o.voice : false, isNew: !o, blobs:{}};
  pushSheet(() => { const t = TL(), d = C.draft, iu = d.blobs.img ? URL.createObjectURL(d.blobs.img) : d.img ? media(d.id+":img") : null;
    openSheet(`<div class="csheet"><h2>${d.isNew ? t.ownNew : t.ownEdit}</h2>
      <label class="clab">${t.ownF}</label><textarea id="cf" rows="2">${esc(d.f)}</textarea>
      <label class="clab">${t.ownB}</label><textarea id="cb" rows="3">${esc(d.b)}</textarea>
      ${iu ? `<div class="cpic"><img src="${iu}" alt=""></div>` : ""}
      <div class="btnrow"><label class="btn small ghost cfile">${t.photo}<input type="file" accept="image/*" id="cimg" hidden></label>
        ${d.img || d.blobs.img ? `<button class="btn small ghost" data-cimgdel>${t.photoDel}</button>` : ""}</div>
      <div class="btnrow"><button class="btn small ghost ${C.rec?"on":""}" data-crec="card">${MIC} ${C.rec ? t.rec : d.voice || d.blobs.voice ? t.voiceAgain : t.voice}</button>
        ${d.voice || d.blobs.voice ? `<button class="btn small ghost" data-cvplay>▶</button><button class="btn small ghost" data-cvdel>${t.voiceDel}</button>` : ""}</div>
      ${Zh() ? `<p class="muted small" id="ctts">${ttsNote(d.f)}</p>` : ""}
      <p class="muted small clocal">${t.local}</p>
      <button class="btn wide" data-cownsave>${t.save}</button></div>`); });
}
function ttsNote(f){   // под кнопкой записи: озвучено / ждёт озвучки (и через сколько) / отправится после сохранения
  const t = TL(), x = ttsText(f); if(!x) return t.ttsNew; if(!ttsOkText(x)) return t.ttsBad; if(ttsHas(x)) return t.ttsReady;
  const at = ttsQ()[audioKey(x)]; if(!at) return t.ttsNew;
  const dt = new Date(at); return t.ttsWait(dt.toLocaleString(Zh() ? "zh-CN" : "ru-RU", {day:"numeric", month:"long", hour:"2-digit", minute:"2-digit"}));
}
async function shrink(file){   // фото — не больше 1200 px, JPEG: меньше места в телефоне
  try{ const bmp = await createImageBitmap(file), k = Math.min(1, 1200/Math.max(bmp.width, bmp.height)), cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width*k); cv.height = Math.round(bmp.height*k); cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    return await new Promise(ok => cv.toBlob(b => ok(b || file), "image/jpeg", .82)); }catch(e){ return file; }
}
async function saveOwn(){
  const t = TL(), d = C.draft, f = ($("cf").value||"").trim(), b = ($("cb").value||"").trim();
  if(!f){ toast(t.needF); return; }
  try{
    if(d.blobs.img){ await mput(d.id+":img", d.blobs.img); forget(d.id+":img"); d.img = true; }
    if(d.blobs.voice){ await mput(d.id+":voice", d.blobs.voice); forget(d.id+":voice"); d.voice = true; }
    if(d.delImg){ await mdel(d.id+":img"); forget(d.id+":img"); }
    if(d.delVoice){ await mdel(d.id+":voice"); forget(d.id+":voice"); }
  }catch(e){ toast(Zh() ? "手机存储空间不足，照片或录音没有保存" : "Не хватило места в телефоне — фото или запись не сохранились"); }
  const list = owns(), rec = {id:d.id, f, b, at:Date.now()}; if(d.img) rec.img = 1; if(d.voice) rec.voice = 1;
  const i = list.findIndex(x => x.id===d.id); if(i>=0) list[i] = rec; else list.push(rec);
  put("cardOwn", list);
  if(d.isNew) addRefs(["o:"+d.id]);
  const willTts = Zh() && ttsOkText(f) && !ttsHas(f) && !ttsQ()[audioKey(ttsText(f))];
  C.draft = null; closeSheet(); toast(willTts ? t.ttsSent : t.saved); render(); ttsSync();
}

/* ---------- запись голоса ---------- */
async function recStart(target){
  if(C.rec){ try{ C.rec.mr.stop(); }catch(e){} return; }
  let stream; try{ stream = await navigator.mediaDevices.getUserMedia({audio:true}); }catch(e){ toast(Zh() ? "没有麦克风权限" : "Нет доступа к микрофону"); return; }
  const mr = new MediaRecorder(stream), parts = [];
  mr.ondataavailable = e => { if(e.data && e.data.size) parts.push(e.data); };
  mr.onstop = () => { stream.getTracks().forEach(x => x.stop()); clearTimeout(C.rec && C.rec.tm); C.rec = null;
    const blob = new Blob(parts, {type: mr.mimeType || "audio/webm"});
    if(target==="card" && C.draft){ C.draft.blobs.voice = blob; C.draft.delVoice = false; refreshSheet(); }
    else { if(C.myRec) URL.revokeObjectURL(C.myRec); C.myRec = URL.createObjectURL(blob); if(C.s){ C.s.flip = C.s.seen = C.s.turn = true; } render(); setTimeout(() => new Audio(C.myRec).play().catch(()=>{}), 150); } };
  C.rec = {mr, tm:setTimeout(() => { try{ mr.stop(); }catch(e){} }, 10000)};   // не дольше 10 секунд
  mr.start(); if(target==="card") refreshSheet(); else render();
}

/* ---------- окна: набор (создать, переименовать, удалить) ---------- */
// первый графемный кластер: эмодзи с модификаторами и «склейками» (👩‍🎓, 🏃🏻) — целиком
const SEG = (() => { try{ return typeof Intl!=="undefined" && Intl.Segmenter ? new Intl.Segmenter(undefined, {granularity:"grapheme"}) : null; }catch(e){ return null; } })();
function firstG(v){ v = (v||"").trim(); if(!v) return "";
  if(SEG){ const it = SEG.segment(v)[Symbol.iterator]().next(); return it.value ? it.value.segment : ""; }
  const m = v.match(/^(?:\p{RI}\p{RI}|\P{M}\p{M}*(?:\u200D\P{M}\p{M}*)*)/u); return m ? m[0] : Array.from(v)[0]; }
function emMark(){ document.querySelectorAll("#sheet [data-cem]").forEach(x => x.classList.toggle("on", x.dataset.cem===C.em)); const i = $("cemin"); if(i && i.value!==C.em && document.activeElement!==i) i.value = C.em; const p = $("cemprev"); if(p) p.textContent = C.em; }
function openSetForm(id){
  const s = id ? setOf(id) : null; C.em = s && isPic(s.em) ? s.em : "i:bookmark";
  pushSheet(() => { const t = TL();
    openSheet(`<div class="csheet"><h2>${s ? t.rename : t.newSet.replace("＋ ","")}</h2><label class="clab">${t.setName}</label>
      <input id="cname" class="cinput" value="${esc(s ? s.name : "")}" placeholder="${esc(t.setNamePh)}" autocomplete="off">
      <label class="clab">${t.emH}</label>
      <div class="cpics">${picGrid(C.em, "data-cem")}</div>
      <button class="btn wide" data-csetsave="${esc(id||"")}">${s ? t.save : t.create}</button>
      ${s ? `<button class="btn wide cdanger" data-csetdel="${esc(id)}">${t.del}</button>` : ""}</div>`); });
  setTimeout(() => { const i = $("cname"); if(i && !s) i.focus(); }, 300);
}
function saveSet(id){
  const t = TL(), name = ($("cname").value||"").trim(); if(!name){ toast(t.needName); return; }
  const all = sets();
  if(id){ const s = all.find(x => x.id===id); if(s){ s.name = name; s.em = C.em; } put("cardSets", all); closeSheet(); render(); return; }
  const s = {id:uid("s"), name, em:C.em, refs:[], at:Date.now()}; all.push(s); put("cardSets", all);
  closeSheet(() => nav("set", s.id));
}
function deleteSet(id){
  const t = TL(); if(!confirm(t.delQ)) return;
  const all = sets(), s = all.find(x => x.id===id); if(!s) return;
  const rest = all.filter(x => x.id!==id), used = new Set(); rest.forEach(x => x.refs.forEach(r => used.add(r)));
  const dead = s.refs.filter(r => r.startsWith("o:") && !used.has(r)).map(r => r.slice(2));
  put("cardSets", rest); put("cardOwn", owns().filter(o => !dead.includes(o.id)));
  dead.forEach(id => { mdel(id+":img"); mdel(id+":voice"); });
  const p = prog(); Object.keys(p).forEach(k => { if(dead.some(id => k.startsWith("o:"+id+"|"))) delete p[k]; }); put("cardProg", p);
  closeSheet(() => { C.v = "home"; C.id = null; history.back(); });
}

/* ---------- экран ---------- */
function screen(){
  if(!document.getElementById("cardscss")){ const st = document.createElement("style"); st.id = "cardscss"; st.textContent = css; document.head.appendChild(st); }
  if(!screen.r){ screen.r = true; const hs = history.state; if(hs && hs.cards) restore(hs.cards); }
  fresh();   // данные могли поменяться синхронизацией — считаем заново
  if(D===null && dictOk() && !dLoading && !dFailed) loadDict();
  const h = C.v==="set" ? setView() : C.v==="study" ? studyView() : C.v==="ex" ? exView() : C.v==="pick" ? pickView() : C.v==="learn" ? learnView() : C.v==="topic" ? topicView() : home();
  return `<div class="cards">${h}</div>`;
}

/* ---------- события ---------- */
let qT = null;
document.addEventListener("input", e => {
  if(e.target.id==="csq" && !e.isComposing){ clearTimeout(qT); const v = e.target.value; qT = setTimeout(() => { C.q = v; C.more = 0; const r = $("cres"); if(r) r.innerHTML = dictRes(); }, 150); }
  if(e.target.id==="cpaste" && C.paste) C.paste.txt = e.target.value;
  if(e.target.id==="cemin" && !e.isComposing){ const g = firstG(e.target.value); if(g){ C.em = g; if(e.target.value!==g) e.target.value = g; emMark(); } }
  if(e.target.dataset && e.target.dataset.cexi && C.ex) C.ex.ans[e.target.dataset.cexi] = e.target.value;
  if(e.target.dataset && e.target.dataset.cpans!==undefined && C.paste && C.paste.rows){ const r = C.paste.rows[+e.target.dataset.cpans]; if(r) r.ans = e.target.value; }
});
document.addEventListener("compositionend", e => { if(e.target.id==="cemin"){ const g = firstG(e.target.value); if(g){ C.em = g; e.target.value = g; emMark(); } }
  if(e.target.id==="csq"){ C.q = e.target.value; const r = $("cres"); if(r) r.innerHTML = dictRes(); } });
document.addEventListener("change", async e => {
  if(e.target.id==="cimg" && C.draft && e.target.files[0]){ C.draft.blobs.img = await shrink(e.target.files[0]); C.draft.delImg = false; refreshSheet(); }
});
document.addEventListener("toggle", e => { const d = e.target; if(d && d.dataset && d.dataset.ctopic){ const o = LS.get("cardOpen", {}) || {}; o[d.dataset.ctopic] = d.open; LS.set("cardOpen", o); }
  if(d && d.dataset && d.dataset.cblk){ if(d.open) BLK.add(d.dataset.cblk); else BLK.delete(d.dataset.cblk); }
  if(d && d.dataset && d.dataset.cpkg && C.pk){ if(d.open) C.pk.open.add(d.dataset.cpkg); else C.pk.open.delete(d.dataset.cpkg); } }, true);
document.addEventListener("keydown", e => { if(state.screen!=="cards" || C.v!=="study" || !C.s || $("modal").classList.contains("open") || /INPUT|TEXTAREA/.test(e.target.tagName)) return;
  const S = C.s; if(S.i >= S.q.length) return;
  if((e.key===" " || e.key==="Enter") && e.target.closest && e.target.closest("[data-cflip]")){ e.preventDefault(); S.flip = !S.flip; S.seen = true; S.turn = true; render(); setTimeout(() => { const f = document.querySelector(".cflip"); if(f) f.focus(); }, 0); }
  else if(S.seen && !S.opts[S.i] && (e.key==="ArrowRight" || e.key==="ArrowLeft")){ e.preventDefault(); answer(e.key==="ArrowRight"); } });
let SW = null;
document.addEventListener("pointerdown", e => { if(state.screen!=="cards" || C.v!=="study" || !C.s || !C.s.seen) return;
  const el = e.target.closest(".cflip"); if(!el || el.closest(".nochoose") || C.s.opts[C.s.i] || e.target.closest("button")) return;
  SW = {el, x:e.clientX, y:e.clientY, dx:0, on:false}; });
document.addEventListener("pointermove", e => { if(!SW) return; const dx = e.clientX - SW.x, dy = e.clientY - SW.y;
  if(!SW.on){ if(Math.abs(dx) < 12) return; if(Math.abs(dy) > Math.abs(dx)){ SW = null; return; } SW.on = true; SW.el.classList.add("drag"); }
  SW.dx = dx; SW.el.style.transform = `translateX(${dx}px) rotate(${dx/22}deg)`;
  SW.el.style.setProperty("--l", Math.max(0, Math.min(1, -dx/110))); SW.el.style.setProperty("--r", Math.max(0, Math.min(1, dx/110))); }, {passive:true});
document.addEventListener("pointerup", e => { if(!SW) return; const s = SW; SW = null; if(!s.on) return;
  s.el.classList.remove("drag"); s.el.dataset.swiped = "1"; setTimeout(() => { if(s.el) delete s.el.dataset.swiped; }, 50);
  if(Math.abs(s.dx) > 90){ const ok = s.dx > 0; if(navigator.vibrate) navigator.vibrate(12);
    s.el.style.transition = "transform .22s ease-in, opacity .22s"; s.el.style.transform = `translateX(${ok ? 520 : -520}px) rotate(${ok ? 24 : -24}deg)`; s.el.style.opacity = "0";
    setTimeout(() => answer(ok), 200); }
  else { s.el.style.transition = "transform .2s"; s.el.style.transform = ""; s.el.style.setProperty("--l", 0); s.el.style.setProperty("--r", 0); setTimeout(() => { s.el.style.transition = ""; }, 220); } });
document.addEventListener("pointercancel", () => { if(SW){ SW.el.classList.remove("drag"); SW.el.style.transform = ""; SW = null; } });
/* смахивание термина в списке набора: вправо — «Уже знаю», влево — «В корзину» (с «Отменить» в подсказке снизу) */
/* удержание строки (0,5 с) — короткое меню: «Пока не учу» (снова «новое»), «Уже знаю», «В корзину» */
let LW = null, LWend = 0, LWhold = null, LWheld = false;
const holdOff = () => { clearTimeout(LWhold); LWhold = null; };
function openHold(ref){ const c = card(ref), t = TL(); if(!c) return;
  pushSheet(() => openSheet(`<div class="csheet"><h2>${sth(c.t)}</h2><div class="list">
    ${status(ref)==="l" ? `<button class="row" data-creset="${esc(ref)}"><span class="cdot">↺</span><span><b>${t.notYet}</b><small>${t.notYetSub}</small></span></button>` : ""}
    <button class="row" data-cswk="${esc(ref)}"><span class="cdot">✓</span><span><b>${t.known}</b><small>${t.knownSub}</small></span></button>
    <button class="row" data-cswt="${esc(ref)}"><span class="cdot">🗑</span><span><b>${t.off}</b><small>${t.offSub}</small></span></button></div></div>`)); }
document.addEventListener("contextmenu", e => { if(state.screen==="cards" && e.target.closest(".cswrow")) e.preventDefault(); });
document.addEventListener("pointerdown", e => { if(state.screen!=="cards" || C.v!=="set" || C.sel || e.button > 0) return;
  const row = e.target.closest(".cswrow"); if(!row || e.target.closest(".crowact,[data-cstinfo]")) return;
  if(row.parentNode) row.parentNode.classList.remove("cnudge");   // подсказка-покачивание не мешает смахиванию
  LW = {row, el:row.querySelector(".crow"), x:e.clientX, y:e.clientY, dx:0, on:false};
  LWheld = false; holdOff(); LWhold = setTimeout(() => { LWhold = null; if(!LW || LW.on) return; LW = null; LWheld = true;   // отпускание после удержания — не открывать карточку
    if(navigator.vibrate) navigator.vibrate(15); openHold(row.dataset.cswr); }, 500); });
document.addEventListener("pointermove", e => { if(!LW) return; const dx = e.clientX - LW.x, dy = e.clientY - LW.y;
  if(LWhold && Math.hypot(dx, dy) > 8) holdOff();
  if(!LW.on){ if(Math.abs(dx) < 10) return; if(Math.abs(dy) > Math.abs(dx)){ LW = null; return; } LW.on = true; LW.row.classList.add("drag"); }
  LW.dx = dx; LW.el.style.transform = `translateX(${dx}px)`; LW.row.classList.toggle("r", dx > 0); LW.row.classList.toggle("l", dx < 0);
  LW.row.classList.toggle("go", Math.abs(dx) > Math.min(110, LW.row.offsetWidth * .3)); }, {passive:true});
document.addEventListener("pointerup", () => { holdOff(); if(!LW) return; const w = LW; LW = null; if(!w.on) return; LWend = Date.now();
  const far = Math.abs(w.dx) > Math.min(110, w.row.offsetWidth * .3);
  if(!far){ w.el.style.transition = "transform .2s"; w.el.style.transform = ""; setTimeout(() => { w.el.style.transition = ""; w.row.classList.remove("drag","r","l","go"); }, 220); return; }
  if(navigator.vibrate) navigator.vibrate(12);
  listAct(w.row, w.dx > 0 ? "k" : "t"); });
document.addEventListener("pointercancel", () => { holdOff(); if(LW){ LW.el.style.transform = ""; LW.row.classList.remove("drag","r","l","go"); LW = null; } });
// уехать за край, свернуть строку, потом записать (и предложить «Отменить»)
function listAct(row, act){
  const ref = row.dataset.cswr, el = row.querySelector(".crow"), sid = C.id, t = TL(); if(!LS.get("cardSwTip", 0)) LS.set("cardSwTip", 1);
  row.classList.add("drag", act==="k" ? "r" : "l", "go");
  el.style.transition = "transform .2s ease-in"; el.style.transform = `translateX(${act==="k" ? "" : "-"}110%)`;
  setTimeout(() => { row.style.height = row.offsetHeight + "px"; row.offsetHeight; row.classList.add("gone"); row.style.height = "0px"; }, 180);
  setTimeout(() => { const c = card(ref), name = c ? plain(c.t) : "";
    if(act==="k"){ const P = prog(), was = P[ref+"|k"]; setProg(ref+"|k", 1); render();
      toast(`${t.blkKnown.replace(" ✓", "")}: ${name}`, t.undo, () => { fresh(); setProg(ref+"|k", was ? was : null); render(); }); }
    else { toTrash(sid, [ref]); render(); toast(`${t.trashed}: ${name}`, t.undo, () => { fresh(); fromTrash(sid, [ref]); render(); }); } }, 400);
}
document.addEventListener("click", e => {
  if(state.screen!=="cards") return;
  if((Date.now() - LWend < 350 || LWheld) && e.target.closest(".cswrow")){ LWheld = false; e.stopPropagation(); e.preventDefault(); return; }   // это было смахивание, а не нажатие
  const b = e.target.closest("[data-cord],[data-cset],[data-cgo],[data-cnewset],[data-cback],[data-cmenu],[data-cadd],[data-copen],[data-cskill],[data-cmode],[data-cflip],[data-cans],[data-cknown],[data-cplay],[data-cmyrec],[data-crec],[data-cknownt],[data-cedit],[data-cremove],[data-cunhide],[data-cchf],[data-cpick],[data-cpickall],[data-cmore],[data-caddpick],[data-cfind],[data-cprow],[data-cpasteadd],[data-cownsave],[data-cimgdel],[data-cvplay],[data-cvdel],[data-cem],[data-csetsave],[data-csetdel],[data-cundo],[data-cspeed],[data-cex],[data-cexkind],[data-cexcheck],[data-cprint],[data-cprlay],[data-cprwhat],[data-cprmode],[data-cprgo],[data-cexfix],[data-cexnew],[data-cexsay],[data-cpair],[data-cchoose],[data-cnext],[data-clearn],[data-csettings],[data-cdaily],[data-coff],[data-cpickopen],[data-cpkr],[data-cpkcat],[data-cpkset],[data-cpksave],[data-csel],[data-cselr],[data-cseloff],[data-cselknown],[data-cgonew],[data-cgofull],[data-ctp],[data-csess],[data-corder],[data-cstinfo],[data-cswk],[data-cswt],[data-cunlearn],[data-cunhideall],[data-creset]");
  if(!b) return;
  fresh();
  const d = b.dataset, t = TL();
  // готовая глава в первый раз — сначала выбрать, что учить
  if(d.cset!==undefined){ const s = anySet(d.cset); C.pk = null; return nav(isCh(s) && !pickOf(s) ? "pick" : "set", d.cset); }
  if(d.cgo!==undefined) return startStudy(d.cgo);
  if(d.cgonew!==undefined) return startStudy(d.cgonew, "new");
  if(d.cgofull!==undefined) return startStudy(d.cgofull, "full");
  if(d.ctp!==undefined) return nav("topic", d.ctp);
  if(d.csess!==undefined){ LS.set("cardSess", +d.csess); fresh(); refreshSheet(); return render(); }
  if(d.corder!==undefined){ LS.set("cardOrder", d.corder); fresh(); return refreshSheet(); }
  if(d.cstinfo!==undefined){ e.stopPropagation(); e.preventDefault(); const st = status(d.cstinfo); return toast(st==="k" ? t.stInfoK : st==="n" ? t.stInfoN : t.stInfoL(stepOf(d.cstinfo))); }
  if(d.cswk!==undefined || d.cswt!==undefined){ const ref = d.cswk!==undefined ? d.cswk : d.cswt, act = d.cswk!==undefined ? "k" : "t";
    if(b.closest("#sheet")) closeSheet();
    const row = document.querySelector(`.cswrow[data-cswr="${CSS.escape(ref)}"]`); if(row) return listAct(row, act);
    if(act==="k") setProg(ref+"|k", 1); else if(C.id) toTrash(C.id, [ref]); toast(act==="k" ? t.knownOn : t.trashed); return render(); }
  // «Начать заново»: стереть весь прогресс термина (ступени, «уже знаю», счёт ошибок) — снова «новое»; можно отменить
  if(d.creset!==undefined){ const P = prog(), pre = d.creset+"|", old = {};
    Object.keys(P).forEach(k => { if(k.startsWith(pre)){ old[k] = P[k]; delete P[k]; } }); put("cardProg", P);
    if(b.closest("#sheet")) closeSheet(); render();
    return toast(t.resetDone, t.undo, () => { put("cardProg", Object.assign(prog(), old)); render(); }); }
  if(d.cunlearn!==undefined){ unlearn(d.cunlearn); if(b.closest("#sheet")) closeSheet(); toast(t.backLearn); return render(); }
  if(d.cunhideall!==undefined){ const s = anySet(C.id); if(s){ const rs = trashOf(s); fromTrash(s.id, rs); toast(`${t.restored}: ${rs.length}`); } return render(); }
  if(d.clearn!==undefined) return nav("learn");
  if(d.csettings!==undefined) return openSettings();
  if(d.cord==="root"){ if(D) DORD.open("root", Zh() ? "词典分类" : "Разделы", "t", D.topics.map(x => ({id:x.id, name:`${TEM[x.id]||"📘"} ${esc(setTitle(x))}`}))); return; }
  if(d.cord!==undefined){ const tp = D && D.topics.find(x => x.id===d.cord); if(tp) DORD.open("t:"+tp.id, setTitle(tp), "c", tp.chapters.filter(c => CHAP[c]).map(c => ({id:c, name:esc(setTitle(CHAP[c]))}))); return; }
  if(d.cdaily!==undefined){ LS.set("cardDaily", +d.cdaily); fresh(); refreshSheet(); return render(); }
  if(d.coff!==undefined){ const i = d.coff.indexOf("|"); offRef(d.coff.slice(0, i), d.coff.slice(i+1)); toast(t.offDone); if(b.closest("#sheet")) closeSheet(); return render(); }
  if(d.cpickopen!==undefined){ C.pk = null; return nav("pick", C.id); }
  if(d.cpkr!==undefined){ const on = !C.pk.sel.has(d.cpkr); on ? C.pk.sel.add(d.cpkr) : C.pk.sel.delete(d.cpkr); const it = ITEM[d.cpkr.slice(2)]; return pkUpdate(it ? [it.c] : []); }
  if(d.cpkcat!==undefined){ e.preventDefault(); const rs = CATREFS[d.cpkcat] || [], all = rs.every(r => C.pk.sel.has(r)); rs.forEach(r => all ? C.pk.sel.delete(r) : C.pk.sel.add(r)); return pkUpdate([d.cpkcat]); }
  if(d.cpkset!==undefined){ const s = anySet(C.pk.id); C.pk.sel = new Set(d.cpkset==="all" ? s.refs : d.cpkset==="main" ? s.refs.filter(defOn) : []); return render(); }
  if(d.cpksave!==undefined) return pickSave();
  // выбор нескольких карточек в списке набора
  if(d.csel!==undefined){ C.sel = C.sel ? null : new Set(); return render(); }
  if(d.cselr!==undefined){ const on = !C.sel.has(d.cselr); on ? C.sel.add(d.cselr) : C.sel.delete(d.cselr); return render(); }
  if(d.cseloff!==undefined){ const s = anySet(C.id), rs = [...C.sel]; toTrash(s.id, rs);
    C.sel = null; toast(t.offDone + ": " + rs.length, t.undo, () => { fresh(); fromTrash(s.id, rs); render(); }); return render(); }
  if(d.cselknown!==undefined){ const P = prog(); C.sel.forEach(r => { P[r+"|k"] = 1; }); put("cardProg", P); toast(t.knownOn + ": " + C.sel.size); C.sel = null; return render(); }
  if(d.cnewset!==undefined) return openSetForm(null);
  if(d.cmenu!==undefined) return openSetForm(C.id);
  if(d.cback!==undefined) return history.back();
  if(d.cadd==="dict") return openDict();
  if(d.cadd==="paste") return openPaste();
  if(d.cadd==="own") return openOwn(null);
  if(d.copen!==undefined) return openCard(d.copen);
  if(d.cskill){ C.skill = d.cskill; LS.set("cardSkill", C.skill); return render(); }
  if(d.cmode){ C.mode = d.cmode; LS.set("cardMode", C.mode); return render(); }
  if(d.crec!==undefined){ e.stopPropagation(); return recStart(d.crec); }
  if(d.cplay!==undefined){ e.stopPropagation(); const S = C.s, x = S && S.q[S.i], ref = b.closest("#sheet") ? C.openRef : x && x.ref, c = ref && card(ref); if(c) play(audioOf(c)); return; }
  if(d.cmyrec!==undefined){ e.stopPropagation(); if(C.myRec) play({url:C.myRec}, null, true); return; }
  // карточку можно переворачивать туда и обратно сколько угодно; «Знаю / Ещё учу» — после первого открытия ответа
  if(d.cflip!==undefined){ if(e.target.closest("summary,details,a,input,textarea")) return; if(C.s){ C.s.flip = !C.s.flip; C.s.seen = true; C.s.turn = true; render(); } return; }
  if(d.cans!==undefined) return answer(d.cans==="1");
  if(d.cundo!==undefined) return undo();
  if(d.cprint!==undefined) return openPrint();
  if(d.cprlay){ PR.lay = d.cprlay; return refreshSheet(); }
  if(d.cprwhat){ PR.what = d.cprwhat; return refreshSheet(); }
  if(d.cprmode){ C.mode = d.cprmode; LS.set("cardMode", C.mode); return refreshSheet(); }
  if(d.cprgo!==undefined) return doPrint();
  if(d.cex!==undefined){ C.ex = null; return nav("ex"); }
  if(d.cexkind){ C.exKind = d.cexkind; LS.set("cardExKind", C.exKind); C.ex = null; return render(); }
  if(d.cexcheck!==undefined){ document.querySelectorAll("[data-cexi]").forEach(x => { C.ex.ans[x.dataset.cexi] = x.value; }); C.ex.checked = true; render(); const f = document.querySelector(".cexr"); if(f) f.scrollIntoView({block:"start", behavior:"smooth"}); return; }
  if(d.cexfix!==undefined){ C.ex.checked = false; return render(); }
  if(d.cexnew!==undefined){ C.ex = null; render(); window.scrollTo({top:0}); return; }
  if(d.cexsay!==undefined){ const k = audioKey(d.cexsay); if(AUD && AUD[k]) play({url:"gym-audio/" + AUD[k]}); return; }
  if(d.cspeed!==undefined){ e.stopPropagation(); const i = SPEEDS.indexOf(speed()); LS.set("cardSpeed", SPEEDS[(i+1) % SPEEDS.length]); render(); const x = C.s && C.s.q[C.s.i]; if(x) play(audioOf(card(x.ref))); return; }
  if(d.cpair!==undefined){ e.stopPropagation(); const x = C.s && C.s.q[C.s.i]; if(x && C.myRec) playPair(C.myRec, audioOf(card(x.ref))); return; }
  if(d.cchoose!==undefined){ e.stopPropagation(); const S = C.s, x = S.q[S.i], ok = d.cchoose===x.ref;
    S.picked = d.cchoose; S.pickOk = ok; snap(); rate(ok);
    if(navigator.vibrate) navigator.vibrate(ok ? 15 : [20, 60, 20]); S.flip = S.seen = S.turn = true; render(); if(!ok) setTimeout(() => play(audioOf(card(x.ref))), 300); return; }
  if(d.cnext!==undefined) return next();
  if(d.cknown!==undefined){ snap(); const x = C.s.q[C.s.i]; setProg(x.ref+"|k", 1); C.s.q = C.s.q.filter((y, i) => i <= C.s.i || y.ref!==x.ref); toast(t.knownOn); return next(); }
  if(d.cknownt!==undefined){ const on = !isKnown(d.cknownt); setProg(d.cknownt+"|k", on ? 1 : null); toast(on ? t.knownOn : t.knownOff); refreshSheet(); return render(); }
  if(d.cedit!==undefined){ return openOwn(d.cedit); }
  if(d.cremove!==undefined){ const s = anySet(C.id); if(!s) return;
    if(s.id.startsWith("r:")) offRef(s.id, d.cremove);
    else { const all = sets(), x = all.find(y => y.id===s.id); x.refs = x.refs.filter(r => r!==d.cremove); put("cardSets", all); }
    closeSheet(); toast(t.removed); return render(); }
  if(d.cunhide!==undefined){ fromTrash(C.id, [d.cunhide]); if(b.closest("#sheet")) closeSheet(); toast(t.restored); return render(); }
  // поиск по Словарю
  if(d.cchf!==undefined){ C.chf = d.cchf || null; C.more = 0; const r = $("cres"); if(r) r.innerHTML = dictRes(); $("sheet").scrollTop = 0; return; }
  if(d.cpick!==undefined){ const on = !C.pick.has(d.cpick); on ? C.pick.add(d.cpick) : C.pick.delete(d.cpick); b.classList.toggle("on", on); b.querySelector(".cbox").textContent = on ? "✓" : ""; return updPickBtn(); }
  if(d.cpickall!==undefined){ const rs = d.cpickall.split(","), all = rs.every(r => C.pick.has(r)); rs.forEach(r => all ? C.pick.delete(r) : C.pick.add(r)); const r = $("cres"); if(r) r.innerHTML = dictRes(); return updPickBtn(); }
  if(d.cmore!==undefined){ C.more++; const r = $("cres"); if(r) r.innerHTML = dictRes(); return; }
  if(d.caddpick!==undefined){ const n = addRefs([...C.pick]); C.pick = new Set(); closeSheet(); toast(t.added(n)); return render(); }
  // вставить список
  if(d.cfind!==undefined){ const P = C.paste; P.txt = $("cpaste").value;
    P.rows = splitList(P.txt).map((line, i) => { const ex = exactLine(line); if(ex) return {i, line, it:ex, exact:true, on:true};
      const pr = splitPair(line); if(pr) return {i, line, pair:pr, on:true};
      const m = D ? matchLine(line) : null; return m ? {i, line, it:m.it, exact:m.exact, on:m.exact} : {i, line, on:true}; });
    return refreshSheet(); }
  if(d.cprow!==undefined){ const r = C.paste.rows[+d.cprow]; r.on = !r.on; return refreshSheet(); }
  if(d.cpasteadd!==undefined){ const P = C.paste, refs = [], list = owns();
    P.rows.filter(r => r.on).forEach(r => { if(r.it) refs.push("g:"+r.it.id); else { const id = uid("o"); list.push({id, f:r.pair ? r.pair[0] : r.line, b:r.pair ? r.pair[1] : (r.ans||"").trim(), at:Date.now()}); refs.push("o:"+id); } });
    put("cardOwn", list); const n = addRefs(refs); C.paste = null; closeSheet(); const nt = Zh() && refs.some(r => r.startsWith("o:"));
    toast(t.added(n) + (nt ? " · " + t.ttsSentN : "")); render(); ttsSync(); return; }
  // своя карточка
  if(d.cownsave!==undefined) return saveOwn();
  if(d.cimgdel!==undefined){ C.draft.blobs.img = null; C.draft.img = false; C.draft.delImg = true; return refreshSheet(); }
  if(d.cvplay!==undefined){ const v = C.draft.blobs.voice ? URL.createObjectURL(C.draft.blobs.voice) : media(C.draft.id+":voice"); if(v) new Audio(v).play().catch(()=>{}); return; }
  if(d.cvdel!==undefined){ C.draft.blobs.voice = null; C.draft.voice = false; C.draft.delVoice = true; return refreshSheet(); }
  // набор
  if(d.cem!==undefined){ C.em = d.cem; const i = $("cemin"); if(i) i.value = C.em; emMark(); return; }
  if(d.csetsave!==undefined) return saveSet(d.csetsave || null);
  if(d.csetdel!==undefined) return deleteSet(d.csetdel);
}, true);
// 🔊 в окне карточки: какую карточку открыли
document.addEventListener("click", e => { const b = e.target.closest("[data-copen]"); if(b) C.openRef = b.dataset.copen; }, true);

const css = `
/* главная: «на сегодня» + разделы списком */
.chero{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 16px 16px 18px;border-radius:var(--r);background:linear-gradient(135deg,var(--accent),color-mix(in srgb,var(--accent) 70%,#000));color:#fff;box-shadow:var(--shadow);margin-bottom:6px}
.chero .chnum{display:flex;align-items:baseline;gap:8px;flex-wrap:wrap} .chero .chnum b{font-size:40px;line-height:1;font-weight:800} .chero .chnum span{font-size:15px;opacity:.9}
.chero .btn{background:#fff;color:var(--accent);flex:none}
.chero.calm{background:linear-gradient(135deg,var(--accent-soft),var(--card));color:inherit} .chero.calm b{display:block;font-size:17px} .chero.calm small{display:block;color:var(--muted);font-size:13.5px;margin-top:3px}
.csecs{background:var(--card);border-radius:var(--r);box-shadow:var(--shadow);overflow:hidden;margin-bottom:10px}
.csec{display:flex;align-items:center;gap:12px;width:100%;padding:11px 14px;text-align:left;background:none;color:inherit;border:0}
.csec+.csec{border-top:1px solid var(--line,rgba(0,0,0,.06))}
.csec .ctill{width:46px;height:46px;padding:5px} .csec .ctem{font-size:28px;width:46px;text-align:center;flex:none}
.csec .cct{flex:1;min-width:0;display:flex;flex-direction:column;gap:2px} .csec .cct b{font-size:16px;line-height:1.25} .csec .cct small{color:var(--muted);font-size:13px} .csec .cbar{margin-top:5px}
.cdpill{flex:none;min-width:30px;height:26px;padding:0 9px;border-radius:13px;background:var(--accent);color:#fff;font-weight:700;font-size:14px;display:grid;place-items:center}
.cdok{flex:none;width:26px;height:26px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:14px;font-weight:700}
.ctem{font-size:32px;line-height:1.1} .ctill{width:52px;height:52px;flex:none;border-radius:50%;background:var(--accent-soft);display:flex;align-items:center;justify-content:center;padding:6px;box-sizing:border-box} .ctill.big{width:48px;height:48px} .ctill .cfig{height:100%;max-width:100%;background:var(--accent)}
.chome2{margin-top:4px}
/* список набора: «Учу» смахивается, «Выучено» и «Корзина» — свёрнутые блоки внизу */
.cards .clist{display:block}
.cswrow{position:relative;-webkit-touch-callout:none;-webkit-user-select:none;user-select:none;margin-bottom:6px;border-radius:14px;width:100%}
.cards .cswrow>.crow{position:relative;z-index:1;margin:0;touch-action:pan-y;user-select:none;-webkit-user-select:none;cursor:pointer}
.cswrow.drag>.crow{box-shadow:var(--shadow)}
.cswbg{position:absolute;inset:0;border-radius:14px;display:none;align-items:center;justify-content:space-between;padding:0 16px;font-weight:700;font-size:14px}
.cswrow.drag .cswbg{display:flex} .cswbg span{opacity:.55;transition:opacity .15s} .cswrow.go .cswbg span{opacity:1}
.cswrow.r .cswbg{background:var(--accent-soft);color:var(--accent)} .cswrow.r .cswbg .x,.cswrow.l .cswbg .k{visibility:hidden}
.cswrow.l .cswbg{background:var(--card2);color:var(--exam);box-shadow:inset 0 0 0 1.5px var(--exam)}
.cswrow.gone{transition:height .2s ease,margin .2s ease,opacity .2s;opacity:0;margin-bottom:0;overflow:hidden}
.cswtip{text-align:center;font-size:12.5px;color:var(--accent);margin:-2px 0 6px;font-weight:600}
.cnudge>.cswrow:first-child>.crow{animation:cnudge 1.6s ease .6s 1}
@keyframes cnudge{0%,100%{transform:none}25%{transform:translateX(34px)}50%{transform:none}75%{transform:translateX(-34px)}}
.crowact{display:none}
@media (hover:hover) and (pointer:fine){
  .cswrow:hover .crowact,.crowact:focus-within{display:flex;gap:4px;flex:none}
  .crowact button{width:32px;height:32px;border-radius:10px;background:var(--card2);color:var(--accent);font-weight:800;font-size:14px;box-shadow:var(--shadow)}
  .crowact button+button{color:var(--exam)}
}
.cmini{flex:none;font-size:12.5px;font-weight:600;color:var(--accent);background:var(--accent-soft);border-radius:10px;padding:5px 9px}
.cblk{margin-top:10px} .cblk>summary b{font-size:14.5px} .cbinsub{margin:0 4px 6px}
.cards .ctrash .cct b{color:var(--muted);font-weight:500} .cards .ctrash .cth{opacity:.6}
.cards .cfull{display:flex;flex-direction:column;gap:1px;margin-top:8px;min-height:52px} .cfull small{font-size:12px;font-weight:500;opacity:.85}
.chardw{margin:10px 0 0}
.cagaintip{text-align:center;font-size:12.5px;color:var(--muted);margin:6px 8px 0;line-height:1.35}
.cemrow{display:flex;align-items:center;gap:10px;margin-bottom:8px} .cemrow .cinput{margin:0;flex:1} .cemrow .cem.big{font-size:24px}
.cards .ch3{margin:18px 4px 8px;font-size:13px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px}
.cards .cdue{display:flex;align-items:center;justify-content:space-between;gap:12px;background:var(--accent-soft);border-radius:var(--r);padding:14px;margin-bottom:6px}
.cards .cdue b{font-size:15.5px} .cards .cdue small{display:block;color:var(--muted);font-size:13px;margin-top:1px}
.cnote{font-size:13px;color:var(--muted);margin:6px 4px 8px;line-height:1.4}
.cordb{display:block;margin:14px auto 4px}
.cline{display:flex;align-items:flex-start;justify-content:space-between;gap:10px} .cline .cnote{margin-top:2px} .csetb{flex:none;color:var(--accent);font-size:13.5px;font-weight:600;padding:2px 4px 8px}
.cpickb{display:block;color:var(--accent);font-weight:600;font-size:14.5px;padding:10px 2px 0}
.cseg3 button{font-size:12.5px;line-height:1.2;padding-left:4px;padding-right:4px}
.clisth{display:flex;align-items:center;justify-content:space-between;margin:14px 4px 6px;font-size:13px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.3px}
.clisth button{color:var(--accent);text-transform:none;letter-spacing:0;font-size:14px;font-weight:600}
.cards .cpick.on{background:var(--accent-soft)}
.cselbar{position:sticky;bottom:calc(76px + env(safe-area-inset-bottom));display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px;margin:8px -4px;background:var(--card);border-radius:16px;box-shadow:var(--shadow);z-index:3}
.cselbar .btn[disabled]{opacity:.5}
.coffb{flex:none;font-size:12.5px;color:var(--muted);border:1px solid var(--line);border-radius:10px;padding:4px 8px}
.clearn .crow{padding:7px 10px} .clearn .cct b{font-size:14.5px;font-weight:600}
.cpksub{margin:10px 4px}
.cpkall{display:flex;gap:6px;margin:0 0 10px} .cpkall button{flex:1;text-align:center;font-size:13.5px;font-weight:600;color:var(--accent);background:var(--card);border-radius:12px;padding:8px 4px;box-shadow:var(--shadow)}
.cpkg{background:var(--card);border-radius:14px;box-shadow:var(--shadow);margin-bottom:8px;overflow:hidden}
.cpkg>summary{list-style:none;display:flex;align-items:center;gap:10px;padding:11px 12px;cursor:pointer;user-select:none}
.cpkg>summary::-webkit-details-marker{display:none} .cpkg>summary b{flex:1;font-size:15px;line-height:1.3} .cpkg>summary small{color:var(--muted);font-size:12.5px;flex:none}
.cpkg>summary svg{color:var(--muted);transition:transform .2s;flex:none} .cpkg[open]>summary svg{transform:rotate(90deg)}
.cards .cpkg .crow{box-shadow:none;border-radius:0;margin:0;border-top:1px solid var(--line);padding-left:16px;background:transparent}
.cpkg .crow.cdim .cct b{color:var(--muted);font-weight:500}
.cbox.on,.cbox.part{background:var(--accent);border-color:var(--accent)}
.ctag{flex:none;font-size:11px;color:var(--muted);background:var(--card2);border-radius:8px;padding:1px 7px}
.cpkfoot{position:sticky;bottom:calc(76px + env(safe-area-inset-bottom));padding-top:6px;z-index:3}
.cards .cempty{margin:4px 4px 10px}
.cards .crow,.csheet .crow{display:flex;align-items:center;gap:10px;width:100%;text-align:left;background:var(--card);border-radius:14px;padding:9px 10px;margin-bottom:6px;box-shadow:var(--shadow);color:inherit}
.cards .crow:active,.csheet .crow:active{background:var(--card2)}
.crow .cem{width:36px;height:36px;font-size:18px} .cem{width:26px;height:26px;flex:none;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center;font-size:14px}
.cem.big{width:44px;height:44px;font-size:22px}
.cct{flex:1;min-width:0} .cct b{display:block;font-size:15.5px;line-height:1.3} .cct small{display:block;color:var(--muted);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.cbar{height:4px;border-radius:2px;background:var(--card2);overflow:hidden;margin-top:6px} .cbar i{display:block;height:100%;background:var(--accent);border-radius:2px;transition:width .3s}
.ctopic{margin-bottom:6px} .ctopic>summary{list-style:none;display:flex;align-items:center;gap:8px;cursor:pointer;padding:8px 4px;font-size:15px;user-select:none}
.ctopic>summary::-webkit-details-marker{display:none} .ctopic>summary small{margin-left:auto;color:var(--muted)} .ctopic>summary svg{transition:transform .2s;color:var(--muted)} .ctopic[open]>summary svg{transform:rotate(90deg)}
.ccrumb{display:inline-flex;align-items:center;gap:4px;color:var(--accent);font-weight:600;font-size:14px;padding:4px 2px 10px}
.chead{display:flex;align-items:center;gap:12px} .chead h2{margin:0;font-size:20px} .chead>div{flex:1;min-width:0}
.cseg{margin-top:14px}
.cards .cstart{margin-top:2px}
.cadd{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:6px 0 14px}
.cadd button{background:var(--card);border-radius:14px;box-shadow:var(--shadow);padding:10px 6px;display:flex;flex-direction:column;align-items:center;gap:3px;text-align:center;font-size:20px;color:inherit}
.cadd button[hidden]{display:none} .cadd b{font-size:13.5px} .cadd small{font-size:11px;color:var(--muted);line-height:1.25}
.cth{width:44px;height:44px;flex:none;border-radius:10px;background:var(--card2);display:flex;align-items:center;justify-content:center;padding:3px;overflow:hidden}
.cth .cfig{width:100%;height:100%} .cth img{width:100%;height:100%;object-fit:cover;border-radius:8px} .cth.ctx{color:var(--accent);font-size:15px;font-weight:700;background:var(--accent-soft)}
.cfig{display:block;background:var(--ink);-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat}
.cfig.cfimg{background:none;-webkit-mask:none;mask:none;object-fit:contain;border-radius:8px}
.cst{font-size:11.5px;padding:2px 8px;border-radius:10px;background:var(--card2);color:var(--muted);flex:none;cursor:help;white-space:nowrap} .cst.l{background:var(--accent-soft);color:var(--accent)} .cst.k{background:var(--accent);color:var(--accent-ink,#fff)}
.cdv{position:relative} .cdv::after{content:"";position:absolute;left:50%;top:-.1em;width:.1em;height:.3em;border-radius:.05em;background:currentColor;transform:translateX(-50%) rotate(30deg);pointer-events:none}
.cprog{display:flex;justify-content:space-between;color:var(--muted);font-size:13px;margin:0 2px} .cskill{font-size:15px}
.cflip{background:var(--card);border-radius:20px;box-shadow:var(--shadow);padding:20px 16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:12px;text-align:center;cursor:pointer;animation:cin .25s ease}
.cflip.turn{animation:cflip .3s ease}
.cflip:focus-visible{outline:2px solid var(--accent);outline-offset:2px}
/* стиль А — «чёткая карточка»: метка «Вопрос/Ответ», высота по содержимому, ответ на мягком фоне акцента */
.cflip.st-a{min-height:220px;justify-content:flex-start;padding-top:14px}
.cflip.st-a .cface{flex:1;justify-content:center}
.cflip.st-a.back{background:var(--accent-soft)}
.cqa{align-self:flex-start;font-size:11.5px;font-weight:700;letter-spacing:.6px;text-transform:uppercase;color:var(--muted)} .cflip.back .cqa{color:var(--accent)}
/* стиль Б — «стопка»: сзади видно ещё две карточки, крупный рисунок — вопрос */
.cflip.st-b{min-height:min(62vh,480px)}
.cmore{width:100%;text-align:left;font-size:15px;line-height:1.45;color:var(--ink)} .cmore summary{color:var(--accent);font-weight:600;font-size:14px;cursor:pointer;text-align:center;list-style:none} .cmore summary::-webkit-details-marker{display:none} .cmore>div{margin-top:6px;white-space:pre-line}
.cday{background:var(--card);border-radius:14px;box-shadow:var(--shadow);padding:10px 12px;margin:14px auto 16px;max-width:320px;font-size:14.5px;line-height:1.6}
.cswhint{text-align:center;font-size:12.5px;color:var(--muted);margin:8px 0 0}
@keyframes cflip{from{transform:rotateY(70deg);opacity:.3}to{transform:none;opacity:1}} @keyframes cin{from{transform:translateY(8px);opacity:0}to{transform:none;opacity:1}}
@media (prefers-reduced-motion:reduce){.cflip,.cflip.turn,.cnudge>.cswrow:first-child>.crow{animation:none}}
.cface{display:flex;flex-direction:column;align-items:center;gap:12px;width:100%}
.cflipnote{font-size:12.5px;color:var(--muted)}
.cfs svg{width:min(60vw,220px);height:auto;color:var(--ink)} .cpic.cfs.big svg{width:min(72vw,280px)} .cpic.cfs.sm svg{width:min(36vw,130px)} .cth.cfs svg{width:100%;height:100%} .cth.cfs .cfig{height:100%}
.cpic{display:flex;gap:8px;justify-content:center;width:100%} .cpic .cfig{height:min(26vh,200px);max-width:100%} .cpic img{max-width:100%;max-height:min(34vh,260px);border-radius:12px}
.cpic.big .cfig{height:min(44vh,340px)} .cpic.big img{max-height:min(48vh,380px)} .cpic.sm .cfig{height:min(15vh,110px)} .cpic.sm img{max-height:min(18vh,130px)}
.cpic.cwait{min-height:min(26vh,200px)} .cpic.big.cwait{min-height:min(44vh,340px)} .cpic.sm.cwait{min-height:min(15vh,110px)}
.cterm{font-size:24px;font-weight:750;line-height:1.3} .cterm.sm{font-size:19px} .czh{font-size:16px;color:var(--muted)} .czh.big{font-size:22px;color:var(--ink);font-weight:600}
.cd{font-size:16px;line-height:1.45;color:var(--ink)} .cd.big{font-size:19px} .chint{font-size:14px;color:var(--muted)}
.csay{font-size:15px;color:var(--ink);text-align:left;align-self:stretch;background:var(--card2);border-radius:12px;padding:8px 12px} .cflip.back .csay{background:var(--card)}
.csay small{display:block;font-size:11.5px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;color:var(--muted);margin-bottom:2px} .csay ul{margin:0;padding-left:18px} .csay li{margin:2px 0}
.cmuted{font-size:13px;color:var(--muted)}
.cspk{width:44px;height:44px;border-radius:50%;background:var(--accent-soft);color:var(--accent);display:grid;place-items:center} .cspk svg,.cbigspk svg,.crecb svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.cbigspk{width:96px;height:96px;border-radius:50%;background:var(--accent);color:var(--accent-ink,#fff);display:grid;place-items:center} .cbigspk svg{width:44px;height:44px}
svg.cmic{width:18px;height:18px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.crecb.on,.csheet .btn.on{background:var(--exam);color:#fff}
.crowbtn{display:flex;gap:10px;align-items:center;justify-content:center}
.canswer{display:grid;grid-template-columns:1fr 1fr;gap:10px} .canswer .btn{min-height:52px;font-size:16px}
.cstack{position:relative;margin:12px 0;z-index:0}
.cstack.b{margin-bottom:28px}
.cstack.b::before,.cstack.b::after{content:"";position:absolute;left:12px;right:12px;top:10px;bottom:-10px;background:var(--card);opacity:.75;border-radius:20px;box-shadow:var(--shadow);z-index:-1}
.cstack.b::after{left:26px;right:26px;top:20px;bottom:-20px;opacity:.45;z-index:-2}
.cstack .cflip{position:relative;margin:0;touch-action:pan-y;user-select:none;-webkit-user-select:none}
.cflip.drag{transition:none;animation:none} .cflip:not(.drag) .cswl,.cflip:not(.drag) .cswr{display:none}
.cswl,.cswr{position:absolute;top:16px;font-style:normal;font-weight:800;font-size:14px;padding:4px 10px;border-radius:10px;opacity:var(--l,0);pointer-events:none}
.cswl{right:14px;color:var(--exam);border:2px solid var(--exam);transform:rotate(8deg)} .cswr{left:14px;opacity:var(--r,0);color:var(--accent);border:2px solid var(--accent);transform:rotate(-8deg)}
.cprog{align-items:center} .cprog>*{flex:1} .cprog>span:nth-child(2){text-align:center} .cprog>:last-child{text-align:right}
.cundo,.cspeed{font-size:13px;color:var(--accent);font-weight:600;padding:4px 0} .cspeed{text-align:right}
.canswer.one{grid-template-columns:1fr}
.cspk.big{width:64px;height:64px} .cspk.big svg{width:30px;height:30px}
.cchoice{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;width:100%}
.cch{background:var(--card2);border-radius:14px;height:min(18vh,130px);display:flex;align-items:center;justify-content:center;padding:8px;border:2px solid transparent}
.cch{overflow:hidden;min-width:0} .cch .cfig{width:100%;height:100%;aspect-ratio:auto!important} .cch svg{max-width:100%;max-height:100%}
.cchoice.done .cch{height:min(11vh,80px)} .cch.ok{border-color:var(--accent);background:var(--accent-soft)} .cch.no{border-color:var(--exam)} .cch.off{opacity:.35}
.chint.cok{color:var(--accent);font-weight:700} .chint.cno{color:var(--exam);font-weight:700}
.cflip.nochoose{cursor:default}
.ctip{background:var(--accent-soft);border-radius:14px;padding:10px 12px;font-size:14px;margin:0 0 10px}
.cexr{display:flex;gap:10px;background:var(--card);border-radius:14px;padding:10px;margin-bottom:8px;box-shadow:var(--shadow);border-left:3px solid transparent}
.cexr.v-ok{border-left-color:var(--accent)} .cexr.v-near{border-left-color:var(--accent);border-left-style:dashed} .cexr.v-no,.cexr.v-empty{border-left-color:var(--exam)}
.cexf{width:84px;height:96px;flex:none;border-radius:10px;background:var(--card2);display:flex;align-items:center;justify-content:center;padding:4px}
.cexf .cfig{max-width:100%;max-height:100%;width:100%;height:100%;aspect-ratio:auto!important}
.cexb{flex:1;min-width:0} .cexn{display:flex;align-items:center;gap:8px;margin-bottom:4px} .cexn b{font-size:15px}
.cexv{font-size:12px;font-weight:700;margin-left:auto} .v-ok .cexv{color:var(--accent)} .v-near .cexv{color:var(--accent)} .v-no .cexv,.v-empty .cexv{color:var(--exam)}
.cexin{width:100%;box-sizing:border-box;border:1.5px solid var(--line);border-radius:10px;padding:8px 10px;font:inherit;font-size:16px;background:var(--bg,var(--card));color:var(--ink);resize:vertical}
.cexu,.cexok{font-size:14.5px;line-height:1.55;margin-top:2px} .cexu small,.cexok small{color:var(--muted);font-size:12px}
.cokw{color:var(--ink)} .cexu .cokw{color:var(--accent)} .ctypo{text-decoration:underline wavy var(--accent);text-underline-offset:3px;text-decoration-thickness:1.5px}
.cmiss{background:var(--accent-soft);color:var(--accent);font-weight:700;border-radius:4px;padding:0 3px;box-shadow:inset 0 0 0 1.5px var(--accent)} .cextra{color:var(--exam);text-decoration:line-through}
.cexnote{font-size:13px;color:var(--muted);margin-top:4px}
.cexsc{text-align:center;margin:8px 0 2px;font-size:16px}
.cspk.sm{width:30px;height:30px;display:inline-grid;vertical-align:middle} .cspk.sm svg{width:16px;height:16px}
.cprintb{display:block;margin:0 auto 12px;color:var(--accent);font-weight:600;font-size:14px;padding:4px 8px}
#cprint{display:none}
@media print{
  @page{size:A4 portrait;margin:8mm}
  html.cprinting body>*:not(#cprint){display:none!important}
  html.cprinting,html.cprinting body{background:#fff!important}
  html.cprinting #cprint{display:block}
  #cprint{font-family:Inter,system-ui,sans-serif;color:#000;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  #cprint .pg{break-after:page;page-break-after:always;display:grid;width:194mm;height:280mm}
  #cprint .pg:last-child{break-after:auto;page-break-after:auto}
  #cprint .pg.fold{grid-template-rows:repeat(5,1fr)}
  #cprint .pr{display:grid;grid-template-columns:1fr 1fr;border:.3mm dashed #999;border-top:none}
  #cprint .pr:first-child{border-top:.3mm dashed #999}
  #cprint .pr .pc+.pc{border-left:.3mm dotted #bbb}
  #cprint .pg.dup{grid-template-columns:1fr 1fr;grid-template-rows:repeat(5,1fr)}
  #cprint .pg.dup .pc{border:.3mm dashed #999;margin:-.15mm}
  #cprint .pc{overflow:hidden;display:flex;align-items:center;justify-content:center;padding:3mm;box-sizing:border-box}
  #cprint .pi{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2mm;text-align:center;width:100%;max-height:100%}
  #cprint .pp{display:flex;gap:2mm;justify-content:center;height:30mm;width:100%}
  #cprint .pp .pf{display:block;height:100%;background:#000;-webkit-mask:var(--m) center/contain no-repeat;mask:var(--m) center/contain no-repeat}
  #cprint .pi>.pp:only-child{height:46mm}
  #cprint .pp img{max-height:100%;max-width:100%;object-fit:contain}
  #cprint .pp svg{height:100%;width:auto}
  #cprint .pt{font-size:14pt;font-weight:700;line-height:1.25}
  #cprint .pz{font-size:13pt}
  #cprint .pd{font-size:9.5pt;line-height:1.3}
  #cprint .pd.big{font-size:11pt}
  #cprint .cdv{position:relative} #cprint .cdv::after{background:#000}
}
.cknown{display:block;margin:16px auto 0;color:var(--accent);font-size:14.5px;font-weight:600;border:1.5px solid var(--accent-soft);border-radius:12px;padding:8px 16px}
.cdone{text-align:center;padding:30px 10px} .cdoneem{font-size:48px} .cdone .btnrow{justify-content:center}
.csheet textarea,.csheet .cinput{width:100%;border:1.5px solid var(--line);border-radius:12px;padding:10px 12px;font:inherit;font-size:16px;background:var(--card);color:var(--ink);margin-bottom:10px;box-sizing:border-box}
.csheet .clab{display:block;font-size:13px;color:var(--muted);margin:4px 2px 4px}
.csheet .clocal{background:var(--accent-soft);border-radius:12px;padding:9px 11px;color:var(--ink)}
.csheet .cfile{cursor:pointer}
.csheet .cpic img{max-height:200px}
.csheet .cgh{display:flex;align-items:center;justify-content:space-between;font-size:12.5px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.3px;margin:14px 4px 6px}
.csheet .cgh button{color:var(--accent);text-transform:none;font-size:13px;letter-spacing:0}
.csheet .cpick.on{background:var(--accent-soft)} .csheet .cpick[disabled]{opacity:.55}
.cbox{width:22px;height:22px;flex:none;border-radius:7px;border:1.8px solid var(--line);display:grid;place-items:center;font-size:13px;font-weight:800;color:var(--accent-ink,#fff)}
.cpick.on .cbox{background:var(--accent);border-color:var(--accent)}
.csheet .cfoot{position:sticky;bottom:-1px;background:var(--bg,var(--card));padding:8px 0 4px;margin-top:6px}
.csheet .cfoot .btn[disabled]{opacity:.5}
.cems{display:grid;grid-template-columns:repeat(8,1fr);gap:5px;margin:4px 0 12px} .cems button{font-size:21px;padding:5px 0;border-radius:12px;background:var(--card2)} .cems button.on{background:var(--accent-soft);box-shadow:inset 0 0 0 2px var(--accent)}
.csheet .cprev>.cterm.sm:first-child{display:none}
.csheet .cprev{display:flex;flex-direction:column;align-items:center;gap:10px;text-align:center;margin-bottom:12px}
.csheet .row>.cdot{flex:0 0 26px;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;background:var(--card2);color:var(--muted);font-size:13px;flex:none} .csheet .row small{display:block;color:var(--muted);font-size:12.5px;font-weight:400;margin-top:1px}
.cpans{display:block;width:100%;box-sizing:border-box;margin-top:5px;border:1px solid var(--line);border-radius:9px;padding:6px 8px;font:inherit;font-size:14px;background:var(--card);color:var(--ink)}
.cdot.on,.csheet .row>.cdot.on{background:var(--accent);color:var(--accent-ink,#fff)}
.csheet .btn.cdanger{background:transparent;color:var(--exam)}
`;

window.CARDS = {screen, restore};
})();
