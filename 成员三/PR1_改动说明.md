# PR #1 改动说明

本PR由协作者（lambert1829，Claude辅助编写）提交，基于main分支 `c99bd49`（学习中心、复习与离线功能集成）。已合并main，GitHub显示可直接合并。全部改动共106个文件：新增93个，修改13个，没有删除任何文件。

## 一、改动概览

| 编号 | 内容 | 主要文件 | 对现有代码的影响 |
|---|---|---|---|
| 1 | K01—K08补充讲义接入应用 | `scripts/import_enrichment.py`、`data/enrichment.json`、`app/main.py`、`knowledge-map.js` | 知识接口多一个字段，详情面板多一个折叠区 |
| 2 | 新编K09—K24共16篇补充讲义 | `知识库补充草稿/K09.md`—`K24.md`、`content_assets/` | 只新增内容文件 |
| 3 | R输出一键核对脚本 | `scripts/check_r_outputs.py` | 新增脚本，不影响运行 |
| 4 | 回答反馈与质量看板 | `static/answer-feedback.js`、`answer-feedback.css` | `app.js` 增加3行调用 |
| 5 | 复习题库新增30道变式题 | `static/review-bank.json` | 题库从94题增至124题 |
| 6 | 答辩演示模式 | `static/demo-mode.js`、`demo-mode.css` | `app.js` 增加约15行调用 |
| 7 | macOS / Linux 启动脚本 | `setup.command`、`start.command`、`stop.command` | 只新增文件 |
| 8 | 合并main并解决冲突 | `app.js`、`knowledge-map.js`、`index.html`、`bootstrap.js`、`.gitignore` | 两边功能都保留 |

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

### 2. K09—K24补充讲义

**内容：** 共16篇，覆盖“向量与字符串”和“矩阵与数组”两个单元。每篇按《知识库补充清单与编写框架》编写：学习目标、先备检查、直观理解、为什么、基础例题、应用例题、图解、易错案例、完整练习、自测题、追问建议、来源与验证。每篇配套 `Kxx_example_01.R`、`Kxx_example_02.R`、`Kxx_exercise.R`（由草稿中的代码块自动导出，保证与草稿一致）和1张SVG图解。

**重要：这16篇的输出尚未在R中运行。** 编写环境没有R，预期输出是按R的打印规则推算的。为了尽量减少错误，做了以下处理：

- 基本信息中写明“验证状态为待R实测”，输出标题统一为“预期输出（待R实测）”。页面会提示“尚待R实测”，每个代码块带“未运行验证”标记。
- 与课程资料中已实测示例相同的代码，直接沿用课程记录的输出。涉及K09的抽样，以及K19、K20、K22、K23、K24的基础例题。
- 均值、标准差、分位数、奇异值、特征值等数值，用Python和NumPy独立计算核对。矩阵的打印排版按R的规则用程序生成，没有手工排空格。
- K22只打印取整后的特征值和容差检查结果，不打印特征向量本身，避免不同平台正负号翻转造成核对失败。
- K23的稀疏矩阵打印格式取自课程实测记录。如果Matrix包版本不同，格式可能略有差异，这一篇最可能需要调整。

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

### 7. macOS / Linux 脚本

`setup.command`、`start.command`、`stop.command` 分别对应现有的 `.cmd` 脚本，在Finder中双击或在终端执行即可：

- `setup.command`：查找Python 3.12或更新版本，创建虚拟环境。
- `start.command`：启动前检查8000端口是否被占用；启动后等待健康检查通过，macOS下会自动打开首页。
- `stop.command`：核对进程编号、启动时间和命令，三者一致才停止，不会误停其他进程。

已在Linux上验证启动、重复启动拦截、停止和重复停止，尚未在真实Mac上测试。

### 8. 合并main与冲突处理

合并 `c99bd49` 时有5个文件冲突，处理原则是两边功能都保留：

- `knowledge-map.js`：构造函数同时接收讲义渲染函数 `markdown` 和你新增的 `visit`、`enroll`、`bookmark`。详情面板里，讲义区与“加入复习”“收藏”按钮同时存在。
- `app.js`：保留你的 `courseApi` 离线回退，在其基础上传入 `markdown:renderCourseMarkdown`。
- `index.html`、`bootstrap.js`：采用你的版本，资源版本号统一为 `learning-v1`，保证Service Worker和相关测试不受影响。
- `.gitignore`：保留你的 `**/output/playwright/` 规则，另外增加忽略测试导出的XML文件。

`service-worker.js` 的 `ASSETS` 新增了4个文件（`answer-feedback.js/.css`、`demo-mode.js/.css`），满足 `test_pwa_assets.py` 的依赖清单检查。注意：资产列表长度变化后，用户已保存的旧离线包会被判定为不完整，需要在“设置与资料”中点击“更新离线资料”。

## 三、需要你完成的事

1. **运行完整测试。** 编写环境无法安装FastAPI，所以以下测试还没有跑过：`test_api`、`test_ai`、`test_pwa_assets` 等后端测试，`test_enrichment.py` 中4项接口相关测试，以及全部浏览器回归测试。已经通过的有：讲义导入与核对逻辑12项、题库3项、`learning_core_test.mjs` 13项、反馈3项。

   ```powershell
   .\.venv\Scripts\python.exe -m pytest -q
   node --test tests/answer_feedback_test.mjs
   node tests/learning_core_test.mjs
   ```

2. **用R核对K09—K24的输出。** 在 `成员三/ai_tutor` 目录下运行以下命令。Rscript不在PATH中时，加 `--rscript "C:/Program Files/R/R-4.x.x/bin/Rscript.exe"`。

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
