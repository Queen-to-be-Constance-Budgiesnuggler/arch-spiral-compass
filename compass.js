// ═══════════════════════════════════════════════════════════════════════════
// APP STATE & DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_PARAMS = {
  smallRadiusMm: 0,
  largeRadiusMm: 15.2,
  radialSegments: 1,
  rotationalSegments: 12,
};

let appState = {
  params: { ...DEFAULT_PARAMS },
  isPortrait: typeof window !== 'undefined' ? window.innerWidth < window.innerHeight : false,
  infoOpen: false,
};

// ─── Math Helpers ──────────────────────────────────────────────────────────

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

//function buildSpiralVertices({ smallRadiusMm, largeRadiusMm, radialSegments, rotationalSegments }) {
//  const angularStep = (2 * Math.PI) / rotationalSegments;
//  const radiusStep = (largeRadiusMm - smallRadiusMm) / radialSegments;
//  const vertices = [];
//
//  for (let i = 0; i <= radialSegments; i++) {
//    const angle = i * angularStep;
//    const radius = smallRadiusMm + i * radiusStep;
//    vertices.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
//  }
//  return vertices;
//}

// Add rotationOffsetDeg to the parameters
//function buildSpiralVertices({ smallRadiusMm, largeRadiusMm, radialSegments, rotationalSegments, rotationOffsetDeg = 0 }) {
//  const angularStep = (2 * Math.PI) / rotationalSegments;
//  const radiusStep = (largeRadiusMm - smallRadiusMm) / radialSegments;
//  const vertices = [];
//  
//  // Convert the web view offset to radians
//  const offsetRad = (rotationOffsetDeg * Math.PI) / 180;
//
//  for (let i = 0; i <= radialSegments; i++) {
//    // Add the offsetRad to the calculation
//    const angle = (i * angularStep) + offsetRad; 
//    const radius = smallRadiusMm + i * radiusStep;
//    vertices.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
//  }
//  return vertices;
//}

//function buildSpiralVertices({ smallRadiusMm, largeRadiusMm, radialSegments, rotationalSegments }) {
//  const angularStep = (2 * Math.PI) / rotationalSegments;
//  const radiusStep = (largeRadiusMm - smallRadiusMm) / radialSegments;
//  const vertices = [];
//
//  // Match the canvas visual offset exactly
//  const rotationOffsetDeg = -60 + (radialSegments - 1) * 15;
//  const offsetRad = (rotationOffsetDeg * Math.PI) / 180;
//
//  for (let i = 0; i <= radialSegments; i++) {
//    const angle = i * angularStep;
//    const radius = smallRadiusMm + i * radiusStep;
//    
//    // We apply the rotation offset AND flip the Y-axis (Math.sin) 
//    // to match the 'cy - radius * sin' logic in your draw function.
//    const finalAngle = angle + offsetRad;
//    
//    const x = radius * Math.cos(finalAngle);
//    const y = radius * Math.sin(finalAngle); // Keep this positive; the drawing function flips it visually.
//    
//    vertices.push([x, y]);
//  }
//  return vertices;
//}

function buildSpiralVertices({ smallRadiusMm, largeRadiusMm, radialSegments, rotationalSegments }) {
  const angularStep = (2 * Math.PI) / rotationalSegments;
  const radiusStep = (largeRadiusMm - smallRadiusMm) / radialSegments;
  const vertices = [];

  for (let i = 0; i <= radialSegments; i++) {
    const angle = i * angularStep;
    const radius = smallRadiusMm + i * radiusStep;
    // Standard Math: Y is positive UP
    vertices.push([radius * Math.cos(angle), radius * Math.sin(angle)]);
  }
  return vertices;
}

function computeSpiralLength({ smallRadiusMm, largeRadiusMm, radialSegments, rotationalSegments }) {
  const angularStep = (2 * Math.PI) / rotationalSegments;
  const drdt = (largeRadiusMm - smallRadiusMm) / (2 * Math.PI * (radialSegments / rotationalSegments));
  const r0 = smallRadiusMm;
  const weights = [0.5688888889, 0.4786286705, 0.4786286705, 0.2369268851, 0.2369268851];
  const nodes = [0, -0.5384693101, 0.5384693101, -0.9061798459, 0.9061798459];

  let totalLength = 0;
  for (let seg = 0; seg < radialSegments; seg++) {
    const a = seg * angularStep;
    const b = a + angularStep;
    const mid = (a + b) / 2;
    const half = (b - a) / 2;
    let segLen = 0;
    for (let k = 0; k < 5; k++) {
      const theta = mid + half * nodes[k];
      const r = r0 + drdt * theta;
      segLen += weights[k] * Math.sqrt(r * r + drdt * drdt);
    }
    totalLength += segLen * half;
  }
  return totalLength;
}

// ─── Canvas Drawing ────────────────────────────────────────────────────────

function drawSpiral(ctx, canvasW, canvasH, params, isMobile) {
  const { smallRadiusMm, largeRadiusMm, radialSegments, rotationalSegments } = params;

  const cx = canvasW / 2;
  const cy = canvasH / 2;
  const outerPx = Math.min(canvasW, canvasH) / 2 - 24;
  const scale = (Math.min(canvasW, canvasH) / 2 - 24 - 52) / largeRadiusMm;

  ctx.clearRect(0, 0, canvasW, canvasH);
  ctx.fillStyle = "#0f0f13";
  ctx.fillRect(0, 0, canvasW, canvasH);

  const rotationOffsetDeg = -60 + (radialSegments - 1) * 15;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((rotationOffsetDeg * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  const largeR = largeRadiusMm * scale;
  const fontSize = isMobile ? 13 : 16;
  const segColors = [
    "rgba(255,200,80,0.12)",
    "rgba(100,160,255,0.12)",
    "rgba(200,100,255,0.12)",
  ];
  const angularStep = (2 * Math.PI) / rotationalSegments;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, largeR, 0, 2 * Math.PI);
  ctx.clip();

  for (let i = 0; i < rotationalSegments; i++) {
    const colorIndex = i === 0 ? 0 : (i % 2 === 1 ? 1 : 2);
    const startAngle = i * angularStep;
    const endAngle   = startAngle + angularStep;

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, largeR, -startAngle, -endAngle, true);
    ctx.closePath();
    ctx.fillStyle = segColors[colorIndex];
    ctx.fill();
  }
  ctx.restore();

  ctx.font = `${fontSize}px 'IBM Plex Mono', monospace`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  for (let i = 0; i < rotationalSegments; i++) {
    const angle = (i / rotationalSegments) * 2 * Math.PI;
    const ex = cx + largeR * Math.cos(angle);
    const ey = cy - largeR * Math.sin(angle);

    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 5]);
    ctx.stroke();
    ctx.setLineDash([]);

    const labelX = cx + (largeR + 28) * Math.cos(angle);
    const labelY = cy - (largeR + 28) * Math.sin(angle);
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.fillText(String(i), labelX, labelY);
  }

  for (const r of [smallRadiusMm, largeRadiusMm]) {
    if (r * scale < 1) continue;
    ctx.beginPath();
    ctx.arc(cx, cy, r * scale, 0, 2 * Math.PI);
    ctx.strokeStyle = "rgba(255,255,255,0.10)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  const vertices = buildSpiralVertices(params);
  const n = vertices.length;

  for (let i = 0; i < n - 1; i++) {
    const t = i / (n - 1);
    const hue = 180 + 200 * t;
    const lightness = 50 + 20 * t;
    ctx.beginPath();
    ctx.moveTo(cx + vertices[i][0] * scale, cy - vertices[i][1] * scale);
    ctx.lineTo(cx + vertices[i + 1][0] * scale, cy - vertices[i + 1][1] * scale);
    ctx.strokeStyle = `hsl(${hue}, 90%, ${lightness}%)`;
    ctx.lineWidth = 1.8;
    ctx.stroke();
  }

  for (let i = 0; i < n; i++) {
    const t = i / (n - 1);
    const hue = 180 + 200 * t;
    const isEndpoint = i === 0 || i === n - 1;
    ctx.beginPath();
    ctx.arc(cx + vertices[i][0] * scale, cy - vertices[i][1] * scale, isEndpoint ? 4 : 2, 0, 2 * Math.PI);
    ctx.fillStyle = isEndpoint ? "#fff" : `hsl(${hue}, 80%, 70%)`;
    ctx.fill();
  }

  const axisLen = 0.42 * Math.min(canvasW, canvasH);
  const axisFont = `${Math.round(11 * window.devicePixelRatio)}px 'IBM Plex Mono', monospace`;

  ctx.save();
  ctx.font = axisFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.beginPath();
  ctx.moveTo(cx - axisLen, cy);
  ctx.lineTo(cx + axisLen, cy);
  ctx.strokeStyle = "rgba(255,100,100,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(255,100,100,0.5)";
  ctx.fillText("X", cx + axisLen + 14, cy);

  ctx.beginPath();
  ctx.moveTo(cx, cy + axisLen);
  ctx.lineTo(cx, cy - axisLen);
  ctx.strokeStyle = "rgba(100,200,100,0.35)";
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.fillStyle = "rgba(100,200,100,0.5)";
  ctx.fillText("Y", cx, cy - axisLen - 14);

  ctx.restore();
  ctx.restore();

  const secondaryRotRad = (-60 - (radialSegments - 1) * 15) * (Math.PI / 180);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(secondaryRotRad);
  ctx.translate(-cx, -cy);
  ctx.font = axisFont;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.beginPath();
  ctx.moveTo(cx - axisLen, cy);
  ctx.lineTo(cx + axisLen, cy);
  ctx.strokeStyle = "rgba(255,0,255,0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,0,255,0.35)";
  ctx.fillText("X′", cx + axisLen + 16, cy);

  ctx.beginPath();
  ctx.moveTo(cx, cy + axisLen);
  ctx.lineTo(cx, cy - axisLen);
  ctx.strokeStyle = "rgba(0,220,255,0.25)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.fillStyle = "rgba(0,220,255,0.35)";
  ctx.fillText("Y′", cx, cy - axisLen - 16);

  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvasW, canvasH);
  ctx.arc(cx, cy, outerPx, 0, 2 * Math.PI, true);
  ctx.fillStyle = "#222128";
  ctx.fill("evenodd");
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, outerPx, 0, 2 * Math.PI);
  ctx.strokeStyle = "#888888";
  ctx.lineWidth = 1;
  ctx.stroke();

  const arrowTip = cy - outerPx - 8;
  const arrowBase = arrowTip + 7 * Math.sqrt(3);
  ctx.beginPath();
  ctx.moveTo(cx, arrowTip);
  ctx.lineTo(cx - 7, arrowBase);
  ctx.lineTo(cx + 7, arrowBase);
  ctx.closePath();
  ctx.fillStyle = "#888888";
  ctx.fill();

  const refAngle = -Math.PI / 2;
  const angleAt12 = (2 * Math.PI) / 12;

  for (let N = 1; N <= 24; N++) {
    const theta = (2 * Math.PI) / N;
    const finalAngle = refAngle + (angleAt12 - theta);

    const x = cx + outerPx * Math.cos(finalAngle);
    const y = cy + outerPx * Math.sin(finalAngle);

    ctx.beginPath();
    ctx.arc(x, y, N === rotationalSegments ? 4 : 2, 0, Math.PI * 2);
    ctx.fillStyle = N === rotationalSegments ? "var(--accent)" : "rgba(255, 255, 255, 0.5)";
    ctx.fill();

    if (N === 1 || N === 12 || N === 24) {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 10px 'IBM Plex Mono'";
      ctx.textAlign = 'center';
      ctx.fillText(N, cx + (outerPx + 15) * Math.cos(finalAngle), cy + (outerPx + 15) * Math.sin(finalAngle) + 4);
    }
  }

  const rotOffRad = rotationOffsetDeg * (Math.PI / 180);
  const rotOffOriginRad = -60 * (Math.PI / 180);

  const toArcAngle = (a) => a - Math.PI / 2;
  function drawBorderTrace(fromOutAngle, toOutAngle, color, anticlockwise) {
    if (Math.abs(toOutAngle - fromOutAngle) < 1e-6) return;
    const arcR = outerPx + 4;
    ctx.beginPath();
    ctx.arc(cx, cy, arcR, toArcAngle(fromOutAngle), toArcAngle(toOutAngle), anticlockwise);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function drawBorderArrow(outAngleRad, color) {
    const odx = Math.sin(outAngleRad);
    const ody = -Math.cos(outAngleRad);
    const pdx = -ody;
    const pdy = odx;
    const arrowH = 12;
    const arrowHB = 7;
    const tx = cx + (outerPx + 8) * odx;
    const ty = cy + (outerPx + 8) * ody;
    const bx = tx - arrowH * odx;
    const by = ty - arrowH * ody;
    ctx.beginPath();
    ctx.moveTo(tx, ty);
    ctx.lineTo(bx - arrowHB * pdx, by - arrowHB * pdy);
    ctx.lineTo(bx + arrowHB * pdx, by + arrowHB * pdy);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }

  drawBorderTrace(rotOffOriginRad, rotOffRad, "rgba(100,200,100,0.3)", false);
  drawBorderArrow(rotOffRad, "rgba(100,200,100,0.9)");
  drawBorderTrace(rotOffOriginRad, secondaryRotRad, "rgba(0,220,255,0.3)", true);
  drawBorderArrow(secondaryRotRad, "rgba(0,220,255,0.9)");
}

// ─── DOM Building ──────────────────────────────────────────────────────────

function createParamSlider(label, value, min, max, step, unit = "", isRadius = false, onChangeCallback, paramKey) {
  const container = document.createElement('div');
  container.className = 'param-slider';

  const labelRow = document.createElement('div');
  labelRow.className = 'slider-label-row';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'slider-label';
  labelSpan.textContent = label;

  const valueSpan = document.createElement('span');
  valueSpan.className = 'slider-value';

  const updateValueDisplay = (v) => {
    valueSpan.textContent = isRadius ? v.toFixed(2) : `${v}${unit}`;
  };

  updateValueDisplay(value);

  let editing = false;

  valueSpan.addEventListener('click', () => {
    if (editing) return;
    editing = true;
    const input = document.createElement('input');
    input.className = 'slider-input-edit';
    input.type = 'number';
    input.value = value;

    const commitEdit = () => {
      const parsed = parseFloat(input.value);
      if (!isNaN(parsed)) {
        const newValue = Math.max(min, Math.min(max, parsed));
        onChangeCallback(newValue);
      }
      editing = false;
    };

    input.addEventListener('blur', commitEdit);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') commitEdit();
      if (e.key === 'Escape') { editing = false; input.replaceWith(valueSpan); }
    });

    valueSpan.replaceWith(input);
    input.focus();
    input.select();
  });

  labelRow.appendChild(labelSpan);
  labelRow.appendChild(valueSpan);

  const getPositionFromValue = (val) => {
    if (isRadius) {
      const logMin = Math.log(Math.max(min, 1e-4));
      const logMax = Math.log(Math.max(max, 1e-4));
      const logVal = Math.log(Math.max(val, 1e-4));
      return (logVal - logMin) / (logMax - logMin);
    } else {
      return (val - min) / (max - min);
    }
  };

  const getValueFromPosition = (pos) => {
    pos = clamp(pos, 0, 1);
    let newVal;
    if (isRadius) {
      const logMin = Math.log(Math.max(min, 1e-4));
      const logMax = Math.log(Math.max(max, 1e-4));
      newVal = Math.exp(logMin + pos * (logMax - logMin));
      newVal = Math.round(newVal * 10000) / 10000;
    } else {
      newVal = min + pos * (max - min);
      if (step > 0) newVal = Math.round(newVal / step) * step;
    }
    return clamp(newVal, min, max);
  };

  const sliderContainer = document.createElement('div');
  sliderContainer.className = 'slider-container';
  sliderContainer.style.padding = '8px 0px';
  sliderContainer.style.cursor = 'pointer';

  const track = document.createElement('div');
  track.style.position = 'relative';
  track.style.width = '100%';
  track.style.height = '24px';
  track.style.display = 'flex';
  track.style.alignItems = 'center';
  track.style.touchAction = 'none';

  const bgBar = document.createElement('div');
  bgBar.style.position = 'absolute';
  bgBar.style.width = '100%';
  bgBar.style.height = '6px';
  bgBar.style.background = 'rgba(255,255,255,0.1)';
  bgBar.style.borderRadius = '3px';
  bgBar.style.pointerEvents = 'none';
  track.appendChild(bgBar);

  const filled = document.createElement('div');
  filled.style.position = 'absolute';
  filled.style.height = '6px';
  filled.style.background = 'var(--accent)';
  filled.style.borderRadius = '3px';
  filled.style.left = '0';
  filled.style.pointerEvents = 'none';
  track.appendChild(filled);

  const thumb = document.createElement('div');
  thumb.style.position = 'absolute';
  thumb.style.width = '16px';
  thumb.style.height = '16px';
  thumb.style.background = 'var(--accent)';
  thumb.style.border = '2px solid rgba(255,255,255,0.2)';
  thumb.style.borderRadius = '50%';
  thumb.style.transform = 'translateX(-50%)';
  thumb.style.pointerEvents = 'none';
  track.appendChild(thumb);

  let isDragging = false;
  const updateVisuals = () => {
    const currentValue = paramKey && appState ? appState.params[paramKey] : value;
    const pos = getPositionFromValue(currentValue);
    filled.style.width = `${pos * 100}%`;
    thumb.style.left = `${pos * 100}%`;
    thumb.style.boxShadow = isDragging ? '0 0 10px rgba(100,160,255,0.6)' : 'none';
  };

  track.addEventListener('pointerdown', (e) => {
    if (editing) return;
    isDragging = true;
    updateVisuals();
    const getPosFromEvent = (evt) => {
      const rect = track.getBoundingClientRect();
      if (rect.width === 0) return 0;
      let clientX = evt.clientX || (evt.touches && evt.touches[0].clientX);
      return clamp((clientX - rect.left) / rect.width, 0, 1);
    };
    const handleMove = (moveEvent) => {
      if (!isDragging) return;
      const pos = getPosFromEvent(moveEvent);
      const newVal = getValueFromPosition(pos);
      onChangeCallback(newVal);
      updateValueDisplay(newVal);
      updateVisuals();
    };
    const handleUp = () => {
      isDragging = false;
      updateVisuals();
      document.removeEventListener('pointermove', handleMove);
      document.removeEventListener('pointerup', handleUp);
    };
    handleMove(e);
    document.addEventListener('pointermove', handleMove);
    document.addEventListener('pointerup', handleUp);
  });

  sliderContainer.appendChild(track);
  container.appendChild(labelRow);
  container.appendChild(sliderContainer);

  container._sliderObserver = setInterval(() => {
    if (!editing) {
      updateVisuals();
      const currentValue = paramKey && appState ? appState.params[paramKey] : value;
      updateValueDisplay(currentValue);
    }
  }, 50);

  return container;
}

function createStatsPanel(params, turns) {
  const panel = document.createElement('div');
  panel.className = 'stats-panel';
  const spiralLength = computeSpiralLength(params);
  const rows = [
    ["Total Turns", turns.toFixed(4)],
    ["Spiral Length", `${spiralLength.toFixed(2)} mm`],
    ["Vertices", params.radialSegments + 1],
    ["Angle / Step", `${(360 / params.rotationalSegments).toFixed(2)}°`],
    ["Δ r / Step", `${((params.largeRadiusMm - params.smallRadiusMm) / params.radialSegments).toFixed(3)} mm`],
    ["Δ Radius", `${(params.largeRadiusMm - params.smallRadiusMm).toFixed(1)} mm`],
  ];
  rows.forEach(([label, val]) => {
    const row = document.createElement('div');
    row.className = 'stats-row';
    row.innerHTML = `<span class="stats-label">${label}</span><span class="stats-value">${val}</span>`;
    panel.appendChild(row);
  });
  return panel;
}

function createControlsPanel(params, setParam, turns, showStats = true) {
  const panel = document.createElement('div');
  panel.className = 'controls-panel';
  const header = document.createElement('div');
  header.className = 'controls-header';
  header.innerHTML = `<div><div class="controls-title-label">Generator</div><div class="controls-title">Archimedean Compass</div></div>`;

  const btnGroup = document.createElement('div');
  btnGroup.className = 'btn-group';

  const exportBtn = document.createElement('button');
  exportBtn.className = 'action-button export-btn';
  // Label adapts: inside Fusion → "Export to Fusion", in browser → "Export DXF"
  exportBtn.textContent = (window.adsk) ? 'Export to Fusion' : 'Export DXF';
  exportBtn.addEventListener('click', exportToDXF);

  const resetBtn = document.createElement('button');
  resetBtn.className = 'action-button';
  resetBtn.textContent = 'Reset';
  resetBtn.addEventListener('click', () => { Object.assign(appState.params, DEFAULT_PARAMS); render(); });

  btnGroup.appendChild(exportBtn);
  btnGroup.appendChild(resetBtn);
  header.appendChild(btnGroup);
  panel.appendChild(header);

  panel.appendChild(createParamSlider('Inner Radius', params.smallRadiusMm, 0, params.largeRadiusMm * 0.99, 0.05, ' mm', true, (v) => setParam('smallRadiusMm', v), 'smallRadiusMm'));
  panel.appendChild(createParamSlider('Outer Radius', params.largeRadiusMm, 1e-4, 50, 0.05, ' mm', true, (v) => setParam('largeRadiusMm', v), 'largeRadiusMm'));
  const divider = document.createElement('div');
  divider.className = 'slider-divider';
  panel.appendChild(divider);
  panel.appendChild(createParamSlider('Rotational Segs', params.rotationalSegments, 1, 24, 1, '', false, (v) => setParam('rotationalSegments', v), 'rotationalSegments'));
  panel.appendChild(createParamSlider('Radial Segments', params.radialSegments, 1, 24, 1, '', false, (v) => setParam('radialSegments', v), 'radialSegments'));
  if (showStats) panel.appendChild(createStatsPanel(params, turns));
  return panel;
}

function createStatusBar(params, turns) {
  const bar = document.createElement('div');
  bar.className = 'status-bar';
  const spiralLength = computeSpiralLength(params);
  const statusData = [['Inner', `${params.smallRadiusMm.toFixed(2)} mm`], ['Outer', `${params.largeRadiusMm.toFixed(2)} mm`], ['Rot', `${params.rotationalSegments}`], ['Rad', `${params.radialSegments}`], ['Turns', turns.toFixed(4)], ['Length', `${spiralLength.toFixed(2)} mm`]];
  statusData.forEach(([label, value]) => {
    const item = document.createElement('div');
    item.className = 'status-item';
    item.innerHTML = `<span class="status-item-label">${label}</span><span class="status-item-value">${value}</span>`;
    bar.appendChild(item);
  });
  return bar;
}

function createLayout(isPortrait, params, turns) {
  const container = document.createElement('div');
  container.className = `layout ${isPortrait ? 'mobile' : 'desktop'}`;
  const titleBar = document.createElement('div');
  titleBar.className = 'title-bar';
  titleBar.textContent = `Archimedean Spiral — ${turns.toFixed(4)}× turns`;
  const mainArea = document.createElement('div');
  mainArea.className = 'main-area';
  const canvasWrapper = document.createElement('div');
  canvasWrapper.className = 'canvas-wrapper';
  const canvas = document.createElement('canvas');
  canvasWrapper.appendChild(canvas);

  if (isPortrait) {
    const infoToggle = document.createElement('div');
    infoToggle.className = 'info-toggle';
    const infoButton = document.createElement('button');
    infoButton.className = 'info-button';
    infoButton.innerHTML = `<span>Info</span><div class="info-arrow ${appState.infoOpen ? 'open' : ''}"><svg width="10" height="9" viewBox="0 0 10 9"><polygon points="5,0 10,9 0,9" fill="rgba(255,255,255,0.5)"/></svg></div>`;
    infoButton.addEventListener('click', () => { appState.infoOpen = !appState.infoOpen; render(); });
    infoToggle.appendChild(infoButton);
    if (appState.infoOpen) { infoToggle.appendChild(createStatsPanel(params, turns)); infoToggle.lastChild.className = 'info-content'; }
    canvasWrapper.appendChild(infoToggle);
  }

  const controlsWrapper = document.createElement('div');
  controlsWrapper.className = 'controls-wrapper';
  controlsWrapper.appendChild(createControlsPanel(params, setParam, turns, !isPortrait));
  mainArea.appendChild(canvasWrapper);
  mainArea.appendChild(controlsWrapper);
  container.appendChild(titleBar);
  container.appendChild(mainArea);
  container.appendChild(createStatusBar(params, turns));

  const observer = new ResizeObserver(() => {
    const rect = canvasWrapper.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    drawSpiral(ctx, rect.width, rect.height, appState.params, isPortrait);
  });
  observer.observe(canvasWrapper);
  return container;
}

function updateUI() {
  const turns = appState.params.radialSegments / appState.params.rotationalSegments;
  const spiralLength = computeSpiralLength(appState.params);
  const titleBar = document.querySelector('.title-bar');
  if (titleBar) titleBar.textContent = `Archimedean Spiral — ${turns.toFixed(4)}× turns`;
  const statsVals = [turns.toFixed(4), `${spiralLength.toFixed(2)} mm`, appState.params.radialSegments + 1, `${(360 / appState.params.rotationalSegments).toFixed(2)}°`, `${((appState.params.largeRadiusMm - appState.params.smallRadiusMm) / appState.params.radialSegments).toFixed(3)} mm`, `${(appState.params.largeRadiusMm - appState.params.smallRadiusMm).toFixed(1)} mm` ];
  const statsPanel = document.querySelector('.stats-panel, .info-content');
  if (statsPanel) { const els = statsPanel.querySelectorAll('.stats-value'); if (els.length === statsVals.length) els.forEach((el, i) => el.textContent = statsVals[i]); }
  const statusVals = [`${appState.params.smallRadiusMm.toFixed(2)} mm`, `${appState.params.largeRadiusMm.toFixed(2)} mm`, `${appState.params.rotationalSegments}`, `${appState.params.radialSegments}`, turns.toFixed(4), `${spiralLength.toFixed(2)} mm` ];
  const statusBar = document.querySelector('.status-bar');
  if (statusBar) { const els = statusBar.querySelectorAll('.status-item-value'); if (els.length === statusVals.length) els.forEach((el, i) => el.textContent = statusVals[i]); }
}

function setParam(key, value) {
  if (key === 'smallRadiusMm') value = Math.min(value, appState.params.largeRadiusMm * 0.99);
  if (key === 'largeRadiusMm') value = Math.max(value, appState.params.smallRadiusMm + 0.01);
  appState.params[key] = value;
  redrawCanvas();
  updateUI();
}

function redrawCanvas() {
  const canvas = document.querySelector('canvas');
  if (!canvas) return;
  const rect = canvas.parentElement.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  if (rect.width === 0 || rect.height === 0) { requestAnimationFrame(() => redrawCanvas()); return; }
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  drawSpiral(ctx, rect.width, rect.height, appState.params, appState.isPortrait);
}

function render() {
  const app = document.getElementById('app');
  if (!app) return;
  const sliders = app.querySelectorAll('.param-slider');
  sliders.forEach(s => clearInterval(s._sliderObserver));
  app.innerHTML = '';
  const turns = appState.params.radialSegments / appState.params.rotationalSegments;
  app.appendChild(createLayout(appState.isPortrait, appState.params, turns));
  requestAnimationFrame(() => redrawCanvas());
}

window.addEventListener('resize', () => {
  const newIsPortrait = window.innerWidth < window.innerHeight;
  if (newIsPortrait !== appState.isPortrait) { appState.isPortrait = newIsPortrait; render(); }
});

if (document.readyState !== 'loading') render(); else document.addEventListener('DOMContentLoaded', render);