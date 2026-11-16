# PR #1 改动说明

本PR由协作者（lambert1829，Claude辅助编写）提交，基于main分支 `c99bd49`（学习中心、复习与离线功能集成）。已合并main，GitHub显示可直接合并；另已确认与你的 `codex/structure-workspace` 分支（`b6429ec`，统一学习档案导出）也能自动合并、没有冲突。全部改动共142个文件：新增129个，修改13个，没有删除任何文件。

## 一、改动概览

| 编号 | 内容 | 主要文件 | 对现有代码的影响 |
|---|---|---|---|
| 1 | K01—K08补充讲义接入应用 | `scripts/import_enrichment.py`、`data/enrichment.json`、`app/main.py`、`knowledge-map.js` | 知识接口多一个字段，详情面板多一个折叠区 |
| 2 | 新编K09—K30共22篇补充讲义 | `知识库补充草稿/K09.md`—`K30.md`、`content_assets/` | 只新增内容文件 |
| 3 | R输出一键核对脚本 | `scripts/check_r_outputs.py` | 新增脚本，不影响运行 |
| 4 | 回答反馈与质量看板 | `static/answer-feedback.js`、`answer-feedback.css` | `app.js` 增加3行调用 |
| 5 | 复习题库新增30道变式题 | `static/review-bank.json` | 题库从94题增至124题 |
| 6 | 答辩演示模式 | `static/demo-mode.js`、`demo-mode.css` | `app.js` 增加约15行调用 |
| 7 | 终端风格代码块 | `static/code-terminal.js`、`code-terminal.css` | `app.js` 增加1行动态导入，`codeBlock()` 不变 |
| 8 | 首页星座背景与数据指标带 | `static/hero-fx.js`、`hero-fx.css`、`app/main.py` | `/api/health` 的 `counts` 新增 `supplements` |
| 9 | macOS / Linux 启动脚本 | `setup.command`、`start.command`、`stop.command` | 只新增文件 |
| 10 | 合并main并解决冲突 | `app.js`、`knowledge-map.js`、`index.html`、`bootstrap.js`、`.gitignore` | 两边功能都保留 |

## 二、各项详细说明

### 1. 补充讲义接入应用

**为什么做：** `知识库补充草稿/K01—K08.md` 和 `content_assets/` 中的例题、图解已经写好，但应用没有读取它们，学生在知识地图里看不到这些内容。

**怎么做：**

- 新增 `scripts/import_enrichment.py`。脚本读取草稿，按代码块之外的二级标题拆分章节，并把“基本信息”中的难度、先修知识、验证状态整理为元数据，结果写入 `data/enrichment.json`。“追问建议”章节不在页面显示。
- 导入时会做以下检查，有问题就中止并列出原因：
  - 缺少必填章节（学习目标、直观理解、基础例题、易错案例、完整练习）。
  - 引用的代码或图片文件不存在。
  - 知识编号不在 `course.json` 中。
  - 链接文字或图片描述中含方括号，导致链接断开。
- 讲义中的资源链接改写为 `/content/code/…` 和 `/content/images/…`。课程PDF不对外提供，PDF链接只保留引用文字。
- `app/engine.py` 启动时加载 `enrichment.json`。文件不存在时视为没有讲义，不报错。
- `app/main.py` 有两处改动：
  - `GET /api/knowledge/{id}` 增加 `enrichment` 字段，没有讲义的知识点为 `null`，原有字段不变。
  - 新增只读路由 `/content/{code|images}/{文件名}`。文件名必须符合 `Kxx_名称.R/.txt/.svg` 格式，否则返回404，路径穿越也会被拒绝。`.R` 文件以UTF-8纯文本返回。该路由不出现在OpenAPI文档中，所以 `test_openapi_unchanged` 的接口数量不变。
- `app/ai/service.py`：真实AI模式下，给最相关的那一个知识点附加讲义片段，包括直观理解、为什么、易错案例，以及基础例题或完整练习。片段受原有20000字符预算约束。未实测的讲义会附上“待R实测”说明。系统提示词版本从 `r4` 升为 `r5`。
- `static/answer-markdown.js`：`markdownFragment()` 新增可选参数 `{localContent:true}`。只有课程讲义会传这个参数，它允许 `/content/` 下的链接和SVG图片；AI回答仍使用原来更严格的净化规则。
- `static/knowledge-map.js`：详情面板底部新增“深入学习”区，每个章节都可以折叠，默认展开“学习目标”和“直观理解”。

**怎么核对：** 打开知识地图，点开K06或K21，详情面板底部会出现“深入学习”。

### 2. K09—K30补充讲义

**内容：** 共22篇，覆盖“向量与字符串”（K09—K18）、“矩阵与数组”（K19—K24）和“数据框整理”（K25—K30）三个单元。每篇按《知识库补充清单与编写框架》编写：学习目标、先备检查、直观理解、为什么、基础例题、应用例题、图解、易错案例、完整练习、自测题、追问建议、来源与验证。每篇配套 `Kxx_example_01.R`、`Kxx_example_02.R`、`Kxx_exercise.R`（由草稿中的代码块自动导出，保证与草稿一致）和1张SVG图解。

**重要：这22篇的输出尚未在R中运行。** 编写环境没有R，预期输出是按R的打印规则推算的。为了尽量减少错误，做了以下处理：

- 基本信息中写明“验证状态为待R实测”，输出标题统一为“预期输出（待R实测）”。页面会提示“尚待R实测”，每个代码块带“未运行验证”标记。
- 与课程资料中已实测示例相同的代码，直接沿用课程记录的输出。涉及K09的抽样，以及K19、K20、K22、K23、K24的基础例题。
- 均值、标准差、分位数、奇异值、特征值等数值，用Python和NumPy独立计算核对。矩阵的打印排版按R的规则用程序生成，没有手工排空格。
- K22只打印取整后的特征值和容差检查结果，不打印特征向量本身，避免不同平台正负号翻转造成核对失败。
- K23的稀疏矩阵打印格式取自课程实测记录。如果Matrix包版本不同，格式可能略有差异，这一篇最可能需要调整。
- K25—K30的基础例题全部沿用课程实测代码与输出。其中K25的 `str()`、`summary()` 含R 4.6对字符列的新显示方式（N.unique等），只能照搬实测记录；K29实测记录首行的前导空格在导入时被去除，已按排版规则补回。
- 数据框打印（行名左对齐、各列右对齐、字符缺失显示 `<NA>`）用辅助程序生成。K27合并后先排序并重置行名，避免依赖 `merge()` 对重复键的内部顺序。

### 3. R输出一键核对脚本

`scripts/check_r_outputs.py` 用来把“待R实测”变成“已实测”：

- 逐段找出讲义中的R代码，以及它下方“预期输出”或“实际错误或异常结果”中的文本。
- 用 `Rscript --vanilla` 在英文提示、UTF-8环境中逐段运行代码。
- 普通输出逐行比对，忽略行尾空格。Error和Warning的换行方式因平台而异，所以只比对文字内容，其中 `...` 可作通配。
- 加 `--write` 时，全部通过的讲义会自动改为“已实测”，并生成 `Kxx_validation.txt` 核对记录。

用法见下文“三、需要你完成的事”。

### 4. 回答反馈与质量看板

**为什么做：** 作业要求成员四完成AI回答质量评价和用户试用反馈，目前缺少收集数据的途径。

- 每条AI回答和纠错结果下方显示“这条回答有帮助吗？”。用户可以选“有帮助”，或选“需改进”并勾选原因（讲解有误、没讲清楚、代码有问题、与问题无关、篇幅不合适）、填写补充说明，提交后可撤销。
- “更多 → 回答质量看板”展示好评率圆环、各类任务的好评情况、改进原因分布和最近的改进意见。
- 可导出CSV。文件带BOM，Excel可以直接打开中文；以 `=`、`+`、`-`、`@` 开头的单元格会加前缀，防止表格公式注入。
- 数据只保存在本浏览器的localStorage中，最多500条，不发送到服务器，也不包含在学习档案导出中。
- 模块通过动态 `import()` 加载。即使加载失败，回答照常显示。
- 新增单元测试：`node --test tests/answer_feedback_test.mjs`（3项）。

### 5. 复习题库新增30道变式题

**为什么做：** `learning-center.js` 规定，评为“熟练完成”需要答对一道变式题（`variantPassed`）。原题库只有8个知识点有变式题，其余知识点永远评不上“熟练”。

- 为K09—K24每个知识点的概念题和应用题各配一道选择型变式题。K10、K11原有概念变式，只补应用变式，共30道。
- 应用变式来自讲义的“预测输出”自测题，选用输出简单、确定的代码；概念变式来自讲义的易错案例和“为什么”。
- 正确选项的位置在第1、2、3项之间轮换。
- `sourceRefs` 指向 `成员三/知识库补充草稿/Kxx.md`，并注明“代码输出待R实测”。
- `tests/test_review_bank.py` 有两处改动：
  - 题目总数从94改为124。
  - “应用题代码必须与课程示例完全一致”这条规则改为只检查非变式题。变式题本来就应使用新代码，原题库中的概念变式也带有自己的代码。

已在浏览器中实测：复习K13时变式题正常出现，答对后显示“变式通过”，“熟练完成”可以选择并成功保存。

### 6. 答辩演示模式

- 入口：右上角“更多 → 答辩演示模式”，或打开 `http://127.0.0.1:8000/?demo` 自动进入。
- 共9步：首页 → 知识地图 → K21知识详情与深入学习 → AI问答 → 回答反馈 → 代码纠错 → 学习中心 → 回答质量看板 → 谢幕卡。
- 每一步自动完成页面操作，用发光边框标出讲解区域，底部面板显示讲解要点。
- 键盘操作兼容翻页笔：
  - → 或 PageDown：下一步。
  - ← 或 PageUp：上一步。
  - H：收起或展开面板。
  - Esc：退出。
  - 也可以点击进度条直接跳到某一步。
- 演示会真实发送两次问答（“NA和NaN有什么区别”和 `x[x == NA]` 纠错），并写入学习记录。如果已切换到真实模型，会调用该模型，答辩时建议保持模拟版。
- 为了让演示面板在看板上方仍然可以操作，`answer-feedback.js` 的 `openDashboard()` 增加了非模态打开选项。

### 7. 终端风格代码块

**为什么做：** 原来的代码块会在单词中间自动折行，长代码难以阅读，也没有语法高亮。

- 新增 `static/code-terminal.js`。它用 `MutationObserver` 监听页面，把每个 `.code-wrap pre` 升级一次，所以AI问答、代码纠错、讲义和学习中心里的代码块全部生效，`codeBlock()` 不需要修改。
- 外观：深色终端底色，标题栏带红黄绿三个圆点；R语法高亮，区分关键字、常量（`TRUE`、`NA` 等）、字符串、数字、函数调用、命名参数、运算符和注释；多行代码显示行号（CSS计数器生成，不会被复制）；长代码不再折行，改为横向滚动。
- 标签含“输出”的代码块按运行输出显示，带 `STDOUT` 标记，`Error` 行标红、`Warning` 行标橙。
- `<pre>` 的文本内容与原来完全一致，“复制代码”按钮和手动选中复制的都是原始代码，浏览器中已核对。
- 打印时自动切换为白底黑字。
- 新增单元测试：`node --test tests/code_terminal_test.mjs`（2项）。测试检查分词后拼回的文本与原文逐字相同，以及各类语法的识别是否正确。

### 8. 首页星座背景与数据指标带

- 新增 `static/hero-fx.js`，首页大标题背后加入画布动画：带连线的光点网络中漂浮着 `<-`、`%in%`、`NA` 等R符号，光点会随鼠标轻微靠近。标题离开屏幕或标签页隐藏时动画暂停；系统开启“减少动态效果”时只绘制静态画面。
- 大标题加入缓慢流动的蓝紫渐变光泽。
- 标题下方新增四个指标卡片：知识点、深入讲义、复习题、错误案例，数字在进入视野时滚动计数。数据全部实时读取，不写死：知识点、错误案例和讲义数量来自 `/api/health`，复习题数量来自 `review-bank.json`。某个数字读取失败时，对应卡片不显示。
- `app/main.py` 的 `/api/health` 在 `counts` 中新增 `supplements`（讲义数量）。原有字段不变，`test_api.py` 只检查 `mode` 和 `version`，不受影响。

### 9. macOS / Linux 脚本

`setup.command`、`start.command`、`stop.command` 分别对应现有的 `.cmd` 脚本，在Finder中双击或在终端执行即可：

- `setup.command`：查找Python 3.12或更新版本，创建虚拟环境。
- `start.command`：启动前检查8000端口是否被占用；启动后等待健康检查通过，macOS下会自动打开首页。
- `stop.command`：核对进程编号、启动时间和命令，三者一致才停止，不会误停其他进程。

已在Linux上验证启动、重复启动拦截、停止和重复停止，尚未在真实Mac上测试。

### 10. 合并main与冲突处理

合并 `c99bd49` 时有5个文件冲突，处理原则是两边功能都保留：

- `knowledge-map.js`：构造函数同时接收讲义渲染函数 `markdown` 和你新增的 `visit`、`enroll`、`bookmark`。详情面板里，讲义区与“加入复习”“收藏”按钮同时存在。
- `app.js`：保留你的 `courseApi` 离线回退，在其基础上传入 `markdown:renderCourseMarkdown`。
- `index.html`、`bootstrap.js`：采用你的版本，资源版本号统一为 `learning-v1`，保证Service Worker和相关测试不受影响。
- `.gitignore`：保留你的 `**/output/playwright/` 规则，另外增加忽略测试导出的XML文件。

`service-worker.js` 的 `ASSETS` 新增了8个文件（`answer-feedback`、`demo-mode`、`code-terminal`、`hero-fx` 各一组 `.js/.css`），满足 `test_pwa_assets.py` 的依赖清单检查。注意：资产列表长度变化后，用户已保存的旧离线包会被判定为不完整，需要在“设置与资料”中点击“更新离线资料”。

## 三、需要你完成的事

1. **运行完整测试。** 编写环境无法安装FastAPI，所以以下测试还没有跑过：`test_api`、`test_ai`、`test_pwa_assets` 等后端测试，`test_enrichment.py` 中4项接口相关测试，以及全部浏览器回归测试。已经通过的有：讲义导入与核对逻辑12项、题库3项、`learning_core_test.mjs` 13项、反馈3项、代码高亮2项。

   ```powershell
   .\.venv\Scripts\python.exe -m pytest -q
   node --test tests/answer_feedback_test.mjs tests/code_terminal_test.mjs
   node tests/learning_core_test.mjs
   ```

2. **用R核对K09—K30的输出。** 在 `成员三/ai_tutor` 目录下运行以下命令。Rscript不在PATH中时，加 `--rscript "C:/Program Files/R/R-4.x.x/bin/Rscript.exe"`。

   ```powershell
   .\.venv\Scripts\python.exe scripts/check_r_outputs.py
   ```

   不一致的代码块会逐段列出“预期”和“实际”的差异。可以修改草稿后重跑，也可以把报告发给我们修改。全部通过后依次运行：

   ```powershell
   .\.venv\Scripts\python.exe scripts/check_r_outputs.py --write
   .\.venv\Scripts\python.exe scripts/import_enrichment.py
   ```

3. **（可选）把已提交的测试产物移出版本控制。** `.gitignore` 已经忽略这些文件，但仓库里仍保留着26张截图和2个测试XML。以下命令只从Git中移除，本地文件保留：

   ```powershell
   git rm -r --cached "成员三/ai_tutor/output/playwright" "成员三/ai_tutor/tests/test-results.xml" "成员三/ai_tutor/tests/ui-backend-results.xml"
   git commit -m "Stop tracking local test artifacts"
   ```

## 四、已知问题与建议

- **合并时机。** 听说你正在调整项目目录。如果会移动或重命名 `成员三/ai_tutor/` 下的文件夹，建议先合并本PR再调整：本PR新增了100多个文件，先合并后Git可以识别整体移动；反过来，就需要逐个重新对应路径。
- **知识地图目录视图尚未实现。** 原计划为知识地图增加按单元的层级目录，但考虑到你正在调整目录相关内容，这一项暂缓，避免重复开发。

- **原题库的选择题答案位置固定。** 原有16道选择题的正确答案都是第一项，而 `learning-center.js` 不会打乱选项顺序，学生容易摸出规律。建议在渲染时随机打乱选项，或者调整题库中的选项顺序。这需要修改你负责的文件，所以本PR没有改动。
- **离线模式不包含讲义。** `/offline-course.json` 只包含 `course.json`，断网时知识详情不显示“深入学习”。如果需要，可以把 `enrichment.json` 加入离线包。
- **反馈不随学习档案导出。** 回答反馈存放在localStorage中，没有并入你的IndexedDB学习档案。如果希望一并导出或导入，需要在 `learning-store.js` 中增加对应字段。
- **版权风险。** `成员一/R数据科学_译本.pdf` 是整本书的译本，放在公开仓库里有风险，应用运行也不需要它。

## 五、提交列表

| 提交 | 内容 |
|---|---|
| `2e16407` | 补充讲义接入应用；macOS/Linux脚本；`.gitignore` 修正 |
| `359d3e1` | K09—K18讲义与R输出核对脚本 |
| `08db2c9` | K19—K24讲义 |
| `d0f9bb3` | 合并main（学习中心、复习调度、离线PWA），解决冲突 |
| `7daa47f` | 回答反馈与质量看板 |
| `e7c6f91` | K09—K24共30道变式题 |
| `25acc3b` | 答辩演示模式 |
| `8a5fae2` | 本说明文档 |
| `3176e87` | K25—K30讲义（数据框整理单元） |
| `55319a9` | 终端风格代码块 |
| `a5f5ef0` | 首页星座背景与数据指标带 |
