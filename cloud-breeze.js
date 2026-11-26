"use strict";
(() => {
  const svgNS = "http://www.w3.org/2000/svg";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  // Give the lifted fringe room to travel past the transparent bitmap's edge.
  const bounds = {x:-.1, y:-.1, width:1.2, height:1.2};
  let field;
  let current;
  let target;
  let frame;

  function node(name, attributes) {
    const element = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  }

  function ease(start, end, value) {
    const u = Math.max(0, Math.min(1, (value - start) / (end - start)));
    return u * u * (3 - 2 * u);
  }

  function softPatch(x, y, cx, cy, rx, ry) {
    return Math.max(0, 1 - ((x-cx)/rx)**2 - ((y-cy)/ry)**2)**2;
  }

  function displacementMap(phaseOffset) {
    const canvas = document.createElement("canvas");
    canvas.width = 112;
    canvas.height = 100;
    const context = canvas.getContext("2d");
    const pixels = context.createImageData(canvas.width,canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const u = bounds.x + bounds.width * x / (canvas.width - 1);
        const v = bounds.y + bounds.height * y / (canvas.height - 1);
        // The fringe grows out of the crown at x≈.45 and curls to the right.
        // Increase both its travel and delay toward the free end of the strand.
        const reach = ease(.43,.96,u);
        const fringe = reach * (1 - ease(.19,.36,v));
        const lag = phaseOffset - 1.35 * reach;
        const leftBrim = softPatch(u,v,.12,.90,.34,.22);
        const rightBrim = softPatch(u,v,.87,.78,.29,.22);
        const dx = .37 * fringe * Math.cos(lag + 1.0) + .10 * leftBrim * Math.cos(phaseOffset);
        const dy = .95 * fringe * Math.cos(lag) + .20 * leftBrim * Math.cos(phaseOffset + .4)
                   - .16 * rightBrim * Math.cos(phaseOffset - .8);
        const offset = 4 * (y * canvas.width + x);
        pixels.data.set([128 + 127 * dx,128 + 127 * dy,128,255],offset);
      }
    }
    context.putImageData(pixels,0,0);
    return canvas.toDataURL();
  }

  function createField() {
    const svg = node("svg",{width:0,height:0,"aria-hidden":"true",focusable:"false"});
    svg.style.cssText = "position:absolute;pointer-events:none;overflow:hidden";
    const filter = node("filter",{id:"cloud-breeze-field",...bounds,
      filterUnits:"objectBoundingBox",primitiveUnits:"objectBoundingBox","color-interpolation-filters":"sRGB"});
    const stages = [0,-Math.PI/2].map((phaseOffset, i) => {
      const map = node("feImage",{...bounds,preserveAspectRatio:"none",result:"field"+i});
      map.setAttributeNS("http://www.w3.org/1999/xlink","href",displacementMap(phaseOffset));
      const deform = node("feDisplacementMap",{...bounds,in:i ? "first" : "SourceGraphic",in2:"field"+i,
        xChannelSelector:"R",yChannelSelector:"G",scale:0,result:i ? "final" : "first"});
      filter.append(map,deform);
      return deform;
    });
    svg.append(filter);
    document.body.append(svg);
    return stages;
  }

  function stop() {
    cancelAnimationFrame(frame);
    if (current) current.style.removeProperty("filter");
    current = null;
  }

  function sync() {
    if (!target?.isConnected || document.hidden || motion.matches) return stop();
    if (current === target) return;
    stop();
    field ||= createField();
    for (const stage of field) stage.setAttribute("scale",0);
    current = target;
    const start = performance.now();
    let last = -Infinity;
    current.style.filter = "url(#cloud-breeze-field)";
    function step(now) {
      if (!current?.isConnected || document.hidden || motion.matches) return stop();
      if (now - last >= 1000 / 30 - 1) {
        const t = now / 1000;
        const angle = t * 2 * Math.PI / 4.6 + .30 * Math.sin(t * .74);
        const amplitude = ease(0,.48,(now-start)/1000) * (.145 + .02 * Math.sin(t * .83));
        field[0].setAttribute("scale",amplitude * Math.sin(angle));
        field[1].setAttribute("scale",amplitude * Math.cos(angle));
        last = now;
      }
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }

  function setTarget(image) {
    target = image;
    sync();
  }

  document.addEventListener("visibilitychange",sync);
  motion.addEventListener("change",sync);
  window.addEventListener("pagehide",stop);
  window.addEventListener("pageshow",sync);
  window.CloudBreeze = {setTarget};
})();
