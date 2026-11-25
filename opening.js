"use strict";
(() => {
  // Both layers were registered to the 390 × 844 cover. The last frame
  // contains the same 812 × 729 image used by the first question.
  const coverWidth = 390;
  const patch = {x:23.36, y:237.35, width:371.52, height:330.24};
  const cloudInPatch = {x:.0210740741, y:.0330052083, width:.9317916667, height:.941390625};
  const cellWidth = 432, cellHeight = 384;
  let prepared;

  function prepare() {
    if (prepared) return prepared;
    const refs = document.getElementById("opening-art").content;
    async function load(part) {
      const image = new Image();
      image.decoding = "async";
      image.src = refs.querySelector('[data-part="' + part + '"]').getAttribute("src");
      await image.decode();
      return image;
    }
    prepared = Promise.all([load("morph"),load("plate")]).catch(() => {
      prepared = null;
      return null;
    });
    return prepared;
  }

  function layer(tag, name) {
    const node = document.createElement(tag);
    node.className = name;
    return node;
  }
  function place(node, x, y, width, height) {
    Object.assign(node.style, {left:x + "px", top:y + "px", width:width + "px", height:height + "px"});
  }
  function play({sheet,rect,editionNav,navTop,target,onClose}) {
    const dialog = layer("dialog","opening-dialog");
    dialog.setAttribute("aria-label","分院帽苏醒");
    const scene = layer("div","opening-scene");
    scene.setAttribute("aria-hidden","true");
    sheet.inert = true;
    place(sheet,rect.left,rect.top,rect.width,rect.height);
    scene.append(sheet);
    if (editionNav && navTop < window.innerHeight) {
      const nav = editionNav.cloneNode(true);
      nav.inert = true;
      nav.style.top = navTop + "px";
      scene.append(nav);
    }
    const skip = layer("button","skip-opening");
    skip.type = "button";
    skip.textContent = "跳过动画";
    dialog.append(scene,skip);
    document.body.append(dialog);
    const quizScreen = target.closest(".shell");
    const listeners = new AbortController();
    const options = {signal:listeners.signal};
    let closed = false, frame = 0, deadline;
    const animations = [];
    function animate(node, frames, duration, delay = 0, easing = "ease-in-out") {
      const animation = node.animate(frames,{duration,delay,easing,fill:"both"});
      animations.push(animation);
      return animation;
    }
    function close(focus = true) {
      if (closed) return;
      closed = true;
      listeners.abort();
      cancelAnimationFrame(frame);
      clearTimeout(deadline);
      for (const animation of animations) animation.cancel();
      target.style.visibility = "";
      if (dialog.open) dialog.close();
      dialog.remove();
      onClose(focus);
    }
    skip.addEventListener("click",() => close(),options);
    dialog.addEventListener("cancel",event => { event.preventDefault(); close(); },options);
    dialog.addEventListener("wheel",event => event.preventDefault(),{...options,passive:false});
    window.addEventListener("pagehide",() => close(false),options);
    document.addEventListener("visibilitychange",() => { if (document.hidden) close(false); },options);
    // Mobile browser chrome may change the height slightly without a rotation.
    const viewport = {width:innerWidth,height:innerHeight};
    window.addEventListener("resize",() => {
      if (Math.abs(innerWidth-viewport.width)>12 || Math.abs(innerHeight-viewport.height)>140) close();
    },options);
    try {
      dialog.showModal();
      skip.focus({preventScroll:true});
    } catch {
      queueMicrotask(() => close());
      return close;
    }
    target.style.visibility = "hidden";
    const scale = rect.width / coverWidth;
    const cloudX = rect.left + (patch.x + patch.width * cloudInPatch.x) * scale;
    const cloudY = rect.top + (patch.y + patch.height * cloudInPatch.y) * scale;
    const cloudW = patch.width * cloudInPatch.width * scale;
    const cloudH = patch.height * cloudInPatch.height * scale;

    function land(hasMorph) {
      if (closed) return;
      const duration = hasMorph ? 830 : 560;
      const cloud = layer("img","opening-cloud");
      cloud.alt = "";
      cloud.src = target.currentSrc || target.src;
      place(cloud,cloudX,cloudY,cloudW,cloudH);
      dialog.insertBefore(cloud,skip);
      const box = target.getBoundingClientRect();
      const css = getComputedStyle(target);
      const drawnWidth = Math.min(parseFloat(css.width),parseFloat(css.height) * 812/729);
      const dx = box.left + box.width/2 - (cloudX + cloudW/2);
      const dy = box.top + box.height/2 - (cloudY + cloudH/2);
      const ratio = drawnWidth/cloudW;
      // The image already occupies the last cel. The new layer carries those
      // pixels out of the poster while the actual first question becomes visible.
      if (hasMorph) sheet.querySelector(".opening-frames").style.visibility = "hidden";
      else animate(cloud,[{opacity:0},{opacity:1}],duration * .75);
      const landing = animate(cloud,[
        {transform:"translate(0,0) scale(1)"},
        {transform:"translate(" + dx + "px," + dy + "px) " + css.transform + " scale(" + ratio + ")"}
      ],duration,0,"cubic-bezier(.42,0,.18,1)");
      animate(scene,[{opacity:1},{opacity:0}],duration * .69);
      animate(quizScreen,[{opacity:0,transform:"translateY(9px)"},{opacity:1,transform:"none"}],
        duration * .59,duration * .38,"cubic-bezier(.2,.68,.26,1)");
      animate(skip,[{opacity:1},{opacity:0}],duration * .58);
      landing.onfinish = () => close();
    }

    function morph([atlas,plate]) {
      const group = layer("div","opening-patch");
      place(group,patch.x*scale,patch.y*scale,patch.width*scale,patch.height*scale);
      const columns = atlas.naturalWidth / cellWidth;
      const rows = atlas.naturalHeight / cellHeight;
      const frameCount = columns * rows;
      const frames = atlas.cloneNode();
      frames.className = "opening-frames";
      frames.style.width = columns * 100 + "%";
      frames.style.height = rows * 100 + "%";
      const backing = plate.cloneNode();
      backing.alt = "";
      group.append(backing,frames);
      sheet.append(group);
      let previous = -1;
      const started = performance.now(), duration = 1560;
      function draw(now) {
        if (closed) return;
        const progress = Math.min(1,Math.max(0,(now-started)/duration));
        const cell = Math.round(progress * (frameCount - 1));
        if (cell !== previous) {
          const x = -100 * (cell % columns) / columns;
          const y = -100 * Math.floor(cell / columns) / rows;
          frames.style.transform = "translate3d(" + x + "%," + y + "%,0)";
          previous = cell;
        }
        if (progress < 1) frame = requestAnimationFrame(draw);
        else land(true);
      }
      draw(started);
      animate(group,[{opacity:0},{opacity:1}],125);
    }
    // An immediate cold-cache tap still reaches the quiz on a slow connection.
    const timeout = new Promise(resolve => { deadline = setTimeout(() => resolve(null),380); });
    Promise.race([prepare(),timeout]).then(images => {
      clearTimeout(deadline);
      if (!closed) images ? morph(images) : land(false);
    }).catch(() => close());
    return close;
  }
  window.CloudOpening = {prepare,play,supported:typeof HTMLDialogElement !== "undefined" &&
    typeof HTMLDialogElement.prototype.showModal === "function" && typeof Element.prototype.animate === "function" &&
    typeof HTMLImageElement.prototype.decode === "function"};
})();
