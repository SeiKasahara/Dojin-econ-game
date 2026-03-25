/**
 * Partner Drama — 同人社団物語
 * Random drama events triggered by partner types
 */

const DRAMA_POOL = {
  demanding: [
    { desc: '搭档嫌弃你的画稿质量，要求推翻重来', summary: '热情-8', passionDelta: -8, reputationDelta: 0 },
  ],
  unreliable: [
    { desc: '搭档突然消失不回消息，进度全部拖延', summary: '热情-5', passionDelta: -5, reputationDelta: 0 },
    { desc: '搭档交付的部分质量很差，只能你来返工', summary: '热情-8', passionDelta: -8, reputationDelta: 0 },
  ],
  toxic: [
    { desc: '搭档在社交媒体上公开吐槽你', summary: '热情-12 声誉-0.5', passionDelta: -12, reputationDelta: -0.5 },
    { desc: '搭档挑起粉丝之间的对立', summary: '热情-10 声誉-0.3', passionDelta: -10, reputationDelta: -0.3 },
    { desc: '搭档把未完成草稿泄露出去', summary: '热情-15 声誉-0.4', passionDelta: -15, reputationDelta: -0.4 },
  ],
};

export function rollPartnerDrama(type) {
  const options = DRAMA_POOL[type] || [];
  return options.length > 0
    ? options[Math.floor(Math.random() * options.length)]
    : { desc: '', summary: '', passionDelta: 0, reputationDelta: 0 };
}
