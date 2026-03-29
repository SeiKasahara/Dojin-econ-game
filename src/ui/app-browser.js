import { ic } from '../icons.js';

export function openBrowserApp() {
  const overlay = document.createElement('div');
  overlay.className = 'event-overlay';
  overlay.innerHTML = `
    <div class="app-page" style="max-height:70vh">
      <div class="app-titlebar" style="border-bottom-color:#4285F4">
        <button class="app-back" id="browser-back">${ic('arrow-left')} 返回</button>
        <span class="app-title">${ic('globe')} 浏览器</span>
        <span style="width:60px"></span>
      </div>
      <div class="app-page-body" style="padding:20px 16px">
        <div style="text-align:center;margin-bottom:20px;color:var(--text-muted);font-size:0.8rem">想去哪里？</div>
        <a href="https://github.com/SeiKasahara/Dojin-econ-game/issues" target="_blank" rel="noopener" class="app-action-card" style="text-decoration:none;color:inherit;margin-bottom:10px">
          <div class="app-action-icon" style="color:#24292e">${ic('github-logo', '1.3rem')}</div>
          <div class="app-action-body">
            <div class="app-action-name">提交反馈 / Issue</div>
            <div class="app-action-cost">在 GitHub 上报告 Bug 或提出建议</div>
          </div>
          <div style="color:var(--text-muted)">${ic('arrow-right')}</div>
        </a>
        <a href="https://seikasahara.com/zh/" target="_blank" rel="noopener" class="app-action-card" style="text-decoration:none;color:inherit;margin-bottom:10px">
          <div class="app-action-icon" style="color:#2A9D8F">${ic('notebook', '1.3rem')}</div>
          <div class="app-action-body">
            <div class="app-action-name">同人经济学理论</div>
            <div class="app-action-cost">seikasahara.com/zh/</div>
          </div>
          <div style="color:var(--text-muted)">${ic('arrow-right')}</div>
        </a>
        <a href="https://wj.qq.com/s2/25896834/7619/" target="_blank" rel="noopener" class="app-action-card" style="text-decoration:none;color:inherit;margin-bottom:10px">
          <div class="app-action-icon" style="color:#FF6B35">${ic('clipboard-text', '1.3rem')}</div>
          <div class="app-action-body">
            <div class="app-action-name">同人经济学调查问卷</div>
            <div class="app-action-cost">帮助我们的研究，填写只需几分钟</div>
          </div>
          <div style="color:var(--text-muted)">${ic('arrow-right')}</div>
        </a>
        <a href="https://space.bilibili.com/4330116" target="_blank" rel="noopener" class="app-action-card" style="text-decoration:none;color:inherit">
          <div class="app-action-icon" style="color:#00A1D6">${ic('monitor-play', '1.3rem')}</div>
          <div class="app-action-body">
            <div class="app-action-name">作者 Bilibili</div>
            <div class="app-action-cost">关注作者的B站空间</div>
          </div>
          <div style="color:var(--text-muted)">${ic('arrow-right')}</div>
        </a>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#browser-back').addEventListener('click', () => overlay.remove());
}
