// ═══════════════════════════════════════════════════════════════════════════
// FUSION 360 BRIDGE
// Receives messages back from the Python add-in layer.
// ═══════════════════════════════════════════════════════════════════════════
window.fusionJavaScriptHandler = {
  handle: function (action, data) {
    if (action === 'importSuccess') {
      setExportBtnState('success');
      showToast('✓ Imported "' + data + '" into design', 'ok');
    } else if (action === 'importError') {
      setExportBtnState('error');
      showToast('Import failed – check Fusion console', 'err');
      console.error('[SpiralCompass] import error:', data);
    } else if (action === 'importCancelled') {
      setExportBtnState('idle');
      showToast('Plane selection cancelled', 'ok');
    }
    return true;
  }
};

// ─── Tiny toast helper ─────────────────────────────────────────────────────
let _toastTimer = null;
function showToast(msg, type) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'visible toast-' + (type || 'ok');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => { el.className = ''; }, 3000);
}

// ─── Export button state machine ───────────────────────────────────────────
function setExportBtnState(state) {
  const btn = document.querySelector('.export-btn');
  if (!btn) return;
  btn.disabled = false;
  btn.className = 'action-button export-btn';
  if (state === 'loading') {
    btn.textContent = 'Importing…';
    btn.disabled = true;
  } else if (state === 'success') {
    btn.textContent = '✓ Imported';
    btn.classList.add('success');
    setTimeout(() => { btn.textContent = 'Export to Fusion'; btn.className = 'action-button export-btn'; }, 2500);
  } else if (state === 'error') {
    btn.textContent = '✗ Failed';
    btn.classList.add('error-state');
    setTimeout(() => { btn.textContent = 'Export to Fusion'; btn.className = 'action-button export-btn'; }, 3000);
  } else {
    btn.textContent = 'Export to Fusion';
  }
}

// ─── DXF BUILD ─────────────────────────────────────────────────────────────
// Returns the DXF string (AC1009 / R12 format for maximum Fusion compatibility).

//function buildDXFString(params) {
//  const vertices = buildSpiralVertices(params);
//  const { radialSegments } = params;
//
//  // Header – AC1009 (AutoCAD R12) is the most stable for 2-D Fusion imports
//  let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n";
//  dxf += "0\nSECTION\n2\nENTITIES\n";
//
//  // Spiral path only — no radial lines
//  for (let i = 0; i < vertices.length - 1; i++) {
//    const [x0, y0] = [vertices[i][0],   vertices[i][1]];
//    const [x1, y1] = [vertices[i+1][0], vertices[i+1][1]];
//    dxf += "0\nLINE\n";
//    dxf += "8\nSPIRAL_PATH\n";
//    dxf += "10\n" + x0.toFixed(4) + "\n";
//    dxf += "20\n" + y0.toFixed(4) + "\n";
//    dxf += "30\n0.0\n";
//    dxf += "11\n" + x1.toFixed(4) + "\n";
//    dxf += "21\n" + y1.toFixed(4) + "\n";
//    dxf += "31\n0.0\n";
//  }
//
//  dxf += "0\nENDSEC\n0\nEOF";
//  return dxf;
//}

//function buildDXFString(params) {
//  // Calculate the exact same offset used in drawSpiral()
//  const rotationOffsetDeg = -60 + (params.radialSegments - 1) * 15;
//  
//  // Inject that offset into the vertex builder
//  const vertices = buildSpiralVertices({ ...params, rotationOffsetDeg });
//  
//  const { radialSegments } = params;
//  let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n";
//  dxf += "0\nSECTION\n2\nENTITIES\n";
//
//  for (let i = 0; i < vertices.length - 1; i++) {
//    const [x0, y0] = [vertices[i][0],   vertices[i][1]];
//    const [x1, y1] = [vertices[i+1][0], vertices[i+1][1]];
//    dxf += "0\nLINE\n8\nSPIRAL_PATH\n";
//    dxf += "10\n" + x0.toFixed(4) + "\n20\n" + y0.toFixed(4) + "\n30\n0.0\n";
//    dxf += "11\n" + x1.toFixed(4) + "\n21\n" + y1.toFixed(4) + "\n31\n0.0\n";
//  }
//
//  dxf += "0\nENDSEC\n0\nEOF";
//  return dxf;
//}

//function buildDXFString(params) {
//  const vertices = buildSpiralVertices(params);
//  
//  // Calculate the EXACT offset used in the web view's CSS/Canvas logic
//  const rotationOffsetDeg = -60 + (params.radialSegments - 1) * 15;
//  const offsetRad = (rotationOffsetDeg * Math.PI) / 180;
//
//  let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";
//
//  for (let i = 0; i < vertices.length - 1; i++) {
//    // Get raw points
//    const [rawX0, rawY0] = vertices[i];
//    const [rawX1, rawY1] = vertices[i+1];
//
//    // MANUALLY ROTATE and FLIP Y for the DXF
//    // This mimics: cy - (radius * sin(angle + offset))
//    const x0 = rawX0 * Math.cos(offsetRad) - rawY0 * Math.sin(offsetRad);
//    const y0 = -(rawX0 * Math.sin(offsetRad) + rawY0 * Math.cos(offsetRad)); // Negative to flip Y for Fusion
//
//    const x1 = rawX1 * Math.cos(offsetRad) - rawY1 * Math.sin(offsetRad);
//    const y1 = -(rawX1 * Math.sin(offsetRad) + rawY1 * Math.cos(offsetRad));
//
//    dxf += "0\nLINE\n8\nSPIRAL_PATH\n";
//    dxf += `10\n${x0.toFixed(4)}\n20\n${y0.toFixed(4)}\n30\n0.0\n`;
//    dxf += `11\n${x1.toFixed(4)}\n21\n${y1.toFixed(4)}\n31\n0.0\n`;
//  }
//
//  dxf += "0\nENDSEC\n0\nEOF";
//  return dxf;
//}

function buildDXFString(params) {
  const { smallRadiusMm, largeRadiusMm, radialSegments, rotationalSegments } = params;
  
  // 1. Calculate the exact rotation used in compass.js
  const rotationOffsetDeg = -60 + (radialSegments - 1) * 15;
  const rotationOffsetRad = (rotationOffsetDeg * Math.PI) / 180;

  const angularStep = (2 * Math.PI) / rotationalSegments;
  const radiusStep = (largeRadiusMm - smallRadiusMm) / radialSegments;

  let dxf = "0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n";

  for (let i = 0; i < radialSegments; i++) {
    // Current point and next point angles
    const angle0 = i * angularStep;
    const angle1 = (i + 1) * angularStep;
    
    const r0 = smallRadiusMm + i * radiusStep;
    const r1 = smallRadiusMm + (i + 1) * radiusStep;

    // --- MIRROR THE WEB VIEW MATH ---
    // In your drawSpiral: x = radius * cos(angle), y = -radius * sin(angle)
    // Then the whole thing is rotated by rotationOffsetRad
    
    const getTransformedPt = (r, a) => {
        // 1. Initial polar to cartesian (Matching your canvas Y-flip)
        const x_raw = r * Math.cos(a);
        const y_raw = -r * Math.sin(a); // Flip Y to match 'cy - r * sin' logic

        // 2. Apply the canvas-level rotation offset
        const x_final = x_raw * Math.cos(rotationOffsetRad) - y_raw * Math.sin(rotationOffsetRad);
        const y_final = x_raw * Math.sin(rotationOffsetRad) + y_raw * Math.cos(rotationOffsetRad);
        
        return [x_final, y_final];
    };

    const [x0, y0] = getTransformedPt(r0, angle0);
    const [x1, y1] = getTransformedPt(r1, angle1);

    dxf += "0\nLINE\n8\nSPIRAL_PATH\n";
    dxf += `10\n${x0.toFixed(4)}\n20\n${y0.toFixed(4)}\n30\n0.0\n`;
    dxf += `11\n${x1.toFixed(4)}\n21\n${y1.toFixed(4)}\n31\n0.0\n`;
  }

  dxf += "0\nENDSEC\n0\nEOF";
  return dxf;
}

// ─── EXPORT / IMPORT ENTRY POINT ───────────────────────────────────────────

function exportToDXF() {
  const { params } = appState;
  let dxf, filename;
  try {
    dxf      = buildDXFString(params);
    filename = 'spiral_r' + params.largeRadiusMm.toFixed(2) + '_rot' + params.rotationalSegments + '_rad' + params.radialSegments + '.dxf';
  } catch(e) {
    showToast('Build error: ' + e.message, 'err');
    return;
  }

  // ── Inside Fusion 360 palette ──────────────────────────────────────────
  // Try adsk.fusionSendData (works in Fusion palette WebView)
  const sendFn = (typeof adsk !== 'undefined' && adsk.fusionSendData)
                   ? adsk.fusionSendData.bind(adsk)
                   : (window.adsk && window.adsk.fusionSendData)
                       ? window.adsk.fusionSendData.bind(window.adsk)
                       : null;

  if (sendFn) {
    setExportBtnState('loading');
    try {
      sendFn('exportDXF', JSON.stringify({ dxfContent: dxf, filename: filename }));
    } catch(e) {
      setExportBtnState('error');
      showToast('Send error: ' + e.message, 'err');
    }
    return;
  }

  // ── Fallback: browser download (outside Fusion) ────────────────────────
  try {
    const blob = new Blob([dxf], { type: 'application/dxf' });
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast('DXF downloaded (not in Fusion)', 'ok');
  } catch(e) {
    showToast('Not in Fusion — adsk bridge unavailable', 'err');
  }
}