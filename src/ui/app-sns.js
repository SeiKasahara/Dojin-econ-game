import { ic } from '../icons.js';
import { generateWorldNews } from '../world-news.js';

export function openSNSPanel(state) {
  const typeIcon = { npc: 'sparkle', trend: 'chart-bar', fan: 'heart', market: 'package', flavor: 'chat-circle-dots', drama: 'lightning' };
  const typeHandle = { npc: '创作者', trend: '趋势话题', fan: '粉丝', market: '市场观察', flavor: '闲聊', drama: '热搜' };
  const avatarColor = { npc: '#264653', trend: '#F5A623', fan: '#FF6B9D', market: '#00A8E8', flavor: '#6B8A7A', drama: '#E76F51' };
  const timeLabels = ['刚刚', '3分钟前', '8分钟前', '15分钟前', '28分钟前', '1小时前', '2小时前', '3小时前'];

  // Build feed HTML
  const feedItems = state.market?.socialFeed || [];
  const feedHtml = feedItems.length === 0
    ? `<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:0.82rem">${ic('chat-circle-dots', '2rem')}<br><br>暂时没有新动态</div>`
    : feedItems.map((f, i) => {
      const authorName = f.author || '匿名';
      const time = timeLabels[Math.min(i, timeLabels.length - 1)];
      const handle = typeHandle[f.type] || '动态';
      const hotTag = f.hot ? `<span class="sns-hot-tag">${ic('fire', '0.6rem')} 热门</span>` : '';
      // Stable avatar from prop-npc based on author name hash
      let nameHash = 0;
      for (let c = 0; c < authorName.length; c++) nameHash = ((nameHash << 5) - nameHash + authorName.charCodeAt(c)) | 0;
      const avatarIdx = (Math.abs(nameHash) % 30) + 1;

      return `
      <div class="sns-feed-item">
        <img class="sns-feed-avatar" src="prop-npc/${avatarIdx}.webp" style="object-fit:cover" alt="">
        <div class="sns-feed-body">
          <div class="sns-feed-meta">
            <span class="sns-feed-author">${authorName}</span>
            <span class="sns-feed-handle">@${handle}</span>
            <span class="sns-feed-dot">·</span>
            <span class="sns-feed-time">${time}</span>
            ${hotTag}
          </div>
          <div class="sns-feed-text">${f.text}</div>
          ${f.commentTexts?.length ? `<div class="sns-feed-comments">${f.commentTexts.map(c => `<div class="sns-comment">${c}</div>`).join('')}</div>` : ''}
          <div class="sns-feed-stats">
            <span>${ic('chat-circle', '0.75rem')} ${f.comments || 0}</span>
            <span>${ic('arrows-clockwise', '0.75rem')} ${f.retweets || 0}</span>
            <span>${ic('heart', '0.75rem')} ${f.likes || 0}</span>
          </div>
        </div>
      </div>`;
    }).join('');

  // Build world news HTML (macro economy & life headlines, not market data)
  const worldNews = generateWorldNews(state);
  const categoryIcons = { macro: 'chart-line-up', life: 'newspaper', quirky: 'smiley-wink', app: 'device-mobile' };
  const categoryLabels = { macro: '财经', life: '社会', quirky: '趣闻', app: '科技' };
  const worldHtml = worldNews.length === 0
    ? '<div style="text-align:center;padding:40px 20px;color:var(--text-muted);font-size:0.82rem">暂无新闻</div>'
    : worldNews.map(n => `
      <div class="sns-feed-item" style="padding:10px 14px">
        <div style="width:32px;height:32px;border-radius:50%;background:${n.category === 'macro' ? '#3498DB' : n.category === 'app' ? '#9B59B6' : n.category === 'quirky' ? '#F39C12' : '#27AE60'};display:flex;align-items:center;justify-content:center;color:#fff;flex-shrink:0;font-size:0.75rem">${ic(categoryIcons[n.category] || 'newspaper')}</div>
        <div class="sns-feed-body">
          <div class="sns-feed-meta">
            <span class="sns-feed-author">${categoryLabels[n.category] || '新闻'}</span>
            <span class="sns-feed-time">今日</span>
          </div>
          <div class="sns-feed-text">${n.text}</div>
        </div>
      </div>`).join('');

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'sns-overlay';
  overlay.innerHTML = `
    <div class="sns-backdrop" id="sns-backdrop"></div>
    <div class="sns-panel">
      <div class="sns-drag-bar"></div>
      <div class="sns-topbar">
        <div class="sns-topbar-avatar">${ic('user', '0.9rem')}</div>
        <span class="sns-topbar-title">Nyaner</span>
        <button class="sns-close" id="sns-close">${ic('x-circle', '1.2rem')}</button>
      </div>
      <div class="sns-header">
        <div class="sns-tabs">
          <div class="sns-tab active" data-tab="feed">圈内动态</div>
          <div class="sns-tab" data-tab="world">今日新闻</div>
        </div>
      </div>
      <div class="sns-content">
        <div class="sns-tab-content" id="sns-tab-feed">${feedHtml}</div>
        <div class="sns-tab-content" id="sns-tab-world" style="display:none">${worldHtml}</div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  // Bind events
  const close = () => { overlay.remove(); };
  overlay.querySelector('#sns-backdrop').addEventListener('click', close);
  overlay.querySelector('#sns-close').addEventListener('click', close);
  overlay.querySelectorAll('.sns-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      overlay.querySelectorAll('.sns-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      overlay.querySelector('#sns-tab-feed').style.display = tab.dataset.tab === 'feed' ? '' : 'none';
      overlay.querySelector('#sns-tab-world').style.display = tab.dataset.tab === 'world' ? '' : 'none';
    });
  });
}
