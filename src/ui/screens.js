import { ACTIONS, canPerformAction, getActionDisplay, getAchievementInfo, getTimeLabel, getLifeStage, getLifeStageLabel, getAge, PARTNER_TYPES, ENDOWMENTS, ENDOWMENT_TOTAL_POINTS, ENDOWMENT_MAX_PER_TRAIT, OBSESSIVE_TRAITS, getCreativeSkill, getSkillLabel, getSkillEffects, BACKGROUNDS, rollBackground, HVP_SUBTYPES, LVP_SUBTYPES } from '../engine.js';
import { createChartCanvas, drawSupplyDemand } from '../chart.js';
import { IP_TYPES } from '../market.js';
import { ic, escapeHtml } from '../icons.js';
import { toggleMute, isMuted } from '../bgm.js';
import { hasSave, getSaveSummary, exportSave, importSave, saveAvatar, loadAvatar, deleteAvatar, getPlayerAvatar } from '../save.js';
import { fogRecession } from '../market-fog.js';
import { $, app, renderPhoneNarrative, renderStatsBar, renderStats, getNarrativeTitle, buildNarrativeSections, renderAlertBanner, renderSpotlightCard, renderPersonalNarrative } from './shared.js';
import { renderAppDesktop } from './app-page.js';

// === Title Screen ===
export function renderTitle(onStart, onContinue) {
  const save = hasSave() ? getSaveSummary() : null;

  app().innerHTML = `
    <div class="screen title-screen">
      <h1>同人社团物语</h1>
      <p class="subtitle">一个关于热情、声誉与选择的<br/>同人经济学模拟游戏</p>
      <p class="tagline">
        <br/>
        从高考后的暑假开始，经历大学、工作<br/>
        你的同人创作之路能走多远？
      </p>
      ${save ? `
      <button class="btn btn-primary" id="btn-continue" style="margin-bottom:12px;width:100%;max-width:340px;padding:14px 16px;line-height:1.6">
        <div style="font-size:1rem">${ic('play')} 继续游戏</div>
        <div style="font-size:0.7rem;font-weight:400;margin-top:4px;opacity:0.75;letter-spacing:0.3px">
          第${save.turn + 1}回合 · ${save.age}岁${save.stage} · ¥${save.money?.toLocaleString()} · ${ic('heart')} ${save.passion}
        </div>
      </button>` : ''}
      <div class="title-reveal-4" style="margin-bottom:20px;width:100%;max-width:340px">
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:8px;text-align:center">你喜欢什么样的作品？</div>
        <div class="price-selector">
          <div class="price-btn selected" data-fandom="niche">
            <div class="price-label">${ic('diamond')} 冷门佳作</div>
            <div class="price-desc">小众但有味道的作品<br/>圈子小，不知道能不能火</div>
          </div>
          <div class="price-btn" data-fandom="popular">
            <div class="price-label">${ic('fire')} 热门大作</div>
            <div class="price-desc">当下最火的作品<br/>圈子大，但热度能持续多久？</div>
          </div>
        </div>
      </div>
      <div class="title-reveal-5"><button class="btn ${save ? 'btn-secondary' : 'btn-primary'}" id="btn-start" style="width:100%;max-width:340px">${save ? '开始新游戏' : '开始创作之旅'}</button></div>
      <p class="tagline mt-16 title-reveal-6" style="font-size:0.7rem">
        玩法：每回合选择行动，管理热情·声誉·资金<br/>
        热情归零 = 游戏结束
      </p>
      <div class="title-reveal-6" style="text-align:center;margin-top:12px">
        <button id="btn-leaderboard" style="background:none;border:1.5px solid #F39C12;border-radius:20px;padding:5px 20px;font-size:0.8rem;color:#E67E22;cursor:pointer;font-weight:600">${ic('trophy')} 排行榜</button>
      </div>
      <div class="title-reveal-6" style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:8px">
        <button id="btn-mute" style="background:none;border:1px solid var(--border);border-radius:20px;padding:4px 14px;font-size:0.75rem;color:var(--text-light);cursor:pointer">${isMuted() ? ic('speaker-slash') + ' 音乐已关闭' : ic('speaker-high') + ' 音乐已开启'}</button>
        ${save ? `<button id="btn-export" style="background:none;border:1px solid var(--border);border-radius:20px;padding:4px 14px;font-size:0.75rem;color:var(--text-light);cursor:pointer">${ic('export')} 导出存档</button>` : ''}
        <button id="btn-import" style="background:none;border:1px solid var(--border);border-radius:20px;padding:4px 14px;font-size:0.75rem;color:var(--text-light);cursor:pointer">${ic('download-simple')} 导入存档</button>
        <a href="https://ifdian.net/a/KirisameCalhoun" target="_blank" rel="noopener" style="background:none;border:1px solid #946ce6;border-radius:20px;padding:4px 14px;font-size:0.75rem;color:#946ce6;cursor:pointer;text-decoration:none;font-weight:600">${ic('heart')} 赞助作者</a>
      </div>
      <p class="tagline title-reveal-6" style="font-size:0.65rem;margin-top:8px">
        作者博客：<a href="https://seikasahara.com/zh/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">seikasahara.com/zh/</a><br/>
        音乐：<a href="https://amachamusic.chagasi.com/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">甘茶音乐工坊</a><br/>
        像素素材：<a href="https://www.avatarsinpixels.com/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">Pixels © MostlyPixels</a><br/>
        背景美术：<a href="https://www.deviantart.com/coolarts223/gallery" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">coolarts223</a><br/>
      </p>
      ${[0,1,2,3,4,5,6,7].map(i => {
        const left = 8 + i * 11;
        const dur = 9 + (i % 5) * 1.4;
        const delay = i * 1.1;
        const size = 6 + (i % 3) * 3;
        const colors = ['#5BCFB5', '#FF6B9D', '#00A8E8', '#F5A623'];
        const bg = colors[i % colors.length];
        return `<span class="title-particle" style="left:${left}%;animation-duration:${dur}s;animation-delay:${delay}s;width:${size}px;height:${size}px;background:${bg};opacity:0.5"></span>`;
      }).join('')}
    </div>
  `;
  let selectedFandom = 'niche';
  document.querySelectorAll('.price-btn[data-fandom]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.price-btn[data-fandom]').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedFandom = btn.dataset.fandom;
    });
  });
  $('#btn-mute').addEventListener('click', () => {
    const m = toggleMute();
    $('#btn-mute').innerHTML = m ? ic('speaker-slash') + ' 音乐已关闭' : ic('speaker-high') + ' 音乐已开启';
  });
  document.getElementById('btn-export')?.addEventListener('click', () => {
    if (exportSave()) {
      const btn = document.getElementById('btn-export');
      if (btn) { btn.innerHTML = `${ic('check')} 已导出`; setTimeout(() => { btn.innerHTML = `${ic('export')} 导出存档`; }, 1500); }
    }
  });
  document.getElementById('btn-import')?.addEventListener('click', () => {
    const doImport = async () => {
      const { success, error } = await importSave();
      if (success) {
        renderTitle(onStart, onContinue);
      } else if (error && error !== '已取消') {
        const btn = document.getElementById('btn-import');
        if (btn) { btn.innerHTML = `${ic('warning')} ${error}`; setTimeout(() => { btn.innerHTML = `${ic('download-simple')} 导入存档`; }, 2000); }
      }
    };
    if (hasSave()) {
      const overlay = document.createElement('div');
      overlay.className = 'event-overlay';
      overlay.innerHTML = `
        <div class="event-card" style="max-width:300px;text-align:center">
          <div style="font-size:1.3rem;margin-bottom:6px">${ic('warning', '1.3rem')}</div>
          <div style="font-weight:700;margin-bottom:6px">覆盖当前存档？</div>
          <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:12px;line-height:1.5">导入会覆盖当前的自动存档。<br/>建议先导出当前存档作为备份。</div>
          <button class="btn btn-primary btn-block" id="import-yes" style="margin-bottom:6px">确认导入</button>
          <button class="btn btn-block" id="import-no" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">取消</button>
        </div>`;
      document.body.appendChild(overlay);
      overlay.querySelector('#import-yes').addEventListener('click', () => { overlay.remove(); doImport(); });
      overlay.querySelector('#import-no').addEventListener('click', () => overlay.remove());
    } else {
      doImport();
    }
  });
  document.getElementById('btn-leaderboard')?.addEventListener('click', () => {
    import('../leaderboard.js').then(({ openLeaderboard }) => openLeaderboard(null, () => renderTitle(onStart, onContinue)));
  });
  document.getElementById('btn-continue')?.addEventListener('click', () => {
    if (onContinue) onContinue();
  });
  $('#btn-start').addEventListener('click', () => {
    // Roll actual IP type and community size behind the scenes
    let ipType, preset;
    if (selectedFandom === 'niche') {
      // Niche: small community, could be cold or secretly have potential
      preset = 'early';
      const r = Math.random();
      ipType = r < 0.40 ? 'cold' : r < 0.85 ? 'normal' : 'hot'; // 40% cold, 45% normal, 15% sleeper hit
    } else {
      // Popular: large community, but could decline
      preset = Math.random() < 0.6 ? 'late' : 'mid';
      const r = Math.random();
      ipType = r < 0.05 ? 'cold' : r < 0.35 ? 'normal' : 'hot'; // 5% already declining, 30% normal, 65% hot
    }
    onStart(preset, ipType);
  });
}

// === Endowment Allocation Screen ===
export function renderEndowments(onConfirm) {
  const MAX = ENDOWMENT_MAX_PER_TRAIT;
  const TRAIT_COUNT = Object.keys(ENDOWMENTS).length; // 5
  const MIN_TOTAL = TRAIT_COUNT; // each trait at least 1
  const MAX_TOTAL = TRAIT_COUNT * MAX; // 15

  // Left-skewed normal: Box-Muller, mean=7.5 sd=2, clamp to [MIN_TOTAL, MAX_TOTAL]
  function rollTotal() {
    const u1 = Math.random(), u2 = Math.random();
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    // Skew left: use lower mean so high rolls are rarer
    const raw = 7 + z * 1.8;
    return Math.max(MIN_TOTAL, Math.min(MAX_TOTAL, Math.round(raw)));
  }

  let totalPoints = rollTotal();
  let bgId = rollBackground();
  let rolled = false; // one reroll allowed
  const pts = { talent: 1, stamina: 1, social: 1, marketing: 1, resilience: 1 };

  function remaining() { return totalPoints - Object.values(pts).reduce((s, v) => s + v, 0); }

  // Rating for the roll
  function rollRating(t) {
    if (t >= 12) return { text: '天选之人！', color: '#E74C3C' };
    if (t >= 10) return { text: '非常幸运', color: '#F39C12' };
    if (t >= 8) return { text: '不错', color: 'var(--success)' };
    if (t >= 7) return { text: '普通', color: 'var(--text-light)' };
    return { text: '逆境开局', color: 'var(--danger)' };
  }

  function render() {
    const rem = remaining();
    const keys = Object.keys(ENDOWMENTS);
    const rating = rollRating(totalPoints);
    const isLegendary = totalPoints >= 12;
    app().innerHTML = `
      <div class="screen endowment-screen">
        <h2 style="text-align:center;margin-bottom:4px">角色禀赋</h2>
        <p style="text-align:center;font-size:0.8rem;color:var(--text-light);margin-bottom:8px">
          先抽取天赋点数，再自由分配（每项至少1，上限${MAX}）
        </p>
        <div style="display:flex;justify-content:center;gap:16px;margin-bottom:12px">
          <div style="text-align:center;flex:1">
            <div class="endow-total-num" data-target="${totalPoints}" style="font-size:1.8rem;font-weight:700;color:${rating.color}">0</div>
            <div class="endow-rating${isLegendary ? ' endow-rating--legendary' : ''}" style="font-size:0.75rem;color:${rating.color};font-weight:600">${rating.text}</div>
            <div style="font-size:0.65rem;color:var(--text-muted)">天赋点数</div>
          </div>
          <div style="text-align:center;flex:1">
            <div style="font-size:1.8rem">${ic(BACKGROUNDS[bgId].emoji)}</div>
            <div style="font-size:0.75rem;font-weight:600">${BACKGROUNDS[bgId].name}</div>
            <div style="font-size:0.65rem;color:var(--text-muted)">¥${BACKGROUNDS[bgId].money}起步</div>
          </div>
        </div>
        <div style="text-align:center;margin-bottom:8px">
          ${!rolled ? `<button class="btn btn-secondary" id="btn-reroll" style="padding:4px 20px;font-size:0.82rem">${ic('dice-five')} 重新抽取（仅1次）</button>` : `<div style="font-size:0.7rem;color:var(--text-muted)">已用完重抽机会</div>`}
        </div>
        <div style="text-align:center;margin-bottom:8px">
          <span class="endow-remaining--${rem > 0 ? 'pending' : 'done'}" style="font-size:0.9rem;font-weight:700;color:${rem > 0 ? 'var(--primary)' : 'var(--success)'}">剩余: ${rem}</span>
        </div>
        <div class="endow-stats-frame">
          ${keys.map(k => {
            const e = ENDOWMENTS[k];
            const v = pts[k];
            return `
            <div class="endow-trait-row" data-key="${k}">
              <span style="font-size:1.3rem;width:28px;text-align:center">${ic(e.emoji)}</span>
              <div style="flex:1;min-width:0">
                <div style="font-weight:700;font-size:0.85rem">${e.name}</div>
                <div style="font-size:0.7rem;color:var(--text-light)">${e.desc}</div>
                <div style="font-size:0.65rem;color:var(--text-muted)">${e.effects.join(' · ')}</div>
              </div>
              <div style="display:flex;align-items:center;gap:4px;flex-shrink:0">
                <button class="endow-btn" data-key="${k}" data-dir="-1" ${v <= 1 ? 'disabled' : ''} style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--bg);font-size:1rem;cursor:pointer">−</button>
                <div style="width:60px;text-align:center">
                  <div class="endow-val" style="font-size:1.1rem;font-weight:700">${v}</div>
                  <div style="display:flex;gap:2px;justify-content:center">${Array.from({length: MAX}, (_, i) => `<div class="endow-bar-pip${i < v ? ' filled' : ''}" style="background:${i < v ? 'var(--primary)' : '#E0E0E0'}"></div>`).join('')}</div>
                </div>
                <button class="endow-btn" data-key="${k}" data-dir="1" ${v >= MAX || rem <= 0 ? 'disabled' : ''} style="width:28px;height:28px;border-radius:50%;border:1px solid var(--border);background:var(--bg);font-size:1rem;cursor:pointer">+</button>
              </div>
            </div>`;
          }).join('')}
        </div>
        <div style="max-width:360px;margin:12px auto 0">
          <button class="btn btn-primary btn-block" id="btn-endow-confirm" ${rem !== 0 ? 'disabled style="opacity:0.5"' : ''}>确认禀赋 (${rem === 0 ? '✓' : `还剩${rem}点`})</button>
        </div>
        <div class="tip-box" style="max-width:360px;margin:12px auto 0;text-align:left">
          <div class="tip-label">禀赋与理论</div>
          <div class="tip-text">天赋点数服从偏左正态分布——大多数人拿到6-8点，少数幸运儿可达10+，也有人以5点逆境开局。每项至少保底1点。</div>
        </div>
      </div>
    `;
    // Animate total points counter (roll effect)
    const numEl = document.querySelector('.endow-total-num');
    if (numEl) {
      const target = parseInt(numEl.dataset.target);
      let current = 0;
      const step = () => {
        current += 1;
        numEl.textContent = current;
        if (current < target) requestAnimationFrame(step);
      };
      setTimeout(() => requestAnimationFrame(step), 200);
    }

    // Incremental DOM update instead of full re-render
    function updateTraitUI(key) {
      const rem = remaining();
      const keys = Object.keys(ENDOWMENTS);

      // Update the changed trait's value + bar pips
      const row = document.querySelector(`.endow-trait-row[data-key="${key}"]`);
      if (row) {
        const v = pts[key];
        row.querySelector('.endow-val').textContent = v;
        row.querySelectorAll('.endow-bar-pip').forEach((pip, i) => {
          const shouldFill = i < v;
          pip.classList.toggle('filled', shouldFill);
          pip.style.background = shouldFill ? 'var(--primary)' : '#E0E0E0';
        });
        // Update +/- button disabled states for this row
        row.querySelector('[data-dir="-1"]').disabled = v <= 1;
        row.querySelector('[data-dir="1"]').disabled = v >= MAX || rem <= 0;
      }

      // Update all other rows' + buttons (rem might have changed)
      keys.forEach(k => {
        if (k === key) return;
        const r = document.querySelector(`.endow-trait-row[data-key="${k}"] [data-dir="1"]`);
        if (r) r.disabled = pts[k] >= MAX || rem <= 0;
      });

      // Update remaining display
      const remEl = document.querySelector('[class*="endow-remaining"]');
      if (remEl) {
        remEl.className = rem > 0 ? 'endow-remaining--pending' : 'endow-remaining--done';
        remEl.style.color = rem > 0 ? 'var(--primary)' : 'var(--success)';
        remEl.textContent = `剩余: ${rem}`;
      }

      // Update confirm button
      const cfm = document.getElementById('btn-endow-confirm');
      if (cfm) {
        cfm.disabled = rem !== 0;
        cfm.style.opacity = rem !== 0 ? '0.5' : '1';
        cfm.textContent = `确认禀赋 (${rem === 0 ? '✓' : `还剩${rem}点`})`;
        // Re-bind click if just became enabled
        if (rem === 0) {
          cfm.onclick = () => showObsessiveChoice(pts, bgId, onConfirm);
        } else {
          cfm.onclick = null;
        }
      }
    }

    document.querySelectorAll('.endow-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const k = btn.dataset.key;
        const dir = parseInt(btn.dataset.dir);
        const newVal = pts[k] + dir;
        if (newVal < 1 || newVal > MAX) return;
        if (dir > 0 && remaining() <= 0) return;
        pts[k] = newVal;
        updateTraitUI(k);
      });
    });
    const confirmBtn = document.getElementById('btn-endow-confirm');
    if (confirmBtn && remaining() === 0) {
      confirmBtn.addEventListener('click', () => showObsessiveChoice(pts, bgId, onConfirm));
    }
    document.getElementById('btn-reroll')?.addEventListener('click', () => {
      if (rolled) return;
      rolled = true;
      // Shake the button before re-rendering
      document.getElementById('btn-reroll')?.classList.add('shake-anim');
      totalPoints = rollTotal();
      bgId = rollBackground();
      pts.talent = 1; pts.stamina = 1; pts.social = 1; pts.marketing = 1; pts.resilience = 1;
      setTimeout(() => render(), 150);
    });
  }
  render();
}

// === Obsessive Specialization Choice (after endowment allocation) ===
function showObsessiveChoice(pts, bgId, onConfirm) {
  // Only traits at max (3) can be pushed to 4
  const eligibleKeys = Object.keys(OBSESSIVE_TRAITS).filter(k => pts[k] === ENDOWMENT_MAX_PER_TRAIT);
  if (eligibleKeys.length === 0) {
    // No trait at 3 — skip obsessive choice entirely
    onConfirm({ ...pts }, bgId, null);
    return;
  }
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  const cardsHtml = eligibleKeys.map(k => {
    const t = OBSESSIVE_TRAITS[k];
    const e = ENDOWMENTS[k];
    return `<div class="obsessive-card" data-key="${k}" style="padding:12px;margin-bottom:8px;border:2px solid var(--border);border-radius:12px;cursor:pointer;transition:all 0.15s">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <span style="font-size:1.2rem">${ic(t.emoji)}</span>
        <div>
          <div style="font-weight:700;font-size:0.85rem">${t.name}</div>
          <div style="font-size:0.68rem;color:var(--text-muted)">${e.name} 3 → <span style="color:var(--primary);font-weight:700">4</span></div>
        </div>
      </div>
      <div style="font-size:0.72rem;color:var(--text-light);margin-bottom:4px;line-height:1.5">${t.desc}</div>
      <div style="font-size:0.7rem;color:var(--success);margin-bottom:2px">${ic('arrow-fat-up','0.65rem')} ${t.buff}</div>
      <div style="font-size:0.7rem;color:var(--danger)">${ic('arrow-fat-down','0.65rem')} ${t.debuff}</div>
    </div>`;
  }).join('');
  overlay.innerHTML = `<div class="app-page" style="max-height:85vh;max-width:380px">
    <div style="padding:16px 16px 8px;text-align:center">
      <div style="font-size:1.3rem;margin-bottom:6px">${ic('fire')}</div>
      <h2 style="margin-bottom:4px;font-size:1rem">偏执强化</h2>
      <p style="font-size:0.75rem;color:var(--text-light);margin-bottom:4px;line-height:1.5">
        选择一项禀赋免费强化到 <b>4级</b>——代价是对应的性格缺陷。<br/>偏执的人在擅长的领域极致，但在其他方面会很差。
      </p>
      <p style="font-size:0.68rem;color:var(--text-muted);margin-bottom:12px">这是不可逆的选择，也可以跳过。</p>
    </div>
    <div class="app-page-body" style="padding:8px 12px">${cardsHtml}</div>
    <div style="padding:10px 12px">
      <button class="btn btn-block" id="obs-skip" style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);font-size:0.8rem;padding:10px">不强化，保持均衡</button>
    </div>
  </div>`;
  document.body.appendChild(overlay);

  // Skip — no obsessive trait
  overlay.querySelector('#obs-skip').addEventListener('click', () => {
    overlay.remove();
    onConfirm({ ...pts }, bgId, null);
  });

  // Select obsessive trait — show confirmation
  overlay.querySelectorAll('.obsessive-card').forEach(card => {
    card.addEventListener('click', () => {
      const key = card.dataset.key;
      const t = OBSESSIVE_TRAITS[key];
      // Highlight selected
      overlay.querySelectorAll('.obsessive-card').forEach(c => {
        c.style.borderColor = c.dataset.key === key ? 'var(--primary)' : 'var(--border)';
        c.style.background = c.dataset.key === key ? 'var(--bg-hover, #FFF8F0)' : '';
      });
      // Replace skip button with confirm
      const btnArea = overlay.querySelector('#obs-skip').parentElement;
      btnArea.innerHTML = `
        <button class="btn btn-primary btn-block" id="obs-confirm" style="font-size:0.85rem;padding:10px;margin-bottom:6px">${ic(t.emoji)} 确认「${t.name}」</button>
        <button class="btn btn-block" id="obs-back" style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);font-size:0.78rem;padding:8px">重新选择</button>
      `;
      btnArea.querySelector('#obs-confirm').addEventListener('click', () => {
        const finalPts = { ...pts, [key]: 4 };
        overlay.remove();
        onConfirm(finalPts, bgId, key);
      });
      btnArea.querySelector('#obs-back').addEventListener('click', () => {
        overlay.querySelectorAll('.obsessive-card').forEach(c => {
          c.style.borderColor = 'var(--border)';
          c.style.background = '';
        });
        btnArea.innerHTML = `<button class="btn btn-block" id="obs-skip" style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);font-size:0.8rem;padding:10px">不强化，保持均衡</button>`;
        btnArea.querySelector('#obs-skip').addEventListener('click', () => {
          overlay.remove();
          onConfirm({ ...pts }, bgId, null);
        });
      });
    });
  });
}

// === Game Screen ===
export function renderGame(state, onAction, onRetire) {
  const partnerInfo = state.hasPartner && state.partnerType
    ? (() => {
        const pt = PARTNER_TYPES[state.partnerType];
        return `<span style="font-size:0.75rem;padding:2px 8px;border-radius:10px;background:${state.partnerType === 'toxic' ? '#FDE8E8' : state.partnerType === 'supportive' ? '#E8F8F0' : '#FFF8E8'}">${ic(pt.emoji)} ${pt.name} (${state.partnerTurns}月)</span>`;
      })()
    : '';

  // Time debuff/buff display
  const debuffInfo = state.timeDebuffs.length > 0
    ? state.timeDebuffs.filter(d => d.turnsLeft < 900).map(d => {
        const isPositive = d.delta > 0;
        const bg = isPositive ? '#E8F8F0' : '#FDE8E8';
        const color = isPositive ? 'var(--success)' : 'var(--danger)';
        const icon = isPositive ? 'sun' : 'hourglass';
        return `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:${bg};color:${color}">${ic(icon)} ${d.reason} ${d.turnsLeft}月</span>`;
      }).join(' ')
    : '';

  const recFog = fogRecession(state.recessionTurnsLeft);
  const recessionInfo = recFog
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#FDE8E8;color:var(--danger)">${ic(recFog.icon)} ${recFog.label}</span>`
    : '';

  const hvpInfo = state.hvpProject
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#E8F0FF;color:#2C3E50">${ic('book-open-text')} 同人本 ${state.hvpProject.progress}/${state.hvpProject.needed}</span>`
    : '';

  const unemployedInfo = state.unemployed
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#FDE8E8;color:var(--danger);font-weight:700">${ic('warning-circle')} 失业中</span>`
    : state.fullTimeDoujin
    ? `<span style="font-size:0.7rem;padding:2px 6px;border-radius:8px;background:#E8F8F0;color:var(--success);font-weight:700">${ic('sparkle')} 全职同人</span>`
    : '';

  // Month schedule card
  const timeRemaining = Math.max(0, state.time - (state.monthTimeSpent || 0));
  const actions = state.monthActions || [];
  const scheduleCard = `
    <div class="schedule-card">
      <div class="schedule-header">
        <span>${ic('calendar-blank')} 本月日程</span>
        <span class="schedule-remaining" style="color:${timeRemaining <= 0 ? 'var(--danger)' : timeRemaining <= 2 ? 'var(--warning)' : 'var(--text-light)'}">
          ${timeRemaining <= 0 ? `${ic('warning')} 0/${state.time}天` : `剩余 ${timeRemaining}/${state.time}天`}
        </span>
      </div>
      <div class="schedule-body">
        ${(() => {
          const timedActions = actions.filter(a => a.timeCost > 0);
          const freeActions = actions.filter(a => a.timeCost === 0);
          if (actions.length === 0) return `<div class="schedule-empty">还没有安排，选择一个行动开始吧</div>`;
          let html = '';
          if (timedActions.length > 0 || timeRemaining > 0) {
            html += `<div class="schedule-timeline"><div class="schedule-track">
              ${timedActions.map(a => `<div class="schedule-block" style="flex:${a.timeCost} 0 0" title="${ACTIONS[a.actionId]?.name || a.actionId} ${a.timeCost}天">
                <span class="schedule-block-name">${ACTIONS[a.actionId]?.name || a.actionId}</span>
                <span class="schedule-block-cost">${a.timeCost}天</span>
              </div>`).join('')}
              ${timeRemaining > 0 ? `<div class="schedule-block schedule-block-free" style="flex:${timeRemaining} 0 0"><span class="schedule-block-name">空闲</span></div>` : ''}
            </div></div>`;
          }
          if (freeActions.length > 0) {
            html += `<div class="schedule-tags">${freeActions.map(a =>
              `<span class="schedule-tag">${ic('check', '0.6rem')} ${ACTIONS[a.actionId]?.name || a.actionId}</span>`
            ).join('')}</div>`;
          }
          return html;
        })()}
      </div>
      <div class="schedule-footer">
        <button class="schedule-end-btn ${timeRemaining <= 0 ? 'urgent' : ''}" id="btn-end-month">
          ${ic('calendar-check')} ${timeRemaining <= 0 ? '闲暇耗尽 · 结束本月' : actions.length > 0 ? `结束本月（剩余${timeRemaining}天）` : '结束本月（跳过）'}
        </button>
      </div>
    </div>`;

  app().innerHTML = `
    <div class="screen screen-game">
      <div class="game-header">
        <span class="turn-badge">第 ${state.turn + 1} 回合</span>
        <span style="display:flex;align-items:center;gap:6px">
          <button class="btn btn-secondary" id="btn-settings" style="padding:2px 8px;font-size:0.75rem;min-height:28px">${ic('gear')}</button>
          <button class="btn btn-secondary" id="btn-mute-game" style="padding:2px 8px;font-size:0.75rem;min-height:28px">${isMuted() ? ic('speaker-slash') : ic('speaker-high')}</button>
          <button class="btn btn-secondary" id="btn-retire" style="padding:2px 10px;font-size:0.75rem;min-height:28px;color:var(--text-muted)">${ic('smiley-sad')}</button>
          <span class="money-badge" ${state.money < 0 ? 'style="color:var(--danger)"' : ''}>¥${state.money.toLocaleString()}</span>
        </span>
      </div>

      ${renderPhoneNarrative(state, partnerInfo, debuffInfo, recessionInfo, hvpInfo, unemployedInfo)}

      <div class="game-content">
        ${renderStatsBar(state)}
        ${scheduleCard}
        ${renderAppDesktop(state)}
      </div>
    </div>
  `;

  // End month button
  document.getElementById('btn-end-month')?.addEventListener('click', () => onAction('endMonth'));

  // Schedule block tap tooltip (mobile: title attr doesn't show)
  document.querySelectorAll('.schedule-block[title]').forEach(el => {
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      document.querySelectorAll('.schedule-tooltip').forEach(t => t.remove());
      const tip = document.createElement('div');
      tip.className = 'schedule-tooltip';
      tip.textContent = el.getAttribute('title');
      el.style.position = 'relative';
      el.appendChild(tip);
      setTimeout(() => tip.remove(), 2000);
    });
  });

  // App icon clicks
  document.querySelectorAll('.app-icon:not(.disabled)').forEach(el => {
    el.addEventListener('click', () => onAction('app:' + el.dataset.app));
  });
  // Mute button
  document.getElementById('btn-mute-game')?.addEventListener('click', () => {
    const m = toggleMute();
    document.getElementById('btn-mute-game').innerHTML = m ? ic('speaker-slash') : ic('speaker-high');
  });
  // Settings button
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    openSettings(state, () => renderGame(state, onAction, onRetire));
  });
  // Stats panel toggle
  document.getElementById('phone-stats-toggle')?.addEventListener('click', () => {
    document.getElementById('phone-stats-panel')?.classList.toggle('collapsed');
  });
  // Retire button — voluntary exit
  document.getElementById('btn-retire')?.addEventListener('click', () => {
    const overlay = document.createElement('div');
    overlay.className = 'event-overlay';
    const months = state.turn;
    const hasWorks = state.totalHVP > 0 || state.totalLVP > 0;
    overlay.innerHTML = `
      <div class="event-card" style="max-width:340px">
        <div style="font-size:2rem;margin-bottom:8px">${ic('smiley-sad')}</div>
        <div style="font-weight:700;font-size:1rem;margin-bottom:8px">放下画笔</div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:16px;line-height:1.5">
          ${months < 6 ? '才刚开始就想放弃了吗...也许同人创作不适合每个人。（请注意社团名字不要有奇怪的内容，否则无法提交排名）'
            : hasWorks ? `创作了${months}个月，也许是时候去过另一种生活了。你的作品会留在这里。`
            : `在圈子里待了${months}个月，虽然一直没动笔，但这段时光也不算白费。`}
        </div>
        <button class="btn btn-block" id="btn-retire-confirm" style="background:#F8F0F0;border:1px solid var(--danger);color:var(--danger);margin-bottom:8px">是的，我想退坑了</button>
        <button class="btn btn-block" id="btn-retire-cancel" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">再坚持一下</button>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#btn-retire-cancel').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#btn-retire-confirm').addEventListener('click', () => {
      overlay.remove();
      state.passion = 0;
      state.phase = 'gameover';
      state.gameOverReason = months < 6
        ? '你在同人创作的门口短暂驻足，最终选择了转身离开。这不是失败——只是人生有太多可能性。'
        : hasWorks
        ? '不是热情燃尽，而是你主动选择了放下。也许这叫"体面退坑"——带着所有美好的记忆，去拥抱下一段人生。'
        : '你始终没能迈出创作的第一步，但在这个圈子里度过的每一天，看过的每一件作品，都是真实的快乐。';
      if (onRetire) onRetire();
    });
  });
}

// === Tutorial Overlay ===
const TUTORIAL_STEPS = [
  { target: '.phone-clock', title: '时间显示', body: '这是你的年龄和当前人生阶段。游戏从18岁高考后暑假开始，经历大学和工作。' },
  { target: '.phone-stats-grid', title: '核心属性', body: `四大核心数值一目了然：<br/><b>${ic('heart')} 热情</b> 生命值，归零=Game Over<br/><b>${ic('star')} 声誉</b> 决定市场份额和销量<br/><b>${ic('timer')} 闲暇</b> 每月可用天数，行动消耗天数<br/><b>${ic('megaphone')} 信息</b> 买家认知度，每月衰减` },
  { target: '.schedule-card', title: '月度日程', body: '每个月你可以执行<b>多个行动</b>，每个行动消耗若干天闲暇。时间轴会显示本月安排。<b>闲暇用完或手动点击「结束本月」</b>进入月末结算。剩余天数会自动转为休息恢复。' },
  { target: '.money-badge', title: '同人资金', body: '用于<b>同人创作和消费</b>的资金。印刷、参展路费、购买同人等都从这里扣。打工、接稿、售卖收入会增加。<b>变为负数时焦虑会消耗热情</b>。' },
  { target: '.app-icon[data-app="enzao"]', title: '嗯造', body: '创作同人本（多月项目）、制作谷子（单月完成）、追加印刷。<b>创作是你的核心活动</b>，完成后作品入库。同人本和谷子每月只能各做一次。' },
  { target: '.app-icon[data-app="xuanfa"]', title: '次元宣发机', body: '提高信息透明度，让更多潜在买家看到你的作品。<b>全力宣发</b>会进入社媒运营小游戏！信息每月衰减，要持续维护。' },
  { target: '.app-icon[data-app="manzhan"]', title: '漫展通', body: '参加同人展是<b>销售的黄金机会</b>，亲参会进入摊位小游戏。展会会消耗当月全部剩余闲暇。也可以在这里购买或出售谷子。' },
  { target: '.app-icon[data-app="ciyuanbi"]', title: '打破次元墙', body: `<b>人脉与协作</b>中心：<br/>· <b>寻找搭档</b>：从人脉池中选人合作，搭档能加速创作、提升销量<br/>· <b>外包助手</b>：花钱加速同人本进度<br/>· <b>赞助社区</b>：花钱提升声誉和曝光，同时认识新朋友<br/><br/>人脉通过<b>展会交换名片、赞助社区、线上宣发</b>积累。关系越深，搭档越靠谱！` },
  { target: '.app-icon[data-app="nyaner"]', title: 'Nyaner', body: '查看<b>圈内动态</b>（创作者们在干什么）和<b>今日新闻</b>（宏观经济、社会热点、文化现象）。同人市场数据请去「同人市场观察」App查看。' },
  { target: '.app-icon[data-app="prediction"]', title: '织梦交易', body: `<b>同人圈预测市场</b>——用真金白银押注圈子的未来，没空行动可以来玩：<br/>· 社群会涨还是跌？潮流会变吗？经济会衰退吗？<br/>· 买<b>YES</b>或<b>NO</b>份额，到期结算赢家得¥100/份<br/>· 可随时按当前价格<b>卖出</b>提前止盈止损<br/><br/>风险提示：判断错误会血本无归。量力而行！` },
  { target: '.app-icon[data-app="market"]', title: '同人市场观察', body: '查看详细的<b>市场数据</b>（社群人数、多样性、IP热度）和你的<b>创作者数据面板</b>（收入、销量、趋势图）。' },
  { target: '.app-icon[data-app="message"]', title: '短信', body: `<b>和朋友聊天：</b><br/>· <b>小柚</b>（闺蜜）：关心你的近况，给生活建议<br/>· <b>傲娇女神</b>（织梦）：当宏观经济事件发生时上线，用傲娇的方式解释同人经济学原理。抓住机会请教！<br/><br/>此外，如果有出版社看上你的作品，也会通过短信联系你。` },
  { target: '.phone-stats-panel', title: '叙事信息', body: '下拉展开可以查看<b>当前状态提示和叙事文本</b>。包括人生阶段描述、创作建议、状态徽章（搭档、同人本进度、经济下行等）。', expand: '#phone-stats-panel' },
  { target: null, title: '开始你的创作之旅', body: `<div style="text-align:left;line-height:1.8">· 先<b>创作</b>积累库存，再<b>宣发</b>让人知道你<br/>· 参加<b>同人展</b>卖出去，库存也有通贩收入<br/>· 关注<b>资金</b>，印刷和生活都要花钱<br/>· 上班后闲暇骤降，要<b>取舍</b><br/>· 热情低于30要及时<b>休息</b>！<br/>· 通过展会和社区活动积累<b>人脉</b>，找到好搭档</div>` },
];

export function renderTutorial(onDone) {
  let step = 0;
  let prevHighlight = null;
  let prevExpand = null;

  function cleanup() {
    if (prevHighlight) { prevHighlight.classList.remove('tut-highlight'); prevHighlight = null; }
    if (prevExpand) { prevExpand.classList.add('collapsed'); prevExpand = null; }
    document.getElementById('tut-overlay')?.remove();
    document.getElementById('tut-bubble')?.remove();
  }

  function render() {
    cleanup();
    const s = TUTORIAL_STEPS[step];
    const isLast = step === TUTORIAL_STEPS.length - 1;
    const total = TUTORIAL_STEPS.length;

    // Expand panel if needed
    if (s.expand) {
      const panel = document.querySelector(s.expand);
      if (panel) { panel.classList.remove('collapsed'); prevExpand = panel; }
    }

    // Highlight target
    const targetEl = s.target ? document.querySelector(s.target) : null;
    if (targetEl) { targetEl.classList.add('tut-highlight'); prevHighlight = targetEl; }

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'tut-overlay';
    overlay.className = 'tut-overlay';

    // Calculate bubble position class
    let bubbleClass = 'tut-bubble-center';
    if (targetEl) {
      const rect = targetEl.getBoundingClientRect();
      bubbleClass = rect.top < window.innerHeight * 0.4 ? 'tut-bubble-below' : 'tut-bubble-above';
    }

    document.body.appendChild(overlay);

    const bubble = document.createElement('div');
    bubble.id = 'tut-bubble';
    bubble.className = `tut-bubble ${bubbleClass}`;
    bubble.innerHTML = `
        <div class="tut-bubble-title">${s.title}</div>
        <div class="tut-bubble-text">${s.body}</div>
        <div class="tut-bubble-nav">
          <span style="font-size:0.7rem;color:var(--text-muted)">${step + 1} / ${total}</span>
          <span style="display:flex;gap:6px">
            ${step > 0 ? '<button class="btn btn-secondary" id="tut-prev" style="padding:4px 12px;min-height:32px;font-size:0.78rem">上一步</button>' : ''}
            <button class="btn btn-primary" id="tut-next" style="padding:4px 14px;min-height:32px;font-size:0.78rem">${isLast ? '开始游戏！' : '下一步'}</button>
          </span>
        </div>
        ${isLast ? '' : '<div style="text-align:center;margin-top:6px"><span id="tut-skip" style="font-size:0.65rem;color:var(--text-muted);cursor:pointer;text-decoration:underline">跳过教程</span></div>'}`;
    document.body.appendChild(bubble);

    const done = () => { cleanup(); onDone(); };
    document.getElementById('tut-next').addEventListener('click', () => { if (isLast) done(); else { step++; render(); } });
    document.getElementById('tut-prev')?.addEventListener('click', () => { step--; render(); });
    document.getElementById('tut-skip')?.addEventListener('click', done);
  }

  render();
}

// === Grouped Deltas (internal helper) ===
function renderGroupedDeltas(deltas) {
  // Categorize deltas by icon/label keywords
  const groups = { passion: [], money: [], reputation: [], inventory: [], other: [] };
  const passionIcons = ['heart', 'smiley-nervous', 'smiley-sad', 'globe', 'hourglass', 'money', 'fire', 'smiley-meh', 'chat-circle', 'confetti'];
  const moneyIcons = ['coins', 'printer', 'handshake', 'briefcase', 'house', 'globe-simple'];
  const repIcons = ['star', 'megaphone', 'trend-up'];
  const invIcons = ['package', 'key', 'book-open-text'];

  for (const d of deltas) {
    if (passionIcons.includes(d.icon)) groups.passion.push(d);
    else if (moneyIcons.includes(d.icon)) groups.money.push(d);
    else if (repIcons.includes(d.icon)) groups.reputation.push(d);
    else if (invIcons.includes(d.icon)) groups.inventory.push(d);
    else groups.other.push(d);
  }

  const renderItems = (items) => items.map(d => {
    const critical = !d.positive && (d.label.includes('热情') || d.label.includes('焦虑'));
    return `<div class="delta-item" ${critical ? 'style="background:#FFF0F0;border-radius:4px;padding:1px 4px;margin:-1px -4px"' : ''}>
      <span class="delta-icon">${ic(d.icon)}</span>
      <span style="flex:1">${d.label}</span>
      <span class="${d.positive ? 'delta-positive' : 'delta-negative'}">${d.value}</span>
    </div>`;
  }).join('');

  const sections = [
    { key: 'passion', label: ic('heart') + ' 热情', items: groups.passion },
    { key: 'money', label: ic('coins') + ' 收支', items: groups.money },
    { key: 'reputation', label: ic('star') + ' 声誉', items: groups.reputation },
    { key: 'inventory', label: ic('package') + ' 库存', items: groups.inventory },
    { key: 'other', label: ic('note-pencil') + ' 其他', items: groups.other },
  ].filter(s => s.items.length > 0);

  // If total deltas ≤ 6, show flat (no grouping needed)
  if (deltas.length <= 6) return renderItems(deltas);

  return sections.map(s => `
    <div style="margin-bottom:4px">
      <div style="font-size:0.7rem;font-weight:600;color:var(--text-muted);padding:2px 0;border-bottom:1px solid var(--border);margin-bottom:2px">${s.label}</div>
      ${renderItems(s.items)}
    </div>
  `).join('');
}

// === Result Screen ===
export function renderResult(state, result, onContinue) {
  const tipHtml = result.tip ? `
    <div class="tip-box">
      <div class="tip-label">${result.tip.label}</div>
      <div class="tip-text">${result.tip.text}</div>
    </div>
  ` : '';

  // Only show newly earned achievements
  const prevCount = (state._prevAchievementCount || 0);
  const newAchievements = state.achievements.slice(prevCount);
  state._prevAchievementCount = state.achievements.length;

  const achieveHtml = newAchievements.map(id => {
    const a = getAchievementInfo(id);
    return `<div style="text-align:center;padding:8px;background:#FFF8E8;border-radius:8px;margin-bottom:8px;animation:achievePop 0.6s cubic-bezier(0.34,1.56,0.64,1)">
      <span style="font-size:1.5rem">${ic(a.emoji)}</span>
      <div style="font-weight:700;font-size:0.85rem;margin-top:4px">${a.name}</div>
      <div style="font-size:0.75rem;color:var(--text-light)">${a.desc}</div>
    </div>`;
  }).join('');

  // Chart placeholder
  const chartId = ''; // supply-demand chart removed (info fog)

  app().innerHTML = `
    <div class="screen">
      <div class="game-header">
        <span class="turn-badge">第 ${state.turn} 回合结果</span>
        <span class="money-badge">¥${state.money.toLocaleString()}</span>
      </div>

      ${renderStats(state)}

      <div class="game-content game-content--frosted">
        <div class="result-box">
          <h3>${ic(result.actionEmoji)} ${result.actionName}</h3>
          ${renderGroupedDeltas(result.deltas)}
        </div>

        ${result.salesDetails && result.salesDetails.length > 0 ? renderSalesLedger(result.salesDetails) : ''}

        ${result.salesInfo ? renderSalesBreakdown(result.salesInfo, result.salesDetails) : ''}

        ${chartId ? `<div class="result-box" style="padding:12px">
          <h3 style="font-size:0.85rem;margin-bottom:8px">${ic('chart-bar')} 供需曲线</h3>
          <div id="${chartId}"></div>
          <p style="font-size:0.7rem;color:var(--text-muted);margin-top:8px;text-align:center">
            声誉↑需求曲线右移 · 信息透明度↑转化率提升 · 绿色=你的收入
          </p>
        </div>` : ''}

        ${result.digitalSalesDetails ? (() => {
          const d = result.digitalSalesDetails;
          const total = result.digitalSalesTotal;
          const collapsed = d.length > 3;
          const rows = d.map(item =>
            `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.7rem">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(item.name)}</span>
              <span style="flex-shrink:0;color:var(--text-muted);margin:0 6px">×${item.sales} @¥${item.price}</span>
              <span style="flex-shrink:0;font-weight:600;color:var(--success)">+¥${item.rev}</span>
            </div>`
          ).join('');
          return `<div class="market-panel${collapsed ? ' collapsed' : ''}" style="margin-bottom:10px">
            <div class="market-header" style="cursor:${collapsed ? 'pointer' : 'default'}">
              <span>${ic('phone')} 电子版被动收入 <span style="font-weight:700;color:var(--success)">+¥${total}</span> <span style="color:var(--text-muted);font-size:0.7rem">(${d.length}部)</span></span>
              ${collapsed ? '<span class="market-arrow">▼</span>' : ''}
            </div>
            <div class="market-body" style="padding:4px 0">${rows}</div>
          </div>`;
        })() : ''}

        ${result.predictionSettlements ? (() => {
          const ps = result.predictionSettlements;
          const totalPayout = ps.reduce((s, p) => s + p.payout, 0);
          const wonCount = ps.filter(p => p.won).length;
          const lostCount = ps.filter(p => !p.won).length;
          const collapsed = ps.length > 3;
          const rows = ps.map(p => {
            const sideLabel = p.side === 'yes' ? 'YES' : 'NO';
            const sideColor = p.won ? 'var(--success)' : 'var(--danger)';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;font-size:0.7rem;border-bottom:1px dashed var(--border)">
              <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(p.question)}</span>
              <span style="flex-shrink:0;margin:0 4px;font-size:0.62rem;color:var(--text-muted)">结果${p.outcome} · 持${sideLabel}×${p.shares}</span>
              <span style="flex-shrink:0;font-weight:600;color:${sideColor}">${p.won ? '+¥' + p.payout : '归零'}</span>
            </div>`;
          }).join('');
          const headerColor = totalPayout > 0 ? 'var(--success)' : 'var(--danger)';
          const headerSummary = wonCount > 0 && lostCount > 0
            ? `${wonCount}赢${lostCount}输 · 收回¥${totalPayout}`
            : wonCount > 0 ? `${wonCount}笔赢 · +¥${totalPayout}`
            : `${lostCount}笔归零`;
          return `<div class="market-panel${collapsed ? ' collapsed' : ''}" style="margin-bottom:10px">
            <div class="market-header" style="cursor:${collapsed ? 'pointer' : 'default'}">
              <span>${ic('chart-line-up')} 织梦交易结算 <span style="font-weight:700;color:${headerColor}">${headerSummary}</span></span>
              ${collapsed ? '<span class="market-arrow">▼</span>' : ''}
            </div>
            <div class="market-body" style="padding:4px 0">${rows}</div>
          </div>`;
        })() : ''}

        ${result.monthFinancial ? (() => {
          const f = result.monthFinancial;
          const profit = f.income - f.expense;
          const profitColor = profit > 0 ? 'var(--success, #27AE60)' : profit < 0 ? 'var(--danger, #E74C3C)' : 'var(--text-muted)';
          const profitSign = profit > 0 ? '+' : profit < 0 ? '-' : '';
          return `<div class="result-box" style="padding:12px">
            <h3 style="font-size:0.85rem;margin-bottom:10px">${ic('chart-pie')} 本月盈亏汇总</h3>
            <div style="display:flex;gap:8px;margin-bottom:8px">
              <div style="flex:1;text-align:center;padding:8px;border-radius:8px;background:#E8F8F0">
                <div style="font-size:0.65rem;color:var(--text-muted)">收入</div>
                <div class="result-counter" data-count-to="${f.income}" data-prefix="+¥" style="font-size:1rem;font-weight:700;color:#27AE60">+¥0</div>
              </div>
              <div style="flex:1;text-align:center;padding:8px;border-radius:8px;background:#FDF0F0">
                <div style="font-size:0.65rem;color:var(--text-muted)">支出</div>
                <div class="result-counter" data-count-to="${f.expense}" data-prefix="-¥" style="font-size:1rem;font-weight:700;color:#E74C3C">-¥0</div>
              </div>
            </div>
            <div class="result-profit--${profit > 0 ? 'positive' : profit < 0 ? 'negative' : ''}" style="text-align:center;padding:8px;border-radius:8px;background:var(--bg-card);border:2px solid ${profitColor}">
              <div style="font-size:0.65rem;color:var(--text-muted)">毛利</div>
              <div class="result-counter" data-count-to="${Math.abs(profit)}" data-prefix="${profitSign}¥" style="font-size:1.1rem;font-weight:700;color:${profitColor}">${profitSign}¥0</div>
            </div>
          </div>`;
        })() : ''}

        ${achieveHtml}
        ${tipHtml}
      </div>

      <div class="bottom-bar result-bottom-bar">
        <button class="btn btn-primary btn-block" id="btn-continue">继续 →</button>
      </div>
    </div>
  `;

  // Animate financial counters
  document.querySelectorAll('.result-counter').forEach(el => {
    const target = parseInt(el.dataset.countTo) || 0;
    const prefix = el.dataset.prefix || '';
    if (target === 0) { el.textContent = prefix + '0'; return; }
    const duration = 600;
    const start = performance.now();
    const step = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = prefix + Math.round(target * eased).toLocaleString();
      if (progress < 1) requestAnimationFrame(step);
    };
    setTimeout(() => requestAnimationFrame(step), 300);
  });

  // Draw chart if applicable
  if (result.supplyDemand) {
    const container = document.getElementById(chartId);
    if (container) {
      const canvas = createChartCanvas();
      container.appendChild(canvas);
      drawSupplyDemand(canvas, result.supplyDemand, true);
    }
  }

  $('#btn-continue').addEventListener('click', onContinue);
  // Collapsible panels in result screen
  document.querySelectorAll('.market-panel .market-header').forEach(h => {
    h.addEventListener('click', () => h.closest('.market-panel').classList.toggle('collapsed'));
  });
}

// === Sales Ledger (per-work sales list) ===
function renderSalesLedger(salesDetails) {
  const rows = salesDetails.map(d => {
    const w = d.work;
    const sub = w.type === 'hvp' ? (HVP_SUBTYPES[w.subtype] || HVP_SUBTYPES.manga) : (LVP_SUBTYPES[w.subtype] || LVP_SUBTYPES.acrylic);
    const name = `${sub.name}${w.name ? '·' + escapeHtml(w.name) : ''}`;
    const unit = w.type === 'hvp' ? '本' : '个';
    return `<div style="display:flex;align-items:center;justify-content:space-between;padding:4px 0;font-size:0.72rem;border-bottom:1px dashed var(--border)">
      <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ic(sub.emoji)} ${name}</span>
      <span style="flex-shrink:0;color:var(--text-muted);margin:0 6px;font-size:0.68rem">×${d.sold}${unit} @¥${w.price}</span>
      <span style="flex-shrink:0;font-weight:600;color:var(--success)">+¥${d.rev}</span>
    </div>`;
  }).join('');
  const totalSold = salesDetails.reduce((s, d) => s + d.sold, 0);
  const totalRev = salesDetails.reduce((s, d) => s + d.rev, 0);
  return `<div class="result-box" style="padding:10px 12px;margin-bottom:10px">
    <h3 style="font-size:0.85rem;margin-bottom:6px">${ic('list-checks')} 销售清单</h3>
    ${rows}
    <div style="display:flex;justify-content:space-between;padding:6px 0 0;font-size:0.75rem;font-weight:700">
      <span>合计</span>
      <span style="color:var(--success)">售出${totalSold} · +¥${totalRev}</span>
    </div>
  </div>`;
}

// === Sales Breakdown (educational waterfall) ===
function renderSalesBreakdown(s, salesDetails) {
  // Narrative intuition panel — no precise numbers, only causal signals
  const insights = [];

  // Market size signal
  const csLabel = s.communitySize > 15000 ? '社群人气很旺，潜在买家多' : s.communitySize > 8000 ? '社群规模中等' : s.communitySize > 3000 ? '社群规模偏小' : '社群人丁稀少';
  insights.push({ icon: 'users', text: csLabel, positive: s.communitySize > 8000 });

  // Reputation → share
  const shareLabel = s.playerShare > 30 ? '你在圈里很有存在感，不少人专程来找你' : s.playerShare > 15 ? '有一部分人认识你，会优先看你的摊位' : s.playerShare > 5 ? '知道你的人不多，大部分人只是路过' : '你还是无名小卒，需要更多曝光';
  insights.push({ icon: 'star', text: shareLabel, positive: s.playerShare > 15 });

  // Info disclosure → conversion
  const convLabel = s.conversion > 60 ? '你的宣传做得很到位，看到的人大多愿意掏钱' : s.conversion > 40 ? '有一定曝光度，路人转化率还行' : '很多人不知道你在卖什么，需要加强宣传';
  insights.push({ icon: 'megaphone', text: convLabel, positive: s.conversion > 40 });

  // Modifiers as narrative
  if (s.partnerMult > 100) insights.push({ icon: 'handshake', text: '搭档帮忙招揽了更多客人', positive: true });
  if (s.shModPct < 90) insights.push({ icon: 'package', text: '二手市场上的竞品分流了一些买家', positive: false });
  if (s.eventBoost > 100) insights.push({ icon: 'tent', text: '展会的面对面接触大大提升了成交意愿', positive: true });
  if (s.catalogBonus > 105) insights.push({ icon: 'books', text: '丰富的产品线吸引了更多人驻足', positive: true });
  if (s.qualityDemandBonus > 110) insights.push({ icon: 'sparkle', text: '作品质量本身就是最好的广告', positive: true });
  if (s.infoHighBonus > 100) insights.push({ icon: 'chat-circle', text: '口碑效应带来了额外的客流', positive: true });
  if (s.alphaMod < 95) insights.push({ icon: 'warning', text: '消费者对同人本的兴趣在衰退，市场在萎缩', positive: false });
  if (s.communitySize < 5000 && s.playerShare > 30) insights.push({ icon: 'crown', text: '小圈子里的绝对核心——但市场天花板也近在咫尺', positive: true });

  const insightsHtml = insights.map(i =>
    `<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 0;font-size:0.72rem">
      <span style="flex-shrink:0;color:${i.positive ? 'var(--success)' : 'var(--danger)'}">${ic(i.icon, '0.72rem')}</span>
      <span style="color:${i.positive ? 'var(--text)' : 'var(--danger)'}">${i.text}</span>
    </div>`
  ).join('');

  // Per-work narrative breakdown
  let workNarrativeHtml = '';
  if (salesDetails && salesDetails.length > 0) {
    const rows = salesDetails.filter(d => d.sold > 0).map(d => {
      const w = d.work;
      const sub = w.type === 'hvp' ? (HVP_SUBTYPES[w.subtype] || HVP_SUBTYPES.manga) : (LVP_SUBTYPES[w.subtype] || LVP_SUBTYPES.acrylic);
      const name = `${sub.name}${w.name ? '·' + escapeHtml(w.name) : ''}`;
      const reasons = [];
      if (d.noveltyBonus > 1) reasons.push('<span style="color:#27AE60">新刊效应</span>');
      if (d.qualityMult > 1.2) reasons.push('<span style="color:var(--success)">质量出众</span>');
      else if (d.qualityMult < 0.8) reasons.push('<span style="color:var(--danger)">质量堪忧</span>');
      if (d.trendMult > 1.1) reasons.push('<span style="color:#27AE60">踩中潮流</span>');
      else if (d.trendMult < 0.9) reasons.push('<span style="color:#E67E22">不合时宜</span>');
      if (d.saturationFactor < 0.5) reasons.push('<span style="color:var(--danger)">市场饱和</span>');
      if (d.ageDecay < 0.7) reasons.push('<span style="color:#E67E22">老作品热度消退</span>');
      return `<div style="display:flex;justify-content:space-between;padding:2px 0;font-size:0.68rem">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${ic(sub.emoji)} ${name}</span>
        <span style="flex-shrink:0;margin:0 4px;color:var(--text-muted)">${reasons.join(' ')}</span>
        <span style="flex-shrink:0;font-weight:600">${d.sold}${w.type === 'hvp' ? '本' : '个'}</span>
      </div>`;
    }).join('');
    if (rows) {
      workNarrativeHtml = `<div style="padding:6px 0;border-top:1px dashed var(--border)">
        <div style="font-weight:700;color:var(--secondary);margin-bottom:4px">${ic('list-dashes')} 各作品表现</div>
        ${rows}
      </div>`;
    }
  }

  return `
    <div class="market-panel collapsed" style="margin-bottom:10px">
      <div class="market-header" id="breakdown-toggle">
        <span>${ic('lightbulb')} 销售直觉分析</span>
        <span class="market-arrow">▼</span>
      </div>
      <div class="market-body" style="font-size:0.75rem">
        <div style="padding:6px 0;font-size:0.68rem;color:var(--text-muted);font-style:italic;margin-bottom:4px">
          作为创作者，你不会看到精确的公式——但你能凭直觉感知到这些因素在起作用：
        </div>
        ${insightsHtml}
        ${workNarrativeHtml}
        <div style="padding:6px 0;font-size:0.65rem;color:var(--text-muted);border-top:1px dashed var(--border);margin-top:4px">
          ${ic('lightbulb', '0.6rem')} 提升销量的关键：声誉决定有多少人知道你，宣传决定多少人愿意买，作品质量决定口碑能否扩散。
        </div>
      </div>
    </div>
  `;
}

// === Event Overlay ===
export function renderEvent(event, onDismiss) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="event-card">
      <div class="event-emoji">${ic(event.emoji)}</div>
      <div class="event-title">${event.title}</div>
      <div class="event-desc">${event.desc}</div>
      <div class="event-effect ${event.effectClass}">${event.effect}</div>
      <div class="tip-box" style="text-align:left;margin-bottom:16px">
        <div class="tip-label">经济学原理</div>
        <div class="tip-text">${event.tip}</div>
      </div>
      <button class="btn btn-primary btn-block" id="btn-dismiss-event">了解 →</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector('#btn-dismiss-event').addEventListener('click', () => {
    overlay.remove();
    onDismiss();
  });
}

// === Settings Overlay ===
function openSettings(state, onClose) {
  const currentAvatar = getPlayerAvatar();
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="app-page" style="max-height:70vh;max-width:380px">
      <div class="app-titlebar" style="border-bottom-color:var(--primary)">
        <button class="app-back" id="settings-back">${ic('arrow-left')} 返回</button>
        <span class="app-title">${ic('gear')} 设置</span>
        <span style="width:60px"></span>
      </div>
      <div class="app-page-body" style="padding:20px 16px">

        <div style="text-align:center;margin-bottom:20px">
          <div style="position:relative;display:inline-block">
            <img id="settings-avatar-preview" src="${escapeHtml(currentAvatar)}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:3px solid var(--primary)">
            <div id="settings-avatar-edit" style="position:absolute;bottom:0;right:0;width:24px;height:24px;border-radius:50%;background:var(--primary);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:0.7rem">${ic('pencil-simple', '0.7rem')}</div>
          </div>
          <div style="margin-top:6px;font-size:0.9rem;font-weight:700">沈星然</div>
          <div style="font-size:0.65rem;color:var(--text-muted)">点击头像更换</div>
          ${loadAvatar() ? `<button id="settings-avatar-reset" style="margin-top:4px;background:none;border:none;color:var(--danger);font-size:0.65rem;cursor:pointer;text-decoration:underline">恢复默认头像</button>` : ''}
        </div>

        <div style="margin-bottom:16px">
          <label style="font-size:0.8rem;font-weight:600;display:block;margin-bottom:6px">${ic('flag-pennant')} 社团名称</label>
          <div style="display:flex;gap:8px">
            <input id="settings-club-name" type="text" value="${escapeHtml(state.clubName || '')}" maxlength="20" placeholder="输入社团名称" style="flex:1;padding:8px 12px;border:1.5px solid var(--border);border-radius:8px;font-size:0.85rem;background:var(--bg)">
            <button id="settings-club-save" class="btn btn-primary" style="padding:8px 16px;font-size:0.8rem">保存</button>
          </div>
          <div id="settings-club-hint" style="font-size:0.65rem;color:var(--text-muted);margin-top:4px"></div>
        </div>

        <div style="border-top:1px solid var(--border);padding-top:12px;margin-bottom:12px">
          <label style="font-size:0.8rem;font-weight:600;display:block;margin-bottom:8px">${ic('floppy-disk')} 存档管理</label>
          <div style="display:flex;gap:8px">
            <button id="settings-export" class="btn btn-secondary" style="flex:1;padding:8px;font-size:0.78rem">${ic('export')} 导出存档</button>
            <button id="settings-import" class="btn btn-secondary" style="flex:1;padding:8px;font-size:0.78rem">${ic('download-simple')} 导入存档</button>
          </div>
        </div>

      </div>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => { overlay.remove(); onClose(); };
  overlay.querySelector('#settings-back').addEventListener('click', close);
  overlay.addEventListener('click', (ev) => { if (ev.target === overlay) close(); });

  // --- Avatar upload ---
  const avatarEdit = overlay.querySelector('#settings-avatar-edit');
  const avatarPreview = overlay.querySelector('#settings-avatar-preview');
  const handleAvatarUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) return;
      if (file.size > 512 * 1024) {
        const hint = overlay.querySelector('#settings-club-hint');
        if (hint) { hint.textContent = '图片太大（最大512KB）'; hint.style.color = 'var(--danger)'; }
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        // Resize to 128x128 to save localStorage space
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 128; canvas.height = 128;
          const ctx = canvas.getContext('2d');
          const size = Math.min(img.width, img.height);
          const sx = (img.width - size) / 2, sy = (img.height - size) / 2;
          ctx.drawImage(img, sx, sy, size, size, 0, 0, 128, 128);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          saveAvatar(dataUrl);
          avatarPreview.src = dataUrl;
          // Add reset button if not present
          if (!overlay.querySelector('#settings-avatar-reset')) {
            const resetBtn = document.createElement('button');
            resetBtn.id = 'settings-avatar-reset';
            resetBtn.style.cssText = 'margin-top:4px;background:none;border:none;color:var(--danger);font-size:0.65rem;cursor:pointer;text-decoration:underline';
            resetBtn.textContent = '恢复默认头像';
            resetBtn.addEventListener('click', () => {
              deleteAvatar();
              avatarPreview.src = 'prop-npc/player.webp';
              resetBtn.remove();
            });
            avatarPreview.parentElement.parentElement.querySelector('div:last-of-type')?.after(resetBtn);
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
    input.click();
  };
  avatarEdit.addEventListener('click', handleAvatarUpload);
  avatarPreview.addEventListener('click', handleAvatarUpload);

  // Avatar reset
  overlay.querySelector('#settings-avatar-reset')?.addEventListener('click', () => {
    deleteAvatar();
    avatarPreview.src = 'prop-npc/player.webp';
    overlay.querySelector('#settings-avatar-reset')?.remove();
  });

  // --- Club name save ---
  overlay.querySelector('#settings-club-save').addEventListener('click', () => {
    const input = overlay.querySelector('#settings-club-name');
    const name = input.value.trim();
    const hint = overlay.querySelector('#settings-club-hint');
    if (!name) {
      hint.textContent = '名称不能为空'; hint.style.color = 'var(--danger)';
      return;
    }
    state.clubName = name;
    hint.textContent = '已保存'; hint.style.color = 'var(--success)';
    setTimeout(() => { hint.textContent = ''; }, 1500);
  });

  // --- Export/Import ---
  overlay.querySelector('#settings-export').addEventListener('click', () => {
    if (exportSave()) {
      const btn = overlay.querySelector('#settings-export');
      btn.innerHTML = `${ic('check')} 已导出`;
      setTimeout(() => { btn.innerHTML = `${ic('export')} 导出存档`; }, 1500);
    }
  });
  overlay.querySelector('#settings-import').addEventListener('click', () => {
    const confirmOverlay = document.createElement('div');
    confirmOverlay.className = 'event-overlay';
    confirmOverlay.style.zIndex = '110';
    confirmOverlay.innerHTML = `
      <div class="event-card" style="max-width:300px;text-align:center">
        <div style="font-size:1.3rem;margin-bottom:6px">${ic('warning', '1.3rem')}</div>
        <div style="font-weight:700;margin-bottom:6px">覆盖当前存档？</div>
        <div style="font-size:0.8rem;color:var(--text-light);margin-bottom:12px;line-height:1.5">导入会覆盖当前的自动存档。<br/>建议先导出当前存档作为备份。</div>
        <button class="btn btn-primary btn-block" id="import-confirm-yes" style="margin-bottom:6px">确认导入</button>
        <button class="btn btn-block" id="import-confirm-no" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">取消</button>
      </div>`;
    document.body.appendChild(confirmOverlay);
    confirmOverlay.querySelector('#import-confirm-no').addEventListener('click', () => confirmOverlay.remove());
    confirmOverlay.querySelector('#import-confirm-yes').addEventListener('click', async () => {
      confirmOverlay.remove();
      const { success, error } = await importSave();
      if (success) {
        overlay.remove();
        // Reload — imported save replaces current state
        window.location.reload();
      } else if (error && error !== '已取消') {
        const btn = overlay.querySelector('#settings-import');
        btn.innerHTML = `${ic('warning')} ${error}`;
        setTimeout(() => { btn.innerHTML = `${ic('download-simple')} 导入存档`; }, 2000);
      }
    });
  });
}

// === Game Over ===
export function renderGameOver(state, onRestart) {
  const survived = state.turn;
  const age = getAge(state.turn);
  const stage = getLifeStage(state.turn);
  const isCommercial = state.commercialTransition;
  const isTampered = state.tampered;
  const isOpenEnding = state.openEnding;
  const title = isTampered ? '叙事崩溃' : isOpenEnding ? '待续……' : isCommercial ? '商业出道' : survived >= 48 ? '传奇落幕' : survived >= 24 ? '旅程结束' : survived >= 12 ? '一段经历' : '遗憾退场';
  const emoji = isTampered ? 'bug' : isOpenEnding ? 'shooting-star' : isCommercial ? 'star-four' : survived >= 48 ? 'trophy' : survived >= 24 ? 'book-open-text' : survived >= 12 ? 'star-four' : 'smiley-sad';

  const stageText = stage === 'work' ? '工作后' : stage === 'university' ? '大学期间' : '暑假';

  const shareText = isOpenEnding
    ? `我在「同人社团物语」中从18岁暑假到42岁，走过了24年的同人创作之路！` +
      `声誉最高${state.maxReputation.toFixed(1)}，` +
      `制作了${state.totalHVP}本同人志和${state.totalLVP}批谷子，累计销售额¥${state.totalRevenue.toLocaleString()}。` +
      `故事还在继续——你的同人人生会是什么样？`
    : isCommercial
    ? `我在「同人社团物语」中从18岁暑假开始创作，` +
      `在${age}岁时成功商业出道！` +
      `声誉最高${state.maxReputation.toFixed(1)}，` +
      `制作了${state.totalHVP}本同人志，累计销售额¥${state.totalRevenue.toLocaleString()}。` +
      `从同人到商业，你能做到吗？`
    : `我在「同人社团物语」中从18岁的暑假开始创作，` +
    `坚持到了${age}岁（${stageText}），` +
    `声誉最高${state.maxReputation.toFixed(1)}，` +
    `制作了${state.totalHVP}本同人志和${state.totalLVP}批谷子。` +
    `你的同人创作之路能走多远？`;

  const achieveHtml = state.achievements
    .filter(id => !id.endsWith('_encounter'))
    .map(id => {
      const a = getAchievementInfo(id);
      return `<span style="display:inline-block;background:#FFF8E8;padding:4px 10px;border-radius:20px;font-size:0.8rem;margin:3px">${ic(a.emoji)} ${a.name}</span>`;
    }).join('');

  app().innerHTML = `
    <div class="screen gameover-screen">
      <div class="go-emoji">${ic(emoji)}</div>
      <h2>${title}</h2>
      <p class="go-subtitle">${state.gameOverReason}</p>

      <div class="go-stats">
        <div class="go-stat-item"><span>起点</span><span class="go-stat-val">18岁 高考后暑假</span></div>
        <div class="go-stat-item"><span>背景</span><span class="go-stat-val">${ic(BACKGROUNDS[state.background]?.emoji || 'house')} ${BACKGROUNDS[state.background]?.name || '普通家庭'}</span></div>
        <div class="go-stat-item"><span>IP</span><span class="go-stat-val">${ic(IP_TYPES[state.market?.ipType]?.emoji || 'star-four')} ${IP_TYPES[state.market?.ipType]?.name || '潜力IP'}</span></div>
        <div class="go-stat-item"><span>禀赋</span><span class="go-stat-val">${Object.entries(state.endowments || {}).map(([k, v]) => `${ENDOWMENTS[k]?.emoji ? ic(ENDOWMENTS[k].emoji) : ''}${v}`).join(' ')}${state.obsessiveTrait ? ` · ${ic(OBSESSIVE_TRAITS[state.obsessiveTrait]?.emoji || 'fire')} ${OBSESSIVE_TRAITS[state.obsessiveTrait]?.name || ''}` : ''}</span></div>
        <div class="go-stat-item"><span>终点</span><span class="go-stat-val">${age}岁 · ${stageText}</span></div>
        <div class="go-stat-item"><span>坚持月数</span><span class="go-stat-val">${survived} 个月</span></div>
        <div class="go-stat-item"><span>最高声誉</span><span class="go-stat-val">${state.maxReputation.toFixed(1)}</span></div>
        <div class="go-stat-item"><span>同人志</span><span class="go-stat-val">${state.totalHVP} 本</span></div>
        <div class="go-stat-item"><span>谷子</span><span class="go-stat-val">${state.totalLVP} 批</span></div>
        <div class="go-stat-item"><span>总销量</span><span class="go-stat-val">${state.totalSales} 件</span></div>
        <div class="go-stat-item"><span>总销售额</span><span class="go-stat-val">¥${state.totalRevenue.toLocaleString()}</span></div>
      </div>

      ${achieveHtml ? `<div style="margin-bottom:16px;text-align:center">${achieveHtml}</div>` : ''}

      <div class="share-card">
        <div class="share-text">${shareText}</div>
        <button class="btn btn-secondary btn-block mt-8" id="btn-copy" style="font-size:0.85rem">复制分享文案</button>
      </div>

      ${state.turn >= 6 && !state.tampered ? `<button class="btn btn-secondary btn-block" id="btn-leaderboard-submit" style="margin-bottom:10px;font-size:0.85rem">${ic('trophy')} 提交到排行榜</button>` : ''}
      <button class="btn btn-primary" id="btn-restart">再来一局</button>
      <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:10px">
        <button id="btn-go-export" style="background:none;border:1px solid var(--border);border-radius:20px;padding:4px 14px;font-size:0.75rem;color:var(--text-light);cursor:pointer">${ic('export')} 导出存档</button>
        <a href="https://ifdian.net/a/KirisameCalhoun" target="_blank" rel="noopener" style="background:none;border:1px solid #946ce6;border-radius:20px;padding:4px 14px;font-size:0.75rem;color:#946ce6;cursor:pointer;text-decoration:none;font-weight:600">${ic('heart')} 赞助作者</a>
      </div>

      <p class="tagline mt-16" style="font-size:0.7rem">
        理论基石请访问个人博客：<a href="https://seikasahara.com/zh/" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">seikasahara.com/zh/</a><br/>
        排行榜提交问题请反馈：<a href="https://github.com/SeiKasahara/Dojin-econ-game/issues" target="_blank" rel="noopener" style="color:inherit;text-decoration:underline">GitHub Issues</a>
      </p>
    </div>
  `;

  $('#btn-restart').addEventListener('click', onRestart);
  $('#btn-go-export').addEventListener('click', () => {
    import('../save.js').then(({ exportSave }) => {
      exportSave();
      const btn = $('#btn-go-export');
      btn.innerHTML = `${ic('check')} 已导出`;
      setTimeout(() => { btn.innerHTML = `${ic('export')} 导出存档`; }, 1500);
    });
  });
  $('#btn-leaderboard-submit')?.addEventListener('click', () => {
    const btn = $('#btn-leaderboard-submit');
    btn.disabled = true;
    btn.innerHTML = '提交中…';
    import('../leaderboard.js').then(({ submitToLeaderboard }) => {
      submitToLeaderboard(state).then(res => {
        if (res.ok) {
          btn.style.background = '#E8F8F0';
          btn.style.color = 'var(--success)';
          btn.style.border = '1px solid var(--success)';
          btn.innerHTML = res.rank ? `${ic('trophy')} 已提交！排名 #${res.rank}` : `${ic('trophy')} 已提交！`;
          // After a brief pause, show view + overwrite options
          setTimeout(() => {
            btn.disabled = false;
            btn.style.background = '';
            btn.style.color = '#E67E22';
            btn.style.border = '1.5px solid #F39C12';
            btn.innerHTML = `${ic('trophy')} 查看排行榜`;
            btn.onclick = () => {
              import('../leaderboard.js').then(({ openLeaderboard }) => {
                openLeaderboard(state, onRestart);
              });
            };
            // Add overwrite button next to it
            if (!document.getElementById('btn-lb-overwrite')) {
              const ow = document.createElement('button');
              ow.id = 'btn-lb-overwrite';
              ow.className = 'btn';
              ow.style.cssText = 'margin-top:6px;width:100%;padding:10px;border-radius:10px;background:var(--bg);border:1px solid var(--border);color:var(--text-muted);font-size:0.8rem;cursor:pointer';
              ow.innerHTML = `${ic('arrows-clockwise')} 覆盖提交`;
              btn.parentNode.insertBefore(ow, btn.nextSibling);
              ow.addEventListener('click', () => {
                ow.disabled = true;
                ow.innerHTML = '提交中…';
                import('../leaderboard.js').then(({ submitToLeaderboard }) => {
                  submitToLeaderboard(state).then(r => {
                    if (r.ok) {
                      ow.style.color = 'var(--success)';
                      ow.innerHTML = r.rank ? `${ic('check')} 已覆盖！排名 #${r.rank}` : `${ic('check')} 已覆盖！`;
                      setTimeout(() => { ow.disabled = false; ow.innerHTML = `${ic('arrows-clockwise')} 覆盖提交`; ow.style.color = 'var(--text-muted)'; }, 2000);
                    } else {
                      ow.style.color = 'var(--danger)';
                      ow.innerHTML = r.error || '覆盖失败';
                      setTimeout(() => { ow.disabled = false; ow.innerHTML = `${ic('arrows-clockwise')} 覆盖提交`; ow.style.color = 'var(--text-muted)'; }, 3000);
                    }
                  });
                });
              });
            }
          }, 1500);
        } else {
          btn.style.color = 'var(--danger)';
          btn.innerHTML = res.error || '提交失败';
          setTimeout(() => { btn.disabled = false; btn.innerHTML = `${ic('trophy')} 重新提交`; btn.style.color = ''; }, 3000);
        }
      });
    });
  });
  $('#btn-copy').addEventListener('click', () => {
    navigator.clipboard.writeText(shareText).then(() => {
      $('#btn-copy').textContent = '已复制！';
      setTimeout(() => { $('#btn-copy').textContent = '复制分享文案'; }, 1500);
    }).catch(() => {
      const ta = document.createElement('textarea');
      ta.value = shareText;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      $('#btn-copy').textContent = '已复制！';
      setTimeout(() => { $('#btn-copy').textContent = '复制分享文案'; }, 1500);
    });
  });
}
