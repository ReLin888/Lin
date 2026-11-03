# Dear My Love Builder

本地 Cordis Host 插件，用来安全地检查和维护 `Dear, My Love` 的 Vite 多页网站项目。

- 插件包名：`@local/dear-my-love-builder`
- 版本：`1.2.0`
- 本地完整路径：`D:\Lin\DeepSeek\ReLin\plugins\dear-my-love-builder`
- 已验证环境：DeepSeek Harness `44.7.0`（Desktop profile `desktop`，Cordis `4.0.5`）
- 项目目录：`D:\Lin\DeepSeek\ReLin`
- 网站构建：Vite `8.3.5`
- 网络行为：安装依赖时只访问 npm registry；不读取私人目录，不上传项目内容
- 自动发布：无

## 当前安装状态

已通过官方 `plugin_manager` 的 `install_bundle` 安装到 `desktop` profile。插件入口是一个 Agent 工具：

```text
dear_my_love_builder
```

它不是通用文件编辑器、Shell 或浏览器。通用页面创建和任意文件编辑继续使用 Harness 已有的 `read` / `write` / `edit` 工具；本插件只负责站点领域内的结构化检查、配置、受控文本替换和固定构建命令。

## 功能

### 检查与审计

| action | 作用 |
| --- | --- |
| `status` | 项目目录、必需文件、配置、照片、Vite 依赖和 dist 状态 |
| `audit` / `build_check` | 综合静态检查：结构、配置、照片、链接、JS、CSS、Vite、部署 |
| `vite_check` | `package.json`、`vite.config.js`、8 个 HTML 入口、构建包装器、dist |
| `theme_audit` | 奶油白 / 樱花粉 token、中文回退字体、三列照片墙、对比度 |
| `mobile_audit` | viewport、断点、触控目标、减少动态效果 |
| `deploy_check` | GitHub Pages、Netlify、Vercel 配置与 `dist` 产物 |
| `read_config` | 读取 `assets/js/config.js` |
| `list_photos` | 列出照片墙照片 |
| `read_page` | 读取受控文件键对应的页面/样式/脚本 |

### 配置与内容

| action | 作用 |
| --- | --- |
| `update_site` | 站点名、她的名字、署名、感情状态等 |
| `set_dates` | 纪念日和生日 |
| `add_photo` / `update_photo` / `remove_photo` / `move_photo` | 管理 `config.photos` |
| `update_music` | 曲名、说明、音量、本地音频路径 |
| `add_love_note` / `remove_love_note` | 管理和十连击彩蛋相关的情话池 |
| `set_easter_egg` | 彩蛋标题、正文、阈值、兑换券 |
| `replace_text` | 在受控页面/样式/脚本中做精确文本替换 |

### Vite 构建

| action | 作用 |
| --- | --- |
| `install_deps` | 先展示预览，再运行固定命令 `pnpm install`；只允许 `vite` 依赖 |
| `vite_build` | 先展示预览，再运行固定命令 `pnpm run build`，检查 `dist/` |

当前机器没有独立 `npm` 可执行文件，Harness 自带的是 Node + pnpm。因此构建操作使用 **pnpm** 执行 `package.json` 中与 `npm run build` 等价的脚本；在普通 GitHub Actions / Vercel / Netlify 环境中仍使用标准 `npm install` / `npm run build`。

## 安全模型

1. **项目围栏**：`projectDir` 固定为 `D:/Lin/DeepSeek/ReLin`；所有路径经 `ctx.fs.contains(root, target)` 校验。
2. **先预览**：任何 mutations 不传 `confirm` 都只返回预览，不写文件、不启动安装/构建。
3. **原生审批**：传 `confirm: true` 后还会调用 DSH `approval` 服务；只有 `allowed-once` 才执行。
4. **版本保护**：文件写入使用读取时的 `FsVersion` 做 `replaceIfVersion`。
5. **没有删除文件 API**：`remove_photo` 只移除配置项，不删除原图。
6. **依赖白名单**：`install_deps` 只允许 `vite`；出现其他依赖时拒绝执行。
7. **固定构建命令**：`vite_build` 只运行 `pnpm run build`，不接受任意 shell 字符串。
8. **无自动发布**：不调用 GitHub、Vercel、Netlify 的发布 API。

## 安装

官方方式：

```text
plugin_manager action=install_bundle
target=D:\Lin\DeepSeek\ReLin\plugins\dear-my-love-builder
```

不要手动写 profile 的 `package.json` 或 `cordis.patch.yml`。更新本地插件源码后，通常需要让 Harness 重新加载插件或重启 Desktop，才能让新的 Host 代码生效。

## 验证

只读检查可以直接调用：

```json
{ "action": "status" }
{ "action": "vite_check" }
{ "action": "build_check" }
{ "action": "theme_audit" }
{ "action": "deploy_check" }
{ "action": "mobile_audit" }
```

安装/构建先预览：

```json
{ "action": "install_deps" }
{ "action": "vite_build" }
```

`confirm` 省略时返回 `confirmation_required`，不会执行。用户明确同意后，才可传：

```json
{ "action": "vite_build", "confirm": true }
```

并会额外出现 DSH 原生审批。

本地 bundle 自检：

```powershell
& 'C:\Users\Lin\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe' .\scripts\validate.mjs
```

## 已验证 / 未验证

已验证：

- 插件 bundle 安装结果为 `application: applied`
- 工具 `dear_my_love_builder` 出现在当前 Agent 的 Tool 列表中
- 实际运行 `status`、`build_check`、`vite_check`、`theme_audit`、`deploy_check`、`mobile_audit` 均通过
- `install_deps` / `vite_build` 的未确认预览不会修改任何文件
- 实际调用 `vite_build` 并确认后，Host 的原生审批链路通过，固定命令 `pnpm run build` 退出码为 `0`
- Vite 构建产物 `dist/` 已生成，包含 8 个页面、经典脚本副本和 `.nojekyll`

未验证：

- 插件在 Plugin Manager 中的实际图标/排版（当前无浏览器页面控制）
- 真实手机触摸和浏览器音频播放
- 远程 GitHub Pages / Vercel / Netlify 的实际发布（用户未授权发布，插件也不会自动发布）

## 尚未完成的功能

- 没有内建可视化页面编辑器。新建页面请用 Harness 原生 `write`，插件负责结构、Vite 入口和构建检查。
- 没有自动发布按钮。部署配置只做静态检查，实际发布由用户在 GitHub/Vercel/Netlify 点击完成。
- 没有真实浏览器截图能力。
