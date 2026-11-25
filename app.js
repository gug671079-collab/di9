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
  const previewSchool = illustratedSchools.find(school => school.id === params.get("preview"));
  const trialEdition = quiz.edition === "trial";
  const pagesTrial = document.documentElement.hasAttribute("data-pages-trial");
  const sessionKey = "mdi:sorting-hat:quiz:1" + (trialEdition ? ":trial" : "") + (previewSchool ? ":preview:" + previewSchool.id : "");
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
  function setCloudIdle(active) {
    if (mascot.dataset.cloudIdle === String(active)) return;
    mascot.dataset.cloudIdle = String(active);
    window.CloudBreeze?.setIdle(mascot,active);
  }
  function stopIdle() {
    clearTimeout(idleTimer);
    if (!mascot) return;
    if (mascot.dataset.cloudIdle === "true") mascot.src = mainFace;
    setCloudIdle(false);
  }
  function restartIdle() {
    stopIdle();
    if (!mascot || closeOpening || document.hidden || motionPreference.matches) return;
    let step = 0;
    function advance() {
      if (!mascot || closeOpening || document.hidden || motionPreference.matches) return stopIdle();
      setCloudIdle(true);
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
      if (value.answers.length > quiz.main.length || !value.answers.every(choice =>
          Number.isInteger(choice) && choice >= 0 && choice < 3)) return null;
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
    document.title = phase === "home" ? title : title + " · " + ({question:"答题",reveal:"分院揭晓",result:"我的分院结果",school:"分院结果",card:"我的学生证"})[phase];
    main.replaceChildren(content);
    mascot = main.querySelector("[data-cloud-mascot]");
    mainFace = mascot?.getAttribute("src");
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
    if (!previewSchool && !trialEdition) window.QuizCounts?.newRun();
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
    closeOpening = opening.play({sheet,rect,editionNav,navTop,target:mascot,onClose(focus) {
      closeOpening = null;
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
  function schoolLink(school, text = school.title) {
    const link = el("a","quiet",text);
    const url = new URL(location.href);
    url.hash = "";
    url.searchParams.set("preview",school.id);
    link.href = url.href;
    return link;
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
    if (q.stemImage) {
      const map = el("div","seat-map");
      const image = new Image(1536,1024);
      image.src = q.stemImage;
      image.alt = "暗房报告厅座位图。讲台在上方，灰色座位已有人，三个蓝色座位可选。";
      map.append(image);
      // Seat centers in the approved 1536 × 1024 illustration.
      [[659,310],[910,687],[1318,461]].forEach(([x,y],i) => {
        const seat = btn("","seat-target",event => choose(i,event));
        seat.setAttribute("aria-label",labels[i]+"："+q.options[i]);
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
  // Local art direction samples. Published verdicts come from the school's reason.
  const sampleVerdicts = {
    "school-01": "明早的汇报，留给睡醒的你。学院的沙发还空着一个位置，刚好够你躺下。",
    "school-05": "从第一道折痕到最后一次试飞，这架飞机都是你自己做的。现在，把它掷出去吧。"
  };
  function rehearsal() {
    return !quiz.ready || location.protocol === "file:" || document.documentElement.hasAttribute("data-portable");
  }
  function selectedSchool() {
    if (previewSchool) return previewSchool;
    if (pagesTrial && quiz.trialOutcomes && session?.phase === "result" && session.answers.length === quiz.main.length) {
      const index = session.answers.reduce((offset, choice) => offset * 3 + choice, 0);
      return quiz.schools[parseInt(quiz.trialOutcomes[index], 36)];
    }
    if (rehearsal() && (session?.phase === "result" || location.hash === "#result" || location.hash === "#card"))
      return illustratedSchools[0];
    if (session?.phase !== "result") return null;
    return quiz.schools.find(school => school.id === session.matchedId);
  }
  function admission(name, text) {
    const section = el("section","admission");
    const intro = el("div","admission-main");
    intro.append(el("h1","admission-name",name));
    if (text) intro.append(el("p","admission-copy",text));
    const tools = el("div","admission-tools");
    section.append(intro,tools);
    return {section,tools};
  }
  async function result(focus = true) {
    const school = selectedSchool();
    if (school) return schoolResult(school,focus);
    if (session?.phase !== "result") return home(focus);
    if (rehearsal()) return schoolResult({title:"试玩完成",reason:"本次试玩已结束。"},focus);

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
    const sample = trialPreview || Boolean(previewSchool) || rehearsal();
    const reason = school.reason || (sample ? sampleVerdicts[school.id] : "");
    const {section,tools} = admission(school.title,reason);
    if (school.face) {
      const hat = art("face-" + school.face);
      hat.className = "admission-hat";
      hat.width = 812;
      hat.height = 729;
      section.querySelector(".admission-main").prepend(hat);
    }
    const actions = el("div","panel-actions");
    const illustrated = illustratedSchools.some(entry => entry.id === school.id);
    if (illustrated) {
      const claim = el("a","action","领取学生证");
      claim.href = trialPreview ? "#preview-card/"+school.id : "#card";
      actions.append(claim);
    } else {
      const status = el("p","hint");
      status.setAttribute("role","status");
      const card = cardActions(school,status);
      actions.append(card.saveCard);
      tools.append(card.preview,status);
    }
    tools.prepend(actions);
    if (sample) {
      tools.append(el("p","school-mode","学院效果预览 · 本次不计入校友人数"));
    } else if (trialEdition) {
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
    if (sample) {
      for (const other of illustratedSchools.filter(entry => entry.id !== school.id)) {
        const link = schoolLink(other,"看"+other.title);
        if (trialPreview) link.href = "#preview-result/"+other.id;
        nav.append(link);
      }
    }
    tools.append(nav);
    mount("school",section,focus);
  }

  function wrapText(ctx,text,width) {
    const lines=[];
    for (const para of text.replace(/\r\n?/g,"\n").split("\n")) {
      let line="";
      for (const ch of para) {
        if (line && ctx.measureText(line+ch).width>width) {lines.push(line);line="";}
        line+=ch;
      }
      lines.push(line);
    }
    return lines;
  }

  async function studentCardPNG(image,reason) {
    await image.decode();
    const canvas=document.createElement("canvas");
    canvas.width=1080;
    const ctx=canvas.getContext("2d");
    const font='500 34px "Microsoft YaHei","PingFang SC",sans-serif';
    ctx.font=font;
    const lines=reason.trim() ? wrapText(ctx,reason,618) : [];
    const extra=Math.max(0,lines.length-3)*47;
    canvas.height=1440+extra;
    // Leave the QR and its entire quiet zone at the original resolution.
    ctx.drawImage(image,0,0);
    if (extra) {
      // Stretch a clean horizontal strip below the entire QR and its caption.
      ctx.drawImage(image,0,1384,1080,1,0,1385,1080,extra);
      ctx.drawImage(image,0,1385,1080,55,0,1385+extra,1080,55);
    }
    if (lines.length) {
      ctx.drawImage(image,82,1206,643,1,82,1207,643,152+extra);
      ctx.fillStyle="#102c73";
      ctx.font=font;
      ctx.textBaseline="top";
      lines.forEach((line,i)=>ctx.fillText(line,91,1215+i*47));
    }
    return canvas.toDataURL("image/png");
  }

  function studentCard(school,focus=true,trialPreview=false) {
    const section=el("section","student-card");
    const heading=el("h1","sr-only",school.title+"学生证");
    const image=schoolImage(school,"card");
    image.className="student-id";
    const panel=el("div","school-tools");
    const status=el("p","school-mode","长按学生证图片也可以保存。");
    status.setAttribute("role","status");
    const actions=el("div","panel-actions");
    const download=el("a","action","保存学生证");
    download.download=school.title+"-学生证.png";
    const back=el("a","quiet","返回分院结果");
    back.href=trialPreview ? "#preview-result/"+school.id : "#result";
    actions.append(download,back);
    panel.append(actions,status);
    section.append(heading,image,panel);
    mount("card",section,focus);
    studentCardPNG(image,school.reason || "").then(url=>{
      image.src=url;
      download.href=url;
      if (school.reason) image.alt=school.title+"学生证。学院判词："+school.reason;
    }).catch(()=>{
      if (!school.reason && image.naturalWidth) {
        download.href=image.src;
        download.download=school.title+"-学生证.webp";
      } else {
        image.hidden=true;
        download.hidden=true;
        status.textContent="学生证图片暂时无法生成。";
        actions.prepend(btn("重试","action",()=>studentCard(school,true,trialPreview)));
      }
    });
  }

  async function drawCard(item) {
    const c=document.createElement("canvas");
    c.width=840;
    const ctx=c.getContext("2d");
    const type='"Microsoft YaHei","PingFang SC",sans-serif';
    const titleFont="900 67px "+type;
    const reasonFont="31px "+type;
    ctx.font=titleFont;
    const titles=wrapText(ctx,item.title || "试玩完成",716);
    ctx.font=reasonFont;
    const reasons=item.reason ? wrapText(ctx,item.reason,716) : [];
    const footerTop=656+titles.length*80+reasons.length*48;
    c.height=footerTop+298;
    ctx.fillStyle="#1046c6";ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle="#d8ecff";ctx.fillRect(36,108,768,430);
    ctx.fillStyle="#c9d910";
    ctx.beginPath();ctx.moveTo(116,142);ctx.lineTo(452,142);ctx.lineTo(574,322);
    ctx.lineTo(452,512);ctx.lineTo(116,512);ctx.closePath();
    ctx.moveTo(191,205);ctx.lineTo(191,449);ctx.lineTo(414,449);ctx.lineTo(498,322);ctx.lineTo(414,205);ctx.closePath();ctx.fill("evenodd");
    const hat=art(item.face ? "face-"+item.face : "idle");
    await hat.decode();
    const scale=Math.min(540/hat.naturalWidth,400/hat.naturalHeight);
    const hw=hat.naturalWidth*scale, hh=hat.naturalHeight*scale;
    ctx.drawImage(hat,425-hw/2,322-hh/2,hw,hh);
    ctx.fillStyle="white";ctx.font="800 37px "+type;ctx.fillText("D&I",50,72);
    ctx.textAlign="right";ctx.font="24px "+type;ctx.fillText("第九届设创双年晚会",788,73);ctx.textAlign="left";
    ctx.fillStyle="#e1f464";ctx.font="700 27px "+type;
    ctx.fillText(item.id ? "我的分院" : "分院结果预览",58,608);
    ctx.fillStyle="white";ctx.font=titleFont;
    titles.forEach((line,i)=>ctx.fillText(line,56,696+i*80));
    ctx.font=reasonFont;
    reasons.forEach((line,i)=>ctx.fillText(line,59,686+titles.length*80+i*48));
    ctx.fillStyle="#9db9ef";ctx.fillRect(57,footerTop,726,2);
    ctx.textAlign="left";ctx.fillStyle="white";ctx.font="700 37px "+type;
    ctx.fillText(title,57,footerTop+131);
    ctx.fillStyle="#e1f464";ctx.font="26px "+type;
    ctx.fillText(item.id ? "扫码参与分院" : "扫码试玩",58,footerTop+179);
    window.QuizQR.draw(ctx,"home",548,footerTop+24,250);
    return c.toDataURL("image/png");
  }
  function cardActions(item,status) {
    const preview=el("details","card-preview");
    const image=el("img","card-original");image.alt="可长按保存的分院结果卡"; image.hidden=true;
    preview.append(el("summary","","查看结果卡原图"),image);
    let drawing;
    async function load() {
      try {
        drawing ??= drawCard(item);
        const url=await drawing;
        image.src=url;image.hidden=false;return url;
      } catch {drawing=null;status.textContent="图片生成失败，可重试或截屏保存。";return null;}
    }
    preview.addEventListener("toggle",() => {if (preview.open) load();});
    const saveCard=btn("保存结果卡","action",async () => {
      saveCard.disabled=true;
      try {
        const url=await load();
        if (!url) return;
        const link=el("a");link.download=(item.title || "分院试玩")+"-结果卡.png";link.href=url;
        document.body.append(link);link.click();link.remove();
        status.textContent="结果卡已生成。";
      } finally {saveCard.disabled=false;}
    });
    return {saveCard,preview};
  }
  function route(focus=true) {
    const hash=location.hash;
    if (trialEdition && hash.startsWith("#preview-")) {
      const [page,id] = hash.split("/");
      const school = illustratedSchools.find(entry => entry.id === id);
      if (school && page === "#preview-result") return schoolResult(school,focus,true);
      if (school && page === "#preview-card") return studentCard(school,focus,true);
    }
    if (hash==="#home") return home(focus);
    if (hash==="#result" && rehearsal()) return result(focus);
    if (hash==="#card") {
      const school = selectedSchool();
      if (school && illustratedSchools.some(entry => entry.id === school.id)) return studentCard(school,focus);
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
