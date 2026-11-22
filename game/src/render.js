// Solmar Heat — isometric renderer: city, water, buildings with height, neon at
// night, characters, cars, minimap and HUD. All art is drawn in code.
import { iso, clamp, lerp } from './random.js';
import { WORLD_W, WORLD_H, PALETTE } from './config.js';

export function timeOfDayColor(t) {
  // t: 0..1 over the day. Returns sky + light level.
  if (t < 0.2) return { sky: '#2a3a6a', light: 0.55 };
  if (t < 0.3) return { sky: lerpColor('#2a3a6a', '#ff9a5c', (t - 0.2) / 0.1), light: 0.7 };
  if (t < 0.45) return { sky: lerpColor('#ff9a5c', '#7ec8e3', (t - 0.3) / 0.15), light: 1 };
  if (t < 0.65) return { sky: '#7ec8e3', light: 1 };
  if (t < 0.75) return { sky: lerpColor('#7ec8e3', '#ff7e5f', (t - 0.65) / 0.1), light: 0.9 };
  if (t < 0.85) return { sky: lerpColor('#ff7e5f', '#1b2340', (t - 0.75) / 0.1), light: 0.6 };
  return { sky: '#1b2340', light: 0.45 };
}
function lerpColor(a, b, t) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return '#' + pa.map((v, i) => Math.round(lerp(v, pb[i], clamp(t, 0, 1))).toString(16).padStart(2, '0')).join('');
}
export function isNight(t) { return t < 0.22 || t > 0.82; }

function drawIsoBox(ctx, x, y, w, h, height, color, topColor) {
  const a = iso(x, y), b = iso(x + w, y), c = iso(x + w, y + h), d = iso(x, y + h);
  const top = (p) => ({ x: p.x, y: p.y - height });
  ctx.fillStyle = shade(color, -28);
  ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.lineTo(top(c).x, top(c).y); ctx.lineTo(top(d).x, top(d).y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(color, -55);
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(top(c).x, top(c).y); ctx.lineTo(top(b).x, top(b).y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = topColor || shade(color, 22);
  ctx.beginPath(); ctx.moveTo(top(a).x, top(a).y); ctx.lineTo(top(b).x, top(b).y); ctx.lineTo(top(c).x, top(c).y); ctx.lineTo(top(d).x, top(d).y); ctx.closePath(); ctx.fill();
}
export function shade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp((n >> 16) + amt, 0, 255), g = clamp(((n >> 8) & 255) + amt, 0, 255), b = clamp((n & 255) + amt, 0, 255);
  return `rgb(${r},${g},${b})`;
}

export function drawWorld(ctx, game, cam, viewW, viewH, animT) {
  const { world } = game;
  const tod = timeOfDayColor(game.timeOfDay);
  ctx.fillStyle = tod.sky;
  ctx.fillRect(0, 0, viewW, viewH);
  // Ground plane in iso: draw the world diamond.
  const corners = [iso(0, 0), iso(WORLD_W, 0), iso(WORLD_W, WORLD_H), iso(0, WORLD_H)];
  ctx.fillStyle = '#8aa86a';
  ctx.beginPath(); corners.forEach((p, i) => i ? ctx.lineTo(p.x - cam.x, p.y - cam.y) : ctx.moveTo(p.x - cam.x, p.y - cam.y)); ctx.closePath(); ctx.fill();
  const px = (x, y, z = 0) => { const p = iso(x, y, z); return { x: p.x - cam.x, y: p.y - cam.y }; };
  // Water with animated waves.
  for (const w of world.water) {
    const a = px(w.x, w.y), b = px(w.x + w.w, w.y), c = px(w.x + w.w, w.y + w.h), d = px(w.x, w.y + w.h);
    ctx.fillStyle = PALETTE.water;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const wx = w.x + ((i * 331 + animT * 40) % w.w);
      const wy = w.y + ((i * 197) % w.h);
      const p1 = px(wx, wy), p2 = px(wx + 70, wy + 30);
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    }
  }
  for (const isl of world.islands) {
    const a = px(isl.x, isl.y), b = px(isl.x + isl.w, isl.y), c = px(isl.x + isl.w, isl.y + isl.h), d = px(isl.x, isl.y + isl.h);
    ctx.fillStyle = '#c8d89a';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = 'bold 13px sans-serif'; ctx.textAlign = 'center';
    const mid = px(isl.x + isl.w / 2, isl.y + isl.h / 2);
    ctx.fillText(isl.name, mid.x, mid.y);
  }
  // Roads: dark strips along the grid, with dashed centre lines.
  ctx.fillStyle = PALETTE.road;
  for (let gx = 0; gx <= WORLD_W; gx += 200) {
    const a = px(gx, 0), b = px(gx + 56, 0), c = px(gx + 56, WORLD_H), d = px(gx, WORLD_H);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  }
  for (let gy = 0; gy <= WORLD_H; gy += 200) {
    const a = px(0, gy), b = px(WORLD_W, gy), c = px(WORLD_W, gy + 56), d = px(0, gy + 56);
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  }
  // Beach sand strip.
  const s1 = px(0, 1860), s2 = px(WORLD_W, 1860), s3 = px(WORLD_W, 1960), s4 = px(0, 1960);
  ctx.fillStyle = PALETTE.sand;
  ctx.beginPath(); ctx.moveTo(s1.x, s1.y); ctx.lineTo(s2.x, s2.y); ctx.lineTo(s3.x, s3.y); ctx.lineTo(s4.x, s4.y); ctx.closePath(); ctx.fill();
  // Bridges.
  for (const br of world.bridges) {
    const a = px(br.x, br.y), b = px(br.x + br.w, br.y), c = px(br.x + br.w, br.y + br.h), d = px(br.x, br.y + br.h);
    ctx.fillStyle = '#6a5a44';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y); ctx.closePath(); ctx.fill();
  }
  // District labels.
  ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
  for (const d of [{ name: 'PORT & DOCKS', x: 300, y: 300 }, { name: 'DOWNTOWN', x: 1000, y: 400 }, { name: 'MARINA', x: 1670, y: 300 }, { name: 'BEACH STRIP', x: 1100, y: 1900 }, { name: 'HILLSIDE VILLAS', x: 1950, y: 1000 }, { name: 'OLD TOWN', x: 1100, y: 1500 }]) {
    const p = px(d.x, d.y); ctx.fillText(d.name, p.x, p.y);
  }
  // Props: crates, containers, umbrellas.
  for (const pr of world.props) {
    const p = px(pr.x, pr.y);
    if (pr.kind === 'umbrella') {
      ctx.fillStyle = pr.c; ctx.beginPath(); ctx.arc(p.x, p.y - 14, 14, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = '#8a6a3a'; ctx.beginPath(); ctx.moveTo(p.x, p.y - 14); ctx.lineTo(p.x, p.y + 4); ctx.stroke();
    } else {
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(0);
      ctx.fillStyle = pr.c; ctx.fillRect(-14, -22, 28, 22);
      ctx.fillStyle = shade(pr.c, 30); ctx.fillRect(-14, -22, 28, 6);
      ctx.restore();
    }
  }
  // Garage (the goal building) — drawn bigger, with a sign.
  const g = world.garage;
  ctx.save();
  const gp = px(g.x, g.y);
  drawIsoBoxAt(ctx, px, g.x, g.y, g.w, g.h, 64, '#d97b4f', '#f0a070');
  ctx.fillStyle = '#fff'; ctx.font = 'bold 15px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('MARIN GARAGE', gp.x, gp.y - 78);
  ctx.restore();
  // Shop + hospital markers.
  for (const spot of [world.shop, world.hospital]) {
    const p = px(spot.x, spot.y);
    drawIsoBoxAt(ctx, px, spot.x, spot.y, spot.w, spot.h, 40, '#e8e0d0', '#fff');
    ctx.fillStyle = '#222'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(spot.name || 'HOSPITAL', p.x, p.y - 52);
  }
  // Buildings sorted by iso depth (y + x) so near ones overlap far ones.
  const sorted = [...world.buildings].sort((a, b) => (a.x + a.y) - (b.x + b.y));
  for (const b of sorted) {
    const top = px(b.x + b.w / 2, b.y + b.h / 2, b.height);
    drawIsoBoxAt(ctx, px, b.x, b.y, b.w, b.h, b.height, b.color, null);
    if (b.roof === 'pool') { ctx.fillStyle = '#4aa8d8'; ctx.beginPath(); ctx.ellipse(top.x, top.y, 16, 8, 0, 0, Math.PI * 2); ctx.fill(); }
    if (b.roof === 'dome') { ctx.fillStyle = shade(b.color, 40); ctx.beginPath(); ctx.arc(top.x, top.y, 14, Math.PI, 0); ctx.fill(); }
    if (isNight(game.timeOfDay)) {
      // Lit windows.
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      const rows = Math.max(1, Math.floor(b.height / 34));
      for (let r = 0; r < rows; r++) {
        const wp = px(b.x + b.w * 0.7, b.y + 14 + r * 22, b.height - 18 - r * 26);
        ctx.fillRect(wp.x - 3, wp.y - 4, 6, 8);
      }
      if (b.neon) {
        ctx.fillStyle = b.neon; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
        const np = px(b.x + b.w / 2, b.y, b.height + 8);
        ctx.fillText('SOLMAR', np.x, np.y);
      }
    }
  }
  // Palm trees.
  for (const palm of world.palms) {
    const p = px(palm.x, palm.y);
    const sway = Math.sin(animT * 1.2 + palm.sway) * 3;
    ctx.strokeStyle = '#8a6a3a'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x + sway, p.y - 26 * palm.s); ctx.stroke();
    ctx.strokeStyle = '#3f9e4d'; ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      const a = -0.4 - i * 0.5;
      ctx.beginPath(); ctx.moveTo(p.x + sway, p.y - 26 * palm.s);
      ctx.quadraticCurveTo(p.x + sway + Math.cos(a) * 16, p.y - 26 * palm.s - 8, p.x + sway + Math.cos(a) * 24, p.y - 26 * palm.s + 4);
      ctx.stroke();
    }
  }
  return px;
}
function drawIsoBoxAt(ctx, px, x, y, w, h, height, color, topColor) {
  const a = px(x, y), b = px(x + w, y), c = px(x + w, y + h), d = px(x, y + h);
  const t = (p) => ({ x: p.x, y: p.y - height });
  ctx.fillStyle = shade(color, -28);
  ctx.beginPath(); ctx.moveTo(d.x, d.y); ctx.lineTo(c.x, c.y); ctx.lineTo(t(c).x, t(c).y); ctx.lineTo(t(d).x, t(d).y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = shade(color, -55);
  ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(t(c).x, t(c).y); ctx.lineTo(t(b).x, t(b).y); ctx.closePath(); ctx.fill();
  ctx.fillStyle = topColor || shade(color, 22);
  ctx.beginPath(); ctx.moveTo(t(a).x, t(a).y); ctx.lineTo(t(b).x, t(b).y); ctx.lineTo(t(c).x, t(c).y); ctx.lineTo(t(d).x, t(d).y); ctx.closePath(); ctx.fill();
}

export function drawCarIso(ctx, px, car, isPlayerCar) {
  const p = px(car.x, car.y);
  ctx.save(); ctx.translate(p.x, p.y);
  const w = car.isBoat ? 52 : 46, h = car.isBoat ? 22 : 24;
  // Iso-ish rotated body: rotate by screen angle derived from world angle.
  const screenAngle = Math.atan2(Math.sin(car.angle) * 0.5, Math.cos(car.angle));
  ctx.rotate(screenAngle);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(0, 4, w / 2 + 3, h / 2 + 3, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = car.color; roundRect(ctx, -w / 2, -h / 2, w, h, 7); ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)'; roundRect(ctx, -w / 6, -h / 2 + 3, w / 3, h - 6, 4); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(-w / 2 + 4, -h / 2 - 2, 6, 4); ctx.fillRect(-w / 2 + 4, h / 2 - 2, 6, 4);
  ctx.fillRect(w / 2 - 10, -h / 2 - 2, 6, 4); ctx.fillRect(w / 2 - 10, h / 2 - 2, 6, 4);
  if (car.isPolice) {
    ctx.fillStyle = '#fff'; ctx.fillRect(-4, -h / 2 + 2, 8, h - 4);
    ctx.fillStyle = (Math.floor(performance.now() / 300) % 2 ? '#ff2222' : '#2266ff');
    ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();
  }
  if (isPlayerCar) { ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 2; ctx.strokeRect(-w / 2 - 3, -h / 2 - 3, w + 6, h + 6); }
  ctx.restore();
}
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function drawPersonIso(ctx, px, x, y, angle, color, label, isPlayer) {
  const p = px(x, y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.beginPath(); ctx.ellipse(p.x, p.y + 2, 10, 4, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = color; ctx.beginPath(); ctx.arc(p.x, p.y - 12, 7, 0, Math.PI * 2); ctx.fill(); // head
  ctx.fillStyle = isPlayer ? '#ff5a7a' : color;
  ctx.beginPath(); ctx.arc(p.x, p.y - 12, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#222'; ctx.fillRect(p.x - 6, p.y - 6, 12, 14); // body
  ctx.fillStyle = '#f2c89a'; ctx.beginPath(); ctx.arc(p.x, p.y - 12, 5, 0, Math.PI * 2); ctx.fill();
  if (isPlayer) {
    ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(p.x, p.y - 8, 15, 0, Math.PI * 2); ctx.stroke();
  }
  if (label) { ctx.fillStyle = '#fff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(label, p.x, p.y - 26); }
}

export function drawMinimap(ctx, game, x, y, size) {
  const scale = size / WORLD_W;
  ctx.save();
  ctx.fillStyle = 'rgba(10,14,24,0.85)'; roundRect(ctx, x - 4, y - 4, size + 8, size + 8, 8); ctx.fill();
  ctx.strokeStyle = '#ffe600'; ctx.lineWidth = 1.5; ctx.strokeRect(x - 4, y - 4, size + 8, size + 8);
  for (const w of game.world.water) ctx.fillStyle = '#2a7fa8', ctx.fillRect(x + w.x * scale, y + w.y * scale, w.w * scale, w.h * scale);
  ctx.fillStyle = '#3a3a44';
  for (let gx = 0; gx <= WORLD_W; gx += 200) ctx.fillRect(x + gx * scale, y, 2, size);
  for (const b of game.world.buildings) { ctx.fillStyle = '#c8a070'; ctx.fillRect(x + b.x * scale, y + b.y * scale, Math.max(1, b.w * scale), Math.max(1, b.h * scale)); }
  const m = game.mission; const cur = m && m.status === 'active' ? (game.missionDef?.target || null) : null;
  if (cur) {
    ctx.fillStyle = '#ffe600'; ctx.beginPath(); ctx.arc(x + cur.x * scale, y + cur.y * scale, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#ffe600'; ctx.beginPath(); ctx.arc(x + cur.x * scale, y + cur.y * scale, 9, 0, Math.PI * 2); ctx.stroke();
  }
  const px = game.player.inCar ? game.player.inCar.x : game.player.x;
  const py = game.player.inCar ? game.player.inCar.y : game.player.y;
  ctx.fillStyle = '#ff5a7a'; ctx.beginPath(); ctx.arc(x + px * scale, y + py * scale, 4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('SOLMAR', x + 4, y + size - 6);
  ctx.restore();
}

export function drawHUD(ctx, game, viewW) {
  const p = game.player;
  ctx.textAlign = 'left';
  // Top-left: cash, health, armor.
  ctx.fillStyle = 'rgba(10,14,24,0.8)'; roundRect(ctx, 10, 10, 250, 64, 8); ctx.fill();
  ctx.fillStyle = '#7cff6a'; ctx.font = 'bold 20px sans-serif'; ctx.fillText(`$${p.cash.toLocaleString()}`, 22, 36);
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif'; ctx.fillText(`Health ${Math.round(p.health)}${p.armor > 0 ? '  Armor ' + Math.round(p.armor) : ''}`, 22, 56);
  ctx.fillStyle = '#333'; ctx.fillRect(130, 44, 110, 10);
  ctx.fillStyle = p.health > 40 ? '#4ade80' : '#ef4444'; ctx.fillRect(130, 44, 110 * clamp(p.health / 100, 0, 1), 10);
  // Wanted stars top-right.
  ctx.fillStyle = 'rgba(10,14,24,0.8)'; roundRect(ctx, viewW - 190, 10, 180, 44, 8); ctx.fill();
  for (let i = 0; i < 5; i++) {
    ctx.fillStyle = i < game.wanted ? '#ffd700' : 'rgba(255,255,255,0.25)';
    drawStar(ctx, viewW - 172 + i * 32, 32, 11);
  }
  // Mission objective bar.
  const m = game.missionDef;
  if (m && game.mission.status === 'active') {
    ctx.fillStyle = 'rgba(10,14,24,0.8)'; roundRect(ctx, 10, 84, 420, 44, 8); ctx.fill();
    ctx.fillStyle = '#ffe600'; ctx.font = 'bold 14px sans-serif'; ctx.fillText(`MISSION ${m.id}: ${m.title}`, 22, 103);
    ctx.fillStyle = '#fff'; ctx.font = '12px sans-serif'; ctx.fillText(game.missionObjectiveText || m.text, 22, 121);
  }
  // Weapon + clock bottom-left.
  ctx.fillStyle = 'rgba(10,14,24,0.8)'; roundRect(ctx, 10, 640 - 10, 220, 40, 8); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = '13px sans-serif';
  const ammo = p.weapon === 'fists' ? '∞' : String(p.ammo[p.weapon] ?? 0);
  ctx.fillText(`${p.weapon.toUpperCase()}  •  Ammo ${ammo}  •  ${game.clockText}`, 22, 656);
  if (game.message) {
    ctx.fillStyle = 'rgba(10,14,24,0.85)'; roundRect(ctx, viewW / 2 - 260, 140, 520, 34, 8); ctx.fill();
    ctx.fillStyle = '#ffe600'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(game.message, viewW / 2, 162); ctx.textAlign = 'left';
  }
}
function drawStar(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
    const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath(); ctx.fill();
}
