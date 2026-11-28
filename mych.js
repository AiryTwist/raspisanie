/* «Мои главы» приложения «Расписание»: студент делает свою главу Словаря на любую тему.
   Слова добавляются вручную, вставкой текста (из конспекта, Moodle, Word), из файла (.docx, .xlsx, .csv, .txt) и с фото (распознавание текста
   прямо на телефоне — tesseract.js в vendor/tess, ≈6,5 МБ скачивается при первом использовании).
   Глава видна в Словаре (раздел «Мои главы», поиск) и в Карточках (готовый набор) — gym.js и cards.js берут её через MYCH.parts().
   Текст глав — localStorage myChaps (синхронизируется с аккаунтом); фото к словам — только IndexedDB этого телефона (myChImg).
   Поделиться: текст главы кладётся в Supabase (mych_put, scripts/mych.sql), ссылка #mych=<id> открывает её у одногруппника — он сохраняет себе копию.
   Пользуется общим из app.js: state, LS, openSheet, pushSheet, refreshSheet, closeSheet, sheetBack, toast, copyText, render, esc, icon, $, rpc, siteUrl, go, SPIN. */
(function(){
const Zh = () => state.lang==="zh";
const T = {
  ru:{ topic:"Мои главы", tip:"Своя глава — для любого предмета. Слова можно набрать, вставить из конспекта, загрузить файлом или сфотографировать. Глава появится в поиске и в «Карточках».",
    newCh:"＋ Новая глава", byLink:"🔗 Открыть главу по ссылке", nTerms:n=>`${n} ${n%10===1&&n%100!==11?"термин":n%10>=2&&n%10<=4&&(n%100<10||n%100>=20)?"термина":"терминов"}`,
    add:"＋ Добавить слова", share:"Поделиться", chEdit:"Глава", empty:"В главе пока нет слов. Нажмите «＋ Добавить слова».",
    chNew:"Новая глава", chName:"Название", chNamePh:"Например: Анатомия — мышцы", chEm:"Значок", create:"Создать", save:"Сохранить", del:"Удалить главу",
    delQ:n=>`Удалить главу «${n}» со всеми словами? Это не отменить.`, needName:"Напишите название",
    addH:"Как добавить слова?", m1:"✍️ Вручную", m1s:"По одному слову", m2:"📋 Вставить текст", m2s:"Скопировать из конспекта, Moodle, Word",
    m3:"📄 Из файла", m3s:"Word (.docx), Excel (.xlsx), .csv, .txt", m4:"📷 С фото", m4s:"Страница учебника или конспекта — текст распознается",
    tNew:"Новое слово", tEdit:"Изменить слово", term:"Термин", termPh:"Например: двуглавая мышца плеча", defn:"Объяснение", defPh:"Что это, как выполняется, зачем…",
    zh:"Перевод на китайский (если нужен)", photo:"📷 Фото или рисунок", photoCh:"Заменить фото", photoDel:"Убрать фото", photoNote:"Фото хранится только на этом телефоне.",
    saveMore:"Сохранить и следующее", tDel:"Удалить слово", tDelQ:"Удалить это слово?", needTerm:"Напишите термин", saved:"Сохранено", added:n=>`Добавлено: ${n}`,
    pasteH:"Вставить текст", pasteHint:"Каждый термин — с новой строки: «термин — объяснение» (через тире, двоеточие или табуляцию). Если термин и объяснение на разных строках — тоже разберётся.",
    pastePh:"Пронация — поворот кисти ладонью вниз\nСупинация — поворот кисти ладонью вверх", parse:"Разобрать", nothing:"Не нашлось ни одного термина",
    ocrH:"Проверьте текст", ocrHint:"Распознавание иногда ошибается — поправьте, что нужно, потом «Разобрать».",
    prevH:n=>`Нашлось: ${n}`, prevHint:"Проверьте и поправьте. Снимите галочку — термин не добавится.", swap:"⇄ Поменять местами", mode1:"Термин и объяснение в одной строке", mode2:"Термин и объяснение на разных строках",
    addN:n=>n?`Добавить (${n})`:"Отметьте термины", fileH:"Из файла", fileHint:"Подойдут Word (.docx), Excel (.xlsx), таблица .csv и текст .txt. В таблице: 1-й столбец — термин, 2-й — объяснение.",
    pick:"Выбрать файл", badFile:"Этот файл не прочитать. Сохраните его как .docx, .xlsx или .txt — или скопируйте текст и вставьте.", oldDoc:"Старый формат .doc не читается — пересохраните как .docx или скопируйте текст.",
    pdf:"PDF не читается напрямую: скопируйте из него текст («Вставить текст») или сделайте снимок экрана («С фото»).", reading:"Читаю файл…",
    photoH:"С фото", photoHint:"Сфотографируйте страницу ровно, при хорошем свете, чтобы текст был крупным. Печатный текст распознаётся хорошо, рукописный — хуже.",
    takePhoto:"📷 Сфотографировать или выбрать", ocrLoad:"Скачиваю распознавание (один раз, ≈6 МБ)…", ocrRun:"Распознаю текст…", ocrFail:"Не получилось распознать. Попробуйте фото чётче или вставьте текст.",
    ocrOld:"Этот браузер не умеет распознавать текст. Обновите его или вставьте текст.", ocrNone:"Текста на фото не нашлось",
    shareH:"Поделиться главой", shareHint:"Одногруппник откроет ссылку — и сохранит себе копию главы. Фото не передаются, только текст. Если потом измените главу — отправьте ссылку заново.",
    copy:"Скопировать ссылку", send:"Отправить", sharing:"Готовлю ссылку…", shareOff:"Обмен главами пока не работает — попробуйте позже.", copied:"Ссылка скопирована",
    linkH:"Открыть главу по ссылке", linkPh:"Вставьте ссылку от одногруппника", open:"Открыть", badLink:"Это не ссылка на главу", loadingCh:"Загружаю главу…", notFound:"Глава по этой ссылке не нашлась",
    inH:"Глава от одногруппника", inAdd:"Сохранить себе", inHave:"Эта глава у вас уже есть", inOpen:"Открыть", inSaved:"Глава сохранена в «Моих главах»",
    srcMy:n=>`Моя глава «${n}»`, srcIn:n=>`Глава «${n}» от одногруппника`, editBtn:"✎ Изменить", more:"…и ещё", back:"Назад" },
  zh:{ topic:"我的章节", tip:"自己的章节，任何课程都可以。可以手动输入、粘贴笔记、上传文件或拍照识别。章节会出现在搜索和“卡片”里。",
    newCh:"＋ 新建章节", byLink:"🔗 通过链接打开章节", nTerms:n=>`${n} 个术语`,
    add:"＋ 添加词语", share:"分享", chEdit:"章节", empty:"这个章节还没有词。点“＋ 添加词语”。",
    chNew:"新建章节", chName:"名称", chNamePh:"例如：解剖学——肌肉", chEm:"图标", create:"创建", save:"保存", del:"删除章节",
    delQ:n=>`删除章节“${n}”和其中所有的词？无法撤销。`, needName:"请写名称",
    addH:"怎样添加词语？", m1:"✍️ 手动输入", m1s:"一个一个地添加", m2:"📋 粘贴文字", m2s:"从笔记、Moodle、Word 复制",
    m3:"📄 从文件", m3s:"Word (.docx)、Excel (.xlsx)、.csv、.txt", m4:"📷 拍照", m4s:"教材或笔记的一页——自动识别文字",
    tNew:"新词", tEdit:"修改", term:"术语（俄语）", termPh:"例如：двуглавая мышца плеча", defn:"解释", defPh:"是什么、怎么做……",
    zh:"中文翻译", photo:"📷 照片或图片", photoCh:"换照片", photoDel:"删除照片", photoNote:"照片只保存在这部手机上。",
    saveMore:"保存，再加一个", tDel:"删除", tDelQ:"删除这个词？", needTerm:"请写术语", saved:"已保存", added:n=>`已添加：${n}`,
    pasteH:"粘贴文字", pasteHint:"每个术语一行：“术语 — 解释”（用破折号、冒号或 Tab 分开）。术语和解释在不同的行也可以。",
    pastePh:"Пронация — поворот кисти ладонью вниз\nСупинация — поворот кисти ладонью вверх", parse:"识别", nothing:"没有找到术语",
    ocrH:"请检查文字", ocrHint:"识别有时会出错——请改正，然后点“识别”。",
    prevH:n=>`找到：${n}`, prevHint:"请检查并修改。取消勾选的不会添加。", swap:"⇄ 交换", mode1:"术语和解释在同一行", mode2:"术语和解释在不同的行",
    addN:n=>n?`添加（${n}）`:"请勾选术语", fileH:"从文件", fileHint:"可以用 Word (.docx)、Excel (.xlsx)、.csv 表格和 .txt 文本。表格：第 1 列是术语，第 2 列是解释。",
    pick:"选择文件", badFile:"无法读取这个文件。请另存为 .docx、.xlsx 或 .txt，或者复制文字后粘贴。", oldDoc:"旧的 .doc 格式无法读取——请另存为 .docx 或复制文字。",
    pdf:"PDF 不能直接读取：请复制里面的文字（“粘贴文字”）或截图（“拍照”）。", reading:"正在读取文件……",
    photoH:"拍照", photoHint:"请把页面拍正、光线充足、文字清楚。印刷体识别得好，手写的差一些。",
    takePhoto:"📷 拍照或选择图片", ocrLoad:"正在下载识别程序（只需一次，约 6 MB）……", ocrRun:"正在识别文字……", ocrFail:"识别失败。请拍得更清楚，或者粘贴文字。",
    ocrOld:"这个浏览器不能识别文字。请更新浏览器或粘贴文字。", ocrNone:"照片上没有找到文字",
    shareH:"分享章节", shareHint:"同学打开链接，就能保存一份章节副本。只分享文字，不分享照片。以后修改了章节，请重新发送链接。",
    copy:"复制链接", send:"发送", sharing:"正在生成链接……", shareOff:"章节分享暂时不能用，请稍后再试。", copied:"链接已复制",
    linkH:"通过链接打开章节", linkPh:"粘贴同学发来的链接", open:"打开", badLink:"这不是章节链接", loadingCh:"正在加载章节……", notFound:"没有找到这个章节",
    inH:"同学分享的章节", inAdd:"保存到我的章节", inHave:"你已经有这个章节了", inOpen:"打开", inSaved:"章节已保存到“我的章节”",
    srcMy:n=>`我的章节“${n}”`, srcIn:n=>`同学分享的章节“${n}”`, editBtn:"✎ 修改", more:"……还有", back:"返回" }
};
const TL = () => T[Zh()?"zh":"ru"];
const uid = p => p + Date.now().toString(36) + Math.random().toString(36).slice(2,6);
const clip = (s, n) => (s||"").replace(/\s+/g, " ").trim().slice(0, n);

/* ---------- хранилище ---------- */
const list = () => { const v = LS.get("myChaps", []); return Array.isArray(v) ? v.filter(c => c && c.id) : []; };
const chOf = id => list().find(c => c.id===id);
const LIS = [];
function changed(){ LIS.forEach(f => { try{ f(); }catch(e){ console.error(e); } }); }
function saveList(l){ LS.set("myChaps", l); changed(); }
function updCh(id, fn){ const l = list(), c = l.find(x => x.id===id); if(!c) return null; fn(c); c.at = Date.now(); saveList(l); return c; }

// фото к словам — IndexedDB только этого телефона: id слова → {u: dataURL (webp), w, h}
let DB = null;
const db = () => DB || (DB = new Promise((ok, no) => { const r = indexedDB.open("myChImg", 1); r.onupgradeneeded = () => r.result.createObjectStore("m"); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
const itx = (mode, fn) => db().then(d => new Promise((ok, no) => { const tx = d.transaction("m", mode), st = tx.objectStore("m"), r = fn(st); tx.oncomplete = () => ok(r && r.result); tx.onerror = () => no(tx.error); }));
const IMG = {};   // id слова → [dataURL, w, h, 1] (1 — цветная картинка, не маска)
db().then(d => new Promise(ok => { const tx = d.transaction("m"), st = tx.objectStore("m"), k = st.getAllKeys(), v = st.getAll();
  tx.oncomplete = () => { (k.result||[]).forEach((key, i) => { const x = v.result[i]; if(x && x.u) IMG[key] = [x.u, x.w, x.h, 1]; }); ok(); }; tx.onerror = () => ok(); }))
  .catch(() => {}).then(() => { if(Object.keys(IMG).length) changed(); });
async function putImg(tid, file){
  const bmp = await createImageBitmap(file), k = Math.min(1, 900 / Math.max(bmp.width, bmp.height));
  const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width*k); cv.height = Math.round(bmp.height*k);
  cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
  let u = cv.toDataURL("image/webp", .8); if(!u.startsWith("data:image/webp")) u = cv.toDataURL("image/jpeg", .82);
  await itx("readwrite", s => s.put({u, w:cv.width, h:cv.height}, tid)); IMG[tid] = [u, cv.width, cv.height, 1];
}
function delImg(tid){ delete IMG[tid]; return itx("readwrite", s => s.delete(tid)).catch(() => {}); }

/* ---------- для Словаря и Карточек: глава → тема «mych», глава, подраздел, термины (id: u-<глава>, u-<слово>) ---------- */
function parts(){
  const chapters = [], cats = [], items = [], t = TL();
  list().forEach(c => { const cid = "u-" + c.id;
    chapters.push({id:cid, name:c.name, nz:c.name, em:c.em||PIC_DEF, my:1, mid:c.id, cats:[cid]});
    cats.push({id:cid, name:c.name, nz:c.name, ch:cid, my:1});
    (c.terms||[]).forEach(w => items.push({id:"u-"+w.id, c:cid, t:w.t, d:w.d||"", dz:w.d||"", zh:w.z||"", say:[], fig:IMG[w.id] ? ["u-"+w.id] : [], p:"",
      src:c.from ? t.srcIn(c.name) : t.srcMy(c.name), my:1, mid:w.id, mch:c.id})); });
  return {topic:{id:"mych", name:T.ru.topic, nz:T.zh.topic, my:1, chapters:chapters.map(c => c.id)}, chapters, cats, items};
}
const figs = () => { const o = {}; for(const k in IMG) o["u-"+k] = IMG[k]; return o; };

/* ---------- экраны внутри Словаря ---------- */
const plural = n => TL().nTerms(n);
function topicHTML(){
  const t = TL(), l = list();
  return `<div class="gtip">${esc(t.tip)}</div>`
    + l.map(c => `<button class="gchr" data-gch="u-${esc(c.id)}"><b><span class="emi">${emH(c.em||PIC_DEF)}</span>${esc(c.name)}</b><small>${plural((c.terms||[]).length)}</small>${icon("chev","sm muted")}</button>`).join("")
    + `<button class="btn wide" data-mynew>${t.newCh}</button><button class="btn wide ghost" data-mylink>${t.byLink}</button>`;
}
function chHead(cid){
  const t = TL(), c = chOf(cid.replace(/^u-/, "")); if(!c) return "";
  return `<div class="btnrow mybar"><button class="btn small" data-myadd="${esc(c.id)}">${t.add}</button><button class="btn small ghost" data-myshare="${esc(c.id)}">${t.share}</button><button class="btn small ghost" data-mychedit="${esc(c.id)}">✎ ${t.chEdit}</button></div>`
    + ((c.terms||[]).length ? "" : `<div class="empty">${t.empty}</div>`);
}

/* ---------- глава: создать, переименовать, удалить ---------- */
let EMSEL = PIC_DEF;
function chForm(id){
  const t = TL(), c = id ? chOf(id) : null; EMSEL = c && isPic(c.em) ? c.em : PIC_DEF;
  openSheet(`<h2>${c ? esc(c.name) : t.chNew}</h2><div class="form">
    <label>${t.chName}<input id="my_n" value="${esc(c ? c.name : "")}" placeholder="${esc(t.chNamePh)}" autocomplete="off" maxlength="80"></label>
    <div class="mylab">${t.chEm}</div><div class="mypics">${picGrid(EMSEL, "data-myem")}</div></div>
    <div class="btnrow"><button class="btn" data-mychsave="${c ? esc(c.id) : ""}">${c ? t.save : t.create}</button>${c ? `<button class="btn danger" data-mychdel="${esc(c.id)}">${t.del}</button>` : ""}</div>`);
}
function chSave(id){
  const t = TL(), n = clip($("my_n").value, 80); if(!n){ toast(t.needName); return; }
  if(id){ updCh(id, c => { c.name = n; c.em = EMSEL; }); closeSheet(); return; }
  const c = {id:uid("c"), name:n, em:EMSEL, terms:[], at:Date.now()};
  saveList(list().concat([c])); closeSheet(() => openCh(c.id, true));
}
function openCh(id, thenAdd){
  if(window.GYM && GYM.open) GYM.open("mych", "u-" + id); else { state.screen = "dict"; render(); }
  if(thenAdd) setTimeout(() => pushSheet(() => addMenu(id)), 50);
}

/* ---------- добавить слова: 4 способа ---------- */
function addMenu(id){
  const t = TL();
  openSheet(`<h2>${t.addH}</h2><div class="mymeth">
    <button data-myman="${esc(id)}"><b>${t.m1}</b><small>${t.m1s}</small></button>
    <button data-mypaste="${esc(id)}"><b>${t.m2}</b><small>${t.m2s}</small></button>
    <button data-myfile="${esc(id)}"><b>${t.m3}</b><small>${t.m3s}</small></button>
    <button data-myphoto="${esc(id)}"><b>${t.m4}</b><small>${t.m4s}</small></button></div>`);
}

// вручную (и изменить слово)
let TD = null;   // черновик: {ch, id, img: File|null|"del"}
function termForm(chId, tid){
  const t = TL(), c = chOf(chId), w = c && tid ? (c.terms||[]).find(x => x.id===tid) : null; if(!c) return;
  TD = TD && TD.ch===chId && TD.id===(w ? w.id : null) ? TD : {ch:chId, id:w ? w.id : null, img:null};
  const has = TD.img && TD.img!=="del" || (w && IMG[w.id] && TD.img!=="del");
  const prev = TD.img && TD.img!=="del" ? URL.createObjectURL(TD.img) : has ? IMG[w.id][0] : "";
  openSheet(`<h2>${w ? t.tEdit : t.tNew}</h2><div class="form">
    <label>${t.term}<input id="my_t" value="${esc(w ? w.t : "")}" placeholder="${esc(t.termPh)}" autocomplete="off" maxlength="200"></label>
    <label>${t.defn}<textarea id="my_d" rows="4" placeholder="${esc(t.defPh)}" maxlength="3000">${esc(w ? w.d||"" : "")}</textarea></label>
    <label>${t.zh}<input id="my_z" value="${esc(w ? w.z||"" : "")}" autocomplete="off" lang="zh" maxlength="300"></label>
    ${has ? `<img class="myimg" src="${esc(prev)}" alt="">` : ""}
    <div class="btnrow"><label class="btn small ghost">${has ? t.photoCh : t.photo}<input type="file" accept="image/*" id="my_img" hidden></label>${has ? `<button class="btn small ghost" data-myimgdel>${t.photoDel}</button>` : ""}</div>
    <small class="muted">${t.photoNote}</small></div>
    <div class="btnrow"><button class="btn" data-mytsave>${t.save}</button>${w ? `<button class="btn danger" data-mytdel="${esc(w.id)}">${t.tDel}</button>` : `<button class="btn ghost" data-mytsave="more">${t.saveMore}</button>`}</div>`);
}
async function termSave(more){
  const t = TL(), d = TD; if(!d) return;
  const term = clip($("my_t").value, 200); if(!term){ toast(t.needTerm); return; }
  const rec = {id:d.id || uid("t"), t:term, d:($("my_d").value||"").trim().slice(0, 3000), z:clip($("my_z").value, 300)};
  try{ if(d.img==="del") await delImg(rec.id); else if(d.img) await putImg(rec.id, d.img); }catch(e){ toast("Фото не сохранилось"); }
  updCh(d.ch, c => { c.terms = c.terms||[]; const i = c.terms.findIndex(x => x.id===rec.id); if(i >= 0) c.terms[i] = Object.assign(c.terms[i], rec); else c.terms.push(rec); });
  TD = null; toast(t.saved);
  if(more){ TD = {ch:d.ch, id:null, img:null}; termForm(d.ch, null); $("my_t") && $("my_t").focus(); }
  else sheetBack();
}
function termDel(tid){
  if(!confirm(TL().tDelQ)) return;
  list().forEach(c => { if((c.terms||[]).some(x => x.id===tid)) updCh(c.id, x => { x.terms = x.terms.filter(y => y.id!==tid); }); });
  delImg(tid); TD = null; closeSheet();
}

// разбор текста: «термин — объяснение» в строке или термин и объяснение на разных строках
const SEP = /\t|\s[—–-]\s|[—–]|:\s|\s=\s/;
function cleanLine(s){ return s.replace(/\u00a0/g, " ").replace(/^\s*(?:\d{1,3}[.)]\s+|[•·▪►✓*]\s*|[-–—]\s+)/, "").replace(/[ \f\v]+/g, " ").replace(/ *\t[\t ]*/g, "\t").trim(); }   // табуляцию оставляем — это разделитель столбцов
function splitLine(s){
  const m = s.match(SEP); if(!m || m.index===0) return null;
  const a = s.slice(0, m.index).trim(), b = s.slice(m.index + m[0].length).trim().replace(/^это\s+/i, "");
  if(!a || a.length > 120 || a.split(" ").length > 12) return null;
  return [a, b];
}
function guessMode(text){
  const ls = text.split(/\r?\n/).map(cleanLine).filter(Boolean); if(!ls.length) return 1;
  return ls.filter(splitLine).length >= ls.length * .3 ? 1 : 2;
}
function parse(text, mode){
  const out = [], raw = text.replace(/\r/g, "").split("\n");
  if(mode===1){
    let gap = true;
    raw.forEach(r => { const s = cleanLine(r); if(!s){ gap = true; return; }
      const p = splitLine(s), last = out[out.length-1];
      if(p) out.push(p);
      else if(last && !gap && /^[a-zа-яё(,;–—-]/.test(s)) last[1] = (last[1] ? last[1] + " " : "") + s;   // продолжение объяснения (строка с маленькой буквы)
      else out.push([s, ""]);
      gap = false; });
  } else {
    const blocks = [], hasGaps = raw.some((r, i) => !r.trim() && i > 0 && i < raw.length-1);
    if(hasGaps){ let b = []; raw.forEach(r => { const s = cleanLine(r); if(s) b.push(s); else if(b.length){ blocks.push(b); b = []; } }); if(b.length) blocks.push(b);
      blocks.forEach(b => out.push([b[0], b.slice(1).join(" ")])); }
    else { const ls = raw.map(cleanLine).filter(Boolean); for(let i = 0; i < ls.length; i += 2) out.push([ls[i], ls[i+1]||""]); }
  }
  return out.filter(p => p[0]).map(p => [clip(p[0], 200), p[1].replace(/\t/g, " — ").trim().slice(0, 3000)]);
}

const HEAD = /^(термин|понятие|слово|название|вопрос|术语|词)(?=[\s:;,.—–-]|$)/i;   // строка-заголовок таблицы — по умолчанию не отмечаем
let PV = null;   // предпросмотр: {ch, text, mode, rows:[[t, d, on]]}
function pasteSheet(chId, text, ocr){
  const t = TL();
  openSheet(`<h2>${ocr ? t.ocrH : t.pasteH}</h2><p class="muted small">${ocr ? t.ocrHint : t.pasteHint}</p>
    <textarea id="my_p" rows="10" class="mypaste" placeholder="${esc(t.pastePh)}">${esc(text||"")}</textarea>
    <div class="btnrow"><button class="btn" data-myparse="${esc(chId)}">${t.parse}</button></div>`);
}
function doParse(chId){
  const text = $("my_p").value || ""; const mode = guessMode(text), rows = parse(text, mode);
  if(!rows.length){ toast(TL().nothing); return; }
  PV = {ch:chId, text, mode, rows:rows.map(r => [r[0], r[1], !(HEAD.test(r[0]) && r[1].length < 30)])};
  pushSheet(prevSheet);
}
function prevSync(){   // набранное в полях → PV
  if(!PV) return; document.querySelectorAll("[data-myrow]").forEach(el => { const i = +el.dataset.myrow, r = PV.rows[i]; if(!r) return;
    r[0] = el.querySelector(".myrt").value; r[1] = el.querySelector(".myrd").value; r[2] = el.querySelector("input[type=checkbox]").checked; });
}
function prevSheet(){
  const t = TL(); if(!PV) return; const n = PV.rows.filter(r => r[2] && r[0].trim()).length;
  openSheet(`<h2>${t.prevH(PV.rows.length)}</h2><p class="muted small">${t.prevHint}</p>
    <div class="myseg"><button class="${PV.mode===1?"on":""}" data-mymode="1">${t.mode1}</button><button class="${PV.mode===2?"on":""}" data-mymode="2">${t.mode2}</button></div>
    <div class="btnrow"><button class="btn small ghost" data-myswap>${t.swap}</button></div>
    <div class="myprev">${PV.rows.map((r, i) => `<div class="myrow${r[2]?"":" off"}" data-myrow="${i}"><input type="checkbox" ${r[2]?"checked":""} aria-label="✓" data-mychk>
      <div><input class="myrt" value="${esc(r[0])}" aria-label="${esc(t.term)}"><textarea class="myrd" rows="2" aria-label="${esc(t.defn)}">${esc(r[1])}</textarea></div></div>`).join("")}</div>
    <div class="mysticky"><button class="btn wide" data-myaddall ${n?"":"disabled"}>${t.addN(n)}</button></div>`);
}
function addAll(){
  prevSync(); const rows = PV.rows.filter(r => r[2] && r[0].trim()); if(!rows.length) return;
  const recs = rows.map(r => ({id:uid("t"), t:clip(r[0], 200), d:r[1].trim().slice(0, 3000), z:""}));
  const ch = PV.ch; updCh(ch, c => { c.terms = (c.terms||[]).concat(recs); });
  PV = null; closeSheet(); toast(TL().added(recs.length));
}

// из файла: .txt .csv .tsv .docx .xlsx (zip читаем сами — DecompressionStream)
async function unzip(buf){
  const v = new DataView(buf), u8 = new Uint8Array(buf), out = {};
  let e = -1; for(let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) if(v.getUint32(i, true)===0x06054b50){ e = i; break; }
  if(e < 0) throw new Error("zip");
  let p = v.getUint32(e + 16, true); const n = v.getUint16(e + 10, true), dec = new TextDecoder();
  for(let k = 0; k < n; k++){
    const meth = v.getUint16(p + 10, true), csz = v.getUint32(p + 20, true), nl = v.getUint16(p + 28, true), xl = v.getUint16(p + 30, true), cl = v.getUint16(p + 32, true), off = v.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nl)); p += 46 + nl + xl + cl;
    out[name] = async () => { const s = off + 30 + v.getUint16(off + 26, true) + v.getUint16(off + 28, true), data = u8.slice(s, s + csz);
      if(meth===0) return dec.decode(data);
      if(meth!==8) throw new Error("zip method");
      return new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text(); };
  }
  return out;
}
const xml = s => new DOMParser().parseFromString(s, "application/xml");
async function docxText(buf){
  const z = await unzip(buf); if(!z["word/document.xml"]) throw new Error("docx");
  const doc = xml(await z["word/document.xml"]()), body = doc.getElementsByTagName("w:body")[0], lines = [];
  const pText = p => { let s = ""; p.querySelectorAll("*").forEach(n => { if(n.localName==="t") s += n.textContent; else if(n.localName==="tab") s += "\t"; else if(n.localName==="br") s += " "; }); return s; };
  [...(body ? body.children : [])].forEach(el => {
    if(el.localName==="p") lines.push(pText(el));
    else if(el.localName==="tbl") [...el.getElementsByTagName("w:tr")].forEach(tr => {
      const cells = [...tr.children].filter(c => c.localName==="tc").map(tc => [...tc.getElementsByTagName("w:p")].map(pText).join(" ").replace(/\s+/g, " ").trim());
      let f = cells.filter(Boolean); if(f.length > 2 && /^(\d+\.?|№|N|#)$/i.test(f[0])) f = f.slice(1);   // столбец «№» не нужен
      if(f.length) lines.push(f.length===1 ? f[0] : f[0] + "\t" + f.slice(1).join(" — ")); });
  });
  return lines.join("\n");
}
async function xlsxText(buf){
  const z = await unzip(buf), ss = [];
  if(z["xl/sharedStrings.xml"]) [...xml(await z["xl/sharedStrings.xml"]()).getElementsByTagName("si")].forEach(si => ss.push([...si.getElementsByTagName("t")].map(x => x.textContent).join("")));
  const sh = Object.keys(z).filter(k => /^xl\/worksheets\/sheet\d+\.xml$/.test(k)).sort((a, b) => parseInt(a.match(/\d+/)) - parseInt(b.match(/\d+/)))[0]; if(!sh) throw new Error("xlsx");
  const doc = xml(await z[sh]()), rows = [];
  [...doc.getElementsByTagName("row")].forEach(r => { const cells = [];
    [...r.getElementsByTagName("c")].forEach(c => { const ref = c.getAttribute("r")||"", col = ref.replace(/\d+/g, "").split("").reduce((a, ch) => a*26 + ch.charCodeAt(0) - 64, 0) - 1, tp = c.getAttribute("t");
      const vv = c.getElementsByTagName("v")[0], is = c.getElementsByTagName("is")[0];
      const val = tp==="s" ? ss[+(vv && vv.textContent)] || "" : tp==="inlineStr" ? (is ? is.textContent : "") : vv ? vv.textContent : "";
      cells[col >= 0 ? col : cells.length] = val.replace(/\s+/g, " ").trim(); });
    const f = [...cells].map(x => x||"").filter(Boolean); if(f.length) rows.push(f.length===1 ? f[0] : f[0] + "\t" + f.slice(1).join(" — ")); });
  return rows.join("\n");
}
function csvText(s){
  const first = s.split("\n").slice(0, 5).join("\n"), dl = (first.match(/\t/g)||[]).length ? "\t" : (first.match(/;/g)||[]).length >= (first.match(/,/g)||[]).length ? ";" : ",";
  const rows = []; let row = [], cur = "", q = false;
  for(let i = 0; i < s.length; i++){ const ch = s[i];
    if(q){ if(ch==='"'){ if(s[i+1]==='"'){ cur += '"'; i++; } else q = false; } else cur += ch; }
    else if(ch==='"') q = true; else if(ch===dl){ row.push(cur); cur = ""; } else if(ch==="\n"){ row.push(cur); rows.push(row); row = []; cur = ""; } else if(ch!=="\r") cur += ch; }
  row.push(cur); rows.push(row);
  return rows.map(r => r.map(x => x.replace(/\s+/g, " ").trim()).filter(Boolean)).filter(r => r.length).map(r => r.length===1 ? r[0] : r[0] + "\t" + r.slice(1).join(" — ")).join("\n");
}
function decodeText(buf){
  const u = new TextDecoder("utf-8").decode(buf); if(!u.includes("�")) return u.replace(/^﻿/, "");
  try{ return new TextDecoder("windows-1251").decode(buf); }catch(e){ return u; }
}
function fileSheet(chId){
  const t = TL();
  openSheet(`<h2>${t.fileH}</h2><p class="muted small">${t.fileHint}</p>
    <div class="btnrow"><label class="btn">${t.pick}<input type="file" id="my_file" data-mych="${esc(chId)}" accept=".docx,.xlsx,.csv,.tsv,.txt,.md,.doc,.pdf,text/plain,text/csv,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label></div>
    <p id="my_fmsg" class="muted small"></p>`);
}
async function readFile(chId, f){
  const t = TL(), nm = (f.name||"").toLowerCase(), msg = $("my_fmsg");
  if(/\.pdf$/.test(nm)){ if(msg) msg.textContent = t.pdf; return; }
  if(/\.doc$/.test(nm)){ if(msg) msg.textContent = t.oldDoc; return; }
  if(/^image\//.test(f.type)) return runOcr(chId, f);
  if(msg) msg.textContent = t.reading;
  try{ const buf = await f.arrayBuffer(); let text;
    if(/\.docx$/.test(nm)) text = await docxText(buf);
    else if(/\.xlsx$/.test(nm)) text = await xlsxText(buf);
    else if(/\.(csv|tsv)$/.test(nm)) text = csvText(decodeText(buf));
    else text = decodeText(buf);
    if(!text || !text.trim()) throw new Error("empty");
    pushSheet(() => pasteSheet(chId, text.slice(0, 200000)));
  }catch(e){ if(msg) msg.textContent = t.badFile; }
}

// с фото: tesseract.js из vendor/tess (русский; работает на телефоне, фото никуда не отправляется)
function photoSheet(chId){
  const t = TL();
  openSheet(`<h2>${t.photoH}</h2><p class="muted small">${t.photoHint}</p>
    <div class="btnrow"><label class="btn">${t.takePhoto}<input type="file" id="my_ph" data-mych="${esc(chId)}" accept="image/*" hidden></label></div>
    <div id="my_ocr" class="myocr"></div>`);
}
let TESS = null;
const loadJs = src => new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
async function runOcr(chId, file){
  const t = TL(), box = $("my_ocr") || $("my_fmsg"), say = (s, p) => { if(box) box.innerHTML = `<div>${esc(s)}</div>${p!=null ? `<i class="mybar2"><b style="width:${Math.round(p*100)}%"></b></i>` : ""}`; };
  if(typeof WebAssembly!=="object" || !window.Worker){ say(t.ocrOld); return; }
  try{
    say(t.ocrLoad, 0);
    const base = new URL("vendor/tess/", location.href).href;
    if(!window.Tesseract) await loadJs(base + "tesseract.min.js");
    if(!TESS) TESS = await Tesseract.createWorker("rus", 1, {workerPath:base + "worker.min.js", corePath:base + "tesseract-core-simd-lstm.wasm.js", langPath:base.replace(/\/$/, ""), gzip:true,
      logger:m => { if(m.status==="recognizing text") say(t.ocrRun, m.progress); else if(/load/.test(m.status||"")) say(t.ocrLoad, m.progress); }});
    say(t.ocrRun, 0);
    const bmp = await createImageBitmap(file), k = Math.min(1, 2400 / Math.max(bmp.width, bmp.height)), cv = document.createElement("canvas");
    cv.width = Math.round(bmp.width*k); cv.height = Math.round(bmp.height*k); cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
    const r = await TESS.recognize(cv);
    let text = (r && r.data && r.data.text || "").replace(/(\S)[-‐­]\n(\S)/g, "$1$2");   // перенос слова по слогам — склеиваем
    if(!text.trim()){ say(t.ocrNone); return; }
    say("");
    pushSheet(() => pasteSheet(chId, text, true));
  }catch(e){ console.error(e); TESS = null; say(t.ocrFail); }
}

/* ---------- поделиться ---------- */
const payload = c => ({v:1, name:c.name, em:c.em||PIC_DEF, terms:(c.terms||[]).map(w => ({t:w.t, d:w.d||"", z:w.z||""}))});
function hashOf(s){ let h = 5381; for(let i = 0; i < s.length; i++) h = (h*33 ^ s.charCodeAt(i)) >>> 0; return h.toString(36); }
const linkOf = id => siteUrl() + "#mych=" + id + ((x => x ? "&k=" + encodeURIComponent(x) : "")(localStorage.getItem("siteCode")));
async function share(chId){
  const t = TL(), c = chOf(chId); if(!c) return;
  const p = payload(c), h = hashOf(JSON.stringify(p));
  const show = url => openSheet(`<h2>${t.shareH}</h2><p class="muted small">${t.shareHint}</p><div class="mylink">${esc(url)}</div>
    <div class="btnrow"><button class="btn" data-act="copy" data-v="${esc(url)}">${t.copy}</button>${navigator.share ? `<button class="btn ghost" data-myshareurl="${esc(url)}" data-myname="${esc(c.name)}">${t.send}</button>` : ""}</div>`);
  if(c.sh && c.shh===h) return show(linkOf(c.sh));
  openSheet(`<h2>${t.shareH}</h2><div class="loading">${typeof SPIN!=="undefined" ? SPIN : ""} ${t.sharing}</div>`);
  try{ let dev = localStorage.getItem("devId"); if(!dev){ dev = Array.from(crypto.getRandomValues(new Uint8Array(9)), b => b.toString(36)).join(""); localStorage.setItem("devId", dev); }
    const id = await rpc("mych_put", {p_data:p, p_dev:dev}); if(typeof id!=="string" || !/^[A-Za-z0-9_-]{6,24}$/.test(id)) throw new Error("bad");
    const l = list(), x = l.find(y => y.id===chId); if(x){ x.sh = id; x.shh = h; LS.set("myChaps", l); }
    show(linkOf(id));
  }catch(e){ openSheet(`<h2>${t.shareH}</h2><p>${t.shareOff}</p>`); }
}
function linkSheet(){
  const t = TL();
  openSheet(`<h2>${t.linkH}</h2><div class="form"><label><input id="my_l" placeholder="${esc(t.linkPh)}" autocomplete="off"></label></div>
    <div class="btnrow"><button class="btn" data-mylinkgo>${t.open}</button></div>`);
}
async function fetchIn(id){
  const t = TL();
  openSheet(`<h2>${t.inH}</h2><div class="loading">${typeof SPIN!=="undefined" ? SPIN : ""} ${t.loadingCh}</div>`);
  let p = null; try{ p = await rpc("mych_get", {p_id:id}); }catch(e){}
  if(!p || !p.name || !Array.isArray(p.terms)){ openSheet(`<h2>${t.inH}</h2><p>${t.notFound}</p>`); return; }
  const have = list().find(c => c.from===id);
  const sample = p.terms.slice(0, 8).map(w => `<li><b>${esc(w.t)}</b>${w.d ? " — " + esc(clip(w.d, 90)) : ""}</li>`).join("");
  openSheet(`<h2><span class="emi">${emH(isPic(p.em) ? p.em : PIC_DEF)}</span>${esc(p.name)}</h2><p class="muted small">${t.inH} · ${plural(p.terms.length)}</p><ul class="mysample">${sample}${p.terms.length > 8 ? `<li class="muted">${t.more}</li>` : ""}</ul>
    ${have ? `<p class="muted small">${t.inHave}</p><div class="btnrow"><button class="btn" data-myopen="${esc(have.id)}">${t.inOpen}</button></div>`
      : `<div class="btnrow"><button class="btn" data-myinadd="${esc(id)}">${t.inAdd}</button></div>`}`);
  IN = {id, p};
}
let IN = null;
function inAdd(){
  if(!IN) return; const p = IN.p;
  const c = {id:uid("c"), name:clip(p.name, 80), em:isPic(p.em) ? p.em : PIC_DEF, from:IN.id, at:Date.now(),
    terms:p.terms.slice(0, 2000).map(w => ({id:uid("t"), t:clip(w.t, 200), d:String(w.d||"").slice(0, 3000), z:clip(w.z, 300)})).filter(w => w.t)};
  saveList(list().concat([c])); IN = null; toast(TL().inSaved); closeSheet(() => openCh(c.id));
}
// ссылка #mych=<id> (app.js запоминает её в sessionStorage до входа) — открыть, когда Словарь готов
function checkIncoming(){
  const id = sessionStorage.getItem("mychIn"); if(!id) return; sessionStorage.removeItem("mychIn");
  setTimeout(() => pushSheet(() => fetchIn(id)), 300);
}

/* ---------- нажатия ---------- */
document.addEventListener("click", e => {
  const b = e.target.closest("[data-mynew],[data-mylink],[data-mylinkgo],[data-myadd],[data-myshare],[data-myshareurl],[data-mychedit],[data-myem],[data-mychsave],[data-mychdel],[data-myman],[data-mypaste],[data-myfile],[data-myphoto],[data-mytsave],[data-mytdel],[data-myedit],[data-myimgdel],[data-myparse],[data-mymode],[data-myswap],[data-myaddall],[data-myinadd],[data-myopen]");
  if(!b) return; const d = b.dataset;
  if(d.mynew!==undefined) return pushSheet(() => chForm(null));
  if(d.mylink!==undefined) return pushSheet(linkSheet);
  if(d.mylinkgo!==undefined){ const v = ($("my_l").value||"").trim(), m = v.match(/mych=([A-Za-z0-9_-]{6,24})/) || v.match(/^([A-Za-z0-9_-]{6,24})$/); if(!m){ toast(TL().badLink); return; } return pushSheet(() => fetchIn(m[1])); }
  if(d.myadd!==undefined) return pushSheet(() => addMenu(d.myadd));
  if(d.myshare!==undefined) return pushSheet(() => share(d.myshare));
  if(d.myshareurl!==undefined) return navigator.share({title:d.myname, url:d.myshareurl}).catch(() => {});
  if(d.mychedit!==undefined) return pushSheet(() => chForm(d.mychedit));
  if(d.myem!==undefined){ EMSEL = d.myem; document.querySelectorAll("[data-myem]").forEach(x => x.classList.toggle("on", x.dataset.myem===EMSEL)); return; }
  if(d.mychsave!==undefined) return chSave(d.mychsave);
  if(d.mychdel!==undefined){ const c = chOf(d.mychdel); if(!c || !confirm(TL().delQ(c.name))) return;
    (c.terms||[]).forEach(w => { if(IMG[w.id]) delImg(w.id); }); saveList(list().filter(x => x.id!==c.id));
    closeSheet(() => { if(window.GYM && GYM.open) GYM.open("mych", null); }); return; }
  if(d.myman!==undefined){ TD = null; return pushSheet(() => termForm(d.myman, null)); }
  if(d.myedit!==undefined){ const [ch, tid] = d.myedit.split(":"); TD = null; return pushSheet(() => termForm(ch, tid)); }
  if(d.mypaste!==undefined) return pushSheet(() => pasteSheet(d.mypaste, ""));
  if(d.myfile!==undefined) return pushSheet(() => fileSheet(d.myfile));
  if(d.myphoto!==undefined) return pushSheet(() => photoSheet(d.myphoto));
  if(d.mytsave!==undefined) return termSave(d.mytsave==="more");
  if(d.mytdel!==undefined) return termDel(d.mytdel);
  if(d.myimgdel!==undefined){ if(TD){ TD.img = "del"; refreshSheet(); } return; }
  if(d.myparse!==undefined) return doParse(d.myparse);
  if(d.mymode!==undefined){ prevSync(); PV.mode = +d.mymode; const keep = PV.rows; PV.rows = parse(PV.text, PV.mode).map(r => [r[0], r[1], true]); if(!PV.rows.length) PV.rows = keep; refreshSheet(); return; }
  if(d.myswap!==undefined){ prevSync(); PV.rows = PV.rows.map(r => [r[1], r[0], r[2]]); refreshSheet(); return; }
  if(d.myaddall!==undefined) return addAll();
  if(d.myinadd!==undefined) return inAdd();
  if(d.myopen!==undefined){ const id = d.myopen; closeSheet(() => openCh(id)); return; }
});
document.addEventListener("change", e => {
  const el = e.target;
  if(el.id==="my_img" && el.files && el.files[0] && TD){ TD.img = el.files[0]; refreshSheet(); return; }
  if(el.id==="my_file" && el.files && el.files[0]) return readFile(el.dataset.mych, el.files[0]);
  if(el.id==="my_ph" && el.files && el.files[0]) return runOcr(el.dataset.mych, el.files[0]);
  if(el.matches && el.matches("[data-mychk]")){ const row = el.closest(".myrow"); if(row) row.classList.toggle("off", !el.checked);
    const n = [...document.querySelectorAll(".myrow")].filter(r => r.querySelector("[data-mychk]").checked && r.querySelector(".myrt").value.trim()).length, btn = document.querySelector("[data-myaddall]");
    if(btn){ btn.textContent = TL().addN(n); btn.disabled = !n; } }
});

const css = `
.mybar{margin:4px 0 10px;flex-wrap:wrap}
.mylab{font-size:14px;color:var(--muted);margin-top:6px}
.mymeth{display:flex;flex-direction:column;gap:8px;margin-top:6px}
.mymeth button{display:flex;flex-direction:column;align-items:flex-start;gap:2px;padding:14px 16px;border-radius:14px;background:var(--card);box-shadow:var(--shadow);text-align:left;min-height:56px}
.mymeth b{font-size:16.5px} .mymeth small{color:var(--muted);font-size:13.5px}
.mypaste{width:100%;box-sizing:border-box;font:inherit;font-size:15px;padding:10px 12px;border-radius:12px;border:1px solid var(--line,#ccc);background:var(--card);color:var(--text);min-height:180px}
.myseg{display:flex;gap:6px;margin:6px 0;flex-wrap:wrap} .myseg button{flex:1 1 140px;padding:9px 10px;border-radius:12px;background:var(--card);box-shadow:var(--shadow);font-size:13.5px;min-height:44px}
.myseg button.on{background:var(--accent);color:var(--accent-ink,#fff)}
.myprev{display:flex;flex-direction:column;gap:8px;margin:8px 0 70px}
.myrow{display:flex;gap:8px;align-items:flex-start;padding:8px;border-radius:12px;background:var(--card);box-shadow:var(--shadow)}
.myrow>input{width:22px;height:22px;margin:10px 2px 0;flex:none;accent-color:var(--accent)} .myrow>div{flex:1;min-width:0;display:flex;flex-direction:column;gap:4px}
.myrow input.myrt,.myrow textarea{width:100%;box-sizing:border-box;font:inherit;border:1px solid transparent;border-radius:8px;padding:6px 8px;background:color-mix(in srgb,var(--accent) 6%,var(--card));color:var(--text)}
.myrow input.myrt{font-weight:600;font-size:15px} .myrow textarea{font-size:14px;resize:vertical}
.myrow.off{opacity:.45}
.mysticky{position:sticky;bottom:0;padding:10px 0 4px;background:linear-gradient(transparent,var(--bg) 35%)}
.myimg{display:block;max-width:100%;max-height:240px;border-radius:12px;margin:8px 0;object-fit:contain}
.mylink{padding:10px 12px;border-radius:12px;background:var(--card);box-shadow:var(--shadow);word-break:break-all;font-size:13.5px;margin:8px 0}
.mysample{padding-left:18px;margin:8px 0} .mysample li{margin:4px 0;font-size:14.5px}
.myocr{margin-top:10px;font-size:14.5px} .mybar2{display:block;height:6px;border-radius:3px;background:color-mix(in srgb,var(--accent) 18%,transparent);margin-top:8px;overflow:hidden}
.mybar2 b{display:block;height:100%;background:var(--accent);transition:width .2s}
`;
const s = document.createElement("style"); s.textContent = css; document.head.appendChild(s);

window.MYCH = {parts, figs, on:f => LIS.push(f), topicHTML, chHead, checkIncoming, edit:(ch, tid) => { TD = null; pushSheet(() => termForm(ch, tid)); }, T:TL};
})();
