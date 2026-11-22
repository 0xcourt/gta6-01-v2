// Solmar Heat — the isometric renderer.
// Canvas 2D only, everything drawn in code. World tiles project to screen
// with the classic 2:1 iso formula; buildings are shaded iso boxes; the HUD
// (cash, health, armor, wanted stars, mission, clock) and a live minimap sit
// on top; title, pause, game-over and story-complete screens are overlays.
// A day/night palette shifts the whole scene as the in-game clock moves.

import { TILE_W, TILE_H, PALETTES, WORLD_SIZE } from './config.js';
import { clamp, lerp, distance } from './random.js';
import { TILE } from './world.js';

// World (tile) coordinates -> screen pixels, before the camera offset.
export function project(x, y, z = 0) {
  return {
    x: (x - y) * (TILE_W / 2),
    y: (x + y) * (TILE_H / 2) - z,
  };
}

// Screen pixels (before camera offset) -> world tile coordinates, ground plane.
export function unproject(sx, sy) {
  const a = sx / (TILE_W / 2);
  const b = sy / (TILE_H / 2);
  return { x: (a + b) / 2, y: (b - a) / 2 };
}

// Which palette the clock asks for, and how far between day/sunset/night.
export function paletteFor(hour) {
  const h = ((hour % 24) + 24) % 24;
  if (h >= 7 && h < 17) return { ...PALETTES.day, blend: 0 };
  if (h >= 17 && h < 19) {
    const t = (h - 17) / 2;
    return { ...mixPalette(PALETTES.day, PALETTES.sunset, t), name: 'sunset', blend: t };
  }
  if (h >= 19 || h < 5) return { ...PALETTES.night, blend: 1 };
  const t = (h - 5) / 2; // 05:00 -> 07:00 dawn
  return { ...mixPalette(PALETTES.night, PALETTES.day, t), name: 'dawn', blend: 1 - t };
}

function mixPalette(a, b, t) {
  const out = {};
  for (const key of Object.keys(a)) {
    if (key === 'name') continue;
    if (typeof a[key] === 'number') out[key] = lerp(a[key], b[key], t);
    else out[key] = t < 0.5 ? a[key] : b[key];
  }
  return out;
}

function shade(hex, factor) {
  const n = parseInt(hex.slice(1), 16);
  const r = clamp(Math.round(((n >> 16) & 255) * factor), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * factor), 0, 255);
  const b = clamp(Math.round((n & 255) * factor), 0, 255);
  return `rgb(${r},${g},${b})`;
}

function drawIsoTile(ctx, sx, sy, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(sx, sy - TILE_H / 2);
  ctx.lineTo(sx + TILE_W / 2, sy);
  ctx.lineTo(sx, sy + TILE_H / 2);
  ctx.lineTo(sx - TILE_W / 2, sy);
  ctx.closePath();
  ctx.fill();
}

function drawIsoBox(ctx, sx, sy, w, d, h, color, roofColor, neon, neonColor, night) {
  const hw = (w * TILE_W) / 2;
  const hd = (d * TILE_W) / 2;
  const topY = sy - h;
  // Left face (darker), right face (mid), roof (light).
  ctx.fillStyle = shade(color, 0.62);
  ctx.beginPath();
  ctx.moveTo(sx - hw, sy - hd / 2);
  ctx.lineTo(sx, sy);
  ctx.lineTo(sx, topY);
  ctx.lineTo(sx - hw, topY - hd / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(color, 0.82);
  ctx.beginPath();
  ctx.moveTo(sx + hw, sy - hd / 2);
  ctx.lineTo(sx, sy);
  ctx.lineTo(sx, topY);
  ctx.lineTo(sx + hw, topY - hd / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade(roofColor, 1.05);
  ctx.beginPath();
  ctx.moveTo(sx, topY - hd);
  ctx.lineTo(sx + hw, topY - hd / 2);
  ctx.lineTo(sx, topY);
  ctx.lineTo(sx - hw, topY - hd / 2);
  ctx.closePath();
  ctx.fill();
  // Lit windows at night, and a neon strip on some downtown towers.
  if (night > 0.3 && h > 30) {
    ctx.fillStyle = `rgba(255, 214, 90, ${0.55 * night})`;
    const rows = Math.min(5, Math.floor(h / 18));
    for (let r = 0; r < rows; r += 1) {
      const wy = topY + 8 + r * 16;
      ctx.fillRect(sx - hw * 0.45, wy, 5, 8);
      ctx.fillRect(sx + hw * 0.2, wy, 5, 8);
    }
  }
  if (neon && night > 0.2) {
    ctx.fillStyle = neonColor;
    ctx.globalAlpha = 0.9;
    ctx.fillRect(sx - 3, topY - 6, 6, h * 0.55);
    ctx.globalAlpha = 1;
  }
}

function drawTree(ctx, sx, sy, kind, s, night) {
  if (kind === 'palm') {
    ctx.strokeStyle = shade('#7a5230', night > 0.5 ? 0.7 : 1);
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(sx + 2 * s, sy - 22 * s);
    ctx.stroke();
    ctx.fillStyle = shade('#2f9e44', night > 0.5 ? 0.55 : 1);
    for (let i = 0; i < 5; i += 1) {
      const a = (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.ellipse(
        sx + 2 * s + Math.cos(a) * 10 * s, sy - 22 * s + Math.sin(a) * 5 * s,
        11 * s, 4 * s, a, 0, Math.PI * 2,
      );
      ctx.fill();
    }
  } else {
    ctx.fillStyle = shade('#8d5a2b', night > 0.5 ? 0.7 : 1);
    ctx.fillRect(sx - 2, sy - 10 * s, 4, 10 * s);
    ctx.fillStyle = shade('#3f7d3a', night > 0.5 ? 0.55 : 1);
    ctx.beginPath();
    ctx.arc(sx, sy - 16 * s, 10 * s, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawCarShape(ctx, sx, sy, angle, color, kind, night) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  const w = 34;
  const h = 18;
  ctx.fillStyle = '#111111';
  ctx.fillRect(-w / 2 - 2, -h / 2 - 2, w + 4, h + 4);
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = kind === 'police' ? '#e8e8e8' : shade(color, 0.7);
  ctx.fillRect(-w / 2 + 5, -h / 2 + 3, w - 14, h - 6);
  ctx.fillStyle = '#9fd8ff';
  ctx.fillRect(-2, -h / 2 + 2, 8, h - 4);
  if (kind === 'police') {
    ctx.fillStyle = '#2233ff';
    ctx.fillRect(-w / 2 + 2, -h / 2 + 2, 6, 5);
    ctx.fillStyle = '#ff2222';
    ctx.fillRect(-w / 2 + 2, h / 2 - 7, 6, 5);
  }
  if (kind === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 7px sans-serif';
    ctx.fillText('TAXI', -w / 2 + 6, 3);
  }
  if (night > 0.4) {
    ctx.fillStyle = 'rgba(255, 240, 170, 0.85)';
    ctx.beginPath();
    ctx.arc(w / 2 + 2, -h / 2 + 3, 2.5, 0, Math.PI * 2);
    ctx.arc(w / 2 + 2, h / 2 - 3, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawPerson(ctx, sx, sy, person, night) {
  const bob = Math.sin(person.walkCycle || 0) * 1.5;
  ctx.fillStyle = '#222';
  ctx.fillRect(sx - 3, sy - 2, 6, 8); // legs
  ctx.fillStyle = person.color || '#e74c3c';
  ctx.fillRect(sx - 4, sy - 12 + bob * 0.3, 8, 10); // torso
  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(sx, sy - 15 + bob * 0.3, 4, 0, Math.PI * 2);
  ctx.fill();
  if (person.state === 'cop') {
    ctx.fillStyle = '#1a2a6b';
    ctx.fillRect(sx - 4, sy - 12 + bob * 0.3, 8, 10);
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(sx - 4, sy - 19 + bob * 0.3, 8, 3);
  }
  if (person.state === 'panic') {
    ctx.fillStyle = '#ffdd00';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('!', sx + 6, sy - 16);
  }
}

function drawBoatShape(ctx, sx, sy, angle, color) {
  ctx.save();
  ctx.translate(sx, sy);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(0, 0, 26, 10, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#f5f5f5';
  ctx.fillRect(-8, -6, 14, 12);
  ctx.fillStyle = '#223344';
  ctx.fillRect(2, -4, 6, 8);
  ctx.restore();
}

// ---- the world ------------------------------------------------------------

export function drawGame(ctx, game) {
  const canvas = ctx.canvas;
  const W = canvas.width;
  const H = canvas.height;
  const palette = paletteFor(game.timeHours);
  const night = palette.night;

  ctx.fillStyle = palette.sky;
  ctx.fillRect(0, 0, W, H);

  // Camera: keep the player (or the title camera target) centred.
  const focus = game.cameraTarget || game.player;
  const focusP = project(focus.x, focus.y, 0);
  const camX = focusP.x - W / 2;
  const camY = focusP.y - H / 2;
  game.camX = camX;
  game.camY = camY;
  game.viewW = W;
  game.viewH = H;
  ctx.save();
  ctx.translate(-camX, -camY);

  const world = game.world;
  // Visible tile range, with a margin for tall buildings.
  const topLeft = unproject(camX - 80, camY - 160);
  const bottomRight = unproject(camX + W + 80, camY + H + 80);
  const x0 = clamp(Math.floor(Math.min(topLeft.x, bottomRight.x)) - 2, 0, WORLD_SIZE - 1);
  const x1 = clamp(Math.ceil(Math.max(topLeft.x, bottomRight.x)) + 2, 0, WORLD_SIZE - 1);
  const y0 = clamp(Math.floor(Math.min(topLeft.y, bottomRight.y)) - 2, 0, WORLD_SIZE - 1);
  const y1 = clamp(Math.ceil(Math.max(topLeft.y, bottomRight.y)) + 2, 0, WORLD_SIZE - 1);

  // Ground tiles, painter's order (x + y ascending).
  for (let s = x0 + y0; s <= x1 + y1; s += 1) {
    for (let x = x0; x <= x1; x += 1) {
      const y = s - x;
      if (y < y0 || y > y1) continue;
      const t = world.grid[y][x];
      const p = project(x + 0.5, y + 0.5, 0);
      if (t === TILE.WATER) drawIsoTile(ctx, p.x, p.y, palette.water);
      else if (t === TILE.BEACH) drawIsoTile(ctx, p.x, p.y, palette.beach);
      else if (t === TILE.DOCK) drawIsoTile(ctx, p.x, p.y, palette.dock);
      else if (t === TILE.BRIDGE) drawIsoTile(ctx, p.x, p.y, palette.bridge);
      else if (t === TILE.ROAD) {
        drawIsoTile(ctx, p.x, p.y, palette.road);
        if ((x % 4 === 0 && y % 2 === 0) || (y % 4 === 0 && x % 2 === 0)) {
          ctx.fillStyle = palette.roadLine;
          ctx.fillRect(p.x - 1, p.y - 1, 2, 2);
        }
      } else {
        const district = (x + y) % 3 === 0 ? palette.landDry : palette.land;
        drawIsoTile(ctx, p.x, p.y, district);
      }
    }
  }

  // Mission marker, drawn on the ground under everything tall.
  const objective = game.missions && game.missions.objective();
  if (objective && objective.x !== undefined && game.state === 'playing') {
    const p = project(objective.x, objective.y, 0);
    const pulse = 1 + Math.sin(game.elapsed * 4) * 0.15;
    ctx.strokeStyle = '#ffd319';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, 26 * pulse, 13 * pulse, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd319';
    ctx.beginPath();
    ctx.moveTo(p.x, p.y - 66);
    ctx.lineTo(p.x - 9, p.y - 48);
    ctx.lineTo(p.x + 9, p.y - 48);
    ctx.closePath();
    ctx.fill();
  }

  // Buildings, trees and props, sorted by depth so near things overlap far ones.
  const drawables = [];
  for (const b of world.buildings) drawables.push({ sort: b.x + b.w / 2 + b.y + b.d / 2, type: 'building', b });
  for (const t of world.trees) drawables.push({ sort: t.x + t.y, type: 'tree', t });
  for (const pr of world.props) drawables.push({ sort: pr.x + pr.y, type: 'prop', pr });
  drawables.sort((a, b) => a.sort - b.sort);
  for (const d of drawables) {
    if (d.type === 'building') {
      const b = d.b;
      const p = project(b.x + b.w / 2, b.y + b.d / 2, 0);
      drawIsoBox(ctx, p.x, p.y, b.w, b.d, b.h, b.color, b.roof, b.neon, b.neonColor, night);
    } else if (d.type === 'tree') {
      const p = project(d.t.x, d.t.y, 0);
      drawTree(ctx, p.x, p.y, d.t.kind, d.t.s, night);
    } else if (d.pr.kind === 'lamp') {
      const p = project(d.pr.x, d.pr.y, 0);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y - 22);
      ctx.stroke();
      if (night > 0.4) {
        ctx.fillStyle = 'rgba(255, 230, 140, 0.9)';
        ctx.beginPath();
        ctx.arc(p.x, p.y - 23, 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (d.pr.kind === 'crate') {
      const p = project(d.pr.x, d.pr.y, 0);
      ctx.fillStyle = '#8a6d3b';
      ctx.fillRect(p.x - 6, p.y - 10, 12, 10);
    } else if (d.pr.kind === 'hydrant') {
      const p = project(d.pr.x, d.pr.y, 0);
      ctx.fillStyle = '#c0392b';
      ctx.fillRect(p.x - 3, p.y - 8, 6, 8);
    }
  }

  // Vehicles and people, also depth-sorted.
  const actors = [];
  for (const c of game.parkedCars) actors.push({ sort: c.x + c.y, draw: () => {
    const p = project(c.x, c.y, 0);
    drawCarShape(ctx, p.x, p.y, c.angle, c.color, c.vehicleKind, night);
  } });
  for (const c of game.traffic) actors.push({ sort: c.x + c.y, draw: () => {
    const p = project(c.x, c.y, 0);
    drawCarShape(ctx, p.x, p.y, c.angle, c.color, c.vehicleKind, night);
  } });
  for (const c of game.police) actors.push({ sort: c.x + c.y, draw: () => {
    const p = project(c.x, c.y, 0);
    drawCarShape(ctx, p.x, p.y, c.angle, c.color, 'police', night);
    if (night >= 0 || true) {
      const flash = Math.sin(c.sirenPhase) > 0 ? '#2244ff' : '#ff2222';
      ctx.fillStyle = flash;
      ctx.beginPath();
      ctx.arc(p.x, p.y - 24, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  } });
  if (game.boat) actors.push({ sort: game.boat.x + game.boat.y, draw: () => {
    const p = project(game.boat.x, game.boat.y, 0);
    drawBoatShape(ctx, p.x, p.y, game.boat.angle, game.boat.color);
  } });
  if (game.policeBoat) actors.push({ sort: game.policeBoat.x + game.policeBoat.y, draw: () => {
    const p = project(game.policeBoat.x, game.policeBoat.y, 0);
    drawBoatShape(ctx, p.x, p.y, game.policeBoat.angle, '#223355');
  } });
  for (const ped of game.peds) actors.push({ sort: ped.x + ped.y, draw: () => {
    const p = project(ped.x, ped.y, 0);
    drawPerson(ctx, p.x, p.y, ped, night);
  } });
  actors.push({ sort: game.player.x + game.player.y, draw: () => {
    const p = project(game.player.x, game.player.y, 0);
    if (game.player.onFoot) {
      drawPerson(ctx, p.x, p.y, { ...game.player, color: '#ff5e8a', walkCycle: game.player.walkCycle }, night);
      // Aim direction tick.
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 12);
      const aim = project(game.player.x + Math.cos(game.player.aimAngle) * 1.1,
        game.player.y + Math.sin(game.player.aimAngle) * 1.1, 0);
      ctx.lineTo(aim.x, aim.y - 12);
      ctx.stroke();
    } else if (game.player.vehicle) {
      const v = game.player.vehicle;
      if (v.kind === 'boat') drawBoatShape(ctx, p.x, p.y, v.angle, v.color);
      else drawCarShape(ctx, p.x, p.y, v.angle, v.color, v.vehicleKind, night);
      // Roxy's pink marker so the player is findable at a glance.
      ctx.fillStyle = '#ff5e8a';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 34);
      ctx.lineTo(p.x - 6, p.y - 24);
      ctx.lineTo(p.x + 6, p.y - 24);
      ctx.closePath();
      ctx.fill();
    }
    if (game.muzzleFlash > 0) {
      ctx.fillStyle = 'rgba(255, 220, 80, 0.9)';
      ctx.beginPath();
      ctx.arc(p.x + 10, p.y - 14, 7, 0, Math.PI * 2);
      ctx.fill();
    }
  } });
  actors.sort((a, b) => a.sort - b.sort);
  for (const a of actors) a.draw();

  ctx.restore();

  // Night darkens the scene; neon and lamps already glow through it.
  if (night > 0.05) {
    ctx.fillStyle = `rgba(8, 12, 40, ${0.34 * night})`;
    ctx.fillRect(0, 0, W, H);
  }

  // Shop prompt and transient messages live above the world, below the HUD.
  if (game.state === 'playing') {
    drawHUD(ctx, game, W, H);
    drawMinimap(ctx, game, W - 216, H - 156, 200, 140);
    if (game.shopOpen) drawShop(ctx, game, W, H);
    if (game.message && game.messageTimer > 0) {
      ctx.font = 'bold 14px sans-serif';
      const tw = ctx.measureText(game.message).width + 28;
      ctx.fillStyle = 'rgba(0,0,0,0.65)';
      ctx.fillRect((W - tw) / 2, 64, tw, 30);
      ctx.fillStyle = '#ffd319';
      ctx.textAlign = 'center';
      ctx.fillText(game.message, W / 2, 84);
      ctx.textAlign = 'left';
    }
  }

  if (game.state === 'title') drawTitle(ctx, game, W, H);
  if (game.state === 'paused') drawPause(ctx, game, W, H);
  if (game.state === 'gameover') drawGameOver(ctx, game, W, H);
  if (game.state === 'complete') drawComplete(ctx, game, W, H);
}

// ---- HUD ------------------------------------------------------------------

function bar(ctx, x, y, w, h, frac, color, bg = 'rgba(0,0,0,0.6)') {
  ctx.fillStyle = bg;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w * clamp(frac, 0, 1), h);
}

export function drawHUD(ctx, game, W, H) {
  const player = game.player;
  ctx.font = 'bold 16px sans-serif';
  // Cash.
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, 12, 190, 30);
  ctx.fillStyle = '#7dff8a';
  ctx.fillText(`$${game.cash.toLocaleString('en-US')}`, 22, 33);
  ctx.fillStyle = '#ffffff';
  ctx.font = '12px sans-serif';
  ctx.fillText(`goal $${game.goalCash.toLocaleString('en-US')}`, 118, 33);
  // Health and armor (labels clear of the bars).
  ctx.font = 'bold 12px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText('HP', 14, 58);
  bar(ctx, 58, 48, 118, 12, player.health / 100, '#e74c3c');
  ctx.fillText('ARMOR', 14, 78);
  bar(ctx, 58, 68, 118, 12, player.armor / 100, '#3498db');
  // Wanted stars, top right.
  const stars = Math.round(game.wanted);
  ctx.font = 'bold 26px sans-serif';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < stars ? '#ffd319' : 'rgba(255,255,255,0.25)';
    ctx.fillText('★', W - 150 + i * 28, 38);
  }
  // Clock and radio station.
  const hour = Math.floor(game.timeHours) % 24;
  const minute = Math.floor((game.timeHours % 1) * 60);
  const hh = String(hour).padStart(2, '0');
  const mm = String(minute).padStart(2, '0');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(W - 150, 48, 138, 24);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(`${hh}:${mm}  ${game.audio ? game.audio.stationName : 'SOLMAR FM'}`, W - 140, 65);
  // Mission tracker, top centre.
  const mission = game.missions.current();
  if (mission && !game.missions.done) {
    const objective = game.missions.objective();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(W / 2 - 260, 12, 520, 46);
    ctx.fillStyle = '#ffd319';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`MISSION ${mission.id}/10 — ${mission.title}`, W / 2, 30);
    ctx.fillStyle = '#fff';
    ctx.font = '13px sans-serif';
    let line = objective ? objective.label : '';
    if (objective && objective.timer) line += `  —  ${Math.max(0, Math.ceil(game.missions.timer))}s`;
    ctx.fillText(line, W / 2, 50);
    ctx.textAlign = 'left';
  }
  // Weapon and ammo, bottom left.
  const weaponNames = { fists: 'Fists', pistol: 'Pistol', smg: 'SMG' };
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(12, H - 66, 210, 54);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 14px sans-serif';
  const ammoText = player.weapon === 'fists' ? '∞' : `${player.ammo[player.weapon] || 0}`;
  ctx.fillText(`[1/2/3] ${weaponNames[player.weapon]}  •  ${ammoText}`, 22, H - 44);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = '#ccc';
  ctx.fillText(player.onFoot ? 'On foot — E: enter car/boat' : 'Driving — E: exit  •  Space: handbrake', 22, H - 24);
  // Controls hint, bottom centre.
  ctx.font = '11px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.textAlign = 'center';
  ctx.fillText('WASD move/drive  •  F punch  •  Click shoot  •  P pause  •  M mute  •  Q save', W / 2, H - 12);
  ctx.textAlign = 'left';
}

export function drawMinimap(ctx, game, x, y, w, h) {
  const world = game.world;
  const scale = Math.min(w / world.size, h / world.size);
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(x - 4, y - 4, w + 8, h + 8);
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  for (let ty = 0; ty < world.size; ty += 1) {
    for (let tx = 0; tx < world.size; tx += 1) {
      const t = world.grid[ty][tx];
      if (t === TILE.WATER) ctx.fillStyle = '#1f618d';
      else if (t === TILE.ROAD || t === TILE.BRIDGE) ctx.fillStyle = '#888';
      else if (t === TILE.BEACH) ctx.fillStyle = '#ecd9a0';
      else ctx.fillStyle = '#4a7a3a';
      ctx.fillRect(x + tx * scale, y + ty * scale, scale + 0.5, scale + 0.5);
    }
  }
  // Mission marker.
  const objective = game.missions && game.missions.objective();
  if (objective && objective.x !== undefined && game.state === 'playing') {
    ctx.fillStyle = '#ffd319';
    const pulse = 3 + Math.sin(game.elapsed * 5) * 1.5;
    ctx.beginPath();
    ctx.arc(x + objective.x * scale, y + objective.y * scale, pulse + 2, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police, then the player.
  ctx.fillStyle = '#ff4444';
  for (const cop of game.police) {
    ctx.fillRect(x + cop.x * scale - 2, y + cop.y * scale - 2, 4, 4);
  }
  ctx.fillStyle = '#ff5e8a';
  ctx.beginPath();
  ctx.arc(x + game.player.x * scale, y + game.player.y * scale, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('SOLMAR', x, y - 8);
}

function drawShop(ctx, game, W, H) {
  const items = [
    { key: '1', name: 'Armor vest (full)', price: game.shopPrices.armor },
    { key: '2', name: 'Pistol ammo +24', price: game.shopPrices.pistolAmmo },
    { key: '3', name: 'SMG + 60 rounds', price: game.shopPrices.smg },
    { key: '4', name: 'SMG ammo +90', price: game.shopPrices.smgAmmo },
    { key: '5', name: 'Repair your car', price: game.shopPrices.repair },
  ];
  ctx.fillStyle = 'rgba(0,0,0,0.75)';
  ctx.fillRect(W / 2 - 220, H / 2 - 150, 440, 300);
  ctx.strokeStyle = '#ffd319';
  ctx.lineWidth = 2;
  ctx.strokeRect(W / 2 - 220, H / 2 - 150, 440, 300);
  ctx.fillStyle = '#ffd319';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CORNER SHOP — SOLMAR', W / 2, H / 2 - 116);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`Cash: $${game.cash}`, W / 2, H / 2 - 90);
  ctx.textAlign = 'left';
  ctx.font = '15px sans-serif';
  items.forEach((item, i) => {
    const iy = H / 2 - 58 + i * 34;
    ctx.fillStyle = '#fff';
    ctx.fillText(`[${item.key}] ${item.name}`, W / 2 - 190, iy);
    ctx.fillStyle = game.cash >= item.price ? '#7dff8a' : '#e74c3c';
    ctx.fillText(`$${item.price}`, W / 2 + 120, iy);
  });
  ctx.fillStyle = '#ccc';
  ctx.font = '13px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Press a number to buy — E or Esc to close', W / 2, H / 2 + 128);
  ctx.textAlign = 'left';
}

// ---- screens ----------------------------------------------------------------

function overlay(ctx, W, H, alpha = 0.72) {
  ctx.fillStyle = `rgba(6, 10, 24, ${alpha})`;
  ctx.fillRect(0, 0, W, H);
}

function drawTitle(ctx, game, W, H) {
  overlay(ctx, W, H, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd319';
  ctx.font = 'bold 64px sans-serif';
  ctx.fillText('SOLMAR HEAT', W / 2, H / 2 - 110);
  ctx.fillStyle = '#ff5e8a';
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText('A coastal city. A stolen garage. One driver who wants it back.', W / 2, H / 2 - 70);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText('Rosa "Roxy" Marín needs $25,000 to buy back her father\'s garage from El Toro.', W / 2, H / 2 - 34);
  ctx.fillText('Ten missions. Steal cars, outrun the police, and take back what\'s yours.', W / 2, H / 2 - 10);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(game.hasSave ? 'Press ENTER to play  •  L to load your save' : 'Press ENTER to play', W / 2, H / 2 + 44);
  ctx.fillStyle = '#ccc';
  ctx.font = '14px sans-serif';
  ctx.fillText('WASD move / drive  •  E enter car  •  Click shoot  •  F punch  •  P pause  •  M mute  •  Q save', W / 2, H / 2 + 78);
  ctx.textAlign = 'left';
}

function drawPause(ctx, game, W, H) {
  overlay(ctx, W, H, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText('PAUSED', W / 2, H / 2 - 20);
  ctx.font = '16px sans-serif';
  ctx.fillText('P or Esc to resume  •  Q to quick-save  •  R to restart', W / 2, H / 2 + 20);
  ctx.textAlign = 'left';
}

function drawGameOver(ctx, game, W, H) {
  overlay(ctx, W, H, 0.7);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#e74c3c';
  ctx.font = 'bold 48px sans-serif';
  ctx.fillText('BUSTED — FLATLINED', W / 2, H / 2 - 30);
  ctx.fillStyle = '#fff';
  ctx.font = '16px sans-serif';
  ctx.fillText(`Roxy went down with $${game.cash} in her pocket and mission ${game.missions.index + 1} unfinished.`, W / 2, H / 2 + 10);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press R to try again', W / 2, H / 2 + 48);
  ctx.textAlign = 'left';
}

function drawComplete(ctx, game, W, H) {
  overlay(ctx, W, H, 0.6);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffd319';
  ctx.font = 'bold 52px sans-serif';
  ctx.fillText('THE GARAGE IS YOURS', W / 2, H / 2 - 60);
  ctx.fillStyle = '#fff';
  ctx.font = '18px sans-serif';
  ctx.fillText('Roxy paid El Toro his $25,000 and took back her father\'s garage.', W / 2, H / 2 - 18);
  ctx.fillText('Ten missions done. Solmar is hers to drive.', W / 2, H / 2 + 10);
  ctx.fillStyle = '#7dff8a';
  ctx.font = 'bold 18px sans-serif';
  ctx.fillText('Press R to play again  •  Thanks for playing Solmar Heat', W / 2, H / 2 + 52);
  ctx.textAlign = 'left';
}
