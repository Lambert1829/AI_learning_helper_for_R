from pathlib import Path
from typing import Literal
from uuid import uuid4
import logging
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ConfigDict, model_validator
from starlette.exceptions import HTTPException
from .engine import DATA, KNOWLEDGE, answer

ROOT = Path(__file__).resolve().parents[1]
class ErrorDetail(BaseModel):
    code: str
    message: str
    retryable: bool


class ErrorResponse(BaseModel):
    request_id: str
    error: ErrorDetail


app = FastAPI(title='R语言AI助教 本地模拟版', version='1.1.0', description='真实HTTP接口；课程资料和规则驱动；不调用模型、不执行R代码。',
              responses={404:{'model':ErrorResponse,'description':'资源或知识点不存在'},
                         422:{'model':ErrorResponse,'description':'参数校验失败'},
                         500:{'model':ErrorResponse,'description':'内部错误；测试中通过故障注入验证'}})
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173','http://127.0.0.1:5173'], allow_methods=['GET','POST'], allow_headers=['Content-Type'])


class History(BaseModel):
    model_config = ConfigDict(extra='forbid')
    role: Literal['user','assistant']
    content: str = Field(max_length=12000)


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    session_id: str = Field(default='', max_length=100)
    question: str = Field(default='', max_length=2000)
    task_type: Literal['auto','concept','function','debug','exercise'] = 'auto'
    code: str = Field(default='', max_length=10000)
    error_message: str = Field(default='', max_length=2000)
    knowledge_id: str | None = None
    teaching_mode: Literal['hint','solution'] = 'hint'
    history: list[History] = Field(default_factory=list, max_length=12)

    @model_validator(mode='after')
    def valid(self):
        if not (self.question.strip() or self.code.strip() or self.knowledge_id):
            raise ValueError('请输入问题、代码或选择知识点')
        if sum(len(h.content) for h in self.history)>24000:
            raise ValueError('历史内容总长度不得超过24000字符')
        return self


class Issue(BaseModel):
    kind: str
    line: int | None
    reason: str


class Answer(BaseModel):
    summary: str
    steps: list[str]
    issues: list[Issue]
    corrected_code: str
    example_code: str
    expected_output: str
    execution_status: Literal['not_executed']
    code_kind: Literal['reference_example']
    follow_ups: list[str]


class Citation(BaseModel):
    knowledge_id: str
    source_id: str
    file: str
    locator: str
    raw: str


class ChatResponse(BaseModel):
    request_id: str
    status: Literal['ok','no_match']
    mode: Literal['mock']
    task_type: str
    answer: Answer
    citations: list[Citation]
    related_knowledge: list[str]
    matched_case_id: str | None
    prompt_version: str
    knowledge_version: str


def failure(request, status, code, message):
    return JSONResponse(status_code=status, content={'request_id':request.state.request_id,
       'error':{'code':code,'message':message,'retryable':status>=500}})


@app.middleware('http')
async def request_id(request: Request, call_next):
    request.state.request_id = str(uuid4())
    try:
        response = await call_next(request)
    except Exception:
        logging.exception('request_id=%s', request.state.request_id)
        response = failure(request, 500, 'INTERNAL_ERROR', '服务内部错误，请查看本地日志或联系维护者')
    response.headers['X-Request-ID'] = request.state.request_id
    return response


@app.exception_handler(RequestValidationError)
async def validation(request, exc):
    details = ['.'.join(str(v) for v in e['loc'])+': '+e['msg'] for e in exc.errors()]
    return failure(request, 422, 'VALIDATION_ERROR', '输入不符合要求；'+'；'.join(details))


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return failure(request, exc.status_code, 'NOT_FOUND' if exc.status_code==404 else 'HTTP_ERROR', str(exc.detail))


@app.get('/api/health')
def health():
    return {'status':'ok','mode':'mock','version':'1.1.0','knowledge_version':DATA['version'],
            'counts':{k:len(DATA[k]) for k in ['knowledge','questions','errors','relations']}}


@app.get('/api/knowledge')
def catalog():
    return {'items':[{k:x[k] for k in ['id','title','chapter','prerequisites']} for x in KNOWLEDGE.values()],
            'relations':DATA['relations'],'knowledge_version':DATA['version']}


@app.get('/api/knowledge/{knowledge_id}')
def knowledge(knowledge_id: str):
    if knowledge_id not in KNOWLEDGE:
        raise HTTPException(404, '知识点不存在，请从课程目录选择')
    return KNOWLEDGE[knowledge_id]


def respond(body, request, review=False):
    if body.knowledge_id and body.knowledge_id not in KNOWLEDGE:
        raise HTTPException(404, '知识点不存在，请从课程目录选择')
    if review and not (body.code.strip() or body.question.strip()):
        return failure(request, 422, 'VALIDATION_ERROR', '代码审查需要代码或问题描述')
    return {'request_id':request.state.request_id, **answer(body, review)}


@app.post('/api/chat', response_model=ChatResponse)
def chat(body: ChatRequest, request: Request):
    return respond(body, request)


@app.post('/api/review', response_model=ChatResponse)
def review(body: ChatRequest, request: Request):
    return respond(body, request, True)


@app.get('/', include_in_schema=False)
def index():
    return FileResponse(ROOT/'static/index.html')


app.mount('/static', StaticFiles(directory=ROOT/'static'), name='static')
