import { ic, escapeHtml } from '../icons.js';

export function renderMessageApp(state, onAction, onBack) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  // Dynamically import to check goddess state
  import('../chat-npc.js').then(({ getBestieRemaining, getBestieCooldown, getGoddessState, getPartnerChatContact, getPartnerChatRemaining, getPartnerChatCooldown, CHAT_CHARACTERS }) => {
    const bestieRemain = getBestieRemaining(state);
    const bestieCd = getBestieCooldown(state);
    const goddessState = getGoddessState(state);

    let bestieSubtitle;
    if (bestieRemain > 0) bestieSubtitle = '闺蜜 · 有空聊天';
    else if (bestieCd > 0) bestieSubtitle = `闺蜜 · ${bestieCd}个月后再聊`;
    else bestieSubtitle = '闺蜜 · 忙去了';

    const contacts = [
      { id: 'bestie', name: '小柚', subtitle: bestieSubtitle, color: '#E84393', avatar: 'Goddess/Guimi.jpg', disabled: bestieRemain <= 0 },
    ];
    if (goddessState) {
      contacts.push({ id: 'goddess', name: '傲娇女神织梦', subtitle: goddessState.remaining > 0 ? `${goddessState.topic} · 剩${goddessState.remaining}条` : '已离开', color: '#9B59B6', avatar: 'Goddess/goddess.jpg', badge: goddessState.remaining > 0, disabled: goddessState.remaining <= 0 });
    } else {
      contacts.push({ id: 'goddess', name: '傲娇女神织梦', subtitle: '不在线', color: '#9B59B6', avatar: 'Goddess/goddess.jpg', disabled: true });
    }
    const partnerContact = getPartnerChatContact(state);
    if (partnerContact) {
      const pRemain = getPartnerChatRemaining(state);
      const pCd = getPartnerChatCooldown(state);
      const pHasNudge = state._partnerChatNudgeSent && pRemain > 0;
      let pSubtitle;
      if (pRemain > 0) pSubtitle = '社团成员 · 有空聊天';
      else if (pCd > 0) pSubtitle = `社团成员 · ${pCd}个月后再聊`;
      else pSubtitle = '社团成员 · 忙去了';
      contacts.push({ id: `partner_${partnerContact.id}`, name: partnerContact.name, subtitle: pSubtitle, color: '#3498DB', avatar: `partner/${partnerContact.avatarIdx}.webp`, disabled: pRemain <= 0, badge: pHasNudge || pRemain > 0 });
    }
    if (state.commercialOfferReceived) {
      contacts.push({ id: 'publisher', name: '某出版社编辑', subtitle: '新消息！', color: '#2ECC71', icon: 'building-office', badge: true });
    }

    overlay.innerHTML = `
      <div class="app-page">
        <div class="app-titlebar" style="border-bottom-color:#2ECC71">
          <button class="app-back" id="app-back">${ic('arrow-left')} 返回</button>
          <span class="app-title">${ic('envelope')} 短信</span>
          <span style="width:60px"></span>
        </div>
        <div class="app-page-body">
          ${contacts.map(c => `
            <div class="app-action-card ${c.disabled ? 'disabled' : ''}" data-contact="${c.id}" style="cursor:${c.disabled ? 'default' : 'pointer'};${c.disabled ? 'opacity:0.5;' : ''}">
              ${c.avatar
                ? `<img src="${c.avatar}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;border:2px solid ${c.color}">`
                : `<div style="width:40px;height:40px;border-radius:50%;background:${c.color};display:flex;align-items:center;justify-content:center;flex-shrink:0;color:#fff">${ic(c.icon || 'user', '1.1rem')}</div>`
              }
              <div class="app-action-body">
                <div class="app-action-name">${c.name} ${c.badge ? `<span style="background:var(--danger);color:#fff;font-size:0.55rem;padding:1px 5px;border-radius:8px;margin-left:4px">新</span>` : ''}</div>
                <div class="app-action-cost">${c.subtitle}</div>
              </div>
            </div>`).join('')}
        </div>
      </div>`;
    document.body.appendChild(overlay);
    overlay.querySelector('#app-back').addEventListener('click', () => { overlay.remove(); if (onBack) onBack(); });

    overlay.querySelectorAll('.app-action-card:not(.disabled)[data-contact]').forEach(el => {
      el.addEventListener('click', () => {
        const contactId = el.dataset.contact;
        overlay.remove();
        if (contactId.startsWith('partner_')) {
          const cid = parseInt(contactId.replace('partner_', ''));
          renderPartnerChat(state, cid, onAction, onBack);
        } else if (contactId === 'publisher') {
          renderPublisherMessage(state, onAction, onBack);
        } else {
          renderChatView(state, contactId, onAction, onBack);
        }
      });
    });
  });
}

function renderPublisherMessage(state, onAction, onBack) {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="app-page">
      <div class="app-titlebar" style="border-bottom-color:#2ECC71">
        <button class="app-back" id="app-back">${ic('arrow-left')} 返回</button>
        <span class="app-title">${ic('building-office')} 某出版社编辑</span>
        <span style="width:60px"></span>
      </div>
      <div class="app-page-body" style="padding:16px">
        <div style="background:#F0FAF0;border-radius:var(--radius);padding:14px;font-size:0.82rem;line-height:1.6;color:var(--text);margin-bottom:16px">
          你好！我是XX出版社的编辑。在上次展会后一直在关注你的作品——我们很看好你的创作实力。<br><br>
          不知道你有没有兴趣聊聊商业出版？
        </div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:16px;line-height:1.5">
          ${ic('lightbulb')} 接受后将告别同人创作，开启商业出道结局。
        </div>
        <button class="btn btn-primary btn-block" id="msg-accept" style="margin-bottom:8px">${ic('star')} 接受邀约</button>
        <button class="btn btn-block" id="msg-decline" style="background:var(--bg);border:1px solid var(--border);color:var(--text-light)">暂时不考虑</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#app-back').addEventListener('click', () => { overlay.remove(); renderMessageApp(state, onAction, onBack); });
  overlay.querySelector('#msg-decline').addEventListener('click', () => { overlay.remove(); renderMessageApp(state, onAction, onBack); });
  overlay.querySelector('#msg-accept').addEventListener('click', () => { overlay.remove(); onAction('goCommercial'); });
}

async function renderChatView(state, characterId, onAction, onBack) {
  if (characterId === 'bestie') {
    return renderBestieChat(state, onAction, onBack);
  }
  return renderGoddessChat(state, onAction, onBack);
}

// === Bestie: preset dialog with choices ===
async function renderBestieChat(state, onAction, onBack) {
  const { CHAT_CHARACTERS, getBestieRemaining } = await import('../chat-npc.js');
  const { pickBestieDialog } = await import('../bestie-dialogs.js');
  const char = CHAT_CHARACTERS.bestie;

  if (!state._chatHistory) state._chatHistory = {};
  if (!state._chatHistory.bestie) state._chatHistory.bestie = [];
  const history = state._chatHistory.bestie;

  // First open: inject greeting
  if (history.length === 0) {
    history.push({ role: 'assistant', content: char.getGreeting(state) });
  }

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  function render() {
    const remaining = getBestieRemaining(state);
    const gone = remaining <= 0;
    // Pick a new dialog if we need to show choices
    const needsDialog = !gone && !history._pendingDialog && history[history.length - 1]?.role === 'assistant';
    if (needsDialog) {
      history._pendingDialog = pickBestieDialog(state);
      // If last message is greeting, show the dialog npc message too
      if (history.length === 1 || history[history.length - 1]?.content !== history._pendingDialog.npc) {
        history.push({ role: 'assistant', content: history._pendingDialog.npc });
      }
    }

    const msgsHtml = history.filter(m => typeof m === 'object' && m.role).map(m => `
      <div style="display:flex;margin-bottom:8px;${m.role === 'user' ? 'flex-direction:row-reverse' : ''}">
        <div style="max-width:80%;padding:8px 12px;border-radius:12px;font-size:0.8rem;line-height:1.5;${
          m.role === 'user'
            ? 'background:var(--primary);color:#fff;border-bottom-right-radius:4px'
            : 'background:var(--bg);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px'
        }">${escapeHtml(m.content)}</div>
      </div>`).join('');

    const dialog = history._pendingDialog;
    const choicesHtml = (!gone && dialog) ? `
      <div style="display:flex;flex-direction:column;gap:6px;padding:8px 12px">
        ${dialog.replies.map((r, i) => `
          <button class="btn bestie-reply" data-idx="${i}" style="text-align:left;padding:8px 12px;font-size:0.78rem;background:var(--bg-card);border:1.5px solid var(--border);border-radius:12px;cursor:pointer">${escapeHtml(r.text)}</button>
        `).join('')}
      </div>` : '';

    overlay.innerHTML = `
      <div class="app-page" style="display:flex;flex-direction:column;height:80vh">
        <div class="app-titlebar" style="border-bottom-color:${char.color};flex-shrink:0">
          <button class="app-back" id="chat-back">${ic('arrow-left')} 返回</button>
          <span class="app-title" style="display:flex;align-items:center;gap:6px">
            <img src="${char.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover">
            ${char.name}
          </span>
          <span style="width:60px"></span>
        </div>
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch">
          ${msgsHtml}
          ${choicesHtml}
          ${gone ? `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.78rem">${char.goneMessage}</div>` : ''}
        </div>
      </div>`;

    if (!document.body.contains(overlay)) document.body.appendChild(overlay);

    const msgBox = overlay.querySelector('#chat-messages');
    msgBox.scrollTop = msgBox.scrollHeight;

    overlay.querySelector('#chat-back').addEventListener('click', () => { overlay.remove(); renderMessageApp(state, onAction, onBack); });

    // Bind reply choices
    overlay.querySelectorAll('.bestie-reply').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const reply = dialog.replies[idx];
        // Player chose
        history.push({ role: 'user', content: reply.text });
        // Bestie responds
        history.push({ role: 'assistant', content: reply.response });
        history._pendingDialog = null;
        // Track usage + mark cooldown start
        if (!state._chatUsage) state._chatUsage = {};
        state._chatUsage.bestie = (state._chatUsage.bestie || 0) + 1;
        state._bestieLastChatTurn = state.turn; // start 3-month cooldown
        // Grow bestie affinity (hidden stat)
        state.bestieAffinity = Math.min(100, (state.bestieAffinity || 10) + 3);
        render();
      });
    });
  }

  render();
}

// === Partner: preset dialog with choices + effects ===
async function renderPartnerChat(state, contactId, onAction, onBack) {
  const { getPartnerChatRemaining } = await import('../chat-npc.js');
  const { pickPartnerDialog } = await import('../partner-dialogs.js');
  const { updateContactAffinity } = await import('../partner.js');

  const contact = (state.contacts || []).find(c => c.id === contactId);
  if (!contact) { renderMessageApp(state, onAction, onBack); return; }

  const PARTNER_GREETINGS = {
    supportive: ['嘿！好久不见~最近创作顺利吗？', '在吗在吗！想跟你聊聊天~', '嗨~今天心情怎么样？'],
    demanding: ['有空？正好有些想法想跟你讨论', '哼，终于想起联系我了？', '你最近作品看了，有话说'],
    unreliable: ['啊！你在！我刚想找你说一件超有趣的事！', '嘿嘿嘿，猜猜我今天干了啥', '诶诶诶你在不在！'],
    toxic: ['唉…最近好无聊，就你还愿意搭理我', '你又来找我了？…还以为你忘了我呢', '哦…你终于想起我了'],
  };

  const charColor = '#3498DB';
  const charAvatar = `partner/${contact.avatarIdx}.webp`;
  const histKey = `partner_${contactId}`;

  if (!state._chatHistory) state._chatHistory = {};
  if (!state._chatHistory[histKey]) state._chatHistory[histKey] = [];
  const history = state._chatHistory[histKey];

  // First open: inject greeting
  if (history.length === 0) {
    const greetings = PARTNER_GREETINGS[contact.pType] || PARTNER_GREETINGS.supportive;
    history.push({ role: 'assistant', content: greetings[Math.floor(Math.random() * greetings.length)] });
  }

  // Clear nudge flag
  state._partnerChatNudgeSent = false;

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  function render() {
    const remaining = getPartnerChatRemaining(state);
    const gone = remaining <= 0;
    const needsDialog = !gone && !history._pendingDialog && history[history.length - 1]?.role === 'assistant';
    if (needsDialog) {
      history._pendingDialog = pickPartnerDialog(state, contact.pType);
      if (history.length === 1 || history[history.length - 1]?.content !== history._pendingDialog.npc) {
        history.push({ role: 'assistant', content: history._pendingDialog.npc });
      }
    }

    const msgsHtml = history.filter(m => typeof m === 'object' && m.role).map(m => `
      <div style="display:flex;margin-bottom:8px;${m.role === 'user' ? 'flex-direction:row-reverse' : ''}">
        <div style="max-width:80%;padding:8px 12px;border-radius:12px;font-size:0.8rem;line-height:1.5;${
          m.role === 'user'
            ? 'background:var(--primary);color:#fff;border-bottom-right-radius:4px'
            : m.role === 'effect'
            ? 'background:transparent;color:var(--text-muted);font-size:0.7rem;font-style:italic;padding:2px 0'
            : 'background:var(--bg);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px'
        }">${escapeHtml(m.content)}</div>
      </div>`).join('');

    const dialog = history._pendingDialog;
    const choicesHtml = (!gone && dialog) ? `
      <div style="display:flex;flex-direction:column;gap:6px;padding:8px 12px">
        ${dialog.replies.map((r, i) => `
          <button class="btn partner-reply" data-idx="${i}" style="text-align:left;padding:8px 12px;font-size:0.78rem;background:var(--bg-card);border:1.5px solid var(--border);border-radius:12px;cursor:pointer">${escapeHtml(r.text)}</button>
        `).join('')}
      </div>` : '';

    overlay.innerHTML = `
      <div class="app-page" style="display:flex;flex-direction:column;height:80vh">
        <div class="app-titlebar" style="border-bottom-color:${charColor};flex-shrink:0">
          <button class="app-back" id="chat-back">${ic('arrow-left')} 返回</button>
          <span class="app-title" style="display:flex;align-items:center;gap:6px">
            <img src="${charAvatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover">
            ${contact.name}
          </span>
          <span style="width:60px"></span>
        </div>
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch">
          ${msgsHtml}
          ${choicesHtml}
          ${gone ? '<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.78rem">TA可能在忙创作了~</div>' : ''}
        </div>
      </div>`;

    if (!document.body.contains(overlay)) document.body.appendChild(overlay);
    const msgBox = overlay.querySelector('#chat-messages');
    msgBox.scrollTop = msgBox.scrollHeight;

    overlay.querySelector('#chat-back').addEventListener('click', () => { overlay.remove(); renderMessageApp(state, onAction, onBack); });

    overlay.querySelectorAll('.partner-reply').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        const reply = dialog.replies[idx];
        history.push({ role: 'user', content: reply.text });
        history.push({ role: 'assistant', content: reply.response });
        // Apply effects
        if (reply.effect) {
          const fx = reply.effect;
          const parts = [];
          if (fx.passion) { state.passion = Math.min(100, Math.max(0, state.passion + fx.passion)); parts.push(`热情${fx.passion > 0 ? '+' : ''}${fx.passion}`); }
          if (fx.affinity) { updateContactAffinity(state, contactId, fx.affinity); parts.push(`好感+${fx.affinity}`); }
          if (fx.collabHint) { state._partnerCollabHint = true; parts.push('合作灵感'); }
          if (fx.infoDisclosure) { state.infoDisclosure = Math.min(1, state.infoDisclosure + fx.infoDisclosure); parts.push(`信息+${Math.round(fx.infoDisclosure * 100)}%`); }
          if (parts.length > 0) history.push({ role: 'effect', content: `[${parts.join(' · ')}]` });
        }
        history._pendingDialog = null;
        if (!state._chatUsage) state._chatUsage = {};
        state._chatUsage.partnerChat = (state._chatUsage.partnerChat || 0) + 1;
        state._partnerChatLastTurn = state.turn;
        render();
      });
    });
  }

  render();
}

// === Goddess: AI-powered free-input chat ===
async function renderGoddessChat(state, onAction, onBack) {
  const { chatWithNPC, CHAT_CHARACTERS, getGoddessState } = await import('../chat-npc.js');
  const char = CHAT_CHARACTERS.goddess;

  if (!state._chatHistory) state._chatHistory = {};
  if (!state._chatHistory.goddess) {
    state._chatHistory.goddess = [];
    const gs = getGoddessState(state);
    if (gs?.opening) state._chatHistory.goddess.push({ role: 'assistant', content: gs.opening });
  }
  const history = state._chatHistory.goddess;

  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';

  function render() {
    const gs = getGoddessState(state);
    const remaining = gs ? gs.remaining : 0;
    const gone = remaining <= 0;

    const msgsHtml = history.map(m => `
      <div style="display:flex;margin-bottom:8px;${m.role === 'user' ? 'flex-direction:row-reverse' : ''}">
        <div style="max-width:75%;padding:8px 12px;border-radius:12px;font-size:0.8rem;line-height:1.5;${
          m.role === 'user'
            ? 'background:var(--primary);color:#fff;border-bottom-right-radius:4px'
            : 'background:var(--bg);border:1px solid var(--border);color:var(--text);border-bottom-left-radius:4px'
        }">${escapeHtml(m.content)}</div>
      </div>`).join('');

    overlay.innerHTML = `
      <div class="app-page" style="display:flex;flex-direction:column;height:80vh">
        <div class="app-titlebar" style="border-bottom-color:${char.color};flex-shrink:0">
          <button class="app-back" id="chat-back">${ic('arrow-left')} 返回</button>
          <span class="app-title" style="display:flex;align-items:center;gap:6px">
            <img src="${char.avatar}" style="width:24px;height:24px;border-radius:50%;object-fit:cover">
            ${char.name}
          </span>
          <span style="width:60px"></span>
        </div>
        <div id="chat-messages" style="flex:1;overflow-y:auto;padding:12px;-webkit-overflow-scrolling:touch">
          ${msgsHtml}
          ${gone ? `<div style="text-align:center;padding:12px;color:var(--text-muted);font-size:0.78rem">${char.goneMessage}</div>` : ''}
        </div>
        <div style="padding:8px 12px;border-top:1px solid var(--border);display:flex;gap:8px;flex-shrink:0;background:var(--bg-card)">
          <input id="chat-input" type="text" placeholder="${gone ? '女神已离开' : `说点什么…（剩${remaining}条）`}" ${gone ? 'disabled' : ''} style="flex:1;border:1.5px solid var(--border);border-radius:20px;padding:8px 14px;font-size:0.8rem;outline:none;background:var(--bg)">
          <button id="chat-send" class="btn btn-primary" style="padding:8px 14px;border-radius:20px;font-size:0.8rem" ${gone ? 'disabled' : ''}>${ic('paper-plane-right')}</button>
        </div>
      </div>`;

    if (!document.body.contains(overlay)) document.body.appendChild(overlay);

    const msgBox = overlay.querySelector('#chat-messages');
    msgBox.scrollTop = msgBox.scrollHeight;

    overlay.querySelector('#chat-back').addEventListener('click', () => { overlay.remove(); renderMessageApp(state, onAction, onBack); });

    if (!gone) {
      const input = overlay.querySelector('#chat-input');
      const sendBtn = overlay.querySelector('#chat-send');

      async function send() {
        const text = input.value.trim();
        if (!text) return;
        input.value = '';

        history.push({ role: 'user', content: text });
        render();

        const msgBox2 = overlay.querySelector('#chat-messages');
        const typing = document.createElement('div');
        typing.style.cssText = 'text-align:left;padding:4px 0;font-size:0.75rem;color:var(--text-muted)';
        typing.textContent = `${char.name}正在输入...`;
        msgBox2.appendChild(typing);
        msgBox2.scrollTop = msgBox2.scrollHeight;

        const reply = await chatWithNPC('goddess', history, state);
        typing.remove();

        if (reply === null) {
          render();
        } else {
          history.push({ role: 'assistant', content: reply });
          render();
        }
      }

      sendBtn.addEventListener('click', send);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.isComposing) send(); });
      input.focus();
    }
  }

  render();
}
