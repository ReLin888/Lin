# Dear, My Love

一个写给「未来女朋友」的恋爱纪念网站。奶油白 + 樱花粉，Vite 多页构建 + HTML/CSS/JavaScript；开发时用 Vite，构建产物仍是可直接托管的静态文件。

共 8 个页面：首页、关于我、照片墙、纪念日、一起做的事、猜猜我、情书和 404。除了读与看，也可以点、勾、答和留下只存在本机的回信。

> 在遇见你之前，我先建好了这座小小的宇宙。

## 预览

本地预览：

```powershell
npm install
npm run dev
```

打开终端里 Vite 打印的地址（默认 <http://127.0.0.1:5173>）。

生产构建：

```powershell
npm run build
npm run preview
```

构建产物在 `dist/`。

当前这台机器没有独立的 `npm` 命令，Harness 自带 Node + pnpm。可以在项目目录用等价命令：

```powershell
pnpm install
pnpm run dev
pnpm run build
```

页面本身仍是经典 HTML/CSS/JS，也可以直接双击 `index.html` 预览；Vite 只是开发和构建入口。

项目里也包含一个本地 Cordis 插件 `plugins/dear-my-love-builder`，用来检查、配置和维护这个网站。**部署网站时不需要带上 `plugins/` 目录**，下面的部署配置已经处理好了。

## 页面

| 页面 | 文件 | 内容 |
| --- | --- | --- |
| 首页 | `index.html` | 主视觉、爱心点击小游戏、隐藏十连击彩蛋、照片墙预览、纪念日入口、一起做的事 / 猜猜我入口、情书入口 |
| 关于我 | `about.html` | 一张手写名片、十个关于我的小事、喜欢与不喜欢、我的一天、三件答应你的事 |
| 照片墙 | `gallery.html` | 三列照片墙、分类筛选、灯箱浏览、留白相框 |
| 纪念日 | `days.html` | 纪念日/生日倒计时、日期占位、每日情话、未来第一次清单、纪念日动画预览 |
| 一起做的事 | `wishlist.html` | 三十件小事清单、分类筛选、随机抽一件、自己加心愿、完成庆祝、进度保存在本机 |
| 猜猜我 | `quiz.html` | 七道关于我的题、即时对错反馈、成绩分层、最佳成绩保存在本机 |
| 情书 | `letter.html` | 火漆信封、三封可切换的信、键盘操作、只保存在本机的回信 |
| 404 | `404.html` | 走丢时的心形提示页 |

## 目录结构

```text
ReLin/
├─ index.html
├─ about.html
├─ gallery.html
├─ days.html
├─ wishlist.html
├─ quiz.html
├─ letter.html
├─ 404.html
├─ package.json              ← Vite / npm 脚本
├─ vite.config.js            ← 8 页入口、base: './'、dist
├─ scripts/
│  ├─ vite-dev.mjs          ← 沙箱安全的 Vite 开发服务器
│  └─ vite-build.mjs        ← 沙箱安全的 Vite 构建包装器
├─ vercel.json
├─ netlify.toml
├─ assets/
│  ├─ css/styles.css
│  ├─ js/
│  │  ├─ config.js       ← 只改这个文件就能换资料
│  │  ├─ site.js         ← 公共交互、花瓣、照片墙、灯箱、纪念日特效
│  │  ├─ music.js        ← 背景音乐播放器 + Web Audio 音乐盒
│  │  ├─ home.js         ← 爱心游戏与十连击彩蛋
│  │  ├─ about.js        ← 关于我页面的资料渲染
│  │  ├─ gallery.js      ← 照片分类
│  │  ├─ days.js         ← 倒计时、日历、每日情话
│  │  ├─ wishlist.js     ← 心愿清单、筛选、随机、自定义与进度
│  │  ├─ quiz.js         ← 答题流程、即时反馈与最佳成绩
│  │  └─ letter.js       ← 信封、信件切换、回信
│  ├─ images/            ← 9 张原创 SVG 占位画 + favicon + 纸张噪点
│  └─ audio/             ← 想放自己的歌，就放这里
├─ plugins/
│  └─ dear-my-love-builder/   ← 本地 Cordis 插件（不参与部署）
├─ .github/workflows/deploy.yml
├─ .vercelignore
├─ .nojekyll
└─ README.md
```

## 个性化配置

主要修改 `assets/js/config.js`。

### 1. 网站资料

```js
site: {
  name: "Dear, My Love",
  chineseName: "写给未来的你",
  herName: "",                    // 有女朋友后填她的名字
  signature: "爱你的男孩",         // 情书和彩蛋落款
  status: "未来女朋友",
  anniversary: null,              // "2026-05-20" 或 null
  birthday: null,                 // "1999-08-18" 或 null
  timezone: "Asia/Shanghai",
  letterDate: ""                  // 留空显示 20__ · 某一天
}
```

`herName` 留空时页面会继续使用「未来的你」，不会出现 `undefined`。

### 2. 关于我

`about` 控制「关于我」整页的内容：

```js
about: {
  monogram: "D.",
  name: "一个提前喜欢你的人",
  role: "在等你的人",
  location: "一座会下雨的城市",
  status: "单身 · 不接受插队",
  cardNote: "这张卡片在你出现之前，一直有效。",
  cardSign: "See you soon.",
  intro: ["第一段，会使用首字下沉。", "第二段。", "第三段。"],
  facts: [
    {
      title: "我喝水只喝温的",
      en: "Room temperature, always",
      note: "冰的会胃疼，烫的会着急。温的刚刚好，像我等你那样。"
    }
  ],
  likes: ["雨天的窗边", "旧书店的味道"],
  dislikes: ["突然的失联"],
  day: [
    { time: "07:20", title: "起床，先喝一杯温水", note: "闹钟响三遍，最后一遍才起。" }
  ],
  promises: [
    { title: "我会认真听你说话", note: "不打断，也不急着给建议。先让你说完。" }
  ],
  closing: "写这些的时候其实有点紧张……",
  signature: "—— 一个提前喜欢你的人"
}
```

- 默认是 10 条 `facts`、6 条 `likes`、6 条 `dislikes`、5 条 `day`、3 条 `promises`。
- 数量可以增减，页面会按条目数自动排版；删到 0 条时对应区域会留白。
- `intro` 的每一段都会渲染成一段正文，第一段带首字下沉。

### 3. 一起做的事

```js
wishlist: {
  items: [
    {
      text: "一起逛一次超市，买一周的菜",
      note: "推一辆车，你挑零食，我挑菜。",
      tag: "日常"
    }
  ]
}
```

- `tag` 只能是 `日常` / `远方` / `仪式感` / `有点傻`，写了其他值会自动归到「日常」。
- 勾选进度、自己添加的心愿都只保存在浏览器 localStorage；「清空全部勾选」不会删除自己写的心愿。
- 想换一批清单，直接替换 `items`。如果旧勾选记录对不上，清空一次进度即可。

### 4. 猜猜我

```js
quiz: {
  questions: [
    {
      question: "我喝水，一般要什么温度？",
      options: ["冰的", "温的", "烫的", "都可以"],
      answer: 1,
      note: "冰的会胃疼，烫的会着急。温的刚刚好，像我等你那样。"
    }
  ],
  results: [
    { min: 7, title: "你是不是偷看了答案？", text: "全对。……" },
    { min: 5, title: "像是认识了很久。", text: "大部分答案你都猜对了。……" },
    { min: 3, title: "有一点点眼缘。", text: "答对了一半。……" },
    { min: 0, title: "我们从零开始，正好。", text: "几乎全军覆没也没关系。……" }
  ]
}
```

- `answer` 是正确选项的下标，从 0 开始；选项数量不限于 4 个。
- `results` 会按 `min` 从高到低匹配，达到哪一档就显示哪一档的标题和文案。
- 最佳成绩只保存在本机，键名 `dml:quiz:best:v1`，不会上传。

### 5. 照片墙

照片墙由 `config.photos` 渲染：

```js
{
  src: "assets/images/your-photo.jpg",
  alt: "一句给视障用户和搜索引擎看的描述",
  title: "这张照片的名字",
  note: "照片下面的一两句说明",
  meta: "SOMEDAY · 春日",
  ratio: "4 / 5",
  tag: "日常" // 风景 / 日常 / 我们
}
```

替换步骤：

1. 把照片放进 `assets/images/`（建议宽度 1200px 以内，压缩到 300KB 左右）。
2. 在 `config.photos` 里替换或增加条目。
3. `ratio` 写照片的宽高比，例如 `4 / 5`、`4 / 3`、`1 / 1`。
4. 至少保留 6 张，首页和照片墙会更好看。

当前的 9 张图是专门为这个项目画的 SVG 占位画，可以保留，也可以逐步换成你们自己的照片。

### 6. 纪念日和生日

把 `anniversary` / `birthday` 写成 `"YYYY-MM-DD"`：

```js
anniversary: "2026-05-20",
birthday: "2000-10-01"
```

- 所有日期计算固定使用 `Asia/Shanghai`（UTC+08:00），不受访客本地时区影响。
- 首页和纪念日页会自动计算在一起的天数、下一次纪念日和生日倒计时。
- 纪念日当天打开 `days.html`，会自动播放一次纪念日动画（同一标签页/同一天一次）。
- 如果生日是 `2 月 29 日`，非闰年的处理规则需要先确认；系统默认不替用户选择 `2 月 28 日` 或 `3 月 1 日`。
- 还没确定就保持 `null`，页面会显示优雅的占位和「预览心动时刻」按钮。

### 7. 背景音乐

默认使用 **Web Audio 实时生成的音乐盒**，不需要任何音频文件，也没有版权问题。

想换成自己的歌：

1. 把 mp3/wav/ogg 放进 `assets/audio/`，例如 `assets/audio/our-song.mp3`。
2. 修改：

```js
music: {
  title: "Our Song",
  subtitle: "第一次一起听的那首",
  audioFile: "assets/audio/our-song.mp3",
  volume: 0.34
}
```

如果文件加载失败，会自动回退到内置音乐盒。浏览器不允许自动播放，需要访客点右下角的唱片按钮。

### 8. 情话和彩蛋

`site.loveNotes` 是纪念日页的「每日情话」池：

```js
loveNotes: [
  "我还没有遇见你，但已经开始练习，怎么把一个人放进未来里。",
  "想把所有普通的日子，都过成和你有关的日子。"
]
```

`site.easterEgg` 控制首页隐藏彩蛋：

```js
easterEgg: {
  enabled: true,
  threshold: 10,
  title: "被你发现了。",
  intro: "……",
  coupons: [
    { text: "一次不计理由的拥抱", note: "No reason needed" }
  ],
  signature: "—— 一个提前喜欢你的人"
}
```

默认是连续点击爱心 10 次触发。用插件修改时会自动写入这些字段。

### 9. 情书

三封信写在 `letter.html` 里，直接搜索 `Letter 01` / `Letter 02` / `Letter 03` 就能找到正文。改完后记得让文字的语气像你自己，不必追求漂亮，真诚更重要。

回信只保存在浏览器 `localStorage`，不会上传到服务器。

## 功能清单

- 爱心点击小游戏：每次点击产生爱心粒子、轻音和心动值进度。
- 隐藏十连击彩蛋：连续点击 10 次（可在配置里改阈值）解锁三张「未来兑换券」。
- 关于我：手写名片、十个关于我的小事、喜欢与不喜欢、我的一天、三件答应你的事，全部由 `config.about` 渲染。
- 一起做的事：三十件小事、分类筛选、随机抽一件、自己加心愿、全部完成时的小庆祝；勾选和自定义心愿只保存在本机。
- 猜猜我：七道关于我的题，选择后立即判题并解释，按分数给出不同结果，最佳成绩只保存在本机。
- 三列照片墙：桌面 3 列、平板 2 列、手机 1 列；分类筛选 + 灯箱 + 键盘方向键。
- 背景音乐：默认原创 Web Audio 音乐盒，可换成本地 mp3。
- 专属情书：火漆信封开启动画、三封信切换、页内回信。
- 纪念日动画：花瓣、彩纸、日期卡、倒计时预览。
- 响应式：`clamp()` 流式排版、移动端菜单、触控友好的按钮。
- 无障碍：跳转链接、键盘操作、焦点样式、`prefers-reduced-motion`。
- Vite 多页构建（8 个 HTML 入口），`base: './'`，构建产物兼容 GitHub Pages 子路径。
- 无追踪、无后端；运行时没有第三方脚本或 CDN 请求。

## 免费部署

### 方案 A：GitHub Pages（推荐）

1. 新建一个 GitHub 仓库，例如 `dear-my-love`。
2. 把本站文件推送到仓库（`plugins/` 可以一起提交，但不会被部署）。
3. 打开仓库 **Settings → Pages → Build and deployment → Source: GitHub Actions**。
4. 推送后，`.github/workflows/deploy.yml` 会自动执行 `npm install`、`npm run build`，只上传 Vite 的 `dist/` 产物；`plugins/` 不会进入构建。
5. 部署完成后得到免费地址：`https://你的用户名.github.io/dear-my-love/`。

工作流已经写好，不需要改。`vite.config.js` 使用 `base: './'`，所以部署在仓库子路径也能正常工作。

### 方案 B：Vercel

1. 把仓库导入 Vercel。
2. Vercel 会识别 Vite；`vercel.json` 已指定 `npm run build` 和 `dist`。
3. 部署。`.vercelignore` 会排除 `plugins/`、`node_modules` 和本地 pnpm store。
4. 得到 `https://your-project.vercel.app`。

### 方案 C：Netlify / Cloudflare Pages

仓库里的 `netlify.toml` 已经配置：

```text
npm install && npm run build
publish = "dist"
```

- Netlify：导入仓库即可。
- Cloudflare Pages：Build command 填 `npm install && npm run build`，Build output 填 `dist`。

如果不想折腾，可以先在本地执行 `npm run build`，再把 `dist/` 拖到 Netlify Drop 或 Cloudflare Pages 的 Direct Upload。

### 之后绑定专属域名

1. 在域名服务商买一个域名（例如 `dearmylove.com`）。
2. 在托管平台添加自定义域名：
   - GitHub Pages：Settings → Pages → Custom domain。
   - Vercel / Netlify / Cloudflare：Domains → Add domain。
3. 按平台提示配置 DNS：
   - 根域名通常添加 4 条 A 记录（GitHub Pages 的 A 记录地址以官方文档为准）或使用平台提供的 ALIAS/ANAME。
   - `www` 子域名通常添加 CNAME 指向 `你的用户名.github.io` 或平台域名。
4. 等待 DNS 生效，平台会自动签发 HTTPS。
5. 建议同时把根域名和 `www` 都指向站点，并在平台里设置主域名跳转。

绑定域名后，可以顺手更新每页 `<meta property="og:image">` 为完整 HTTPS 地址，分享时的预览会更稳定。

## 部署前检查

```powershell
# 1. 安装依赖并构建
npm install
npm run build

# 2. 预览生产构建
npm run preview
```

2. 检查控制台没有报错，手机宽度（DevTools 375px）没有横向滚动。
3. 点一次音乐按钮、点十次爱心、打开三封信、切换照片分类。
4. 打开「关于我」看资料是否渲染完整；在「一起做的事」勾几条、加一条自己的心愿，刷新确认还在；在「猜猜我」答一轮，刷新确认最佳成绩还在。
5. 如果用 Cordis 插件，让 Agent 运行：

```json
{ "action": "vite_check" }
{ "action": "build_check" }
{ "action": "deploy_check" }
```

## 隐私与版权

- 没有后端、没有统计脚本、没有第三方字体或 CDN 请求。
- 回信、清单进度与自定义心愿、答题最佳成绩、音乐音量、彩蛋状态只存在浏览器本地，不会上传。
- 9 张占位画为项目内原创 SVG；换成你们自己的照片前，请确认你有使用权。
- 背景音乐默认由 Web Audio 即时合成，不包含任何第三方录音。

## 本地 Cordis 插件

路径：`plugins/dear-my-love-builder`

版本 `1.2.0`，提供 `dear_my_love_builder` 工具：

- 项目结构、8 页 Vite 入口、主题、移动端和部署配置检查
- 照片墙、纪念日/生日、情话/彩蛋、背景音乐管理
- 关于我 / 一起做的事 / 猜猜我页面的受控文本替换
- `install_deps` / `vite_build`（预览 + DSH 原生审批后执行）
- 不自动发布，不读取无关私人目录

安装与验证说明见：`plugins/dear-my-love-builder/README.md`。
