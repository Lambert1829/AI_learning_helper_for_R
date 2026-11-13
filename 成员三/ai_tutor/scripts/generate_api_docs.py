"""Generate member-two handoff from the running service and its OpenAPI schema."""
from pathlib import Path
import json
import urllib.request
import urllib.error
from datetime import datetime
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8000'


def call(path, body=None):
    req = urllib.request.Request(BASE+path,
        data=json.dumps(body,ensure_ascii=False).encode('utf-8') if body is not None else None,
        headers={'Content-Type':'application/json'} if body is not None else {})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as e:
        return e.code, json.load(e)


def block(obj):
    return '\n```json\n'+json.dumps(obj, ensure_ascii=False, indent=2)+'\n```\n'


def type_name(field):
    if '$ref' in field:
        return field['$ref'].split('/')[-1]
    if 'anyOf' in field:
        return ' / '.join(type_name(x) for x in field['anyOf'])
    if field.get('type')=='array':
        return 'array<'+type_name(field['items'])+'>'
    return field.get('type','object')


def table(schema, name):
    model=schema['components']['schemas'][name]
    out='\n| 字段 | 类型 | 必填 | 默认值 | 约束 |\n|---|---|---|---|---|\n'
    for key,value in model['properties'].items():
        rules=[]
        for f in ['enum','const','maxLength','maxItems','minimum']:
            if f in value: rules.append(f+'='+json.dumps(value[f],ensure_ascii=False))
        out+=f"| `{key}` | {type_name(value)} | {'是' if key in model.get('required',[]) else '否'} | {json.dumps(value['default'],ensure_ascii=False) if 'default' in value else '—'} | {'；'.join(rules) or '—'} |\n"
    return out


def main():
    health=call('/api/health')
    assert health[0]==200 and health[1]['mode']=='mock'
    _,schema=call('/openapi.json')
    required={'/api/health','/api/knowledge','/api/knowledge/{knowledge_id}','/api/chat','/api/review'}
    assert required<=set(schema['paths'])
    query={'question':'mean中的na.rm怎么用？','task_type':'function'}
    review={'question':'为什么不能用x == NA判断缺失？','code':'x <- c(1, NA, 3)\nx[x == NA]'}
    calls={
      'health':health,
      'catalog':call('/api/knowledge'),
      'detail':call('/api/knowledge/K06'),
      'chat':call('/api/chat',query),
      'review':call('/api/review',review),
      'no_match':call('/api/chat',{'question':'明天天气如何'}),
      'not_found':call('/api/knowledge/K99'),
      'invalid':call('/api/chat',{'question':'   '}),
    }
    for key,value in calls.items():
        assert value[0]==({'not_found':404,'invalid':422}.get(key,200)), (key,value)
    (ROOT/'tests/http_evidence.json').write_text(json.dumps(calls,ensure_ascii=False,indent=2),encoding='utf-8')
    # Use a fixed UTC+8 offset to avoid depending on Windows IANA timezone data.
    from datetime import timezone, timedelta
    stamp=datetime.now(timezone(timedelta(hours=8))).strftime('%Y-%m-%d %H:%M:%S +08:00')
    text=f'''# R语言AI助教接口说明

适用读者：开发小白、成员二和成员三  
版本：1.0.0 本地模拟版  
接口实测时间：{stamp}  
知识版本：`{health[1]['knowledge_version']}`

本文根据当前代码、运行服务的OpenAPI定义和真实HTTP请求生成。五个接口已经实现并测试；回答由课程资料和规则产生，未接入大模型，未运行R代码。参数表来自实际OpenAPI定义，不是规划草案。

## 1 先运行再连接

双击 `ai_tutor/start.cmd`，出现Ready后访问：

- 网页：<http://127.0.0.1:8000/>
- API基础地址：`http://127.0.0.1:8000`
- FastAPI交互文档：<http://127.0.0.1:8000/docs>
- 原始接口定义：<http://127.0.0.1:8000/openapi.json>

当前电脑依赖已安装。其他电脑先安装Python 3.12，再运行 `setup.cmd`。停止服务使用 `stop.cmd`。地址只适用于运行服务的电脑，不是公网地址。

同源页面使用 `/api/...` 即可。独立前端允许来自 `http://localhost:5173` 和 `http://127.0.0.1:5173` 的GET/POST请求；没有开放任意来源。不要直接双击HTML用file协议调用。没有登录、认证或服务端会话存储。

## 2 接口一览

| 方法 | 路径 | 用途 | 成功响应 |
|---|---|---|---|
| GET | `/api/health` | 检查服务和模拟模式 | 服务状态、版本、资料数量 |
| GET | `/api/knowledge` | 获取课程导航与关系 | items、relations、knowledge_version |
| GET | `/api/knowledge/{{knowledge_id}}` | 获取一个知识点 | 标准教学内容、来源与先修 |
| POST | `/api/chat` | 自动或指定类型问答、追问 | ChatResponse |
| POST | `/api/review` | 代码审查；强制debug模式 | ChatResponse |

所有接口返回JSON；每个HTTP响应附带 `X-Request-ID` 便于排错。GET的成功正文不重复该请求编号，问答及错误正文包含 `request_id`。

## 3 健康检查

`GET /api/health` 没有参数，不调用模型。`status`是服务状态，`mode`固定为mock，`version`是应用版本，`knowledge_version`标识资料版本，`counts`包含各类资料数量。

成功200的完整实测响应：
'''+block(calls['health'][1])+'''
## 4 课程目录与知识详情

`GET /api/knowledge` 没有参数。`items`数组每项包含 `id`、`title`、`chapter`（教学单元）、`prerequisites`（先修知识ID数组）。`relations`每项包含 `from`、`to`、`type`、`description`；顶层 `knowledge_version`用于识别数据版本。

成功200响应节选如下，仅展示前2个条目和前2条关系，完整响应见服务或 `ai_tutor/tests/http_evidence.json`：
'''+block({'items':calls['catalog'][1]['items'][:2], 'relations':calls['catalog'][1]['relations'][:2], 'knowledge_version':health[1]['knowledge_version']})+'''
`GET /api/knowledge/{knowledge_id}` 的路径参数必填，大小写敏感，例如K06。只接受数据中存在的编号，不存在返回404。

详情字段：`id/title/chapter`标识知识点；`fields`保留来源文档的教学字段（解释、函数语法、参数说明、运行示例、实际输出、易错提醒、练习提示等）；`sources`保存来源定位；`knowledge_ids`为本条编号；`prerequisites`为先修编号；`keywords`为检索用词；`verification`说明本应用未执行R代码；`catalog_row`为Excel原始行；`level`为Excel原始层级。

`fields`是资料字段映射，不同条目的可选字段可能不同。代码中的换行由JSON的 `\\n` 表示，前端解析后按原换行展示。不要把资料中的核验记录解读成这次请求执行了代码。

K06详情成功200的完整实测响应：
'''+block(calls['detail'][1])+'''
## 5 问答和代码审查请求

两个POST接口均接受 `Content-Type: application/json`。`/api/review`强制使用debug，其他输入与问答相同。所有未定义字段均拒绝；参数非法返回422。

请求参数表（自动提取自ChatRequest）：
'''+table(schema,'ChatRequest')+'''
额外约束：question、code和knowledge_id至少提供一个有效非空值；审查入口还要求question或code非空。knowledge_id若提供，必须存在，否则返回404。history默认空数组，最多12条消息（6轮），每条最多12000字符，总计最多24000字符。它不允许system角色。

session_id仅用于客户端标识，不用于认证或服务端记忆。question是问题，code是待审查代码，error_message为可选报错，task_type控制任务类型，teaching_mode控制提示/答案，knowledge_id用于知识导航或追问主题。

history每项字段：
'''+table(schema,'History')+'''
短追问可携带上次返回的related_knowledge首个ID作为knowledge_id。新问题出现明确主题时会重新检索。history用于找回最近用户问题中的主题，不进行大模型式对话理解。

问答成功请求：
'''+block(query)+'''
问答成功200完整实测响应：
'''+block(calls['chat'][1])+'''
代码审查成功请求：
'''+block(review)+'''
代码审查成功200完整实测响应：
'''+block(calls['review'][1])+'''
## 6 回答字段说明

ChatResponse结构：
'''+table(schema,'ChatResponse')+'''
`status=ok`表示找到资料或案例；`status=no_match`表示没有可靠匹配，HTTP仍为200。`mode`固定为mock；`task_type`是最终采用的类型；`matched_case_id`是Q/E案例编号，未匹配特定案例时为null；`related_knowledge`最多4个知识ID。prompt_version是模拟规则版本，knowledge_version是资料版本，均用于复现。

answer结构：
'''+table(schema,'Answer')+'''
summary是概括，steps是教学步骤，issues是问题建议，corrected_code是错误案例的参考修正，example_code是教学示例。expected_output来自资料，是参考输出；execution_status始终not_executed，code_kind始终reference_example。follow_ups是可点击追问文本。无内容的代码和输出字段返回空字符串，无问题列表返回空数组。

issues每项：
'''+table(schema,'Issue')+'''
kind使用error、warning或logic；line只有能定位时才为从1开始的行号，其余为null。reason是参考案例解释，不是执行诊断。

citations每项：
'''+table(schema,'Citation')+'''
source_id是S1等来源编号；file为资料名称；locator保留原始PDF页码、教材章节或其他定位文字；raw为原始来源描述。使用locator而不是强行把所有定位转成页码数组，避免把章节号当页码。点击引用可用knowledge_id读取知识详情；当前不提供原PDF下载接口。

未知问题请求 `{"question":"明天天气如何"}` 的200实测响应：
'''+block(calls['no_match'][1])+'''
## 7 失败处理与状态码

| 状态码 | 已实现情形 | 前端处理 |
|---|---|---|
| 200 | 成功或no_match | 展示回答；no_match说明能力范围 |
| 404 | 路由或知识编号不存在 | 提示重新选择知识点或核对路径 |
| 422 | 空输入、超长、非法类型、额外字段、非法history等 | 展示error.message，允许修改后重试 |
| 500 | 后端未处理异常 | 提示查看日志；自动测试通过注入故障验证 |

404、422示例来自当前运行服务；500已在单元测试中注入异常验证，不代表当前服务实际发生故障。没有实现模型超时、上游鉴权失败、限流或付费余额接口，不记录对应状态码为已支持。

`GET /api/knowledge/K99` 实测404响应：
'''+block(calls['not_found'][1])+'''
`POST /api/chat` 输入 `{"question":"   "}` 实测422响应：
'''+block(calls['invalid'][1])+'''
统一错误格式为request_id和error；error包含code、message和retryable。500使用INTERNAL_ERROR，retryable=true；404和422为false。页面不应无限重试。

浏览器连接拒绝或断网时没有HTTP状态码，fetch会抛异常；前端应提示“无法连接本地服务”，恢复发送按钮。此情形已通过实际停止服务验证。

## 8 成员二可直接使用的前端示例

以下脚本适用于本站页面，或允许的5173端口开发页面。代码与已通过浏览器测试的页面采用相同请求字段和错误读取方式：

```javascript
const API_BASE = location.port === "5173" ? "http://127.0.0.1:8000" : "";
async function askTutor(question, knowledgeId = null, history = []) {
  try {
    const response = await fetch(`${API_BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        question, task_type: "auto", teaching_mode: "hint",
        knowledge_id: knowledgeId, history
      }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || "请求失败");
    // 用textContent展示；不要把资料或用户代码直接赋给innerHTML。
    console.log(data.answer.summary, data.citations);
    return data; // 检查status，no_match也是正常JSON响应。
  } catch (error) {
    console.error("请检查本地服务或输入：", error.message);
    throw error; // 在调用方finally中恢复发送按钮。
  }
}
const first = await askTutor("空值怎么判断");
await askTutor("举个例子", first.related_knowledge[0], [
  {role: "user", content: "空值怎么判断"},
  {role: "assistant", content: first.answer.summary}
]);
```

审查代码时改为 `/api/review`，请求体至少提供question或code，例如第5节的实测请求。练习先发送teaching_mode=hint；点击查看答案后，原问题不变，改为solution重发。返回的课程参考代码不得标为已执行。

## 9 更新记录

| 日期 | 变更 | 证据 |
|---|---|---|
| 2026-11-13 | 初建说明，标记当时无接口实现 | 当时工作区检查 |
| 2026-11-13 | 实现v1本地模拟版，替换占位内容；核对5个接口、请求与响应字段、来源定位、错误和前端示例 | pytest回归、Playwright浏览器验收、tests/http_evidence.json |

每次修改接口后，应先运行测试、重启服务，再执行scripts/generate_api_docs.py更新本文。本文未声称接入真实模型或完成公网部署。
'''
    (ROOT.parent/'接口说明.md').write_text(text,encoding='utf-8')
    print('Updated API documentation and live HTTP evidence.')


if __name__=='__main__':
    main()
