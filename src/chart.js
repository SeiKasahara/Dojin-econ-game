/**
 * Supply-Demand Chart — Canvas-based visualization
 * Shows how reputation shifts demand, info disclosure affects conversion
 */

const DPR = typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1;

export function createChartCanvas() {
  const canvas = document.createElement('canvas');
  const W = 300, H = 200;
  canvas.width = W * DPR;
  canvas.height = H * DPR;
  canvas.style.width = W + 'px';
  canvas.style.height = H + 'px';
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  return canvas;
}

export function drawSupplyDemand(canvas, data, animate = true) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width / DPR;
  const H = canvas.height / DPR;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // Chart area with margins
  const ml = 40, mr = 16, mt = 16, mb = 32;
  const cw = W - ml - mr;
  const ch = H - mt - mb;

  // Data
  const { Pmax, slope, Qsupply, Peq, Qmax, reputation, infoDisclosure } = data;

  // Scale
  const scaleX = (q) => ml + (q / Qmax) * cw;
  const scaleY = (p) => mt + ch - (p / (Pmax * 1.2)) * ch;

  // Animate
  const frames = animate ? 30 : 1;
  let frame = 0;

  function draw() {
    const t = animate ? Math.min(1, frame / frames) : 1;
    const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic

    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = '#FFFBF5';
    ctx.fillRect(0, 0, W, H);

    // Grid lines (subtle)
    ctx.strokeStyle = '#F0E6D8';
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 4; i++) {
      const y = mt + (ch / 5) * i;
      ctx.beginPath();
      ctx.moveTo(ml, y);
      ctx.lineTo(ml + cw, y);
      ctx.stroke();
    }

    // Axes
    ctx.strokeStyle = '#3D2B1F';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(ml, mt);
    ctx.lineTo(ml, mt + ch);
    ctx.lineTo(ml + cw, mt + ch);
    ctx.stroke();

    // Axis labels
    ctx.fillStyle = '#8B7355';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('数量 Q', ml + cw / 2, H - 4);
    ctx.save();
    ctx.translate(12, mt + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('价格 P', 0, 0);
    ctx.restore();

    // Demand curve (animated)
    const curPmax = Pmax * eased;
    ctx.strokeStyle = '#C73E3A';
    ctx.lineWidth = 2;
    ctx.beginPath();
    const qEnd = Math.min(Qmax, curPmax / slope);
    for (let q = 0; q <= qEnd; q += 0.5) {
      const p = curPmax - slope * q;
      if (p < 0) break;
      const x = scaleX(q);
      const y = scaleY(p);
      if (q === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Demand label
    if (eased > 0.5) {
      ctx.fillStyle = '#C73E3A';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'left';
      const lblQ = Math.min(qEnd * 0.7, Qmax * 0.6);
      const lblP = curPmax - slope * lblQ;
      ctx.fillText('D (需求)', scaleX(lblQ) + 4, scaleY(lblP) - 4);
    }

    // Supply curve (vertical at Qsupply)
    const curQ = Qsupply * eased;
    ctx.strokeStyle = '#3498DB';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(scaleX(curQ), mt + ch);
    ctx.lineTo(scaleX(curQ), mt);
    ctx.stroke();
    ctx.setLineDash([]);

    if (eased > 0.5) {
      ctx.fillStyle = '#3498DB';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('S (产量)', scaleX(curQ), mt + 12);
    }

    // Equilibrium point
    if (eased > 0.3) {
      const eqP = Math.max(0, curPmax - slope * curQ);
      const eqX = scaleX(curQ);
      const eqY = scaleY(eqP);

      // Revenue area (shaded)
      ctx.fillStyle = 'rgba(39, 174, 96, 0.12)';
      ctx.fillRect(ml, eqY, eqX - ml, mt + ch - eqY);

      // Equilibrium dot
      ctx.fillStyle = '#27AE60';
      ctx.beginPath();
      ctx.arc(eqX, eqY, 5 * eased, 0, Math.PI * 2);
      ctx.fill();

      // Price label
      ctx.fillStyle = '#27AE60';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(`P*≈¥${Math.round(eqP)}`, ml - 4, eqY + 4);

      // Revenue label
      if (eased > 0.8) {
        const rev = Math.round(eqP * curQ);
        ctx.fillStyle = '#27AE60';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`收入≈¥${rev}`, (ml + eqX) / 2, (eqY + mt + ch) / 2 + 4);
      }
    }

    // Info disclosure indicator
    if (eased > 0.8) {
      const barW = 60;
      const barH = 6;
      const bx = ml + cw - barW - 4;
      const by = mt + 4;

      ctx.fillStyle = '#F0E6D8';
      ctx.fillRect(bx, by, barW, barH);
      ctx.fillStyle = '#E6A817';
      ctx.fillRect(bx, by, barW * infoDisclosure, barH);
      ctx.fillStyle = '#8B7355';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(`信息透明 ${Math.round(infoDisclosure * 100)}%`, bx, by + barH + 10);

      // Reputation indicator
      ctx.fillText(`声誉 =${reputation.toFixed(1)}`, bx, by + barH + 22);
    }

    frame++;
    if (frame <= frames) requestAnimationFrame(draw);
  }

  draw();
}
