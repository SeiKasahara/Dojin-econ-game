import { getTimeLabel, getLifeStage, getLifeStageLabel, getAge, PARTNER_TYPES, getCreativeSkill, getSkillLabel, getSkillEffects } from '../engine.js';
import { getMarketNarratives } from '../market.js';
import { getOfficialNarratives } from '../official.js';
import { getAdvancedNarratives } from '../advanced.js';
import { ic } from '../icons.js';
import { fogRecession } from '../market-fog.js';

export const $ = (sel) => document.querySelector(sel);
export const app = () => $('#app');

// === Phone Narrative (top of game screen) ===
export function renderPhoneNarrative(state, partnerInfo, debuffInfo, recessionInfo, hvpInfo, unemployedInfo) {
  const age = getAge(state.turn);
  const stageLabel = getLifeStageLabel(state.turn, state);
  const month = ((state.turn + 6) % 12) + 1;
  const seasonIcon = month >= 3 && month <= 5 ? 'flower-lotus' : month >= 6 && month <= 8 ? 'sun' : month >= 9 && month <= 11 ? 'leaf' : 'snowflake';

  const badges = [unemployedInfo, hvpInfo, partnerInfo, debuffInfo, recessionInfo].filter(Boolean).join(' ');
  const sk = (state.totalHVP + state.totalLVP > 0) ? getCreativeSkill(state) : null;
  const invLine = (state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0)
    ? `${ic('package')} 本×${state.inventory.hvpStock} 谷×${state.inventory.lvpStock}` : '';
  const skillLine = sk !== null ? `${ic('target')} Lv${sk.toFixed(1)} ${getSkillLabel(sk)}` : '';
  const narrative = (() => { const s = buildNarrativeSections(state); return renderAlertBanner(s.alerts) + renderSpotlightCard(s.spotlight) + renderPersonalNarrative(getNarrativeTitle(state), s.personal); })();

  // Circle member card
  const memberCard = (() => {
    const members = [];
    // Player is always the first member
    members.push(`<div style="display:flex;align-items:center;gap:6px;padding:4px 0">
      <img src="prop-npc/player.webp" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:2px solid var(--primary)">
      <span style="font-size:0.75rem;font-weight:600">沈星然</span>
      <span style="font-size:0.6rem;padding:1px 5px;border-radius:6px;background:var(--primary);color:#fff">社长</span>
    </div>`);
    // Current partner
    if (state.hasPartner && state.partnerType) {
      const pt = PARTNER_TYPES[state.partnerType];
      const contact = state.activeContactId ? (state.contacts || []).find(c => c.id === state.activeContactId) : null;
      const pName = contact ? contact.name : pt.name;
      const avatarSrc = contact ? `partner/${contact.avatarIdx}.webp` : 'prop-npc/player.webp';
      const typeColor = state.partnerType === 'toxic' ? 'var(--danger)' : state.partnerType === 'supportive' ? 'var(--success)' : 'var(--warning)';
      members.push(`<div style="display:flex;align-items:center;gap:6px;padding:4px 0">
        <img src="${avatarSrc}" style="width:24px;height:24px;border-radius:50%;object-fit:cover;border:2px solid ${typeColor}">
        <span style="font-size:0.75rem;font-weight:600">${pName}</span>
        <span style="font-size:0.6rem;padding:1px 5px;border-radius:6px;background:${typeColor}18;color:${typeColor}">${pt.name}</span>
        <span style="font-size:0.6rem;color:var(--text-muted);margin-left:auto">剩${state.partnerTurns}月</span>
      </div>`);
    }
    return `<div style="padding:4px 12px 2px">
      <div style="font-size:0.68rem;color:var(--text);margin-bottom:2px">${ic('users')} 社团成员 (${members.length})</div>
      ${members.join('')}
      ${!state.hasPartner ? `<div style="font-size:0.68rem;color:var(--text);padding:4px 0;font-style:italic">暂无搭档 — 去「打破次元壁」寻找合作伙伴</div>` : ''}
    </div>`;
  })();

  return `
    <div class="phone-clock">
      <div class="phone-clock-time">${age}<span class="phone-clock-unit">岁</span></div>
      <div class="phone-clock-sub">${ic(seasonIcon)} ${stageLabel} · ${month}月</div>
    </div>
    <div class="phone-stats-panel collapsed" id="phone-stats-panel">
      <div class="phone-stats-handle" id="phone-stats-toggle"><div class="phone-stats-bar"></div></div>
      <div style="max-height:70vh;overflow-y:auto;-webkit-overflow-scrolling:touch;padding-bottom:40vh">
        ${badges ? `<div class="phone-badges">${badges}</div>` : ''}
        ${invLine || skillLine ? `<div class="phone-inv">${invLine}${invLine && skillLine ? ' · ' : ''}${skillLine}</div>` : ''}
        ${memberCard}
        <div style="padding:0 12px 8px">${narrative}</div>
      </div>
    </div>`;
}

// === Stats Bar (visible in game-content) ===
export function renderStatsBar(state) {
  const passionPct = Math.max(0, state.passion);
  const repPct = Math.min(100, state.reputation * 10);
  const timeRemaining = Math.max(0, state.time - (state.monthTimeSpent || 0));
  const timePct = Math.min(100, state.time * 10);
  const timeRemainingPct = Math.min(100, timeRemaining * 10);
  const infoPct = state.infoDisclosure * 100;

  return `
    <div class="phone-stats-grid" style="padding:0 12px 4px">
      <div class="phone-stat-card">
        <div class="phone-stat-header"><span>${ic('heart')} 热情</span><span class="phone-stat-val ${passionPct < 25 ? 'danger' : ''}">${Math.round(state.passion)}</span></div>
        <div class="phone-stat-bar-bg"><div class="stat-bar passion ${passionPct < 25 ? 'danger' : ''}" style="width:${passionPct}%"></div></div>
      </div>
      <div class="phone-stat-card">
        <div class="phone-stat-header"><span>${ic('star')} 声誉</span><span class="phone-stat-val">${state.reputation.toFixed(1)}</span></div>
        <div class="phone-stat-bar-bg"><div class="stat-bar reputation" style="width:${repPct}%"></div></div>
      </div>
      <div class="phone-stat-card">
        <div class="phone-stat-header"><span>${ic('timer')} 闲暇</span><span class="phone-stat-val ${timeRemaining <= 1 ? 'danger' : ''}">${timeRemaining}/${state.time}天</span></div>
        <div class="phone-stat-bar-bg" style="position:relative">
          <div class="stat-bar" style="width:${timePct}%;background:#D8D0C4;position:absolute;top:0;left:0;height:100%;border-radius:3px"></div>
          <div class="stat-bar time ${timeRemaining <= 1 ? 'danger' : ''}" style="width:${timeRemainingPct}%;position:relative;z-index:1"></div>
        </div>
      </div>
      <div class="phone-stat-card">
        <div class="phone-stat-header"><span>${ic('megaphone')} 信息</span><span class="phone-stat-val">${Math.round(infoPct)}%</span></div>
        <div class="phone-stat-bar-bg"><div class="stat-bar" style="width:${infoPct}%;background:linear-gradient(90deg,#E6A817,#F5D76E)"></div></div>
      </div>
    </div>`;
}

// === Stats Panel (for result screen) ===
export function renderStats(state) {
  const passionPct = Math.max(0, state.passion);
  const repPct = Math.min(100, state.reputation * 10);
  const timePct = Math.min(100, state.time * 10);
  const infoPct = state.infoDisclosure * 100;

  return `
    <div class="stats-panel">
      <div class="stat-row">
        <span class="stat-icon">${ic('heart')}</span>
        <span class="stat-label">热情</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar passion ${passionPct < 25 ? 'danger' : ''}" style="width:${passionPct}%"></div>
        </div>
        <span class="stat-value">${Math.round(state.passion)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">${ic('star')}</span>
        <span class="stat-label">声誉</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar reputation" style="width:${repPct}%"></div>
        </div>
        <span class="stat-value">${state.reputation.toFixed(1)}</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">${ic('timer')}</span>
        <span class="stat-label">时间</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar time ${state.time <= 1 ? 'danger' : ''}" style="width:${timePct}%"></div>
        </div>
        <span class="stat-value">${state.time}/10</span>
      </div>
      <div class="stat-row">
        <span class="stat-icon">${ic('megaphone')}</span>
        <span class="stat-label">信息</span>
        <div class="stat-bar-wrap">
          <div class="stat-bar" style="width:${infoPct}%;background:linear-gradient(90deg,#E6A817,#F5D76E)"></div>
        </div>
        <span class="stat-value">${Math.round(infoPct)}%</span>
      </div>
      ${infoPct > 15 ? `<div style="font-size:0.65rem;color:var(--text-muted);text-align:right;padding-right:4px;margin-top:-4px">每月-7% · ${Math.ceil((infoPct - 8) / 7)}月后回到底线</div>` : ''}
      ${(state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0) || (state.totalHVP + state.totalLVP > 0) ? `
      <div style="display:flex;justify-content:center;gap:12px;padding:6px 0;margin-top:4px;border-top:1px dashed var(--border);font-size:0.78rem;flex-wrap:wrap">
        ${(state.inventory.hvpStock > 0 || state.inventory.lvpStock > 0) ? `<span>${ic('package')} 本×${state.inventory.hvpStock} 谷×${state.inventory.lvpStock}</span>` : ''}
        ${(state.totalHVP + state.totalLVP > 0) ? (() => {
          const sk = getCreativeSkill(state);
          return `<span style="color:var(--secondary)">${ic('target')} 技艺Lv${sk.toFixed(1)} ${getSkillLabel(sk)}</span>`;
        })() : ''}
      </div>` : ''}
    </div>
  `;
}

// === Narrative Helpers ===
export function getNarrativeTitle(state) {
  return getTimeLabel(state.turn);
}

export function buildNarrativeSections(state) {
  const stage = getLifeStage(state.turn);
  const alerts = [];    // { icon, text, severity: 'danger'|'warning' }
  const spotlight = [];  // { icon, text }
  const personal = [];   // plain strings
  const world = { market: [], official: [], advanced: [] };

  // === Turn 0 special case ===
  if (state.turn === 0) {
    personal.push('高考终于结束了！这个暑假，你决定把一直以来的同人创作梦想付诸行动，成立了自己的社团。');
    personal.push(`<span style="color:var(--text-muted);font-size:0.8rem">提示：暑假时间充裕，做同人时间有(${state.time}天/月)，是起步的好时机。注意管理热情值——它会随着时间推移越来越难维持。</span>`);
    return { alerts, spotlight, personal, world };
  }

  // === ALERTS: urgent / negative status ===
  if (state.passion < 20) {
    alerts.push({ icon: 'heart', text: '身心俱疲，创作热情即将耗尽...赶紧休息！', severity: 'danger' });
  } else if (state.passion < 40) {
    alerts.push({ icon: 'heart', text: '疲惫感在累积，注意管理热情值。', severity: 'warning' });
  }

  if (state.money < -2000) {
    alerts.push({ icon: 'money', text: '严重亏损！焦虑影响热情。去"打工"或"接稿"吧。', severity: 'danger' });
  } else if (state.money < -500) {
    alerts.push({ icon: 'money', text: '贴钱做同人的焦虑感在累积...试试打工或接稿。', severity: 'warning' });
  } else if (state.money < 0) {
    alerts.push({ icon: 'coins', text: '资金是负数了。亏损焦虑会消耗热情。', severity: 'warning' });
  } else if (state.money < 300 && stage !== 'work') {
    alerts.push({ icon: 'coins', text: '资金不多了，继续制作可能会亏损。', severity: 'warning' });
  }

  if (state.time <= 1) {
    alerts.push({ icon: 'timer', text: '几乎没有空闲时间，只能休息等忙碌的日子过去。', severity: 'danger' });
  } else if (state.time <= 2) {
    alerts.push({ icon: 'timer', text: '时间非常紧张，只够做轻量级的事情。', severity: 'warning' });
  }

  if (state.unemployed) {
    alerts.push({ icon: 'warning-circle', text: `失业中（已找工作${state.jobSearchTurns}个月）。可以找工作、休息或接稿。`, severity: 'danger' });
    if (state.recessionTurnsLeft > 0) alerts.push({ icon: 'trend-down', text: '经济下行让求职更加困难。', severity: 'danger' });
  }

  if (state.recessionTurnsLeft > 0) {
    const rf = fogRecession(state.recessionTurnsLeft);
    alerts.push({ icon: 'trend-down', text: `${rf.label}，销量下降，成本上升。`, severity: 'warning' });
  }

  const negDebuffs = state.timeDebuffs.filter(d => d.delta < 0);
  if (negDebuffs.length > 0) {
    const reasons = negDebuffs.map(d => d.reason).join('、');
    alerts.push({ icon: 'hourglass', text: `受"${reasons}"影响，可用时间减少。`, severity: 'warning' });
  }

  // === SPOTLIGHT: actionable opportunities ===
  if (state.availableEvents && state.availableEvents.length > 0) {
    for (const e of state.availableEvents) {
      spotlight.push({ icon: 'tent', text: `<b>${e.name}</b>@${e.city} <span class="spotlight-chip">路费¥${e.travelCost}</span> <span class="spotlight-chip">${e.salesBoost >= 4 ? '盛况空前' : e.salesBoost >= 2.5 ? '人气旺盛' : '人流一般'}</span>` });
    }
  }
  if (state.attendingEvent) {
    spotlight.push({ icon: 'sparkle', text: `参展加成生效中！` });
  }
  if (state.hvpProject) {
    const p = state.hvpProject;
    spotlight.push({ icon: 'book-open-text', text: `同人本创作中 <span class="spotlight-chip">${p.progress}/${p.needed}</span> 选择"创作同人本"推进进度` });
  }

  // === PERSONAL: life story / status ===
  if (state.turn === 2) personal.push('大学开学了！新环境、新朋友，但课程也开始占用时间了。');
  if (state.turn === 14) personal.push('大二了，课程变多，你开始感受到平衡学业和创作的压力。');
  if (state.turn === 26) personal.push('大三了...身边的同学开始讨论考研还是找工作。你呢？');
  if (state.turn === 38) personal.push('大四上学期，秋招、考研，现实的压力越来越大。还能坚持创作吗？');
  if (state.turn === 50) personal.push('毕业了，正式踏入社会。工作占据了大部分时间，但每个月有了固定收入。同人创作从此成了"业余爱好"...');

  // === Work stage milestones ===
  if (state.turn === 62) personal.push('工作一年了。下班回家打开画板的那一刻，才觉得这一天真正属于自己。同事们聊房价、聊绩效，你默默想着下一本的分镜。');
  if (state.turn === 86) {
    const peer = state.reputation >= 3 ? '你在圈里已经有了名气，但现实世界里没人知道这意味着什么。' : '同龄人升职的升职，你还在为几十本的销量开心。';
    personal.push(`25岁了。朋友圈里都是晒offer和旅行的，而你的快乐是新刊售罄。${peer}`);
  }
  if (state.turn === 110) personal.push('工作第五年。画技在进步，但每天下班后拖着疲惫的身体还要打开软件，这件事本身就是一种战斗。你开始理解为什么很多人在这个阶段退坑了。');
  if (state.turn === 134) {
    personal.push('快三十了。家里开始催婚，同学聚会时总有人问"你那个画画的爱好还在搞吗？"你笑着点头，心里五味杂陈。');
    if (state.fullTimeDoujin) personal.push('全职同人这条路没有先例可循，每一步都是你自己趟出来的。');
  }
  if (state.turn === 158) {
    const skillNote = getCreativeSkill(state) >= 3 ? '你的技艺已经相当精湛了——至少在这个圈子里，你的名字意味着品质保证。' : '虽然技艺还在磨练，但这么多年的坚持本身就是一种天赋。';
    personal.push(`三十出头。${skillNote}有新人给你发私信请教入坑经验，你突然意识到自己不知不觉已经成了"前辈"。`);
  }
  if (state.turn === 182) personal.push('33岁。你见过太多人来了又走——曾经一起摆摊的朋友，有人转行了，有人结婚后再也没出过新刊。而你还在这里，还在画。这大概就是所谓的热爱吧。');
  if (state.turn === 206) {
    personal.push('35岁。熬夜赶稿第二天明显比以前难恢复了。你开始认真考虑作息时间这件事——身体在提醒你，它不是无限的资源。');
  }
  if (state.turn === 230) {
    const repNote = state.reputation >= 6 ? '后辈们提到你的名字时语气里带着敬意。你在这个圈子的故事，已经成了一种传说。' : '虽然不是什么大佬，但能坚持到现在的人本就寥寥无几。你的存在本身就有意义。';
    personal.push(`37岁。做同人已经快二十年了。${repNote}`);
  }
  if (state.turn === 254) personal.push('39岁。翻到自己十年前的本子，画工青涩得让人发笑。但那个时候的热情和冲劲，纸张都快兜不住了。你有多久没有那种"非画不可"的冲动了？');
  if (state.turn === 278) {
    const legacy = state.totalHVP >= 15 ? `你已经出了${state.totalHVP}本同人志——这是一份相当厚实的创作年表。` : '作品数量也许不多，但每一本都是认真做的。';
    personal.push(`41岁。${legacy}不管接下来怎样，这段旅程已经足够精彩。`);
  }

  if (state.passion > 85) personal.push('你充满干劲，灵感源源不断！');

  if (state.hasPartner && state.partnerType) {
    const pt = PARTNER_TYPES[state.partnerType];
    if (state.partnerType === 'toxic') {
      personal.push(`${ic(pt.emoji)} 有毒搭档还会纠缠你${state.partnerTurns}个月...忍忍吧。`);
    } else {
      personal.push(`${ic(pt.emoji)} ${pt.name}还会陪你${state.partnerTurns}个月。`);
    }
  }

  const cs = state.market?.communitySize || 10000;
  const smallCircle = cs < 5000;
  if (state.reputation >= 8 && smallCircle) {
    personal.push(`${ic('crown')} 这个${cs < 2000 ? '微型' : '小众'}圈子几乎就是围着你转的——你就是这里的"镇圈之宝"。虽然外面的世界不认识你，但这里的每个人都视你为传说。`);
    personal.push(`<span style="font-size:0.78rem;color:var(--text-muted);font-style:italic">"在一千个人心中封神，胜过在一百万人眼里路过。"</span>`);
  } else if (state.reputation >= 5 && smallCircle) {
    personal.push(`${ic('star')} 圈子虽小，但你已经是这里响当当的名字了。几乎每个人都认识你的作品——大鱼，小池塘。`);
    if (cs < 3000) personal.push(`<span style="font-size:0.78rem;color:var(--text-muted);font-style:italic">社群不到${cs.toLocaleString()}人，市场天花板就在头顶。但这份被所有人认识的归属感，大圈子里可得不到。</span>`);
  } else if (state.reputation >= 8) {
    personal.push('你是圈内公认的大手，作品发布就有人翘首以盼。');
  } else if (state.reputation >= 5) {
    personal.push('越来越多人认识你了，社群里经常能看到对你作品的讨论。');
  } else if (state.reputation < 0.5) {
    personal.push('圈子里还没什么人知道你。试试宣发推广？');
  }

  if (state.infoDisclosure < 0.15) {
    personal.push(`${ic('lightbulb')} 信息透明度很低——先"宣发推广"，然后立刻制作售卖！`);
  }

  // Default
  if (personal.length === 0 && alerts.length === 0 && spotlight.length === 0) {
    const defaults = ['新的一个月，这个月打算做什么呢？', '每一步选择都在塑造你的同人生涯。', '看看手头的状态，做出最适合的选择吧。'];
    personal.push(defaults[state.turn % defaults.length]);
  }

  // === WORLD: market / IP / advanced ===
  if (state.market) world.market = getMarketNarratives(state.market);
  if (state.official) world.official = getOfficialNarratives(state.official);
  if (state.advanced) world.advanced = getAdvancedNarratives(state.advanced);

  return { alerts, spotlight, personal, world };
}

// --- Section renderers ---
export function renderAlertBanner(alerts) {
  if (!alerts.length) return '';
  const items = alerts.map(a =>
    `<div class="alert-item ${a.severity}"><span class="alert-icon">${ic(a.icon)}</span>${a.text}</div>`
  ).join('');
  return `<div class="alert-strip">${items}</div>`;
}

export function renderSpotlightCard(spotlight) {
  if (!spotlight.length) return '';
  const items = spotlight.map(s =>
    `<div class="spotlight-item"><span class="spotlight-icon">${ic(s.icon)}</span><span>${s.text}</span></div>`
  ).join('');
  return `<div class="spotlight-card"><div class="spotlight-title">${ic('target')} 本月机会</div>${items}</div>`;
}

export function renderPersonalNarrative(title, personal) {
  if (!personal.length) return '';
  return `<div class="narrative"><div class="turn-title">${title}</div><p>${personal.join('</p><p>')}</p></div>`;
}
