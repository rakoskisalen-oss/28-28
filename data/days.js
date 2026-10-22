/* 28/28 — Tibo 的 28 天发布挑战
 * 单一数据源。新增一天：在 DAYS 末尾追加一条，保持 day 连续，然后跑 tools/validate.mjs。
 * 日期均为美西时间（PT）。reactions = X 上的「鼓掌 / 无感」互动数，仅作社区温度参考。
 */
window.CHALLENGE = {
  name: "28/28",
  subject: "Tibo",
  handle: "thsottiaux",
  role: "OpenAI · Codex / ChatGPT",
  startDate: "2026-10-05",
  endDate: "2026-11-01",
  totalDays: 28,
  timezone: "America/Los_Angeles",
  ruleUrl: "https://x.com/thsottiaux/status/2106845241357824205",
  ruleZh:
    "在接下来的 28 天里，我们每天要么发布一项明确的、与大多数 Codex / 工作用户相关的改进，要么进行一次完整重置。改进，开始吧。",
  rulePostedAt: "2026-10-04 13:33 PT",
  dataThrough: "2026-10-20"
};

window.DAYS = [
  {
    day: 1,
    date: "2026-10-05",
    kinds: ["ship"],
    title: "第一天：默认推理速度提升约 50%",
    url: "https://x.com/thsottiaux/status/2107158998495748264",
    summary:
      "GPT-6 Astra 与 GPT-6.1 Sol 的默认推理速度提升约 50%。评论区并不买账：实测没到宣传的 50 TPS，而且这更像是在补 9 月底降速留下的坑。",
    quote: null,
    quoteZh: null,
    items: [],
    reactions: { praise: 14563, meh: 2082 },
    tags: ["速度", "模型"],
    note: null
  },
  {
    day: 2,
    date: "2026-10-06",
    kinds: ["reset", "ship"],
    title: "社区投票要求重置，于是重置",
    url: null,
    summary:
      "当天先发了四条改进：Decisions API 进入公测、Meetings 插件开始记录会议、API 付费档位从五档并为三档、所有登录用户可用 Auto-review。社区投票仍一边倒地要重置，于是当天照做。",
    quote: null,
    quoteZh: null,
    items: [
      {
        title: "Decisions API 公测上线",
        url: "https://x.com/thsottiaux/status/2107574912349303197",
        summary: "开发者可以近实时地选择模型、工具或动作，决策速度最多比走 Responses API 调 GPT-6 Luna 快 10 倍。",
        praise: 557,
        meh: 1417
      },
      {
        title: "Meetings 插件：记笔记，也记下一步",
        url: "https://x.com/thsottiaux/status/2107573405553938664",
        summary: "插件替你做会议记录，把个性化摘要和后续动作存进 ChatGPT Space；先在 macOS 桌面端的 Pro / Business 公测。",
        praise: 273,
        meh: 1536
      },
      {
        title: "更高 API 速率限制的门槛降低了",
        url: "https://x.com/thsottiaux/status/2107548725359104441",
        summary: "付费层级从五档减为三档：Build、Launch、Grow；最高的 Grow 累计付费满 $500 即可达到，此前需要 $1,000。",
        praise: 185,
        meh: 1635
      },
      {
        title: "所有登录用户可用 Auto-review",
        url: "https://x.com/thsottiaux/status/2107368734981517634",
        summary: "免费放开自动审查，是当天争议最大的一条。",
        praise: 2425,
        meh: 6596
      }
    ],
    reactions: { praise: 3345, meh: 840 },
    tags: ["API", "插件"],
    note: null
  },
  {
    day: 3,
    date: "2026-10-07",
    kinds: ["banked", "ship"],
    title: "给所有人发一张储备重置，再补两条",
    url: null,
    summary:
      "向所有账户发放一次可留存、按需使用的「储备重置」，到目前为止是 28 天里唯一一张。同日还上线了 Codex Cloud 的 Tailscale 连接和 GPT-6 / Intelligent UI 更新。",
    quote: "Confirmed landed across all accounts. How are we doing so far?",
    quoteZh: "已确认在所有账户落地。到目前为止我们做得怎么样？",
    items: [
      {
        title: "Codex Cloud 支持通过 Tailscale 连接",
        url: "https://x.com/thsottiaux/status/2108084615349170480",
        summary: "Codex Cloud 可以安全地连上你 tailnet 里的资源。",
        praise: 526,
        meh: 1424
      },
      {
        title: "GPT-6 更新与 Intelligent UI",
        url: "https://x.com/thsottiaux/status/2107912709715132482",
        summary: "新版 GPT-6 与 Intelligent UI 向所有 ChatGPT 用户铺开，回答变得可视化、可交互，并能直接调用工具。",
        praise: 2800,
        meh: 553
      }
    ],
    reactions: { praise: 3395, meh: 112 },
    tags: ["储备重置", "Cloud"],
    note: null
  },
  {
    day: 4,
    date: "2026-10-08",
    kinds: ["ship"],
    title: "即时纠偏，以及 GPT-6.1 Sol ultrafast",
    url: "https://x.com/thsottiaux/status/2108275041276420573",
    summary:
      "模型开始即时响应用户的方向调整，可以在任务中途实时纠正；GPT-6.1 Sol ultrafast 同时在 API、Codex 和 ChatGPT Work 铺开。",
    quote: null,
    quoteZh: null,
    items: [],
    reactions: { praise: 1202, meh: 3411 },
    tags: ["速度", "交互"],
    note: null
  },
  {
    day: 5,
    date: "2026-10-09",
    kinds: ["ship"],
    title: "三条：Devin 接入套餐、Dots 派活、输入预测",
    url: null,
    summary:
      "个人 ChatGPT 套餐可以接到 Devin 上；dot 现在能启动并跟进 Codex 工作、编辑 ChatGPT Work 里的计划任务；Codex 桌面端开始内测输入预测。三条的互动都不算好看。",
    quote: null,
    quoteZh: null,
    items: [
      {
        title: "ChatGPT 套餐可用于 Devin",
        url: "https://x.com/thsottiaux/status/2108777962053292398",
        summary: "个人 Go / Plus / Pro 套餐可以连到 Devin，GPT 模型用量从 ChatGPT 套餐额度里扣。",
        praise: 147,
        meh: 2699
      },
      {
        title: "Dots 可委派 Codex 工作、编辑计划任务",
        url: "https://x.com/thsottiaux/status/2108773703064657936",
        summary: "dot 会结合对话、Codex 线程和自动化的上下文去启动并跟进 Codex 任务，也能查看和编辑计划任务。",
        praise: 491,
        meh: 1985
      },
      {
        title: "Codex 桌面应用新增输入预测",
        url: "https://x.com/thsottiaux/status/2108645667451318747",
        summary: "Pro 用户可内测：根据对话内容和你跟 Codex 的说话方式，提示下一条消息，且不消耗套餐用量。",
        praise: 788,
        meh: 3933
      }
    ],
    reactions: null,
    tags: ["生态", "Codex"],
    note: null
  },
  {
    day: 6,
    date: "2026-10-10",
    kinds: ["reset"],
    title: "重置入袋",
    url: "https://x.com/thsottiaux/status/2109132167112782291",
    summary: "一句话，一次全量重置。当天 2,119 次鼓掌，125 次无感。",
    quote: "Put the reset in the bag. All propagated.",
    quoteZh: "把重置收入囊中。已经全部生效。",
    items: [],
    reactions: { praise: 2119, meh: 125 },
    tags: ["重置"],
    note: null
  },
  {
    day: 7,
    date: "2026-10-11",
    kinds: ["ship"],
    title: "GPT-6.1 Sol 默认上下文 272k → 500k",
    url: "https://x.com/thsottiaux/status/2109430343346581527",
    summary:
      "Codex 与 Work 里 GPT-6.1 Sol 的默认上下文接近翻倍，长任务里少触发压缩、少丢上下文。当天 3,100 次鼓掌，是发布类记录里最受欢迎的一条。",
    quote: null,
    quoteZh: null,
    items: [],
    reactions: { praise: 3100, meh: 1034 },
    tags: ["上下文"],
    note: null
  },
  {
    day: 8,
    date: "2026-10-12",
    kinds: ["reset"],
    title: "「配菜是重置」",
    url: "https://x.com/thsottiaux/status/2109873287853707513",
    summary: "发布类记录连续两天之后，第 8 天回到重置。",
    quote: "What would you like with your side of reset? It's done.",
    quoteZh: "你的重置想配点什么？已经搞定了。",
    items: [],
    reactions: { praise: 2168, meh: 254 },
    tags: ["重置"],
    note: null
  },
  {
    day: 9,
    date: "2026-10-13",
    kinds: ["ship"],
    title: "桌面端磁盘占用减少约 60%",
    url: "https://x.com/thsottiaux/status/2110151690641154499",
    summary:
      "ChatGPT 与 Codex 桌面应用做了存储优化，官方预计状态数据占用的磁盘空间下降约 60%。鼓掌比例 39%，无感 2,597 票。",
    quote: null,
    quoteZh: null,
    items: [],
    reactions: { praise: 1626, meh: 2597 },
    tags: ["桌面端"],
    note: null
  },
  {
    day: 10,
    date: "2026-10-14",
    kinds: ["reset"],
    title: "彻底搞定",
    url: "https://x.com/thsottiaux/status/2110618732666257557",
    summary: "当天两次发文确认重置，还顺手辟了个谣：重置按钮没有丢。",
    quote: "Done and dusted",
    quoteZh: "彻底搞定。",
    items: [
      {
        title: "「重置按钮丢了」的传闻言过其实",
        url: "https://x.com/thsottiaux/status/2110595484180214059",
        summary: "第 10 天 / 重置。",
        praise: null,
        meh: null
      }
    ],
    reactions: { praise: 1776, meh: 222 },
    tags: ["重置"],
    note: null
  },
  {
    day: 11,
    date: "2026-10-15",
    kinds: ["ship"],
    title: "减少「模型满容量」报错",
    url: "https://x.com/thsottiaux/status/2110750421367287996",
    summary:
      "增加算力并上线一批改动，目标是显著降低「Selected model is at capacity」的出现频率；即便出现，也应该自行恢复而不是一直卡住。社区反应冷淡，25% 鼓掌。",
    quote: null,
    quoteZh: null,
    items: [],
    reactions: { praise: 912, meh: 2724 },
    tags: ["稳定性"],
    note: null
  },
  {
    day: 12,
    date: "2026-10-16",
    kinds: ["ship"],
    title: "一天四条：缓存、并行智能体、Dots、幻灯片",
    url: null,
    summary: "28 天里最密集的一天：缓存优化、并行智能体、Dots 上主屏、Space 幻灯片。缓存那条当天最受欢迎，88% 鼓掌。",
    quote: null,
    quoteZh: null,
    items: [
      {
        title: "跨子代理复用上下文，提高缓存命中",
        url: "https://x.com/thsottiaux/status/2111244596131111253",
        summary: "在子代理之间复用上下文、延长缓存时间、优化请求路由，让同样的额度干更多活。",
        praise: 2438,
        meh: 335
      },
      {
        title: "GPT-6 Astra Pro 支持并行智能体",
        url: "https://x.com/thsottiaux/status/2111244957851984181",
        summary: "响应更快、插件与工具调用更好，多个智能体可并行处理任务，在 Chat 标签页里逐个看进度。",
        praise: 1058,
        meh: 1152
      },
      {
        title: "Dots 上主屏",
        url: "https://x.com/thsottiaux/status/2111245052513259606",
        summary: "更新应用后，dot 直接放在主屏幕上。",
        praise: 185,
        meh: 2101
      },
      {
        title: "ChatGPT Space 支持幻灯片",
        url: "https://x.com/thsottiaux/status/2111249810502353152",
        summary: "Pro、Business、Enterprise 用户可以在 Space 里用幻灯片。",
        praise: 232,
        meh: 2048
      }
    ],
    reactions: null,
    tags: ["缓存", "并行"],
    note: null
  },
  {
    day: 13,
    date: "2026-10-17",
    kinds: ["reset"],
    title: "重置，两次",
    url: "https://x.com/thsottiaux/status/2111566005684289735",
    summary: "上午一条「第 13 天 / 额度重置」，下午一句「Done」。当天 2,163 次鼓掌，218 次无感。",
    quote: "Done",
    quoteZh: "完成了。",
    items: [
      {
        title: "第 13 天 / 额度重置",
        url: "https://x.com/thsottiaux/status/2111492673890824348",
        summary: "配图确认，全部账户生效。",
        praise: null,
        meh: null
      }
    ],
    reactions: { praise: 2163, meh: 218 },
    tags: ["重置"],
    note: null
  },
  {
    day: 14,
    date: "2026-10-18",
    kinds: ["ship"],
    title: "桌面端可以编辑历史消息",
    url: "https://x.com/thsottiaux/status/2111990254408434095",
    summary:
      "桌面应用支持在会话内编辑此前发出的消息。功能本身是「早该有」，但当天 89% 的互动是「无感」，是 28 天里最不受欢迎的一条发布。",
    quote: null,
    quoteZh: null,
    items: [],
    reactions: { praise: 423, meh: 3521 },
    tags: ["桌面端"],
    note: null
  },
  {
    day: 15,
    date: "2026-10-19",
    kinds: ["reset", "ship"],
    title: "先重置，再上线《Cooked》",
    url: null,
    summary:
      "一句「还在做，然后重置」先把额度放了，同一天 Codex 的新节目《Cooked》上线。两条都算数，但社区当天想要的就是前者。",
    quote: "Day 15/ Nevermind, we're still cooking... and reset. Enjoy.",
    quoteZh: "第 15 天 / 算了，我们还在做菜……然后重置。请慢用。",
    items: [
      {
        title: "Codex 新节目《Cooked》上线",
        url: "https://x.com/thsottiaux/status/2112268918681485431",
        summary: "第 15 天的另一半：一档新节目。",
        praise: null,
        meh: null
      }
    ],
    reactions: { praise: 1481, meh: 172 },
    tags: ["重置", "内容"],
    note: null
  },
  {
    day: 16,
    date: "2026-10-20",
    kinds: ["ship"],
    title: "Codex 与 Work 支持持久缓存",
    url: "https://x.com/thsottiaux/status/2112712984644784534",
    summary:
      "登录用户的缓存不再过期：隔几天回到旧对话也能命中，而且保证命中；API 侧同步支持 12 小时提示词缓存。又是「同样的额度更经用」这条线上的改动。",
    quote: null,
    quoteZh: null,
    items: [],
    reactions: { praise: 2191, meh: 152 },
    tags: ["缓存", "成本"],
    note: null
  }
];
