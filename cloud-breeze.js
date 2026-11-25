"use strict";
(() => {
  const svgNS = "http://www.w3.org/2000/svg";
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  let field;
  let current;
  let frame;

  function node(name, attributes) {
    const element = document.createElementNS(svgNS, name);
    for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
    return element;
  }

  // The two maps follow the left brim, right brim and lower crown of the approved
  // painting. Their compact support leaves the eyes, mouth and pointed tip still.
  // Each patch is [centerX, centerY, radiusX, radiusY, horizontal, vertical].
  const left = [[.12,.90,.33,.23,.71,-.62], [.31,.64,.11,.22,.41,.35]];
  const right = [[.87,.77,.30,.20,-.61,-.76], [.64,.62,.13,.15,.40,-.38]];

  function displacementMap(patches) {
    const canvas = document.createElement("canvas");
    canvas.width = 112;
    canvas.height = 100;
    const context = canvas.getContext("2d");
    const pixels = context.createImageData(canvas.width,canvas.height);
    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        let dx = 0, dy = 0;
        for (const [cx,cy,rx,ry,horizontal,vertical] of patches) {
          const distance = ((x / (canvas.width - 1) - cx) / rx) ** 2
            + ((y / (canvas.height - 1) - cy) / ry) ** 2;
          const weight = Math.max(0, 1 - distance) ** 2;
          dx += weight * horizontal;
          dy += weight * vertical;
        }
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
    const filter = node("filter",{id:"cloud-breeze-field",x:0,y:0,width:1,height:1,
      filterUnits:"objectBoundingBox",primitiveUnits:"objectBoundingBox","color-interpolation-filters":"sRGB"});
    const stages = [left,right].map((patches, i) => {
      const map = node("feImage",{x:0,y:0,width:1,height:1,preserveAspectRatio:"none",result:"field"+i});
      map.setAttributeNS("http://www.w3.org/1999/xlink","href",displacementMap(patches));
      const deform = node("feDisplacementMap",{in:i ? "first" : "SourceGraphic",in2:"field"+i,
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

  function setIdle(image, idle) {
    if (!idle) {
      if (current === image) stop();
      return;
    }
    if (current === image || document.hidden || motion.matches || !image.isConnected) return;
    stop();
    field ||= createField();
    for (const stage of field) stage.setAttribute("scale",0);
    current = image;
    const start = performance.now();
    let last = -Infinity;
    image.style.filter = "url(#cloud-breeze-field)";
    function step(now) {
      if (!image.isConnected || document.hidden || motion.matches) return stop();
      // The breeze varies over seconds; 24 samples per second resolve it at mobile scale.
      if (now - last >= 1000 / 24) {
        const t = (now - start) / 1000;
        const fade = Math.min(1, t);
        const amplitude = .036 * fade * fade * (3 - 2 * fade);
        field[0].setAttribute("scale",amplitude * Math.sin(t * 2 * Math.PI / 6.8));
        field[1].setAttribute("scale",amplitude * Math.sin(t * 2 * Math.PI / 8.2 - 1.2));
        last = now;
      }
      frame = requestAnimationFrame(step);
    }
    frame = requestAnimationFrame(step);
  }

  window.CloudBreeze = {setIdle};
})();
