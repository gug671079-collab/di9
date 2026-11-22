"use strict";
(() => {
  const quiz = window.CloudQuiz;
  const main = document.getElementById("main");
  const pictures = document.getElementById("cloud-art").content;
  const labels = ["A", "B", "C"];
  const levelNames = {low:"低", mid:"中", high:"高"};
  const sessionKey = "mdi:sorting-hat:quiz:1";
  // Earlier preview URLs keep their original title; the default uses the working IP name.
  const themes = {
    live: ["快乐云", "上线"], which: ["今天", "哪朵云？"], match: ["云上", "对个号"]
  };
  const requested = new URLSearchParams(location.search).get("theme");
  const theme = Object.hasOwn(themes, requested) ? requested : null;
  const nameLines = theme ? themes[theme] : ["云朵", "分院帽"];
  const title = nameLines.join("");
  const titlePicker = document.createElement("details");
  if (!quiz.ready) {
    titlePicker.className="title-picker";
    titlePicker.append(el("summary","","切换首页标题"));
    const nav=el("nav");
    nav.setAttribute("aria-label","首页标题方案");
    for (const [id,lines] of Object.entries({home:["云朵","分院帽"],...themes})) {
      const link=el("a","",lines.join(""));
      const url=new URL(location.href);
      if (id==="home") url.searchParams.delete("theme");
      else url.searchParams.set("theme",id);
      url.hash="home";
      link.href=url.href;
      if (id===(theme || "home")) link.setAttribute("aria-current","page");
      nav.append(link);
    }
    titlePicker.append(nav);
    document.querySelector("footer").lastElementChild.replaceWith(titlePicker);
  }
  document.documentElement.dataset.theme = theme || "live";
  const motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  let session = resume();
  let view;
  let timer = 0;

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
    const ref = pictures.querySelector('[data-pose="' + pose + '"]');
    const x = new Image();
    x.alt = alt;
    x.src = location.protocol === "file:" && ref.dataset.fileSrc ? ref.dataset.fileSrc : ref.getAttribute("src");
    return x;
  }
  function resume() {
    try {
      const value = JSON.parse(sessionStorage.getItem(sessionKey));
      if (!value || value.revision !== quiz.revision || !Array.isArray(value.answers)) return null;
      const state = quiz.getState(value.answers);
      if (!["question", "reveal", "result"].includes(value.phase) ||
          !Number.isInteger(value.index) || value.index < 0 || value.index >= quiz.main.length ||
          value.index > value.answers.length || (value.phase !== "question" && !state.completed)) return null;
      return value;
    } catch { return null; }
  }
  function save() {
    try { sessionStorage.setItem(sessionKey, JSON.stringify(session)); } catch { /* Private browsing can disable storage. */ }
  }
  function mount(phase, content, focus = true) {
    clearTimeout(timer);
    view = phase;
    document.body.dataset.screen = phase;
    titlePicker.hidden=phase!=="home";
    titlePicker.open=false;
    document.title = title + " · " + ({home:"设创双年晚会",question:"答题",reveal:"分院揭晓",result:"我的分院结果"})[phase];
    main.replaceChildren(content);
    window.scrollTo(0,0);
    if (focus) {
      const h = main.querySelector("h1");
      h.tabIndex = -1;
      h.focus({preventScroll:true});
    }
  }
  function start() {
    window.QuizCounts?.newRun();
    session = {revision:quiz.revision, answers:[], index:0, phase:"question"};
    save();
    question();
  }
  function continueRun(focus = true) {
    if (!session) return home(focus);
    if (session.phase === "result") return result(focus);
    if (session.phase === "reveal") return reveal(focus);
    question(focus);
  }
  function home(focus = true) {
    const section = el("section","landing");
    const copy = el("div","hero-copy");
    const mark = el("h1","wordmark");
    mark.setAttribute("aria-label",title);
    for (const line of nameLines) mark.append(el("span","",line));
    copy.append(el("p","home-kicker","设创生活测试"),mark,
      el("p","home-summary","3 个模块　/　18 道三选一"));
    const actions = el("div","home-actions");
    if (session && session.phase !== "result") {
      actions.append(btn("继续分院","action",() => continueRun()),btn("重新开始","quiet",start));
    } else {
      actions.append(btn(quiz.ready ? "开始分院" : "开始试玩","action",start));
      if (session) actions.append(btn("查看上次结果","quiet",() => result()));
    }
    copy.append(actions);
    const visual = el("div","hero-art");
    visual.append(art("idle","笑着扬起帽檐的云朵分院帽"));
    const modules = el("ol","module-strip");
    modules.setAttribute("aria-label","测试模块");
    for (const [i,m] of quiz.modules.entries()) {
      const li=el("li");
      li.append(el("b","",String(i+1).padStart(2,"0")),el("span","",m.label));
      modules.append(li);
    }
    section.append(copy,visual,modules);
    mount("home",section,focus);
  }
  function question(focus = true, lastTap = null) {
    session.phase = "question";
    const n = session.index;
    const q = quiz.main[n];
    const axis = quiz.axes[q.axis];
    const module = quiz.modules.find(m=>m.id === q.module);
    const section = el("section","flow");
    const aside = el("aside","flow-aside");
    aside.append(art("idle"),el("p","aside-title",module.label));
    const list = el("ol","module-nav");
    list.setAttribute("aria-label","模块进度");
    for (const [i,m] of quiz.modules.entries()) {
      const li=el("li","",String(i+1).padStart(2,"0")+"　"+m.label);
      if (m.id === module.id) {li.className="current";li.setAttribute("aria-current","step");}
      list.append(li);
    }
    aside.append(list);
    const panel = el("div","question-panel");
    const step = el("div","step");
    step.append(el("span","",module.label),el("span","","第 "+(n+1)+" / "+quiz.main.length+" 题"));
    const progress = el("progress","progress");
    progress.max = quiz.main.length; progress.value = n+1;
    progress.setAttribute("aria-label","答题进度");
    const dimension = el("p","dimension",q.text ? axis.label : "题干待填");
    const heading = el("h1","",q.text || axis.label);
    heading.id="prompt";
    const choices = el("div","scale");
    choices.setAttribute("role","group");
    choices.setAttribute("aria-labelledby","prompt");
    q.options.forEach((option,i) => {
      const choice = btn("","answer",event => {
        if (!section.isConnected) return;
        // The second tap of a double-tap can land on the newly mounted question.
        const tap = event.detail > 0 ? {x:event.clientX, y:event.clientY, time:event.timeStamp} : null;
        if (tap && lastTap && tap.time-lastTap.time < 350 &&
            Math.hypot(tap.x-lastTap.x,tap.y-lastTap.y) < 16) return;
        session.answers[n]=i;
        if (n === quiz.main.length-1) {
          session.phase="reveal";save();reveal();
        } else {
          session.index++;save();question(true,tap);
        }
      });
      choice.setAttribute("aria-pressed",String(session.answers[n]===i));
      choice.append(el("b","letter",labels[i]),el("span","",option || "选项 "+labels[i]));
      choices.append(choice);
    });
    const actions = el("div","panel-actions");
    actions.append(btn(n===0 ? "返回首页" : "上一题","quiet",() => {
      if (n===0) return home();
      session.index--;save();question();
    }));
    panel.append(step,progress,dimension,heading,choices,actions);
    section.append(aside,panel);
    mount("question",section,focus);
  }
  function reveal(focus = true) {
    if (motionPreference.matches) return finish(focus);
    const section = el("section","reveal-screen");
    const stage = el("div","stage");
    const hat = art("reveal","云朵分院帽变成 D，再回到云朵");
    stage.append(hat);
    const heading = el("h1","","分院揭晓");
    section.append(stage,heading,btn("直接看结果","quiet",() => finish()));
    mount("reveal",section,focus);
    const proceed = () => {
      if (view==="reveal" && section.isConnected) finish();
    };
    // Start the clock after the animated asset has decoded, including on slow connections.
    timer = setTimeout(proceed,7000);
    hat.decode().then(() => {
      if (!section.isConnected) return;
      clearTimeout(timer);timer=setTimeout(proceed,4400);
    }).catch(proceed);
  }
  function finish(focus = true) {
    session.phase="result";
    save();result(focus);
  }
  motionPreference.addEventListener("change",() => {
    if (view==="reveal" && motionPreference.matches) finish();
  });
  function result(focus = true) {
    const item = quiz.getState(session.answers).result;
    const section = el("section","result-screen");
    const head=el("div","result-head");
    const block=el("div","result-copy");
    block.append(el("p","home-kicker",item.id ? "你被分到了" : "分院结果预览"),
      el("h1","",item.title || "我的试玩结果"));
    if (item.reason) block.append(el("p","reason",item.reason));
    const figure=el("div","result-art");figure.append(art("idle"));
    head.append(block,figure);
    const panel=el("div","result-panel");
    panel.append(el("h2","","我的九维得分"));
    const chart=el("div","score-list");
    for (const m of quiz.modules) {
      const group=el("section","score-group");
      group.append(el("h3","",m.label));
      for (const axis of m.axes) {
        const row=el("div","score-row");
        const label=quiz.axes[axis].label;
        const meter=el("meter");
        meter.min=2;meter.max=6;meter.value=item.scores[axis];
        meter.setAttribute("aria-label",label+"得分");
        row.append(el("span","",label),meter,el("b","",item.scores[axis]+" · "+levelNames[item.levels[axis]]));
        group.append(row);
      }
      chart.append(group);
    }
    panel.append(chart);
    const notice=el("div","alumni");panel.append(notice);
    const actions=el("div","panel-actions");
    const status=el("p","hint");status.setAttribute("role","status");
    const {saveCard,preview}=cardActions(item,status);
    actions.append(saveCard,btn("修改答案","quiet",() => {
      session.index=quiz.main.length-1;session.phase="question";save();question();
    }),btn("再测一次","quiet",start));
    panel.append(actions,preview,status);
    section.append(head,panel);
    mount("result",section,focus);
    window.QuizCounts?.attach(notice,item,session.answers);
  }

  async function drawCard(item) {
    const c=document.createElement("canvas");
    c.width=840;
    const ctx=c.getContext("2d");
    const type='"Microsoft YaHei","PingFang SC",sans-serif';
    function lines(text,font,width) {
      ctx.font=font;
      const result=[];
      for (const para of text.split("\n")) {
        let line="";
        for (const ch of para) {
          if (line && ctx.measureText(line+ch).width>width) {result.push(line);line="";}
          line+=ch;
        }
        result.push(line);
      }
      return result;
    }
    const titleFont="900 67px "+type;
    const reasonFont="31px "+type;
    const titles=lines(item.title || "我的试玩结果",titleFont,716);
    const reasons=item.reason ? lines(item.reason,reasonFont,716) : [];
    const bodyBottom=656+titles.length*80+reasons.length*48;
    const gridTop=bodyBottom+84;
    const gridBottom=gridTop+242;
    c.height=gridBottom+290;
    ctx.fillStyle="#1046c6";ctx.fillRect(0,0,c.width,c.height);
    ctx.fillStyle="#d8ecff";ctx.fillRect(36,108,768,430);
    ctx.fillStyle="#c9d910";
    ctx.beginPath();ctx.moveTo(116,142);ctx.lineTo(452,142);ctx.lineTo(574,322);
    ctx.lineTo(452,512);ctx.lineTo(116,512);ctx.closePath();
    ctx.moveTo(191,205);ctx.lineTo(191,449);ctx.lineTo(414,449);ctx.lineTo(498,322);ctx.lineTo(414,205);ctx.closePath();ctx.fill("evenodd");
    const hat=art("idle");
    await hat.decode();
    const hw=540;const hh=hw*(hat.naturalHeight/hat.naturalWidth);
    ctx.drawImage(hat,155,322-hh/2,hw,hh);
    ctx.fillStyle="white";ctx.font="800 37px "+type;ctx.fillText("D&I",50,72);
    ctx.textAlign="right";ctx.font="24px "+type;ctx.fillText("第九届设创双年晚会",788,73);ctx.textAlign="left";
    ctx.fillStyle="#e1f464";ctx.font="700 27px "+type;
    ctx.fillText(item.id ? "我的分院" : "分院结果预览",58,608);
    ctx.fillStyle="white";ctx.font=titleFont;
    titles.forEach((line,i)=>ctx.fillText(line,56,696+i*80));
    ctx.font=reasonFont;
    reasons.forEach((line,i)=>ctx.fillText(line,59,686+titles.length*80+i*48));
    ctx.fillStyle="#9db9ef";ctx.fillRect(57,bodyBottom+2,726,2);
    ctx.fillStyle="white";ctx.font="700 27px "+type;
    ctx.fillText("我的九维得分",58,bodyBottom+59);
    ctx.textAlign="right";ctx.font="24px "+type;
    ctx.fillText("每项 2–6 分",783,bodyBottom+59);
    ctx.fillStyle="#fbfaef";ctx.fillRect(36,gridTop,768,gridBottom-gridTop);
    for (const [column,module] of quiz.modules.entries()) {
      const left=36+256*column;
      if (column>0) {
        ctx.fillStyle="#d4dcd6";ctx.fillRect(left,gridTop+20,2,202);
      }
      ctx.textAlign="left";ctx.fillStyle="#1046c6";ctx.font="800 28px "+type;
      ctx.fillText(module.label,left+19,gridTop+47);
      for (const [row,axis] of module.axes.entries()) {
        const baseline=gridTop+101+row*51;
        ctx.textAlign="left";ctx.fillStyle="#142c52";ctx.font="24px "+type;
        ctx.fillText(quiz.axes[axis].label,left+19,baseline);
        ctx.textAlign="right";ctx.font="700 24px "+type;
        ctx.fillText(item.scores[axis]+" · "+levelNames[item.levels[axis]],left+237,baseline);
      }
    }
    ctx.textAlign="left";ctx.fillStyle="white";ctx.font="700 37px "+type;
    ctx.fillText(title,57,gridBottom+128);
    ctx.fillStyle="#e1f464";ctx.font="26px "+type;
    ctx.fillText(item.id ? "扫码参与分院" : "扫码试玩",58,gridBottom+176);
    window.QuizQR.draw(ctx,theme || "home",548,gridBottom+16,250);
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
  document.querySelector(".monogram").addEventListener("click",event => {event.preventDefault();home();});
  if (location.hash==="#home") {
    home(false);
    try { history.replaceState(null,"",location.href.split("#")[0]); } catch {}
  } else continueRun(false);
})();
