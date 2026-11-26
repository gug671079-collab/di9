"use strict";
(() => {
  const quiz = window.CloudQuiz;
  const main = document.getElementById("main");
  const pictures = document.getElementById("cloud-art").content;
  const schoolFaces = document.getElementById("school-faces").content;
  const labels = ["A", "B", "C"];
  const schoolArt = document.getElementById("school-art").content;
  const illustratedSchools = quiz.schools.filter(school =>
    school.id && Array.from(schoolArt.querySelectorAll('[data-kind="card"]')).some(img => img.dataset.school === school.id));
  const params = new URLSearchParams(location.search);
  const liveCounts = document.documentElement.hasAttribute("data-live-counts");
  const previewSchools = quiz.schools.filter(school => school.poster || illustratedSchools.includes(school));
  const previewSchool = previewSchools.find(school => school.id === params.get("preview"));
  const trialEdition = quiz.edition === "trial";
  const pagesTrial = document.documentElement.hasAttribute("data-pages-trial");
  const editionKey = liveCounts ? ":event" : trialEdition ? ":trial" : "";
  const sessionKey = "mdi:sorting-hat:quiz:1" + editionKey + (previewSchool ? ":preview:" + previewSchool.id : "");
  const reviewKey = quiz.edition ? "mdi:local-review:" + sessionKey : null;
  const title = "设创分院帽";
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  let session = resume();
  let view;
  let pendingMatch;
  let closeOpening = null;
  const idlePoses = ["face-19","face-37","face-44"];
  const restTime = 5000;
  let idleFrames;
  let idleTimer;
  let mascot = null;
  let mainFace;

  function el(tag, cls, text) {
    const x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = text;
    return x;
  }
  function btn(text, cls, fn) {
    const x = el("button", cls, text);
    x.type = "button";
    x.addEventListener("click", fn);
    return x;
  }
  function art(pose, alt = "") {
    const selector = '[data-pose="' + pose + '"]';
    const ref = pictures.querySelector(selector) || schoolFaces.querySelector(selector);
    const x = new Image();
    x.alt = alt;
    x.src = location.protocol === "file:" && ref.dataset.fileSrc ? ref.dataset.fileSrc : ref.getAttribute("src");
    return x;
  }
  function stopIdle() {
    clearTimeout(idleTimer);
    if (mascot && mascot.getAttribute("src") !== mainFace) mascot.src = mainFace;
  }
  function restartIdle() {
    stopIdle();
    if (!mascot || closeOpening || document.hidden || motionPreference.matches) return;
    let step = 0;
    function advance() {
      if (!mascot || closeOpening || document.hidden || motionPreference.matches) return stopIdle();
      const isAlternate = step % 2 === 0;
      const frame = idleFrames[Math.floor(step / 2)];
      mascot.src = isAlternate && frame.ready ? frame.image.src : mainFace;
      step = (step + 1) % (idleFrames.length * 2);
      idleTimer = setTimeout(advance,isAlternate ? 2000 : restTime);
    }
    if (idleFrames) {
      idleTimer = setTimeout(advance,restTime);
    } else {
      // Let the cover transition finish before decoding the three idle expressions.
      idleTimer = setTimeout(() => {
        idleFrames = idlePoses.map(pose => {
          const frame = {image:art(pose), ready:false};
          frame.image.decode().then(() => { frame.ready = true; }).catch(() => {});
          return frame;
        });
        idleTimer = setTimeout(advance,restTime / 2);
      },restTime / 2);
    }
  }
  function resume() {
    try {
      const saved = sessionStorage.getItem(sessionKey) || (reviewKey && localStorage.getItem(reviewKey));
      const value = JSON.parse(saved);
      if (!value || value.revision !== quiz.revision || !Array.isArray(value.answers)) return null;
      if (value.answers.length > quiz.main.length || !value.answers.every((choice,i) =>
          Number.isInteger(choice) && choice >= 0 && choice < quiz.main[i].options.length)) return null;
      if (!["question", "reveal", "result"].includes(value.phase) ||
          !Number.isInteger(value.index) || value.index < 0 || value.index >= quiz.main.length ||
          value.index > value.answers.length || (value.phase !== "question" && value.answers.length !== quiz.main.length)) return null;
      return value;
    } catch { return null; }
  }
  function save() {
    const value = JSON.stringify(session);
    try { sessionStorage.setItem(sessionKey,value); } catch { /* Storage may be unavailable. */ }
    if (reviewKey) {
      try { localStorage.setItem(reviewKey,value); } catch { /* The current tab can still be used. */ }
    }
  }
  function mount(phase, content, focus = true) {
    closeOpening?.(false);
    pendingMatch?.abort();
    pendingMatch = null;
    stopIdle();
    view = phase;
    document.body.dataset.screen = phase;
    document.title = phase === "home" ? title : title + " · " + ({question:"答题",reveal:"分院揭晓",result:"我的分院结果",school:"我的学生证"})[phase];
    main.replaceChildren(content);
    mascot = main.querySelector("[data-cloud-mascot]");
    mainFace = mascot?.getAttribute("src");
    window.CloudBreeze?.setTarget(mascot);
    restartIdle();
    window.scrollTo(0,0);
    if (focus) {
      const h = main.querySelector("h1");
      h.tabIndex = -1;
      h.focus({preventScroll:true});
    }
  }
  function enterPlay() {
    if (view === "home") {
      history.replaceState(null,"","#home");
      history.pushState(null,"","#play");
    } else {
      history.replaceState(null,"","#play");
    }
  }
  function start(focus = true) {
    if (!params.has("preview") && (liveCounts || !trialEdition)) window.QuizCounts?.newRun();
    enterPlay();
    session = {revision:quiz.revision, answers:[], index:0, phase:"question"};
    save();
    question(focus);
  }
  function startFromCover() {
    if (view !== "home" || closeOpening) return;
    const opening = window.CloudOpening;
    if (motionPreference.matches || !opening?.supported) return start();
    const sheet = main.querySelector(".poster-sheet");
    const rect = sheet.getBoundingClientRect();
    const editionNav = document.querySelector(".edition-nav");
    const navTop = editionNav?.getBoundingClientRect().top;
    start(false);
    stopIdle();
    window.CloudBreeze?.setTarget(null);
    closeOpening = opening.play({sheet,rect,editionNav,navTop,target:mascot,onClose(focus) {
      closeOpening = null;
      if (view === "question") window.CloudBreeze?.setTarget(mascot);
      if (focus && view === "question") {
        const heading = main.querySelector("h1");
        heading.tabIndex = -1;
        heading.focus({preventScroll:true});
        restartIdle();
      }
    }});
  }
  function continueRun(focus = true) {
    if (!session) return home(focus);
    if (session.phase === "result") return result(focus);
    if (session.phase === "reveal") return finish(focus);
    question(focus);
  }
  function home(focus = true) {
    const section = el("section","landing");
    const sheet = el("div","poster-sheet");
    const mark = el("h1","wordmark");
    mark.append(el("span","sr-only",title),document.getElementById("cover-poster").content.cloneNode(true));
    const description = el("p","sr-only","同济大学设计创意学院 · 12.22 双年晚会。嗲人专属分院帽！来测测你会被分到哪个学院！");
    const actions = el("div","home-actions" + (session ? " returning" : ""));
    if (session && session.phase !== "result") {
      actions.append(btn("重新开始","quiet",startFromCover),btn("继续分院","resume-play",() => {
        enterPlay(); continueRun();
      }));
    } else {
      if (session) actions.append(btn("查看上次结果","quiet",() => {
        history.replaceState(null,"","#result"); result();
      }));
      const label = quiz.ready ? "开始分院" : "开始试玩";
      if (session) actions.append(btn(label,"resume-play",startFromCover));
      else {
        const play = btn("","home-play",startFromCover);
        play.setAttribute("aria-label",label);
        if (quiz.ready) play.append(el("span","home-label",label + " →"));
        actions.append(play);
      }
    }
    sheet.append(mark,description,actions);
    section.append(sheet);
    mount("home",section,focus);
    if (!motionPreference.matches && window.CloudOpening?.supported) window.CloudOpening.prepare();
  }
  function question(focus = true, lastTap = null) {
    session.phase = "question";
    const n = session.index;
    const q = quiz.main[n];
    const section = el("section","flow");
    const hat = art("idle");
    hat.className = "flow-hat";
    hat.width = 812;
    hat.height = 729;
    hat.dataset.cloudMascot = "";
    const panel = el("div","question-panel");
    const progress = el("progress","progress");
    progress.max = quiz.main.length; progress.value = n+1;
    progress.setAttribute("aria-label","答题进度");
    progress.setAttribute("aria-valuetext",`第 ${n+1} 题，共 ${quiz.main.length} 题`);
    const hasCopy = q.text.trim() && q.options.every(option => option.trim());
    const heading = el("h1","",hasCopy ? q.text : "题目待填");
    heading.id="prompt";
    const choices = el("div","scale");
    choices.setAttribute("role","group");
    choices.setAttribute("aria-labelledby","prompt");
    function choose(i,event) {
      if (!section.isConnected) return;
      // The second tap of a double-tap can land on the newly mounted question.
      const tap = event.detail > 0 ? {x:event.clientX, y:event.clientY, time:event.timeStamp} : null;
      if (tap && lastTap && tap.time-lastTap.time < 350 &&
          Math.hypot(tap.x-lastTap.x,tap.y-lastTap.y) < 16) return;
      delete session.matchedId;
      session.answers[n]=i;
      if (n === quiz.main.length-1) return finish();
      session.index++;save();question(true,tap);
    }
    const header = el("div","question-progress");
    header.append(progress);
    if (trialEdition && illustratedSchools.length) {
      header.append(btn("直达最终页","quiet preview-final",() => {
        location.hash = "#preview-result/" + (previewSchool || illustratedSchools[0]).id;
      }));
    }
    panel.append(header,heading);
    if (q.stemImage || q.optionImages?.length) {
      panel.append(el("p","question-image-tip","图片没加载出来请稍等"));
    }
    if (q.stemImage) {
      choices.classList.add("seat-choices");
      const map = el("div","seat-map");
      const image = new Image(1536,1024);
      image.src = q.stemImage;
      image.alt = "暗房报告厅座位图。讲台在上方，灰色座位已有人，三个蓝色座位可选。";
      map.append(image);
      // Seat centers in the approved 1536 × 1024 illustration.
      [[659,310],[910,687],[1318,461]].forEach(([x,y],i) => {
        const seat = btn("","seat-target",event => choose(i,event));
        seat.setAttribute("aria-label",labels[i]);
        seat.style.left = (x/1536*100)+"%";
        seat.style.top = (y/1024*100)+"%";
        map.append(seat);
      });
      panel.append(map);
    }
    if (q.optionImages) {
      choices.classList.add("image-options");
      if (q.optionLayout === "charts") choices.classList.add("chart-options");
    }
    q.options.forEach((option,i) => {
      const choice = btn("","answer",event => choose(i,event));
      choice.setAttribute("aria-pressed",String(session.answers[n]===i));
      if (q.optionImages) {
        const image = new Image();
        image.src = q.optionImages[i];
        image.alt = labels[i]+"："+option;
        choice.append(image);
      } else if (q.stemImage) {
        choice.textContent = labels[i];
      } else {
        choice.append(el("b","letter",labels[i]),el("span","",hasCopy ? option : "选项 "+labels[i]));
      }
      choices.append(choice);
    });
    const actions = el("div","panel-actions");
    actions.append(btn(n===0 ? "返回首页" : "上一题","quiet",() => {
      if (n===0) return home();
      session.index--;save();question();
    }));
    panel.append(choices,actions);
    section.append(hat,panel);
    mount("question",section,focus);
  }
  function finish(focus = true) {
    session.phase="result";
    history.replaceState(null,"","#result");
    save();result(focus);
  }
  motionPreference.addEventListener("change",() => {
    if (motionPreference.matches) closeOpening?.();
    restartIdle();
  });
  for (const event of ["pointerdown","pointermove","keydown","wheel","scroll"]) {
    document.addEventListener(event,restartIdle,{passive:true,capture:true});
  }
  document.addEventListener("visibilitychange",restartIdle);
  window.addEventListener("pagehide",stopIdle);
  window.addEventListener("pageshow",restartIdle);
  function rehearsal() {
    return !quiz.ready || location.protocol === "file:" || document.documentElement.hasAttribute("data-portable");
  }
  function selectedSchool() {
    if (previewSchool) return previewSchool;
    if (pagesTrial && quiz.trialOutcomes && session?.phase === "result" && session.answers.length === quiz.main.length) {
      const index = session.answers.reduce((offset, choice, i) => offset * quiz.main[i].options.length + choice, 0);
      return quiz.schools[parseInt(quiz.trialOutcomes[index], 36)];
    }
    if (rehearsal() && (session?.phase === "result" || location.hash === "#result" || location.hash === "#card"))
      return illustratedSchools[0];
    if (session?.phase !== "result") return null;
    return quiz.schools.find(school => school.id === session.matchedId);
  }
  function schoolTitleParts(name) {
    const suffix = name.match(/（[^（）]+）$/u);
    return suffix ? [name.slice(0,suffix.index),suffix[0]] : [name,""];
  }
  function admission(name, text) {
    const section = el("section","admission");
    const intro = el("div","admission-main");
    const [mainName,qualifier] = schoolTitleParts(name);
    const heading = el("h1","admission-name",mainName);
    if (qualifier) heading.append(el("span","admission-qualifier",qualifier));
    intro.append(heading);
    if (text) intro.append(el("p","admission-copy",text));
    const tools = el("div","admission-tools");
    section.append(intro,tools);
    return {section,tools};
  }
  async function result(focus = true) {
    const school = selectedSchool();
    if (school) return schoolResult(school,focus);
    if (session?.phase !== "result") return home(focus);
    if (rehearsal()) return schoolResult({title:"试玩完成"},focus);

    const loading = admission("正在分院","");
    mount("result",loading.section,focus);
    const controller = new AbortController();
    pendingMatch = controller;
    const timeout = setTimeout(() => controller.abort(),10000);
    try {
      const base = document.documentElement.dataset.resultsApi || location.href;
      const endpoint = new URL("/api/match",base);
      if (trialEdition) endpoint.searchParams.set("edition","trial");
      const response = await fetch(endpoint,{
        method:"POST",headers:{"Content-Type":"application/json"},credentials:"omit",
        body:JSON.stringify({answers:session.answers,bankRevision:quiz.revision}),signal:controller.signal
      });
      if (!response.ok) throw new Error(response.status === 409 ? "revision" : "unavailable");
      const data = await response.json();
      const matched = quiz.schools.find(entry => entry.id === data.id);
      if (!matched) throw new Error("unavailable");
      if (!loading.section.isConnected) return;
      session.matchedId = matched.id;
      save();
      schoolResult(matched,focus);
    } catch (error) {
      if (!loading.section.isConnected) return;
      const changed = error.message === "revision";
      const status = admission("分院结果待揭晓",changed ? "题库已更新，请刷新后重新答题。" : "暂时没有收到分院结果，你的答案已保留。");
      status.tools.append(changed ? btn("刷新页面","action",() => location.reload()) : btn("再试一次","action",() => result()));
      mount("result",status.section,focus);
    } finally { clearTimeout(timeout); }
  }
  function schoolImage(school,kind) {
    const original=schoolArt.querySelector('[data-school="'+school.id+'"][data-kind="'+kind+'"]');
    const image=new Image();
    image.alt=original.alt;
    image.src=original.getAttribute("src");
    return image;
  }

  function schoolResult(school,focus,trialPreview = false) {
    const sample = trialPreview || params.has("preview") || rehearsal();
    const {section,tools} = admission(school.title);
    section.classList.add("student-id-result");
    section.querySelector("h1").classList.add("sr-only");
    const image = el("img","student-id student-id-art");
    image.alt = school.title + "学生证";
    const verdict = school.verdict;
    if (verdict) {
      image.alt += "。" + verdict.text;
      if (verdict.author) image.alt += " ——" + verdict.author;
    }
    image.hidden = true;
    section.querySelector(".admission-main").append(image);
    const actions = el("div","panel-actions");
    const status = el("p","hint");
    status.setAttribute("role","status");
    const download = el("a","action","保存我的学生证");
    download.download = school.title + "-学生证.png";
    async function loadStudentID() {
      actions.replaceChildren();
      status.textContent = "正在生成学生证…";
      try {
        const url = await drawCard(school);
        image.src = url;
        image.hidden = false;
        download.href = url;
        actions.append(download);
        status.textContent = "";
      } catch {
        status.textContent = "学生证暂时未能生成。";
        actions.append(btn("重新生成学生证","action",loadStudentID));
      }
    }
    tools.append(actions,status);
    if (sample) {
      tools.append(el("p","school-mode","学院效果预览 · 本次不计入院友人数"));
    } else if (trialEdition && !liveCounts) {
      tools.append(el("p","school-mode",pagesTrial ? "公开试玩 · 本次不计入校友人数" : "本地试填 · 本次不计入校友人数"));
    } else {
      const peers = el("div","alumni");
      tools.append(peers);
      window.QuizCounts?.attach(peers,school,session.answers);
    }
    const nav = el("div","school-links");
    if (session?.phase === "result") {
      nav.append(btn("修改答案","quiet",() => {
        history.replaceState(null,"","#play");
        session.index=quiz.main.length-1;session.phase="question";save();question();
      }));
    }
    if (previewSchool || !session || session.phase === "question") {
      nav.append(btn(session?.phase === "question" ? "继续答题" : "从第一题试玩","quiet",() => {
        if (session?.phase === "question") { enterPlay(); continueRun(); }
        else start();
      }));
    } else nav.append(btn("再测一次","quiet",start));
    tools.append(nav);
    mount("school",section,focus);
    loadStudentID();
  }

  async function studentCardPNG(image) {
    await image.decode();
    const canvas=document.createElement("canvas");
    canvas.width=image.naturalWidth;
    canvas.height=image.naturalHeight;
    const ctx=canvas.getContext("2d");
    ctx.drawImage(image,0,0);
    // Both original illustrations have a printed verdict label and rules left of the QR.
    // Restore the paper in that rectangle using its clean adjacent strip.
    ctx.drawImage(image,730,1148,20,205,82,1148,643,205);
    return canvas.toDataURL("image/png");
  }

  function cardTextLines(ctx, text, maxWidth) {
    const lines = [];
    let line = "";
    // Prefer a break between clauses. Keep closing punctuation with its character.
    const clauses = text.match(/[^，。！？；：、]+[，。！？；：、]*|./gu) || [];
    for (const clause of clauses) {
      const parts = ctx.measureText(clause).width <= maxWidth ? [clause] : clause.match(/.[，。！？；：、]*/gu);
      for (const part of parts) {
        if (line && ctx.measureText(line + part).width > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += part;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  async function drawCard(item) {
    if (!item.poster && illustratedSchools.some(school => school.id === item.id)) {
      return studentCardPNG(schoolImage(item, "card"));
    }

    const face = art(item.face ? "face-" + item.face : "idle");
    const picture = item.poster ? new Image() : face;
    if (item.poster) picture.src = item.poster;
    await Promise.all([picture.decode(), face.decode()]);

    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1440;
    const ctx = canvas.getContext("2d");
    const ink = "#123480";
    const paper = "#fffbee";
    const lime = "#e6f426";
    const sans = '"Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", sans-serif';
    const [schoolName, qualifier] = schoolTitleParts(item.title || "试玩完成");

    ctx.fillStyle = "#143fbe";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.beginPath();
    ctx.moveTo(32, 32);
    ctx.lineTo(1012, 32);
    ctx.lineTo(1048, 68);
    ctx.lineTo(1048, 1372);
    ctx.lineTo(1012, 1408);
    ctx.lineTo(32, 1408);
    ctx.closePath();
    ctx.fillStyle = paper;
    ctx.fill();

    ctx.save();
    ctx.clip();
    ctx.fillStyle = lime;
    ctx.fillRect(32, 32, 1016, 166);
    ctx.fillStyle = ink;
    ctx.fillRect(32, 195, 1016, 3);
    ctx.font = "italic 900 92px Arial, sans-serif";
    ctx.fillText("D&I", 60, 126);
    ctx.font = "bold 27px " + sans;
    ctx.fillText("第九届设创双年晚会", 65, 170);
    ctx.textAlign = "right";
    ctx.font = "900 74px " + sans;
    ctx.fillText("学生证", 1015, 122);
    ctx.font = "bold 30px Arial, sans-serif";
    ctx.fillText("STUDENT ID", 1015, 169);
    ctx.restore();

    ctx.fillStyle = ink;
    ctx.font = "bold 26px " + sans;
    ctx.fillText("所属学院", 60, 248);
    ctx.save();
    ctx.translate(56, qualifier ? 337 : 365);
    ctx.transform(1, 0, -0.10, 1, 0, 0);
    ctx.font = "900 105px " + sans;
    ctx.fillText(schoolName, 0, 0, 945);
    ctx.restore();
    if (qualifier) {
      ctx.font = "bold 33px " + sans;
      ctx.fillText(qualifier, 60, 385);
    }

    const scale = Math.min(960 / picture.naturalWidth, 700 / picture.naturalHeight);
    const width = picture.naturalWidth * scale;
    const height = picture.naturalHeight * scale;
    ctx.drawImage(picture, 540 - width / 2, 758 - height / 2, width, height);

    ctx.fillStyle = ink;
    ctx.fillRect(60, 1144, 960, 3);
    // The academy seal uses its assigned cloud expression.
    ctx.beginPath();
    ctx.arc(104, 1268, 44, 0, 2 * Math.PI);
    ctx.strokeStyle = ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(104, 1268, 37, 0, 2 * Math.PI);
    ctx.fillStyle = ink;
    ctx.fill();
    const faceScale = Math.min(66 / face.naturalWidth, 60 / face.naturalHeight);
    const faceWidth = face.naturalWidth * faceScale;
    const faceHeight = face.naturalHeight * faceScale;
    ctx.drawImage(face, 104 - faceWidth / 2, 1268 - faceHeight / 2, faceWidth, faceHeight);
    ctx.fillStyle = ink;
    if (item.verdict) {
      const left = 158, width = 492, lineHeight = 49;
      ctx.font = "700 37px " + sans;
      const text = item.verdict.text;
      const lines = ctx.measureText(text).width <= width * 1.08 ? [text] : cardTextLines(ctx, text, width);
      const author = item.verdict.author;
      const firstBaseline = 1281 - ((lines.length - 1) * lineHeight + (author ? 45 : 0)) / 2;
      lines.forEach((line, index) => ctx.fillText(line, left, firstBaseline + index * lineHeight, width));
      if (author) {
        ctx.font = "500 30px " + sans;
        ctx.fillText("——" + author, left, firstBaseline + (lines.length - 1) * lineHeight + 45, width);
      }
    } else {
      ctx.font = "bold 42px " + sans;
      ctx.fillText(title, 168, 1281);
    }
    window.QuizQR.draw(ctx, "nice", 670, 1199, 147);
    window.QuizQR.draw(ctx, "home", 860, 1198, 148);
    ctx.textAlign = "center";
    ctx.font = "bold 21px " + sans;
    ctx.fillText("NICE老师欢迎投票！", 744, 1378);
    ctx.fillText("扫码参与分院", 934, 1378);
    return canvas.toDataURL("image/png");
  }
  function route(focus=true) {
    const hash=location.hash;
    if (trialEdition && hash.startsWith("#preview-")) {
      const [page,id] = hash.split("/");
      const school = previewSchools.find(entry => entry.id === id);
      if (school && (page === "#preview-result" || page === "#preview-card")) return schoolResult(school,focus,true);
      return home(focus);
    }
    if (hash==="#home") return home(focus);
    if (hash==="#result" && rehearsal()) return result(focus);
    if (hash==="#card") {
      const school = selectedSchool();
      if (school) return schoolResult(school,focus);
    }
    if (previewSchool) {
      if (hash==="#play") {
        if (!session || session.phase==="result") return start();
        return continueRun(focus);
      }
      return result(focus);
    }
    continueRun(focus);
  }
  document.querySelector(".monogram").addEventListener("click",event => {
    event.preventDefault();
    history.replaceState(null,"","#home");
    home();
  });
  window.addEventListener("hashchange",()=>route());
  if (quiz.edition && !pagesTrial) {
    const nav = el("nav","edition-nav");
    nav.setAttribute("aria-label","本地题库版本");
    const other = new URL(location.pathname,location.origin);
    other.searchParams.set("edition",trialEdition ? "original" : "trial");
    const link = el("a","",trialEdition ? "切回原稿" : "打开试填版");
    link.href = other.href;
    nav.append(el("span","",trialEdition ? "本地试填版" : "本地原稿"),link);
    document.querySelector(".shell").after(nav);
  }
  route(false);
})();
