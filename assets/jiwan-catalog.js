/* 即玩共用目录与店面铬。首页、发现、排行、社区、工坊、个人页共用。 */
const ICONS = {
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.6 14.4 9l5.8.5-4.4 3.8 1.4 5.7L12 16.2 6.8 19l1.4-5.7L3.8 9.5 9.6 9z"/></svg>',
  idle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8"/><path d="M12 8v8M8 12h8"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M13 3 6 14h6l-1 7 8-12h-6z"/></svg>',
  puzzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h5V6a2 2 0 1 1 4 0v2h5v5h2a2 2 0 1 1 0 4h-2v5H4V8z"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4.5h11a3 3 0 0 1 3 3V20H8a3 3 0 0 0-3 3V4.5z"/><path d="M5 4.5A3 3 0 0 1 8 1.5h10"/></svg>',
  cube: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 20 7.5v9L12 21 4 16.5v-9L12 3z"/><path d="M12 21V12M20 7.5 12 12 4 7.5"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/></svg>',
  heartOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z"/></svg>'
};

const GENRES = [
  { id:'all', label:'全部类型' },
  { id:'action', label:'动作' },
  { id:'io', label:'IO 对战' },
  { id:'puzzle', label:'解谜' },
  { id:'idle', label:'放置' },
  { id:'story', label:'叙事' }
];
const DURATIONS = [
  { id:'all', label:'不限时长' },
  { id:'short', label:'三分钟内' },
  { id:'mid', label:'约十分钟' },
  { id:'long', label:'长线养成' }
];
const FABLE = [
  { id:'all', label:'全部来源' },
  { id:'workshop', label:'仅 Fable 5.2' },
  { id:'curated', label:'不含工坊' }
];
const RANK_TABS = [['hot','热玩'],['new','新作'],['score','口碑']];
const RANK_PERIODS = [['day','日'],['week','周'],['month','月']];
const RANK_TAB_NAME = {hot:'热玩榜', new:'新作榜', score:'口碑榜'};
const RANK_PERIOD_NAME = {day:'日榜', week:'周榜', month:'月榜'};
const RANK_ARROW_UP = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 1.2 9.2 8.8H.8z"/></svg>';
const RANK_ARROW_DOWN = '<svg viewBox="0 0 10 10" aria-hidden="true"><path d="M5 8.8.8 1.2h8.4z"/></svg>';
const BRAND_PADS = `<g class="brand-pads" aria-hidden="true" transform="translate(50 14) scale(.7) translate(-50 -14)"><defs><linearGradient id="jiwanPadWg" x1="18%" y1="6%" x2="82%" y2="96%"><stop offset="0" stop-color="#fffef8"/><stop offset=".38" stop-color="#f4eee4"/><stop offset=".72" stop-color="#d5ccbe"/><stop offset="1" stop-color="#b4a896"/></linearGradient><linearGradient id="jiwanPadWf" x1="30%" y1="0%" x2="70%" y2="100%"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e4dcd0"/></linearGradient><linearGradient id="jiwanPadWb" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0" stop-color="#d8d0c4"/><stop offset="1" stop-color="#c4b8a8"/></linearGradient><radialGradient id="jiwanPadWs" cx="32%" cy="22%" r="58%"><stop offset="0" stop-color="#fff" stop-opacity=".72"/><stop offset=".42" stop-color="#fff" stop-opacity=".14"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient><linearGradient id="jiwanPadKg" x1="16%" y1="0%" x2="88%" y2="100%"><stop offset="0" stop-color="#4e4e54"/><stop offset=".4" stop-color="#1c1c20"/><stop offset="1" stop-color="#08080a"/></linearGradient><linearGradient id="jiwanPadKf" x1="28%" y1="0%" x2="72%" y2="100%"><stop offset="0" stop-color="#3a3a40"/><stop offset="1" stop-color="#141416"/></linearGradient><linearGradient id="jiwanPadKb" x1="50%" y1="0%" x2="50%" y2="100%"><stop offset="0" stop-color="#2a2a30"/><stop offset="1" stop-color="#121214"/></linearGradient><radialGradient id="jiwanPadKs" cx="36%" cy="18%" r="52%"><stop offset="0" stop-color="#9a9aa2" stop-opacity=".45"/><stop offset=".5" stop-color="#4a4a50" stop-opacity=".1"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient><radialGradient id="jiwanPadStW" cx="36%" cy="30%" r="68%"><stop offset="0" stop-color="#4a4540"/><stop offset=".48" stop-color="#1a1816"/><stop offset="1" stop-color="#050403"/></radialGradient><radialGradient id="jiwanPadStK" cx="36%" cy="30%" r="68%"><stop offset="0" stop-color="#6e6e74"/><stop offset=".48" stop-color="#2a2a2e"/><stop offset="1" stop-color="#0c0c0e"/></radialGradient></defs><ellipse cx="24.5" cy="26.6" rx="17.5" ry="2.1" fill="#2a231c" opacity=".14"/><g transform="translate(14.2 .4) rotate(17 20 13.4) scale(.9)"><g class="pad-k"><path fill="url(#jiwanPadKg)" stroke="#050506" stroke-width=".35" stroke-linejoin="round" d="M8 3.6C4.5 3.8 2.2 6 1.6 9.4C1.1 12.6 1.8 15.5 3.4 17.5C3.2 20.6 1.8 24.8 4.6 26.8C7.2 28.6 11.4 26.6 12.2 22.6C12.8 20.4 15 18.4 18 18C19.3 17.8 20.7 17.8 22 18C25 18.4 27.2 20.4 27.8 22.6C28.6 26.6 32.8 28.6 35.4 26.8C38.2 24.8 36.8 20.6 36.6 17.5C38.2 15.5 38.9 12.6 38.4 9.4C37.8 6 35.5 3.8 32 3.6C27.5 2.8 12.5 2.8 8 3.6Z"/><path fill="url(#jiwanPadKb)" d="M8.4 3.7C12.2 2.55 27.8 2.55 31.6 3.7C28.6 2.35 11.4 2.35 8.4 3.7Z"/><path fill="url(#jiwanPadKf)" d="M9.2 5C6.4 5.2 4.4 6.8 4 9.4C3.6 12 4.6 14.4 6.4 15.8C9.2 17.2 14 17.4 17.6 17.2H22.4C26 17.4 30.8 17.2 33.6 15.8C35.4 14.4 36.4 12 36 9.4C35.6 6.8 33.6 5.2 30.8 5C26.8 4.4 13.2 4.4 9.2 5Z"/><path fill="url(#jiwanPadKs)" d="M9.2 5C6.4 5.2 4.4 6.8 4 9.4C3.6 12 4.6 14.4 6.4 15.8C9.2 17.2 14 17.4 17.6 17.2H22.4C26 17.4 30.8 17.2 33.6 15.8C35.4 14.4 36.4 12 36 9.4C35.6 6.8 33.6 5.2 30.8 5C26.8 4.4 13.2 4.4 9.2 5Z"/><circle cx="11.5" cy="10.15" r="2.45" fill="#000" opacity=".12"/><path fill="#c8c8ce" d="M10.95 8.00h1.1v1.6h1.6v1.1h-1.6v1.6h-1.1v-1.6h-1.6v-1.1h1.6z"/><circle cx="11.5" cy="10.15" r=".28" fill="#000" opacity=".25"/><ellipse cx="11.85" cy="16.7" rx="2.87" ry="2.6404" fill="#000" opacity=".22"/><ellipse cx="11.85" cy="16.55" rx="2.45" ry="2.303" fill="url(#jiwanPadStK)" stroke="#8a8a90" stroke-width=".35"/><ellipse cx="11.85" cy="16.844" rx="1.0290000000000001" ry="0.931" fill="#000" opacity=".28"/><ellipse cx="11.164" cy="15.717" rx="0.539" ry="0.392" fill="#fff" opacity=".4"/><circle cx="20.0" cy="8.55" r="1.55" fill="#0a0a0c"/><circle cx="20.0" cy="8.55" r="1.05" fill="#2e2e32"/><circle cx="19.75" cy="8.200000000000001" r=".35" fill="#fff" opacity=".28"/><circle cx="28.45" cy="9.35" r="1.05" fill="#efbf0d"/><circle cx="28.169999999999998" cy="9.03" r=".38" fill="#fff" opacity=".5"/><circle cx="26.25" cy="11.55" r="1.05" fill="#3b88e3"/><circle cx="25.97" cy="11.23" r=".38" fill="#fff" opacity=".5"/><circle cx="30.65" cy="11.55" r="1.05" fill="#e03c3c"/><circle cx="30.369999999999997" cy="11.23" r=".38" fill="#fff" opacity=".5"/><circle cx="28.45" cy="13.75" r="1.05" fill="#5cbf4a"/><circle cx="28.169999999999998" cy="13.43" r=".38" fill="#fff" opacity=".5"/><ellipse cx="28.85" cy="17.299999999999997" rx="2.64" ry="2.4288000000000003" fill="#000" opacity=".22"/><ellipse cx="28.85" cy="17.15" rx="2.22" ry="2.0868" fill="url(#jiwanPadStK)" stroke="#8a8a90" stroke-width=".35"/><ellipse cx="28.85" cy="17.4164" rx="0.9324" ry="0.8436000000000001" fill="#000" opacity=".28"/><ellipse cx="28.2284" cy="16.3952" rx="0.48840000000000006" ry="0.3552" fill="#fff" opacity=".4"/></g></g><g transform="translate(.15 2.05) rotate(-2.6 19.5 14)"><g class="pad-w"><path fill="url(#jiwanPadWg)" stroke="#2a231c" stroke-width=".7" stroke-linejoin="round" d="M8 3.6C4.5 3.8 2.2 6 1.6 9.4C1.1 12.6 1.8 15.5 3.4 17.5C3.2 20.6 1.8 24.8 4.6 26.8C7.2 28.6 11.4 26.6 12.2 22.6C12.8 20.4 15 18.4 18 18C19.3 17.8 20.7 17.8 22 18C25 18.4 27.2 20.4 27.8 22.6C28.6 26.6 32.8 28.6 35.4 26.8C38.2 24.8 36.8 20.6 36.6 17.5C38.2 15.5 38.9 12.6 38.4 9.4C37.8 6 35.5 3.8 32 3.6C27.5 2.8 12.5 2.8 8 3.6Z"/><path fill="url(#jiwanPadWb)" d="M8.4 3.7C12.2 2.55 27.8 2.55 31.6 3.7C28.6 2.35 11.4 2.35 8.4 3.7Z"/><path fill="url(#jiwanPadWf)" d="M9.2 5C6.4 5.2 4.4 6.8 4 9.4C3.6 12 4.6 14.4 6.4 15.8C9.2 17.2 14 17.4 17.6 17.2H22.4C26 17.4 30.8 17.2 33.6 15.8C35.4 14.4 36.4 12 36 9.4C35.6 6.8 33.6 5.2 30.8 5C26.8 4.4 13.2 4.4 9.2 5Z"/><path fill="url(#jiwanPadWs)" d="M9.2 5C6.4 5.2 4.4 6.8 4 9.4C3.6 12 4.6 14.4 6.4 15.8C9.2 17.2 14 17.4 17.6 17.2H22.4C26 17.4 30.8 17.2 33.6 15.8C35.4 14.4 36.4 12 36 9.4C35.6 6.8 33.6 5.2 30.8 5C26.8 4.4 13.2 4.4 9.2 5Z"/><circle cx="11.5" cy="10.15" r="2.45" fill="#000" opacity=".12"/><path fill="#2c2720" d="M10.95 8.00h1.1v1.6h1.6v1.1h-1.6v1.6h-1.1v-1.6h-1.6v-1.1h1.6z"/><circle cx="11.5" cy="10.15" r=".28" fill="#000" opacity=".25"/><ellipse cx="11.85" cy="16.7" rx="2.87" ry="2.6404" fill="#000" opacity=".22"/><ellipse cx="11.85" cy="16.55" rx="2.45" ry="2.303" fill="url(#jiwanPadStW)" stroke="#1a1814" stroke-width=".35"/><ellipse cx="11.85" cy="16.844" rx="1.0290000000000001" ry="0.931" fill="#000" opacity=".28"/><ellipse cx="11.164" cy="15.717" rx="0.539" ry="0.392" fill="#fff" opacity=".4"/><circle cx="20.0" cy="8.55" r="1.55" fill="#2a251f"/><circle cx="20.0" cy="8.55" r="1.05" fill="#14110e"/><circle cx="19.75" cy="8.200000000000001" r=".35" fill="#fff" opacity=".28"/><circle cx="28.45" cy="9.35" r="1.05" fill="#efbf0d"/><circle cx="28.169999999999998" cy="9.03" r=".38" fill="#fff" opacity=".5"/><circle cx="26.25" cy="11.55" r="1.05" fill="#3b88e3"/><circle cx="25.97" cy="11.23" r=".38" fill="#fff" opacity=".5"/><circle cx="30.65" cy="11.55" r="1.05" fill="#e03c3c"/><circle cx="30.369999999999997" cy="11.23" r=".38" fill="#fff" opacity=".5"/><circle cx="28.45" cy="13.75" r="1.05" fill="#5cbf4a"/><circle cx="28.169999999999998" cy="13.43" r=".38" fill="#fff" opacity=".5"/><ellipse cx="28.85" cy="17.299999999999997" rx="2.64" ry="2.4288000000000003" fill="#000" opacity=".22"/><ellipse cx="28.85" cy="17.15" rx="2.22" ry="2.0868" fill="url(#jiwanPadStW)" stroke="#1a1814" stroke-width=".35"/><ellipse cx="28.85" cy="17.4164" rx="0.9324" ry="0.8436000000000001" fill="#000" opacity=".28"/><ellipse cx="28.2284" cy="16.3952" rx="0.48840000000000006" ry="0.3552" fill="#fff" opacity=".4"/></g></g></g>`
const BRAND_WORDMARK = `<text x="54" y="20" font-size="17" font-weight="600" letter-spacing="0.04em" fill="currentColor" style="font-family:'Noto Serif SC','Songti SC','STSong',serif">即玩空间</text>`;
const BRAND_LOGO = `<svg class="brand-logo" viewBox="0 0 128 28" width="128" height="28" fill="none" role="img" aria-hidden="true" focusable="false" overflow="visible">${BRAND_PADS}${BRAND_WORDMARK}</svg>`;

function brandLogoHTML(){
  const lang = getLang();
  if (lang === 'en') {
    return `<svg class="brand-logo" viewBox="0 0 184 28" width="184" height="28" fill="none" role="img" aria-hidden="true" focusable="false" overflow="visible" data-lang="en">${BRAND_PADS}<text x="54" y="20" font-size="14" font-family="Iowan Old Style, Charter, Georgia, serif" font-weight="600" letter-spacing="-0.03em" fill="currentColor">Jiwan Space</text></svg>`;
  }
  return BRAND_LOGO.replace('<svg class="brand-logo"', '<svg class="brand-logo" data-lang="zh"');
}
const I18N = {
  zh: {
    'nav.home':'首页','nav.discover':'发现','nav.rank':'排行','nav.community':'社区','nav.workshop':'工坊',
    'nav.publish':'上架作品','nav.login':'登录','nav.logout':'退出','nav.me':'我的','nav.notify':'通知','nav.settings':'账号设置','nav.admin':'管理',
    'nav.menu':'菜单','nav.search':'搜索游戏','nav.main':'主导航','nav.lang':'语言',
    'nav.skip':'跳到内容','brand.name':'即玩空间',
    'foot.body':'站内游戏均搜集自公开网络，版权归原作者所有。若涉侵权，请留言告知，我们会尽快核实并下架。联系邮箱：',
    'foot.mail':'sqzxz456@gmail.com',
    'search.empty':'没有叫这个名字的游戏',
    'meta.new':'新作','meta.listed':'本周上架','meta.playing':'在玩','meta.playingSuffix':'在玩',
    'label.workshopDemo':'工坊示例','label.fable':'Fable 5.2','label.userListed':'用户上架','label.xNew':'X 新作','label.webgame':'网页游戏','label.live':'原页可玩',
    'origin.shot':'实机封面','origin.x':'X 实机封面','origin.hosted':'原页托管',
    'rank.hot':'热玩','rank.new':'新作','rank.score':'口碑',
    'rank.hotBoard':'热玩榜','rank.newBoard':'新作榜','rank.scoreBoard':'口碑榜',
    'period.day':'日','period.week':'周','period.month':'月',
    'period.dayBoard':'日榜','period.weekBoard':'周榜','period.monthBoard':'月榜',
    'rank.newIn':'新进榜','rank.up':'较{name}上升 {n} 名','rank.down':'较{name}下降 {n} 名','rank.same':'较{name}名次未变','rank.newMark':'新',
    'genre.all':'全部类型','genre.action':'动作','genre.io':'IO 对战','genre.puzzle':'解谜','genre.idle':'放置','genre.story':'叙事',
    'duration.all':'不限时长','duration.short':'三分钟内','duration.mid':'约十分钟','duration.long':'长线养成',
    'fable.all':'全部来源','fable.workshop':'仅 Fable 5.2','fable.curated':'不含工坊',
    'cta.play':'立即游玩','cta.unplayable':'暂不可玩','cta.more':'更多','cta.seeGame':'看游戏','cta.follow':'关注','cta.following':'已关注','cta.share':'分享',
    'home.hot':'大家都在玩','home.rank':'排行榜','home.kept':'口碑常驻','home.workshop':'工坊','home.new':'本周新作','home.community':'玩家社区',
    'home.continue':'接着玩','home.continueNote':'最近打开的试玩舱。',
    'home.feat':'编辑推荐','home.empty':'暂时没有游戏。工坊作品会在作者上架 Fable 5.2 网页包后出现。',
    'home.keptNote':'高分还在榜上，打开就能玩。','home.workshopNote':'作者过审上架、打开就能玩。',
    'home.featPrev':'上一张封面','home.featNext':'下一张封面','home.featDots':'封面进度',
    'title.home':'即玩空间 · 发现网页游戏','title.browse':'即玩空间 · 发现网页游戏','title.rank':'即玩空间 · 排行榜',
    'title.community':'即玩空间 · 社区','title.workshop':'即玩空间 · 工坊','title.profile':'即玩空间 · 我的',
    'title.search':'即玩空间 · 搜索','title.play':'试玩舱 · 即玩空间','title.index':'即玩空间 · 网页游戏分发原型',
    'title.login':'即玩空间 · 登录','title.register':'即玩空间 · 注册','title.notify':'即玩空间 · 通知',
    'title.settings':'即玩空间 · 账号设置','title.reset':'即玩空间 · 重设密码',
    'title.user':'即玩空间 · 作者','title.post':'即玩空间 · 帖子',
    'browse.kicker':'分类浏览','browse.title':'发现网页游戏','browse.workshopTitle':'工坊上架','browse.lede':'按类型、一局时长和是否来自 Fable 5.2 工坊收窄。筛选项可以叠加。',
    'browse.workshopLede':'这里只展示用户通过工坊提交、并审核上架的作品；可按类型和时长继续筛选。',
    'browse.filters':'筛选','browse.genreH':'游戏类型','browse.durationH':'一局时长','browse.fableH':'Fable 工坊',
    'browse.reset':'清空筛选','browse.count':'共 {n} 款','browse.empty':'这一侧暂时没有游戏。换一个类型，或清空筛选。',
    'browse.noteFable':'带「Fable 5.2」的是公开网页包；「工坊示例」是店面示意，非正式上架。',
    'browse.noteRank':'名次箭头对照上一档周期。',
    'browse.sortHot':'按热度','browse.sortNew':'按新作','browse.sortScore':'按评分',
    'browse.pageOf':'第 {p} / {n} 页','browse.fail':'这一页暂时读不出来。','browse.retry':'再试一次','browse.loading':'正在收这一页。',
    'pager.prev':'上一页','pager.next':'下一页','pager.label':'翻页','pager.pos':'{p} / {n}',
    'load.fail':'这一侧暂时读不出来。','load.retry':'再试一次','load.loading':'正在打开。',
    'rank.title':'排行榜','rank.lede':'切日 / 周 / 月时，名次对照上一档重算。绿三角是上升，红倒三角是下降，「新」是上一档不在这份名单里。',
    'rank.moreAria':'查看更多{name}{period}','rank.periodAria':'日周月',
    'detail.back':'← 返回首页','detail.about':'这款游戏','detail.shots':'画面','detail.shotsFake':'设计海报，非实机截图',
    'back.home':'返回首页','back.browse':'返回发现','back.rank':'返回排行榜','back.search':'返回搜索结果',
    'back.community':'返回社区','back.workshop':'返回工坊','back.profile':'返回我的主页','back.notify':'返回消息','back.admin':'返回管理台',
    'back.detail':'返回游戏详情','back.play':'返回试玩舱','back.post':'返回帖子','back.user':'返回个人主页',
    'back.short.home':'首页','back.short.browse':'发现','back.short.rank':'排行榜','back.short.search':'搜索',
    'back.short.community':'社区','back.short.workshop':'工坊','back.short.profile':'我的主页',
    'back.short.detail':'详情','back.short.post':'帖子','back.short.user':'主页',
    'detail.reviews':'玩家评价','detail.related':'相关推荐','detail.tab':'详情','detail.reviewsTab':'评价','detail.forum':'论坛',
    'detail.forumSoon':'论坛下一期再接。','detail.webOpen':'网页即开','detail.scale':'十分制 · {n} 条评价',
    'detail.forumEmpty':'这款游戏还没有帖。登录后可以开一楼。','detail.startPost':'开一楼','detail.forumCount':'{n} 条帖','detail.report':'举报','detail.reported':'已记下，审核会看',
    'detail.reportNeed':'请写明原因','detail.reportWhy':'为什么举报','detail.reportSend':'提交举报','detail.reportKind':'举报类型',
    'report.spam':'广告或灌水','report.spoil':'剧透','report.abuse':'人身攻击','report.other':'其他',
    'detail.collecting':'评分还在收集 · {n} 条来自作者','detail.coverNote':'封面来自原作公开画面，不是设计稿。',
    'detail.noReviews':'这一侧暂时没有评价。','detail.shotAlt':'{title} 画面 {n}',
    'detail.favOn':'已关注','detail.favOff':'已取消关注','detail.reviewBelow':'评价在本页下方',
    'detail.missing':'找不到这款游戏。','detail.backHome':'返回首页',
    'detail.write':'写一条评价','detail.score':'十分制','detail.scoreHint':'1 到 10，十分制',
    'detail.sentGood':'好评','detail.sentBad':'吐槽','detail.submitRev':'提交评价',
    'detail.needLoginRev':'登录后才能写评。','detail.revOk':'评价已记下','detail.revNeed':'请打分并写满四个字',
    'detail.editRev':'改这条','detail.delRev':'删掉','detail.revDelOk':'评价已删','detail.revSave':'保存评价',
    'auth.need':'请先登录','auth.kicker':'账号','auth.loginTitle':'登录即玩空间',
    'auth.registerTitle':'注册账号','auth.name':'名字','auth.handle':'账号','auth.pass':'密码',
    'auth.login':'登录','auth.register':'注册','auth.toRegister':'没有账号，去注册',
    'auth.toLogin':'已有账号，去登录','auth.demo':'用你的名字和密码登录','auth.bad':'名字或密码不对',
    'auth.exists':'这个账号已经有人用了','auth.needFields':'请把名字和密码写完',
    'auth.loggedOut':'已退出',
    'auth.forgot':'忘记密码','auth.resetTitle':'重设密码','auth.reset':'记下新密码',
    'auth.resetOk':'新密码已记下，去登录','auth.resetMissing':'找不到这个账号','auth.resetClosed':'不能只凭用户名重设密码。已登录请到账号设置修改；忘记密码请联系站务。','auth.toSettings':'去账号设置改密码','auth.newPass':'新密码',
    'auth.passShort':'密码至少十个字',
    'auth.bio':'简介','auth.avatar':'头像','auth.save':'保存资料','auth.saved':'资料已记下',
    'auth.settingsTitle':'账号设置','auth.avatarHint':'点这里选一张图。只写在这台设备上。',
    'auth.oldPass':'当前密码','auth.changePass':'记下新密码','auth.passChanged':'密码已改','auth.passWrong':'当前密码不对',
    'play.unavailable':'这款游戏暂时不能在舱里打开。作者还没有托管可播放的网页包。',
    'play.openDetail':'查看详情',
    'play.embedFail':'对方站点不让嵌进这一页。去原页打开。',
    'play.embedHint':'若舱里是白屏，去原页打开。',
    'workshop.statusPending':'审核中','workshop.statusListed':'已上架','workshop.statusRejected':'被拒','workshop.statusDraft':'草稿',
    'workshop.markListed':'上架','workshop.markRejected':'拒绝',
    'workshop.needLogin':'登录后才能上架作品。','workshop.listedOk':'已记到架上',
    'workshop.queue':'审核队列','workshop.queueEmpty':'现在没有待审作品。','workshop.queueCount':'{n} 条待审',
    'workshop.reviewerNote':'林澄是审核员。作者不能给自己过审。','workshop.needReviewer':'只有审核员能过审',
    'workshop.rejectSend':'记下拒绝原因',
    'workshop.reports':'举报表','workshop.reportsEmpty':'现在没有举报。','workshop.reportsCount':'{n} 条举报',
    'workshop.reportGame':'游戏','workshop.reportPost':'帖子','workshop.reportDismiss':'记下已看','workshop.reportGone':'这条已从举报表拿下',
    'workshop.hidePost':'藏帖','workshop.takedown':'下架游戏','workshop.hiddenOk':'帖已从社区拿下','workshop.takedownOk':'游戏已从架上拿下','workshop.alreadyGone':'已经处置过了',
    'workshop.unlistedOk':'已从架上拿下','workshop.resubmitOk':'已重新提交',
    'workshop.unlist':'下架','workshop.edit':'改这一条','workshop.resubmit':'重新提交',
    'workshop.rejectWhy':'拒绝原因','workshop.reasonPh':'例如：封面看不清',
    'workshop.formPlay':'试玩地址','workshop.playHint':'填托管页地址后，试玩舱才能打开。没有地址会显示「暂不可玩」。',
    'workshop.playPh':'https://','workshop.statusUnlisted':'已下架','workshop.editing':'正在改这一条',
    'workshop.cancelEdit':'取消编辑','workshop.saveEdit':'保存修改','workshop.needPlayOrPack':'请填试玩地址，或选择网页包',
    'post.kicker':'帖子','post.write':'发帖','post.title':'标题','post.body':'正文','post.game':'关联游戏',
    'post.submit':'发布','post.none':'找不到这条帖。','post.ok':'已发布',
    'post.needTitle':'标题请写 4 到 48 个字','post.loginToPost':'登录后才能发帖。',
    'post.comments':'评论','post.comment':'写评论','post.commentOk':'评论已记下','post.commentNeed':'请写两个字以上',
    'post.loginToComment':'登录后才能评论。','post.noComments':'还没有评论。','post.countComments':'{n} 条评论',
    'post.edit':'改帖','post.delete':'删帖','post.deleted':'帖已删','post.save':'保存','post.saved':'帖已改',
    'post.commentEdit':'改','post.commentDel':'删','post.commentSaved':'评论已改',
    'confirm.delete':'确定删掉？',
    'user.missing':'找不到这位作者。','user.follow':'关注作者','user.following':'已关注作者',
    'notify.title':'通知','notify.empty':'还没有通知。','notify.mark':'全部标为已读','notify.unread':'未读',
    'notify.like':'{name} 赞了你的帖','notify.comment':'{name} 评论了你的帖','notify.follow':'{name} 关注了你',
    'notify.packOn':'{title} 已上架','notify.packOff':'{title} 未过审',
    'notify.postHidden':'你的帖已被审核藏起','notify.gameDown':'你的游戏已从架上拿下',
    'profile.loginGate':'登录后查看在玩、评价和发布。','profile.logout':'退出这台设备上的账号','profile.settings':'改资料',
    'index.login':'登录','index.loginCopy':'登录后顶栏换成昵称。',
    'index.settings':'账号设置','index.settingsCopy':'改名字、简介和头像。','index.reset':'重设密码','index.resetCopy':'不能只凭用户名重设密码。已登录请到账号设置修改；忘记密码请联系站务。',
    'index.notify':'通知','index.notifyCopy':'点赞、关注、工坊审核状态。',
    'share.title':'分享这款游戏','share.copy':'复制链接','share.close':'关闭','share.copied':'链接已复制','share.copyFail':'请手动复制链接',
    'rev.all':'全部','rev.good':'好评','rev.bad':'吐槽','rev.author':'作者',
    'play.exit':'退出','play.cabin':'试玩舱','play.mute':'静音','play.muted':'已静音','play.full':'全屏','play.share':'分享',
    'play.skip':'跳到试玩舱','play.note':'试玩舱 · {title}。用来感受操作，不是作者托管的完整原作。',
    'play.noteLive':'正在打开作者托管的原页 · {title}。被拦了就点「原页打开」。',
    'play.openSrc':'原页打开','play.live':'原页',
    'play.demo':'{title} 试玩','play.newGame':'新开一局','play.keys':'方向键或 WASD',
    'play.size':'体积 {n}','play.ioHint':'移动指针，吞掉小的，躲开大的',
    'play.ioDead':'被更大的圆吞掉了，点画面重开','play.notEnough':'还不够',
    'play.cps':'每秒 +{n}','play.clips':'回形针 {n}','play.cookies':'饼干 {n}',
    'play.hitClip':'再别一支','play.hitCookie':'再点一块',
    'play.shop.auto':'自动别针','play.shop.cursor':'指针','play.shop.plant':'车间',
    'play.shop.oven':'烤箱','play.shop.market':'市场','play.shop.factory':'工厂',
    'play.again':'再来一次',
    'play.dark.start':'火堆只剩一层余烬。屋子里什么也看不见。',
    'play.dark.start.0':'把旁边的木头添进去','play.dark.start.1':'先坐着听',
    'play.dark.fire':'火苗又起来了。门缝里有一下一下的脚步。',
    'play.dark.fire.0':'把门顶上','play.dark.fire.1':'轻轻把门拉开',
    'play.dark.wait':'火灭了。冷从地面爬上来。你听见自己的呼吸。',
    'play.dark.wait.0':'摸黑找木头','play.dark.wait.1':'继续等',
    'play.dark.bar':'门顶住了。火光照出墙上的记号：出去，向北。',
    'play.dark.bar.0':'记下记号，守夜','play.dark.bar.1':'准备出门',
    'play.dark.open':'门外不是走廊，是一片空地。远处有另一堆火。',
    'play.dark.open.0':'向那堆火走','play.dark.open.1':'退回房间',
    'play.dark.endCold':'试玩舱到这里。完整内容在原作或工坊包里。',
    'play.dark.endKeep':'你守到天亮。试玩舱结束。',
    'play.dark.endOut':'空地上风很大。试玩舱到此。',
    'play.pwd.start':'写一个密码。规则会在你写完之后才出现。',
    'play.pwd.start.0':'先写四个字母','play.pwd.start.1':'先写今天的日期',
    'play.pwd.letters':'新规则：必须包含一个数字。刚才的四个字母还在。',
    'play.pwd.letters.0':'末尾加 2','play.pwd.letters.1':'全删重写',
    'play.pwd.date':'新规则：不可以是一段连续日期。今天被否决了。',
    'play.pwd.date.0':'改成乱序数字','play.pwd.date.1':'改成四个字母',
    'play.pwd.num':'新规则：数字加起来必须是 10。试玩舱到此为止。',
    'search.kicker':'混合结果','search.title':'搜索','search.games':'游戏','search.posts':'帖子',
    'search.ledeEmpty':'在顶栏输入名字、作者或标签，回车到这一页。下面先放一列正在热玩的游戏。',
    'search.ledeHits':'游戏 {g} 款，帖子 {p} 条，作者 {a} 位。','search.countGames':'{n} 款','search.countPosts':'{n} 条',
    'search.authors':'作者','search.noAuthors':'没有相关作者。','search.countAuthors':'{n} 位',
    'search.noPosts':'没有相关帖子。','search.quoted':'「{q}」','search.suggest':'是不是要找「{q}」','search.fail':'搜索暂时打不开。',
    'community.kicker':'玩家社区','community.title':'刚刚有人在玩',
    'community.lede':'作者发帖、工坊进度、大厅牢骚。点赞和关注按账号分开，写在本机接口。',
    'community.topics':'话题','community.watch':'值得关注','community.empty':'这一侧还没有帖子。关注几位作者，或换一个话题。',
    'community.feedAll':'全部','community.feedFollow':'已关注','community.feedFable':'工坊',
    'community.followed':'已关注 {name}','community.unfollowed':'已取消关注 {name}',
    'workshop.kicker':'工坊投稿','workshop.title':'把网页包放到架上',
    'workshop.lede':'把你导出的网页包传上来——.zip 或 .html 都行，用什么工具做的都可以，只要能在浏览器里打开。补一张封面、写一句话和标签，提交后进入审核队列；审核通过，作品才会出现在发现页。',
    'workshop.shelf':'已上架的网页包','workshop.allFable':'全部 Fable','workshop.publish':'上架作品',
    'workshop.shelfLoading':'正在读架上的网页包…','workshop.draftsLoading':'正在读你的投稿…',
    'workshop.shelfEmpty':'架上还没有网页包。右边填完表单提交，审核通过后就会出现在这里。',
    'workshop.noDraft':'还没有投稿。右边填完表单提交，就能在这里跟进审核进度。',
    'workshop.mineGuide':'这里只放你自己的投稿：提交后先显示「审核中」，过审变成「已上架」，被拒会附上原因；随时可以改、重新提交或自己下架。公共作品在发现页看。',
    'workshop.visPublic':'待审公开','workshop.visLink':'仅链接','workshop.visDraft':'草稿','workshop.noPack':'无网页包',
    'workshop.submit':'提交上架','workshop.unnamed':'未命名','workshop.drafts':'我的投稿',
    'workshop.formName':'游戏名','workshop.formAuthor':'作者','workshop.formBlurb':'一句话','workshop.formCat':'类型',
    'workshop.formTags':'标签','workshop.formVis':'可见性','workshop.visOpen':'公开','workshop.formPack':'网页包','workshop.formCover':'封面',
    'workshop.dropPack':'点这里选择 .zip 或 .html','workshop.packHint':'提交后进入审核队列，审核通过才会出现在发现页。',
    'workshop.packErr':'请选择网页包（.zip 或 .html）。','workshop.titleErr':'请填写 2 到 24 个字的游戏名。','workshop.authorErr':'请填写作者名。',
    'workshop.clearCover':'去掉封面','workshop.preview':'预览','workshop.coverHint':'点纸窗选图，也可拖进来。发现页按 16:10 裁切。',
    'workshop.needFields':'还有必填项没写完','workshop.savedDraft':'草稿已记下','workshop.submitted':'已提交，进入审核队列',
    'workshop.coverPick':'选择封面','workshop.coverChange':'更换封面','workshop.needImage':'请选择图片作为封面',
    'workshop.dropImage':'请拖入图片作为封面','workshop.badImage':'这张图读不出来','workshop.storage':'这台设备写不下更多草稿',
    'workshop.coverAlt':'封面预览','workshop.placeholder':'例如：夜航港','workshop.blurbPh':'打开就能玩的那一句。','workshop.tagsPh':'工坊、叙事，用顿号分开',
    'profile.kicker':'工坊作者','profile.lede':'关注、点赞和工坊草稿按账号写在本机接口。',
    'profile.statPlay':'在玩','profile.statRev':'评价','profile.statPub':'发布',
    'profile.tabPlay':'在玩','profile.tabFav':'关注','profile.tabReview':'评价','profile.tabMade':'发布的游戏','profile.tabPosts':'我的帖','profile.posts':'帖子',
    'profile.emptyPlay':'打开试玩舱后，会出现在这里。','profile.emptyPlayOther':'还没有打开过试玩舱。','profile.emptyFav':'还没有关注的游戏。去详情页点关注。','profile.emptyMade':'还没有发布过游戏。',
    'profile.emptyPosts':'还没有发过帖。','profile.emptyPostsOther':'还没有发过帖。','profile.emptyPeople':'还没有关注作者。去社区点关注。',
    'profile.emptyReviewsOther':'还没有写下评价。','profile.people':'关注的作者','profile.favGames':'关注的游戏',
    'profile.followers':'关注者','profile.emptyFollowers':'还没有人关注。',
    'profile.playNote':'按最近打开的试玩舱排列。',
    'profile.madeNote':'夜航港是店面工坊示例。新作品从工坊页提交，不会真正托管。',
    'crumb.me':'我的','index.kicker':'即玩空间','index.title':'网页游戏分发原型',
    'index.lede':'发现、排行、社区、工坊用同一套纸面杂志店面。架上收录 fable52.games、Claude Gaming 和 X 上的公开网页游戏。详情封面统一 16:9，试玩在独立舱里打开。',
    'index.homeCopy':'编辑推荐轮播、热玩、排行、口碑、工坊和新作。',
    'index.browseCopy':'按类型、时长、Fable 工坊筛选，也能接排行榜的日周月。',
    'index.rankCopy':'热玩、新作、口碑。切日周月时名次带升降箭头。',
    'index.communityCopy':'动态流、话题和关注。点赞、关注按账号分开。',
    'index.workshopCopy':'Fable 5.2 网页包上架。公开提交进审核队列，林澄是演示审核员。',
    'index.profileCopy':'登录后查看在玩、评价、发布。',
    'index.searchCopy':'游戏和帖子混合结果。顶栏回车进入。',
    'index.detailCopy':'16:9 封面、评分、画面、评价。有托管地址才显示立即游玩。',
    'index.playCopy':'有托管地址就打开原页。没有地址则显示暂不可玩。',
    'index.detail':'游戏详情','index.play':'试玩舱','index.me':'我的'
  },
  en: {
    'nav.home':'Home','nav.discover':'Discover','nav.rank':'Charts','nav.community':'Community','nav.workshop':'Workshop',
    'nav.publish':'Publish','nav.login':'Sign in','nav.logout':'Sign out','nav.me':'Me','nav.notify':'Alerts','nav.settings':'Account','nav.admin':'Admin',
    'nav.menu':'Menu','nav.search':'Search games','nav.main':'Main','nav.lang':'Language',
    'nav.skip':'Skip to content','brand.name':'Jiwan Space',
    'foot.body':'Games here are collected from the public web and remain the property of their original authors. If anything infringes your rights, leave us a message and we will review and take it down. Email: ',
    'foot.mail':'sqzxz456@gmail.com',
    'search.empty':'No game by that name',
    'meta.new':'New','meta.listed':'Listed this week','meta.playing':'playing','meta.playingSuffix':' playing',
    'label.workshopDemo':'Workshop demo','label.fable':'Fable 5.2','label.userListed':'User listing','label.xNew':'New on X','label.webgame':'Web game','label.live':'Play original',
    'origin.shot':'Gameplay still','origin.x':'Gameplay still from X','origin.hosted':'Hosted original',
    'rank.hot':'Hot','rank.new':'New','rank.score':'Rated',
    'rank.hotBoard':'Hot chart','rank.newBoard':'New chart','rank.scoreBoard':'Rated chart',
    'period.day':'D','period.week':'W','period.month':'M',
    'period.dayBoard':'Daily','period.weekBoard':'Weekly','period.monthBoard':'Monthly',
    'rank.newIn':'New on the chart','rank.up':'Up {n} vs {name}','rank.down':'Down {n} vs {name}','rank.same':'Unchanged vs {name}','rank.newMark':'New',
    'genre.all':'All genres','genre.action':'Action','genre.io':'IO','genre.puzzle':'Puzzle','genre.idle':'Idle','genre.story':'Story',
    'duration.all':'Any length','duration.short':'Under 3 min','duration.mid':'About 10 min','duration.long':'Long session',
    'fable.all':'All sources','fable.workshop':'Fable 5.2 only','fable.curated':'No workshop',
    'cta.play':'Play now','cta.unplayable':'Not playable yet','cta.more':'More','cta.seeGame':'Open game','cta.follow':'Follow','cta.following':'Following','cta.share':'Share',
    'home.hot':'Everyone’s playing','home.rank':'Charts','home.kept':'Staples','home.workshop':'Workshop','home.new':'New this week','home.community':'Players',
    'home.continue':'Continue','home.continueNote':'The last cabins you opened.',
    'home.feat':'Editors’ pick','home.empty':'Nothing here yet. Workshop games appear after an author lists a Fable 5.2 web pack.',
    'home.keptNote':'High scores that stay on the shelf. Open and play.','home.workshopNote':'Approved by the workshop, ready in the browser.',
    'home.featPrev':'Previous cover','home.featNext':'Next cover','home.featDots':'Cover progress',
    'title.home':'Jiwan Space · Discover web games','title.browse':'Jiwan Space · Discover','title.rank':'Jiwan Space · Charts',
    'title.community':'Jiwan Space · Community','title.workshop':'Jiwan Space · Workshop','title.profile':'Jiwan Space · Profile',
    'title.search':'Jiwan Space · Search','title.play':'Play cabin · Jiwan Space','title.index':'Jiwan Space · Web-game storefront',
    'title.login':'Jiwan Space · Sign in','title.register':'Jiwan Space · Register','title.notify':'Jiwan Space · Alerts',
    'title.settings':'Jiwan Space · Account','title.reset':'Jiwan Space · Reset password',
    'title.user':'Jiwan Space · Author','title.post':'Jiwan Space · Post',
    'browse.kicker':'Browse by type','browse.title':'Discover web games','browse.workshopTitle':'Listed in the workshop','browse.lede':'Narrow by genre, session length, and whether it came from the Fable 5.2 workshop. Filters stack.',
    'browse.workshopLede':'Only works submitted by users through the workshop and approved for listing appear here. Narrow them by genre or session length.',
    'browse.filters':'Filters','browse.genreH':'Genre','browse.durationH':'Session length','browse.fableH':'Fable workshop',
    'browse.reset':'Clear filters','browse.count':'{n} games','browse.empty':'Nothing on this side. Pick another type, or clear the filters.',
    'browse.noteFable':'“Fable 5.2” marks a public web pack; “Workshop demo” is storefront sample, not a live listing.',
    'browse.noteRank':'Arrows compare against the previous period.',
    'browse.sortHot':'By heat','browse.sortNew':'By new','browse.sortScore':'By rating',
    'browse.pageOf':'Page {p} of {n}','browse.fail':'This page could not load.','browse.retry':'Try again','browse.loading':'Loading this page.',
    'pager.prev':'Previous','pager.next':'Next','pager.label':'Pages','pager.pos':'{p} / {n}',
    'load.fail':'This side could not load.','load.retry':'Try again','load.loading':'Opening.',
    'rank.title':'Charts','rank.lede':'Switching day / week / month recalculates rank against the previous period. Green is up, red is down, “New” was not on the last list.',
    'rank.moreAria':'See more {name} {period}','rank.periodAria':'Day week month',
    'detail.back':'← Back home','detail.about':'This game','detail.shots':'Shots','detail.shotsFake':'Designed poster, not a screenshot',
    'back.home':'Back home','back.browse':'Back to Discover','back.rank':'Back to the charts','back.search':'Back to results',
    'back.community':'Back to community','back.workshop':'Back to workshop','back.profile':'Back to my page','back.notify':'Back to messages','back.admin':'Back to admin',
    'back.detail':'Back to the game','back.play':'Back to the cabin','back.post':'Back to the post','back.user':'Back to the profile',
    'back.short.home':'Home','back.short.browse':'Discover','back.short.rank':'Charts','back.short.search':'Results',
    'back.short.community':'Community','back.short.workshop':'Workshop','back.short.profile':'My page',
    'back.short.detail':'Game','back.short.post':'Post','back.short.user':'Profile',
    'detail.reviews':'Player reviews','detail.related':'Related','detail.tab':'About','detail.reviewsTab':'Reviews','detail.forum':'Forum',
    'detail.forumSoon':'Forum comes in a later pass.','detail.webOpen':'Play in browser','detail.scale':'Out of 10 · {n} reviews',
    'detail.forumEmpty':'No posts for this game yet. Sign in to start one.','detail.startPost':'Start a thread','detail.forumCount':'{n} posts','detail.report':'Report','detail.reported':'Saved. Review will see it',
    'detail.reportNeed':'Write a reason','detail.reportWhy':'Why report this','detail.reportSend':'Submit report','detail.reportKind':'Report type',
    'report.spam':'Spam','report.spoil':'Spoilers','report.abuse':'Abuse','report.other':'Other',
    'detail.collecting':'Score still collecting · {n} from the author','detail.coverNote':'Cover is a public still from the original, not a mock.',
    'detail.noReviews':'No reviews on this side yet.','detail.shotAlt':'{title} shot {n}',
    'detail.favOn':'Following','detail.favOff':'Unfollowed',
    'detail.reviewBelow':'Reviews are further down this page',
    'detail.missing':'This game is not on the shelf.','detail.backHome':'Back home',
    'detail.write':'Write a review','detail.score':'Out of 10','detail.scoreHint':'1 to 10',
    'detail.sentGood':'Praise','detail.sentBad':'Rant','detail.submitRev':'Submit review',
    'detail.needLoginRev':'Sign in to write a review.','detail.revOk':'Review saved','detail.revNeed':'Score it and write at least four characters',
    'detail.editRev':'Edit this','detail.delRev':'Delete','detail.revDelOk':'Review deleted','detail.revSave':'Save review',
    'auth.need':'Sign in first','auth.kicker':'Account','auth.loginTitle':'Sign in to Jiwan Space',
    'auth.registerTitle':'Create an account','auth.name':'Name','auth.handle':'Handle','auth.pass':'Password',
    'auth.login':'Sign in','auth.register':'Register','auth.toRegister':'No account? Register',
    'auth.toLogin':'Have an account? Sign in','auth.demo':'Sign in with your name and password','auth.bad':'Name or password is wrong',
    'auth.exists':'That handle is taken','auth.needFields':'Fill in name and password',
    'auth.loggedOut':'Signed out',
    'auth.forgot':'Forgot password','auth.resetTitle':'Reset password','auth.reset':'Save new password',
    'auth.resetOk':'New password saved. Sign in','auth.resetMissing':'No account with that name','auth.resetClosed':'A username alone cannot reset a password. Signed-in users can change it in Account settings; if you forgot it, contact staff.','auth.toSettings':'Change password in Account settings','auth.newPass':'New password',
    'auth.passShort':'Use at least ten characters',
    'auth.bio':'Bio','auth.avatar':'Avatar','auth.save':'Save profile','auth.saved':'Profile saved',
    'auth.settingsTitle':'Account settings','auth.avatarHint':'Pick an image. It stays on this device.',
    'auth.oldPass':'Current password','auth.changePass':'Save new password','auth.passChanged':'Password changed','auth.passWrong':'Current password is wrong',
    'play.unavailable':'This game cannot open in the cabin yet. The author has not hosted a playable page.',
    'play.openDetail':'Open the game page',
    'play.embedFail':'The host blocks embedding. Open the original page.',
    'play.embedHint':'If the cabin is blank, open the original page.',
    'workshop.statusPending':'In review','workshop.statusListed':'Listed','workshop.statusRejected':'Rejected','workshop.statusDraft':'Draft',
    'workshop.markListed':'List','workshop.markRejected':'Reject',
    'workshop.needLogin':'Sign in to list a pack.','workshop.listedOk':'Marked as listed',
    'workshop.queue':'Review queue','workshop.queueEmpty':'Nothing waiting for review.','workshop.queueCount':'{n} pending',
    'workshop.reviewerNote':'林澄 is the reviewer. Authors cannot list their own packs.','workshop.needReviewer':'Only a reviewer can list a pack',
    'workshop.rejectSend':'Save the rejection reason',
    'workshop.reports':'Reports','workshop.reportsEmpty':'No reports right now.','workshop.reportsCount':'{n} reports',
    'workshop.reportGame':'Game','workshop.reportPost':'Post','workshop.reportDismiss':'Mark seen','workshop.reportGone':'Removed from the report list',
    'workshop.hidePost':'Hide post','workshop.takedown':'Take down','workshop.hiddenOk':'Post hidden from the feed','workshop.takedownOk':'Game taken off the shelf','workshop.alreadyGone':'Already handled',
    'workshop.unlistedOk':'Taken off the shelf','workshop.resubmitOk':'Submitted again',
    'workshop.unlist':'Unlist','workshop.edit':'Edit this pack','workshop.resubmit':'Submit again',
    'workshop.rejectWhy':'Rejection reason','workshop.reasonPh':'e.g. cover is unreadable',
    'workshop.formPlay':'Play URL','workshop.playHint':'A hosted page URL is what the cabin opens. Without it the cabin says it is not playable.',
    'workshop.playPh':'https://','workshop.statusUnlisted':'Unlisted','workshop.editing':'Editing this pack',
    'workshop.cancelEdit':'Cancel edit','workshop.saveEdit':'Save changes','workshop.needPlayOrPack':'Add a play URL or a web pack',
    'post.kicker':'Post','post.write':'New post','post.title':'Title','post.body':'Body','post.game':'Linked game',
    'post.submit':'Publish','post.none':'This post is gone.','post.ok':'Published',
    'post.needTitle':'Use 4–48 characters for the title','post.loginToPost':'Sign in to post.',
    'post.comments':'Comments','post.comment':'Write a comment','post.commentOk':'Comment saved','post.commentNeed':'Write at least two characters',
    'post.loginToComment':'Sign in to comment.','post.noComments':'No comments yet.','post.countComments':'{n} comments',
    'post.edit':'Edit post','post.delete':'Delete post','post.deleted':'Post deleted','post.save':'Save','post.saved':'Post saved',
    'post.commentEdit':'Edit','post.commentDel':'Delete','post.commentSaved':'Comment saved',
    'confirm.delete':'Delete this?',
    'user.missing':'This author is not here.','user.follow':'Follow author','user.following':'Following author',
    'notify.title':'Alerts','notify.empty':'No alerts yet.','notify.mark':'Mark all read','notify.unread':'Unread',
    'notify.like':'{name} liked your post','notify.comment':'{name} commented on your post','notify.follow':'{name} followed you',
    'notify.packOn':'{title} is listed','notify.packOff':'{title} was not listed',
    'notify.postHidden':'Your post was hidden by review','notify.gameDown':'Your game was taken off the shelf',
    'profile.loginGate':'Sign in to see playing, reviews, and listed games.','profile.logout':'Sign out on this device','profile.settings':'Edit profile',
    'index.login':'Sign in','index.loginCopy':'After sign-in the bar shows your name.',
    'index.settings':'Account','index.settingsCopy':'Change name, bio, and avatar.','index.reset':'Reset password','index.resetCopy':'A username alone cannot reset a password. Signed-in users can change it in Account settings; if you forgot it, contact staff.',
    'index.notify':'Alerts','index.notifyCopy':'Likes, follows, workshop review status.',
    'share.title':'Share this game','share.copy':'Copy link','share.close':'Close','share.copied':'Link copied','share.copyFail':'Copy the link yourself',
    'rev.all':'All','rev.good':'Praise','rev.bad':'Rants','rev.author':'Author',
    'play.exit':'Exit','play.cabin':'Play cabin','play.mute':'Mute','play.muted':'Muted','play.full':'Full screen','play.share':'Share',
    'play.skip':'Skip to cabin','play.note':'Play cabin · {title}. Built to feel the controls, not a hosted original.',
    'play.noteLive':'Opening the author’s hosted page · {title}. If it is blocked, use Open original.',
    'play.openSrc':'Open original','play.live':'Original',
    'play.demo':'{title} demo','play.newGame':'New game','play.keys':'Arrow keys or WASD',
    'play.size':'Size {n}','play.ioHint':'Move the pointer. Swallow the small ones, dodge the large.',
    'play.ioDead':'A larger circle ate you. Click the stage to restart.','play.notEnough':'Not enough yet',
    'play.cps':'+{n} / sec','play.clips':'Paperclips {n}','play.cookies':'Cookies {n}',
    'play.hitClip':'Make another','play.hitCookie':'Bake another',
    'play.shop.auto':'Auto-clipper','play.shop.cursor':'Cursor','play.shop.plant':'Plant',
    'play.shop.oven':'Oven','play.shop.market':'Market','play.shop.factory':'Factory',
    'play.again':'Play again',
    'play.dark.start':'Only embers left. The room is dark.',
    'play.dark.start.0':'Feed the wood beside you','play.dark.start.1':'Sit and listen',
    'play.dark.fire':'The fire is back. Footsteps in the door crack.',
    'play.dark.fire.0':'Bar the door','play.dark.fire.1':'Ease the door open',
    'play.dark.wait':'The fire dies. Cold climbs from the floor. You hear your own breath.',
    'play.dark.wait.0':'Feel for wood in the dark','play.dark.wait.1':'Keep waiting',
    'play.dark.bar':'Door barred. Firelight shows a mark on the wall: go north.',
    'play.dark.bar.0':'Note it and keep watch','play.dark.bar.1':'Get ready to leave',
    'play.dark.open':'Outside is a clearing, not a hall. Another fire far off.',
    'play.dark.open.0':'Walk toward that fire','play.dark.open.1':'Back to the room',
    'play.dark.endCold':'The cabin ends here. The full piece is in the original or the workshop pack.',
    'play.dark.endKeep':'You watch until dawn. Cabin over.',
    'play.dark.endOut':'The wind is hard in the clearing. Cabin ends here.',
    'play.pwd.start':'Write a password. The rule shows up after you finish.',
    'play.pwd.start.0':'Start with four letters','play.pwd.start.1':'Start with today’s date',
    'play.pwd.letters':'New rule: it must include a number. The four letters stay.',
    'play.pwd.letters.0':'Add 2 at the end','play.pwd.letters.1':'Wipe and start over',
    'play.pwd.date':'New rule: it cannot be a consecutive date. Today is rejected.',
    'play.pwd.date.0':'Switch to scrambled digits','play.pwd.date.1':'Switch to four letters',
    'play.pwd.num':'New rule: the digits must add to 10. The cabin stops here.',
    'search.kicker':'Mixed results','search.title':'Search','search.games':'Games','search.posts':'Posts',
    'search.ledeEmpty':'Type a name, author, or tag in the bar and press Enter. Below is a first column of games people are playing.',
    'search.ledeHits':'{g} games, {p} posts, {a} authors.','search.countGames':'{n} games','search.countPosts':'{n} posts',
    'search.authors':'Authors','search.noAuthors':'No matching authors.','search.countAuthors':'{n} authors',
    'search.noPosts':'No matching posts.','search.quoted':'“{q}”','search.suggest':'Did you mean “{q}”','search.fail':'Search could not open.',
    'community.kicker':'Players','community.title':'Someone just played',
    'community.lede':'Author posts, workshop notes, lobby gripes. Likes and follows are per account on this device.',
    'community.topics':'Topics','community.watch':'Worth following','community.empty':'No posts on this side. Follow a few authors, or pick another topic.',
    'community.feedAll':'All','community.feedFollow':'Following','community.feedFable':'Workshop',
    'community.followed':'Following {name}','community.unfollowed':'Unfollowed {name}',
    'workshop.kicker':'Workshop','workshop.title':'Put a web pack on the shelf',
    'workshop.lede':'Upload the web pack you exported — a .zip or a single .html, built with any tool as long as it runs in a browser. Add a cover, a one-liner and tags; the pack then goes into review, and it only shows up in Discover once approved.',
    'workshop.shelf':'Listed web packs','workshop.allFable':'All Fable','workshop.publish':'Publish',
    'workshop.shelfLoading':'Reading the shelf…','workshop.draftsLoading':'Reading your submissions…',
    'workshop.shelfEmpty':'Nothing on the shelf yet. Fill the form and submit — approved packs show up here.',
    'workshop.noDraft':'No submissions yet. Submit the form and you can follow the review here.',
    'workshop.mineGuide':'Only your own submissions live here: in review after you submit, listed once approved, rejected with a reason. You can edit, resubmit or unlist at any time. Public works are in Discover.',
    'workshop.visPublic':'Pending public','workshop.visLink':'Link only','workshop.visDraft':'Draft','workshop.noPack':'No pack',
    'workshop.submit':'Submit listing','workshop.unnamed':'Untitled','workshop.drafts':'My submissions',
    'workshop.formName':'Title','workshop.formAuthor':'Author','workshop.formBlurb':'Tagline','workshop.formCat':'Genre',
    'workshop.formTags':'Tags','workshop.formVis':'Visibility','workshop.visOpen':'Public','workshop.formPack':'Web pack','workshop.formCover':'Cover',
    'workshop.dropPack':'Choose a .zip or .html','workshop.packHint':'A submit goes into review; it only reaches Discover once approved.',
    'workshop.packErr':'Pick a web pack (.zip or .html).','workshop.titleErr':'Use 2–24 characters for the title.','workshop.authorErr':'Enter an author name.',
    'workshop.clearCover':'Remove cover','workshop.preview':'Preview','workshop.coverHint':'Click the paper window or drop an image. Discover crops to 16:10.',
    'workshop.needFields':'Required fields are still empty','workshop.savedDraft':'Draft saved','workshop.submitted':'Submitted. It is now in the review queue.',
    'workshop.coverPick':'Choose cover','workshop.coverChange':'Change cover','workshop.needImage':'Choose an image for the cover',
    'workshop.dropImage':'Drop an image for the cover','workshop.badImage':'That image could not be read','workshop.storage':'This device cannot store more drafts',
    'workshop.coverAlt':'Cover preview','workshop.placeholder':'e.g. Night Port','workshop.blurbPh':'The line you see before you play.','workshop.tagsPh':'Workshop, story — split with a pause mark',
    'profile.kicker':'Workshop author','profile.lede':'Follows, likes, and workshop drafts stay per account on this device.',
    'profile.statPlay':'Playing','profile.statRev':'Reviews','profile.statPub':'Listed',
    'profile.tabPlay':'Playing','profile.tabFav':'Following','profile.tabReview':'Reviews','profile.tabMade':'Games listed','profile.tabPosts':'My posts','profile.posts':'Posts',
    'profile.emptyPlay':'Open the play cabin and it will show up here.','profile.emptyPlayOther':'No play cabin history yet.','profile.emptyFav':'Nothing followed yet. Follow a game from its page.','profile.emptyMade':'No games listed yet.',
    'profile.emptyPosts':'No posts yet.','profile.emptyPostsOther':'No posts yet.','profile.emptyPeople':'No authors followed. Follow someone in Community.',
    'profile.emptyReviewsOther':'No reviews written yet.','profile.people':'Authors followed','profile.favGames':'Games followed',
    'profile.followers':'Followers','profile.emptyFollowers':'No one follows this author yet.',
    'profile.playNote':'Ordered by the last cabin you opened.',
    'profile.madeNote':'Night Port is a storefront workshop sample. New titles submitted from Workshop are not really hosted.',
    'crumb.me':'Me','index.kicker':'Jiwan Space','index.title':'Web-game storefront prototype',
    'index.lede':'Home, charts, community, and workshop share one print-magazine storefront. The shelf holds public web games from fable52.games, Claude Gaming, and X. Detail covers are 16:9; play opens in its own cabin.',
    'index.homeCopy':'Editors’ carousel, hot, charts, staples, workshop, and new.',
    'index.browseCopy':'Filter by genre, length, and Fable workshop. Charts can hand off day / week / month.',
    'index.rankCopy':'Hot, new, rated. Switching periods shows up / down arrows.',
    'index.communityCopy':'Feed, topics, and follow. Likes and follows are per account.',
    'index.workshopCopy':'List a Fable 5.2 web pack. Public submits go to the review queue. 林澄 is the demo reviewer.',
    'index.profileCopy':'Sign in to see playing, reviews, and listed games.',
    'index.searchCopy':'Mixed game and post results. Enter from the top bar.',
    'index.detailCopy':'16:9 cover, score, shots, reviews. Play now only when a host URL exists.',
    'index.playCopy':'Opens the hosted original when a play URL exists. Otherwise the cabin says it is not playable.',
    'index.detail':'Game page','index.play':'Play cabin','index.me':'Me'
  }
};
const TAG_I18N = {
  '生存':['生存','Survival'],'动作':['动作','Action'],'放置':['放置','Idle'],'解谜':['解谜','Puzzle'],'射击':['射击','Shooter'],
  '叙事':['叙事','Story'],'探索':['探索','Explore'],'竞速':['竞速','Racing'],'休闲':['休闲','Casual'],'模拟':['模拟','Sim'],
  '工坊':['工坊','Workshop'],'联机':['联机','Multiplayer'],'开放世界':['开放世界','Open world'],'驾驶':['驾驶','Driving'],
  '飞行':['飞行','Flight'],'体育':['体育','Sports'],'策略':['策略','Strategy'],'冒险':['冒险','Adventure'],'恐怖':['恐怖','Horror'],
  '跑酷':['跑酷','Parkour'],'街机':['街机','Arcade'],'平台':['平台','Platform'],'收集':['收集','Collect'],'贸易':['贸易','Trade'],
  '魂like':['魂like','Soulslike'],'赛博':['赛博','Cyber'],'西部':['西部','Western'],'水下':['水下','Underwater'],
  '武侠':['武侠','Wuxia'],'建造':['建造','Build'],'对战':['对战','Versus'],'家庭':['家庭','Family'],'神话':['神话','Myth'],
  '同人':['同人','Fan'],'中文':['中文','Chinese'],'IO':['IO','IO'],'CF':['CF','CF'],'MOBA':['MOBA','MOBA']
};
function langSwitchHTML(where){
  const lang = getLang();
  return `<div class="lang-switch" data-od-id="lang-switch-${where}" role="group" data-i18n-aria="nav.lang" aria-label="${t('nav.lang')}"><button class="lang-btn" type="button" data-lang="zh" data-od-id="lang-zh-${where}" aria-pressed="${lang==='zh'?'true':'false'}">中</button><span class="lang-sep" aria-hidden="true">/</span><button class="lang-btn" type="button" data-lang="en" data-od-id="lang-en-${where}" aria-pressed="${lang==='en'?'true':'false'}">EN</button></div>`;
}
function reviewLabel(s){
  if (s === '好评') return t('rev.good');
  if (s === '吐槽') return t('rev.bad');
  if (s === '作者') return t('rev.author');
  if (s === 'all') return t('rev.all');
  return s;
}
function tagsLine(g, n){
  return (g.tags || []).slice(0, n == null ? 2 : n).map(tagLabel).join(' · ');
}
function sortLabel(id){
  if (id === 'hot') return t('browse.sortHot');
  if (id === 'new') return t('browse.sortNew');
  return t('browse.sortScore');
}
function getLang(){
  try { return localStorage.getItem('jiwan-lang') === 'en' ? 'en' : 'zh'; } catch (e) { return 'zh'; }
}
function t(key, vars){
  const pack = I18N[getLang()] || I18N.zh;
  let s = pack[key] || I18N.zh[key] || key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] == null ? '' : vars[k]));
  return s;
}
function tagLabel(tag){
  const row = TAG_I18N[tag];
  if (!row) return tag;
  return getLang() === 'en' ? row[1] : row[0];
}
/* 语言字段随数据一起从接口下来，前端不再持有第二个语言表 */
function gameTitle(g){
  if (!g) return '';
  return (getLang() === 'en' && g.title_en) ? g.title_en : (g.title || '');
}
function gameBlurb(g){
  if (!g) return '';
  return (getLang() === 'en' && g.blurb_en) ? g.blurb_en : (g.blurb || '');
}
function gameAbout(g){
  if (!g) return '';
  return (getLang() === 'en' && g.about_en) ? g.about_en : (g.about || '');
}
function gameBanner(g){
  if (!g) return '';
  return (getLang() === 'en' && g.banner_en) ? g.banner_en : (g.banner || g.blurb || '');
}
function syncI18nLists(){
  GENRES.forEach(g => { g.label = t('genre.' + g.id); });
  DURATIONS.forEach(g => { g.label = t('duration.' + g.id); });
  FABLE.forEach(g => { g.label = t('fable.' + g.id); });
  RANK_TABS.forEach(row => { row[1] = t('rank.' + row[0]); });
  RANK_PERIODS.forEach(row => { row[1] = t('period.' + row[0]); });
  RANK_TAB_NAME.hot = t('rank.hotBoard'); RANK_TAB_NAME.new = t('rank.newBoard'); RANK_TAB_NAME.score = t('rank.scoreBoard');
  RANK_PERIOD_NAME.day = t('period.dayBoard'); RANK_PERIOD_NAME.week = t('period.weekBoard'); RANK_PERIOD_NAME.month = t('period.monthBoard');
}
function applyI18n(){
  const lang = getLang();
  document.documentElement.lang = lang === 'en' ? 'en' : 'zh-CN';
  syncI18nLists();
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.getAttribute('data-i18n')); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => { el.setAttribute('placeholder', t(el.getAttribute('data-i18n-placeholder'))); });
  document.querySelectorAll('[data-i18n-aria]').forEach(el => { el.setAttribute('aria-label', t(el.getAttribute('data-i18n-aria'))); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.setAttribute('title', t(el.getAttribute('data-i18n-title'))); });
  document.querySelectorAll('[data-back-label]').forEach(el => { el.textContent = backLabel(el.getAttribute('data-back-key'), el.getAttribute('data-back-short') === '1'); });
  document.querySelectorAll('.lang-btn').forEach(btn => {
    const on = btn.getAttribute('data-lang') === lang;
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  document.querySelectorAll('a.brand').forEach(a => {
    a.setAttribute('aria-label', t('brand.name'));
    const svg = a.querySelector('svg.brand-logo');
    if (!svg) return;
    if (svg.getAttribute('data-lang') === lang) return;
    svg.outerHTML = brandLogoHTML();
  });
  document.querySelectorAll('.foot-inner > strong').forEach(el => { el.textContent = t('brand.name'); });
}
function setLang(lang){
  lang = lang === 'en' ? 'en' : 'zh';
  try { localStorage.setItem('jiwan-lang', lang); } catch (e) {}
  applyI18n();
  window.dispatchEvent(new CustomEvent('jiwan:langchange', { detail: lang }));
}
try { if (getLang() === 'en') document.documentElement.lang = 'en'; } catch (e) {}


const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
/* 游戏索引由接口 /games/index 提供，这里是同步查找的唯一入口 */
let GAME_INDEX = new Map();
function setIndex(list){
  GAME_INDEX = new Map((list || []).map(g => [String(g.id), g]));
}
const byId = id => GAME_INDEX.get(String(id)) || null;
const allGames = () => [...GAME_INDEX.values()];
function parsePlayers(g){
  const extra = Number(g && g.plays) || 0;
  const s = String(g.players||'');
  if (/上架/.test(s) || /listed/i.test(s)) return extra;
  const n = parseFloat(s);
  if (!Number.isFinite(n)) return extra;
  if (/万/.test(s)) return n * 10000 + extra;
  if (/千/.test(s)) return n * 1000 + extra;
  if (/k\b/i.test(s)) return n * 1000 + extra;
  return n + extra;
}
function livePlayers(g){
  const base = parsePlayers(g);
  const slot = Math.floor(Date.now() / 7000);
  const key = String((g && g.id) || '') + ':' + slot;
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 33 + key.charCodeAt(i)) | 0;
  const amp = base >= 10000
    ? Math.max(1200, Math.round(base * 0.0035))
    : Math.max(2, Math.round(Math.max(base, 8) * 0.08));
  const tick = (Math.abs(h) % (amp * 2 + 1)) - amp;
  return Math.max(0, base + tick);
}
function formatPlayers(n){
  if(!n) return t('meta.listed');
  if(getLang()==='en'){
    const label = n >= 1000 ? (n >= 100000 ? Math.round(n/1000) : (n/1000).toFixed(1).replace(/\.0$/,'')) + 'k' : String(Math.round(n));
    return label + ' ' + t('meta.playing');
  }
  if (n >= 10000) return (n/10000).toFixed(1).replace(/\.0$/,'') + '万' + t('meta.playingSuffix');
  if (n >= 1000) return (n/1000).toFixed(1).replace(/\.0$/,'') + '千' + t('meta.playingSuffix');
  return String(Math.round(n)) + t('meta.playingSuffix');
}
/* 榜单顺序与「上一期名次」都由服务端算好（/home、/rankings、/games?from=rank）。
   这里只保留一个缓存入口，页面照旧同步取用。 */
let RANK_PREV = Object.create(null);
function setRankPrev(map){ RANK_PREV = map || Object.create(null); }
function rankIndexMap(){ return RANK_PREV; }
function rankMoveHTML(cur, prev, prevName){
  if(prev==null) return `<span class="rank-delta is-new" title="${t('rank.newIn')}" aria-label="${t('rank.newIn')}">${t('rank.newMark')}</span>`;
  const d=prev-cur;
  if(d>0) return `<span class="rank-delta is-up" title="${t('rank.up',{name:prevName,n:d})}" aria-label="${t('rank.up',{name:prevName,n:d})}">${RANK_ARROW_UP}${d}</span>`;
  if(d<0) return `<span class="rank-delta is-down" title="${t('rank.down',{name:prevName,n:-d})}" aria-label="${t('rank.down',{name:prevName,n:-d})}">${RANK_ARROW_DOWN}${-d}</span>`;
  return `<span class="rank-delta is-same" title="${t('rank.same',{name:prevName})}" aria-label="${t('rank.same',{name:prevName})}">—</span>`;
}
function toast(msg){
  let t = document.getElementById('toast');
  if(!t){
    t = document.createElement('div');
    t.id = 'toast';
    t.className = 'toast';
    t.setAttribute('role','status');
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('is-on');
  clearTimeout(toast._id);
  toast._id = setTimeout(()=>t.classList.remove('is-on'), 2200);
}
function coverStyle(g){ return `--hue:${g.hue};--chroma:${g.chroma}`; }
function scoreText(g){ return g.score==null ? t('meta.new') : g.score.toFixed(1); }
function playerLine(g){
  return formatPlayers(livePlayers(g));
}
function bindLivePlayers(){
  const tick = () => {
    document.querySelectorAll('[data-live-players]').forEach(el => {
      const g = byId(el.getAttribute('data-live-players'));
      if (g) el.textContent = playerLine(g);
    });
  };
  tick();
  if (!bindLivePlayers._id) bindLivePlayers._id = setInterval(tick, 7000);
}
function openReasonForm(opts){
  const title = (opts && opts.title) || t('detail.report');
  const hint = (opts && opts.hint) || '';
  const ph = (opts && opts.placeholder) || t('detail.reportWhy');
  const submit = (opts && opts.submit) || t('detail.reportSend');
  let modal = document.getElementById('reason-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'reason-modal';
    modal.className = 'modal-back';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'reason-title');
    document.body.appendChild(modal);
  }
  const kinds = (opts && opts.kinds) || [];
  const kindsHTML = kinds.length
    ? `<div class="field"><span>${t('detail.reportKind')}</span><div class="choice-row" id="reason-kinds">${kinds.map((k, i) =>
        `<label><input type="radio" name="reason-kind" value="${esc(k.value)}"${i === 0 ? ' checked' : ''}> ${esc(k.label)}</label>`
      ).join('')}</div></div>`
    : '';
  modal.innerHTML = `<div class="sheet">
    <h3 id="reason-title">${esc(title)}</h3>
    ${hint ? `<p class="meta">${esc(hint)}</p>` : ''}
    <form id="reason-form">
      ${kindsHTML}
      <div class="field" id="f-reason">
        <label for="reason-text">${esc(ph)}</label>
        <textarea id="reason-text" name="reason" maxlength="200"></textarea>
        <p class="err">${t('detail.reportNeed')}</p>
      </div>
      <div class="detail-actions">
        <button class="btn btn-primary" type="submit" data-od-id="reason-submit">${esc(submit)}</button>
        <button class="btn" type="button" id="reason-close">${t('share.close')}</button>
      </div>
    </form>
  </div>`;
  modal.classList.add('is-on');
  const close = () => modal.classList.remove('is-on');
  modal.querySelector('#reason-close').onclick = close;
  modal.onclick = e => { if (e.target === modal) close(); };
  modal.querySelector('#reason-form').onsubmit = async e => {
    e.preventDefault();
    const kind = (modal.querySelector('input[name="reason-kind"]:checked') || {}).value || '';
    const text = modal.querySelector('#reason-text').value.trim();
    const needText = !kind || kind === 'other';
    modal.querySelector('#f-reason').classList.toggle('is-bad', needText && text.length < 2);
    if (needText && text.length < 2) { toast(t('detail.reportNeed')); return; }
    const kindLabel = kind ? t('report.' + kind) : '';
    const combined = [kindLabel, text].filter(Boolean).join(' · ');
    close();
    if (opts && opts.onSubmit) await opts.onSubmit(combined || kindLabel);
  };
  const ta = modal.querySelector('#reason-text');
  if (ta) setTimeout(() => ta.focus(), 0);
}
function reportKinds(){
  return [
    { value: 'spam', label: t('report.spam') },
    { value: 'spoil', label: t('report.spoil') },
    { value: 'abuse', label: t('report.abuse') },
    { value: 'other', label: t('report.other') }
  ];
}
function posterTag(g, cls){
  if(!g.poster) return '';
  return `<img class="${cls||'poster'}" src="${g.poster}" alt="${gameTitle(g)}" width="${g.pw}" height="${g.ph}" style="object-position:${g.pos||'center'}">`;
}
function fableLabel(g){
  /* 用户投稿不宣称制作工具：过审上架的包统一标成「用户上架」。 */
  if (g.packStatus === 'listed') return t('label.userListed');
  if (g.src) return t('label.live');
  if (g.demo) return t('label.workshopDemo');
  if (g.fable) return t('label.fable');
  if (g.origin === 'x') return t('label.xNew');
  if (g.origin === 'claudegaming') return 'Claude Gaming';
  return (g.tags && tagLabel(g.tags[0])) || t('label.webgame');
}
function originChip(g){
  if (g.src) {
    try { return new URL(g.src).host.replace(/^www\./, ''); } catch (e) { return t('origin.hosted'); }
  }
  if (!g.poster) return '';
  if (g.origin === 'fable52') return 'fable52.games';
  if (g.origin === 'claudegaming') return 'Claude Gaming';
  if (g.origin === 'x') return t('origin.x');
  return t('origin.shot');
}
function coverHTML(g,kicker){
  const skip = kicker===false;
  const kick = skip ? '' : (kicker || fableLabel(g));
  const kickEl = kick ? `<span class="cover-kicker">${kick}</span>` : '';
  if(g.poster) return `<div class="cover has-poster" style="${coverStyle(g)}">${kickEl}${posterTag(g)}</div>`;
  return `<div class="cover" style="${coverStyle(g)}">${kickEl}${skip?'':`<strong>${gameTitle(g)}</strong>`}</div>`;
}
function iconHTML(g){ return `<div class="icon">${coverHTML(g,false)}</div>`; }
function miniHTML(g){
  if(g.poster) return `<div class="mini-art has-poster">${posterTag(g)}</div>`;
  return `<div class="mini-art" style="${coverStyle(g)}"></div>`;
}
function gameHref(id){ return `game-detail.html?id=${encodeURIComponent(id)}`; }
function playHref(id){ return `play.html?id=${encodeURIComponent(id)}`; }
function playSrc(g){ return (g && (g.src || g.playUrl)) || ''; }
function esc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
const AUTH_FILES = { 'login.html': 1, 'register.html': 1, 'reset.html': 1 };
const RETURN_KEY = 'jiwan-return';
function pageFile(raw){
  return String(raw || '').split(/[?#]/)[0].toLowerCase();
}
function isAuthPage(raw){
  return !!AUTH_FILES[pageFile(raw)];
}
function currentPage(){
  return (location.pathname.split('/').pop() || 'index.html') + location.search + location.hash;
}
function pageFromHref(href){
  if (!href) return '';
  try {
    const u = new URL(href, location.href);
    if (u.origin !== location.origin) return '';
    return (u.pathname.split('/').pop() || 'index.html') + u.search + u.hash;
  } catch (e) { return ''; }
}
function sanitizeNext(raw){
  if (raw == null || raw === '') return '';
  let s = String(raw);
  try { s = decodeURIComponent(s); } catch (e) {}
  s = s.trim();
  if (!s || /^https?:/i.test(s) || s.startsWith('//') || s.includes('..')) return '';
  if (!/^[a-z0-9._-]+\.html([?#].*)?$/i.test(s)) return '';
  if (isAuthPage(s)) return '';
  return s;
}
function peekReturn(){
  try { return sanitizeNext(sessionStorage.getItem(RETURN_KEY) || ''); }
  catch (e) { return ''; }
}
function rememberReturn(raw){
  const dest = sanitizeNext(raw);
  if (!dest) return '';
  try { sessionStorage.setItem(RETURN_KEY, dest); } catch (e) {}
  return dest;
}
function takeReturn(){
  const dest = peekReturn();
  try { sessionStorage.removeItem(RETURN_KEY); } catch (e) {}
  return dest;
}
function resolveNext(raw){
  const fromQuery = sanitizeNext(raw);
  if (fromQuery) return rememberReturn(fromQuery) || fromQuery;
  const stored = peekReturn();
  if (stored) return stored;
  const fromRef = sanitizeNext(pageFromHref(document.referrer));
  if (fromRef) return rememberReturn(fromRef) || fromRef;
  return 'index.html';
}
/* ── 来路记忆：列表页把自己记下来，详情页/试玩舱/帖子/个人页据此显示「返回来处」 ──
   详情页顶部的返回键不再写死回首页：从排行榜点进来的就回排行榜，
   从搜索、发现、分类、工坊、我的主页进来的也各自回去，并且带上当时的筛选参数。 */
const ORIGIN_KEY = 'jiwan-origin';
/* 会被记为「来处」的列表页 */
const LIST_PAGES = {
  'index.html': 'home',
  'browse.html': 'browse',
  'rankings.html': 'rank',
  'search.html': 'search',
  'community.html': 'community',
  'workshop.html': 'workshop',
  'profile.html': 'profile',
  'notify.html': 'notify',
  'admin.html': 'admin'
};
/* 内容页：本身不当来处记，但可以作为某些页面的直接上一页（作者主页 ← 游戏详情 等） */
const CONTENT_PAGES = {
  'game-detail.html': 'detail',
  'play.html': 'play',
  'post.html': 'post',
  'user.html': 'user'
};
function originKeyOf(page){
  return LIST_PAGES[pageFile(page)] || '';
}
function anyKeyOf(page){
  return LIST_PAGES[pageFile(page)] || CONTENT_PAGES[pageFile(page)] || '';
}
function trackOrigin(){
  const page = currentPage();
  const key = originKeyOf(page);
  if (!key) return '';
  try { sessionStorage.setItem(ORIGIN_KEY, JSON.stringify({ url: page, key: key, at: Date.now() })); } catch (e) {}
  return key;
}
function peekOrigin(){
  try {
    const rec = JSON.parse(sessionStorage.getItem(ORIGIN_KEY) || 'null');
    if (rec && rec.url && originKeyOf(rec.url)) return rec;
  } catch (e) {}
  return null;
}
/* 返回目标：优先用浏览器带的来路，其次用会话里记下的那一页，两者都没有才退回首页。
   - 默认只认「列表页」来路（试玩舱/游戏详情用它，避免详情↔试玩来回打转）
   - wide:true 时内容页也算来路，skip 里的类型除外（作者主页、帖子页用它）
   exact 表示「来路就是这一页」，可以走 history.back() 把滚动位置和筛选状态原样还回去。 */
function backTarget(opts){
  const o = opts || {};
  const skip = o.skip || [];
  const refPage = pageFromHref(document.referrer);
  const refKey = anyKeyOf(refPage);
  const org = peekOrigin();
  const knownRef = refKey && (o.wide || !!originKeyOf(refPage)) && skip.indexOf(refKey) < 0;
  let href, key;
  if (knownRef) { href = refPage; key = refKey; }
  else if (org) { href = org.url; key = org.key || originKeyOf(org.url); }
  else { href = 'index.html'; key = 'home'; }
  return { href: href, key: key, exact: !!href && refPage === href };
}
function backLabel(key, short){
  const k = (short ? 'back.short.' : 'back.') + (key || 'home');
  const pack = I18N[getLang()] || I18N.zh;
  if (pack[k] || I18N.zh[k]) return t(k);
  return t('back.home');
}
function backHTML(opts){
  const o = opts || {};
  const b = backTarget(o);
  return `<a class="back${o.className ? ' ' + o.className : ''}" href="${esc(b.href)}" data-back data-back-exact="${b.exact ? '1' : '0'}" data-back-key="${esc(b.key)}" data-od-id="${esc(o.odId || 'back-link')}" rel="prev"><span class="back-ar" aria-hidden="true">←</span><span data-back-label data-back-key="${esc(b.key)}"${o.short ? ' data-back-short="1"' : ''}>${esc(backLabel(b.key, o.short))}</span></a>`;
}
let originBound = false;
function bindOrigin(){
  if (originBound) return;
  originBound = true;
  window.addEventListener('pagehide', trackOrigin);
  document.addEventListener('visibilitychange', function(){
    if (document.visibilityState === 'hidden') trackOrigin();
  });
}
function loginHref(next){
  let dest = sanitizeNext(next);
  if (!dest && !isAuthPage(currentPage())) dest = sanitizeNext(currentPage());
  dest = dest || peekReturn() || 'index.html';
  rememberReturn(dest);
  return 'login.html?next=' + encodeURIComponent(dest);
}
function userHref(id){ return 'user.html?id=' + encodeURIComponent(id); }
function authorHref(gOrName){
  if (!gOrName) return '';
  const api = window.JIWAN && window.JIWAN.api;
  const find = api && api.findUser;
  if (typeof gOrName === 'string') {
    const u = find ? find(gOrName) : null;
    return u ? userHref(u.id) : '';
  }
  const g = gOrName;
  if (g.ownerId) return userHref(g.ownerId);
  if (!g.author) return '';          /* 未署名条目不给假链接 */
  const u = find ? find(g.author) : null;
  return u ? userHref(u.id) : '';
}
/* 作者列表（社区右栏用）：从游戏索引里反推，只保留能对上账号的 */
function authorsList(n){
  const seen = new Map();
  allGames().forEach(g => {
    const name = g.author;
    if (!name || seen.has(name)) return;
    const u = (window.JIWAN && JIWAN.api && JIWAN.api.findUser) ? JIWAN.api.findUser(name) : null;
    if (!u) return;
    seen.set(name, { id: u.id, name, game: g.id, note: '' });
  });
  return [...seen.values()].slice(0, n || 8);
}
/* 署名展示：有作者显示作者；没有作者的（Fable 5.2 自主生成 / 第三方 IP）如实说明来源 */
function authorLabel(g){
  if (!g) return '';
  if (g.author) return g.author;
  if (g.maker) return g.maker + (getLang() === 'en' ? ' (generated)' : ' 生成');
  if (g.source) return (getLang() === 'en' ? 'via ' : '来源 ') + g.source;
  return getLang() === 'en' ? 'Uncredited' : '未署名';
}
function postHref(id){ return 'post.html?id=' + encodeURIComponent(id); }
function tagHref(tag){ return 'browse.html?tag=' + encodeURIComponent(tag); }
/* 搜索弹层的最小匹配：标题 / 作者 / 标签 / 拼音 / 来源 */
function hitMatch(g, q){
  const s = String(q || '').toLowerCase().replace(/\s+/g, '');
  if (!s) return true;
  const blob = [g.title, g.title_en, g.author, g.maker, (g.tags || []).join(' '), g.blurb, g.pinyin]
    .join(' ').toLowerCase().replace(/\s+/g, '');
  return blob.includes(s);
}
function highlight(text, q){
  const raw = String(text == null ? '' : text);
  const needle = String(q || '').trim();
  if (!needle) return esc(raw);
  const i = raw.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return esc(raw);
  return esc(raw.slice(0, i)) + '<mark>' + esc(raw.slice(i, i + needle.length)) + '</mark>' + esc(raw.slice(i + needle.length));
}
function pagerHTML(page, pageSize, total, od){
  const pages = Math.max(1, Math.ceil((Number(total) || 0) / Math.max(1, Number(pageSize) || 12)));
  if (pages <= 1) return '';
  const p = Math.max(1, Number(page) || 1);
  return `<nav class="pager" data-od-id="${od || 'pager'}" aria-label="${t('pager.label')}">
    <button class="btn" type="button" data-page="${p - 1}" ${p > 1 ? '' : 'disabled'}>${t('pager.prev')}</button>
    <span class="meta">${t('pager.pos', { p, n: pages })}</span>
    <button class="btn" type="button" data-page="${p + 1}" ${p < pages ? '' : 'disabled'}>${t('pager.next')}</button>
  </nav>`;
}
function failHTML(retryId){
  return `<div class="empty fail-box" data-od-id="fail-state"><p>${t('load.fail')}</p><p><button class="btn" type="button" id="${retryId || 'btn-retry'}">${t('load.retry')}</button></p></div>`;
}
function loadingHTML(){
  return `<div class="empty" data-od-id="loading">${t('load.loading')}</div>`;
}
function avatarHTML(user, cls){
  const u = user || {};
  const name = u.name || '';
  if (u.avatar) return `<span class="${cls || 'nav-avatar'}" aria-hidden="true"><img src="${esc(u.avatar)}" alt=""></span>`;
  return `<span class="${cls || 'nav-avatar'}" aria-hidden="true">${esc(name.slice(0, 1) || '?')}</span>`;
}
function accountNavHTML(active){
  const api = window.JIWAN && window.JIWAN.api;
  const me = api && api.meSync ? api.meSync() : null;
  const pubHref = me ? 'workshop.html#publish' : loginHref('workshop.html#publish');
  const pubDesk = `<a class="nav-link desktop-only" href="${pubHref}" data-od-id="btn-publish" data-i18n="nav.publish">${t('nav.publish')}</a>`;
  const pubMob = `<a class="nav-link" href="${pubHref}" data-i18n="nav.publish">${t('nav.publish')}</a>`;
  if (me) {
    const unread = api.unreadCount ? api.unreadCount() : 0;
    const badge = unread ? `<span class="nav-badge">${unread}</span>` : '';
    /* 后台入口：管理员与审核员可见 */
    const canReview = me.role === 'admin' || me.role === 'reviewer' || me.id === 'lincheng' || me.id === 'admin';
    const adminDesk = canReview ? `<a class="nav-link desktop-only${active==='admin'?' is-active':''}" href="admin.html" data-od-id="btn-admin">${t('nav.admin')}</a>` : '';
    const adminMob = canReview ? `<a class="nav-link${active==='admin'?' is-active':''}" href="admin.html">${t('nav.admin')}</a>` : '';
    const desk = `<a class="nav-link desktop-only${active==='notify'?' is-active':''}" href="notify.html" data-od-id="btn-notify">${t('nav.notify')}${badge}</a>${adminDesk}<a class="nav-link nav-account desktop-only${active==='profile'?' is-active':''}" href="profile.html" data-od-id="btn-account">${avatarHTML(me)}${esc(me.name)}</a><button class="nav-link desktop-only" type="button" id="nav-logout-desk" data-od-id="btn-logout-desk">${t('nav.logout')}</button>`;
    const mob = `<a class="nav-link${active==='notify'?' is-active':''}" href="notify.html">${t('nav.notify')}${unread ? ' ' + unread : ''}</a>${adminMob}<a class="nav-link${active==='profile'?' is-active':''}" href="profile.html">${esc(me.name)}</a><button class="nav-link" type="button" id="nav-logout" data-od-id="btn-logout">${t('nav.logout')}</button>`;
    return { pubDesk, pubMob, desk, mob };
  }
  const next = loginHref();
  return {
    pubDesk, pubMob,
    desk: `<a class="nav-link desktop-only${active==='profile'?' is-active':''}" href="${next}" data-od-id="btn-login" data-i18n="nav.login">${t('nav.login')}</a>`,
    mob: `<a class="nav-link" href="${next}" data-i18n="nav.login">${t('nav.login')}</a>`
  };
}
/* 「工坊」是作者自己的作坊：只有上架过作品（或本身是审核员/管理员）才在导航里出现。
   没上架过的人不该在导航里看到一个空作坊 —— 入口只有右上角的「上架作品」。 */
const WORKSHOP_FLAG = 'jiwan-workshop-entry';
function markWorkshopEntry(){
  try { localStorage.setItem(WORKSHOP_FLAG, '1'); } catch (e) {}
}
function clearWorkshopEntry(){
  try { localStorage.removeItem(WORKSHOP_FLAG); } catch (e) {}
}
function hasWorkshopEntry(active){
  if (active === 'workshop') return true;
  try { if (localStorage.getItem(WORKSHOP_FLAG) === '1') return true; } catch (e) {}
  const api = window.JIWAN && window.JIWAN.api;
  const me = api && api.meSync && api.meSync();
  if (!me) return false;
  return me.role === 'admin' || me.role === 'reviewer' || (api.isReviewer && api.isReviewer(me));
}
function navHTML(active){
  const items = [
    ['home','nav.home','index.html'],
    ['browse','nav.discover','browse.html'],
    ['rank','nav.rank','rankings.html'],
    ['community','nav.community','community.html']
  ];
  if (hasWorkshopEntry(active)) items.push(['workshop','nav.workshop','workshop.html']);
  const acc = accountNavHTML(active);
  const links = items.map(([id,key,href])=>`<a class="nav-link${active===id?' is-active':''}" href="${href}" data-od-id="nav-${id}" data-i18n="${key}">${t(key)}</a>`).join('');
  const mobile = items.map(([id,key,href])=>`<a class="nav-link${active===id?' is-active':''}" href="${href}" data-i18n="${key}">${t(key)}</a>`).join('');
  return `<header class="site-nav" id="jiwan-nav" data-od-id="site-nav">
    <div class="nav-inner">
      <a class="brand" href="index.html" data-od-id="brand-home" aria-label="${t('brand.name')}">${brandLogoHTML()}</a>
      <nav class="nav-links" aria-label="${t('nav.main')}" data-i18n-aria="nav.main">${links}</nav>
      <div class="search-wrap" data-od-id="search">
        <input class="search-field" id="search" type="search" placeholder="${t('nav.search')}" data-i18n-placeholder="nav.search" autocomplete="off">
        <div class="search-pop" id="search-pop" role="listbox"></div>
      </div>
      <div class="nav-actions">
        ${langSwitchHTML('nav')}
        ${acc.pubDesk}
        ${acc.desk}
        <button class="nav-link menu-btn" type="button" id="menu-btn" aria-label="${t('nav.menu')}" data-i18n="nav.menu" data-i18n-aria="nav.menu">${t('nav.menu')}</button>
      </div>
    </div>
    <div class="mobile-drawer" id="mobile-drawer">${mobile}
      ${langSwitchHTML('drawer')}
      ${acc.pubMob}
      ${acc.mob}
    </div>
  </header>`;
}
function footHTML(){
  return `<footer class="foot" id="jiwan-foot" data-od-id="site-footer"><div class="foot-inner"><strong data-i18n="brand.name">${t('brand.name')}</strong> <span data-i18n="foot.body">${t('foot.body')}</span><a class="foot-mail" href="mailto:${t('foot.mail')}" data-i18n="foot.mail">${t('foot.mail')}</a></div></footer>`;
}
function bindSearch(openGame){
  const search = document.getElementById('search');
  const pop = document.getElementById('search-pop');
  if(!search || !pop) return;
  function render(q){
    const s = q.trim().toLowerCase();
    if(!s){ pop.classList.remove('is-open'); pop.innerHTML=''; return; }
    const hits = allGames().filter(g => !g.takedown && hitMatch(g, s)).slice(0,6);
    pop.innerHTML = hits.length
      ? hits.map(g=>`<button class="search-hit" role="option" data-open="${g.id}" type="button"><div class="icon mini">${coverHTML(g,false)}</div><span><strong>${gameTitle(g)}</strong><br><span class="meta">${g.author} · ${tagsLine(g, 4)}</span></span></button>`).join('')
      : `<div class="empty" style="padding:12px">${t('search.empty')}</div>`;
    pop.classList.add('is-open');
  }
  search.addEventListener('input', ()=>render(search.value));
  search.addEventListener('focus', ()=>{ if(search.value) render(search.value); });
  search.addEventListener('keydown', e=>{
    if(e.key!=='Enter') return;
    const q = search.value.trim();
    if(!q) return;
    location.href = 'search.html?q=' + encodeURIComponent(q);
  });
  document.addEventListener('click', e=>{
    if(!e.target.closest('.search-wrap')) pop.classList.remove('is-open');
    const hit = e.target.closest('[data-open]');
    if(hit && hit.closest('#search-pop')){
      openGame(hit.dataset.open);
    }
  });
}
function mountChrome(active, opts={}){
  const openGame = opts.openGame || (id => { location.href = gameHref(id); });
  /* 列表页顺手把自己的地址记下来，详情页的返回键才知道该回哪儿 */
  bindOrigin();
  trackOrigin();
  const host = document.getElementById('jiwan-nav');
  if(host) host.outerHTML = navHTML(active);
  else document.body.insertAdjacentHTML('afterbegin', navHTML(active));
  const foot = document.getElementById('jiwan-foot');
  if(foot) foot.outerHTML = footHTML();
  bindSearch(openGame);
  const menu = document.getElementById('menu-btn');
  if(menu) menu.onclick = ()=> document.getElementById('mobile-drawer').classList.toggle('is-on');
  function doLogout(){
    const api = window.JIWAN && window.JIWAN.api;
    if (api && api.logout) api.logout();
    clearWorkshopEntry();
    toast(t('auth.loggedOut'));
    location.href = 'index.html';
  }
  const out = document.getElementById('nav-logout');
  if(out) out.onclick = doLogout;
  const outDesk = document.getElementById('nav-logout-desk');
  if(outDesk) outDesk.onclick = doLogout;
  applyI18n();
}

window.JIWAN = {
  ICONS, GENRES, DURATIONS, FABLE,
  RANK_TABS, RANK_PERIODS, RANK_TAB_NAME, RANK_PERIOD_NAME,
  RANK_ARROW_UP, RANK_ARROW_DOWN,
  $, $$, byId, allGames, setIndex, setRankPrev, authorsList, parsePlayers, livePlayers, formatPlayers, rankIndexMap, rankMoveHTML,
  toast, coverStyle, scoreText, playerLine, bindLivePlayers, openReasonForm, reportKinds, posterTag, fableLabel, originChip, coverHTML, iconHTML, miniHTML,
  gameHref, playHref, playSrc, hitMatch,
  highlight, pagerHTML, failHTML, loadingHTML, avatarHTML,
  esc, currentPage, loginHref, userHref, authorHref, authorLabel, postHref, tagHref, accountNavHTML,
  isAuthPage, sanitizeNext, rememberReturn, peekReturn, takeReturn, resolveNext,
  trackOrigin, peekOrigin, backTarget, backHTML, bindOrigin,
  hasWorkshopEntry, markWorkshopEntry, clearWorkshopEntry,
  navHTML, footHTML, mountChrome,
  t, getLang, setLang, applyI18n, tagLabel, tagsLine, reviewLabel, sortLabel, langSwitchHTML,
  brandLogoHTML, BRAND_LOGO, gameTitle, gameBlurb, gameAbout, gameBanner
};

document.addEventListener('click', function(e){
  const btn = e.target.closest('[data-lang]');
  if(!btn || !btn.closest('.lang-switch')) return;
  e.preventDefault();
  setLang(btn.getAttribute('data-lang'));
});
/* 返回键：来路就是那一页时走 history.back()，滚动位置和筛选状态原样还回去；
   其余情况（新开标签、中间又点进别的详情）按算出来的地址跳转。 */
document.addEventListener('click', function(e){
  const link = e.target.closest('[data-back]');
  if(!link) return;
  if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const href = link.getAttribute('href');
  if(!href) return;
  if(link.getAttribute('data-back-exact') === '1'){
    try {
      if(document.referrer && pageFromHref(document.referrer) === href){
        e.preventDefault();
        history.back();
      }
    } catch (err) {}
  }
});
if (document.getElementById('jiwan-nav')) applyI18n();

