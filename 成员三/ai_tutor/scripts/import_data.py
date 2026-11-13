"""Rebuild the shipped course dataset without changing member one's files."""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
import re
import xml.etree.ElementTree as ET
from openpyxl import load_workbook

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parents[1] / '成员一'
NS = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
FILES = {'S1': 'CH11R语言安装.pdf', 'S2': 'CH12R语言安装.pdf',
         'S3': 'CH2R语言数据操作课件.pdf', 'S4': 'R数据科学_译本.pdf'}


def paragraphs(path):
    with ZipFile(path) as z:
        root = ET.fromstring(z.read('word/document.xml'))
    for p in root.findall('.//w:p', NS):
        text = ''.join('\n' if n.tag == f"{{{NS['w']}}}br" else
                       '\t' if n.tag == f"{{{NS['w']}}}tab" else
                       (n.text or '') if n.tag == f"{{{NS['w']}}}t" else '' for n in p.iter())
        if text.strip():
            yield text.strip()


def sources(raw):
    result = []
    raw = re.split('先修：|关联条目：|核验：', raw)[0].strip('。 ')
    for m in re.finditer(r'(S[1-5])\s*([^；]+)', raw):
        sid, locator = m.groups()
        result.append({'source_id': sid, 'file': FILES.get(sid, '现代接口官方文档补充'),
                       'locator': locator.strip(), 'raw': raw})
    return result


def main():
    doc = next(SOURCE.glob('*.docx'))
    book = next(SOURCE.glob('*.xlsx'))
    rows = list(paragraphs(doc))
    start = next(i for i, p in enumerate(rows) if p.startswith('K01 R'))
    blocks = []
    for p in rows[start:]:
        match = re.match(r'^([KQE]\d{2})\s+(.+)', p)
        if match:
            blocks.append({'id': match[1], 'title': match[2], 'body': []})
        elif blocks and not re.match(r'^[四五]、', p):
            blocks[-1]['body'].append(p)
    data = {'knowledge': [], 'questions': [], 'errors': [], 'relations': [], 'warnings': []}
    for block in blocks:
        fields, field = {}, 'intro'
        for p in block.pop('body'):
            m = re.match(r'^【([^】]+)】(.*)', p, re.S)
            if m:
                field = m[1]
                fields[field] = m[2]
            elif p == '参考输出':
                field = '参考输出'
                fields[field] = ''
            else:
                fields[field] = (fields.get(field, '') + '\n' + p).strip()
        block['fields'] = fields
        block['sources'] = sources(fields.get('来源', '').split('\n')[0])
        block['knowledge_ids'] = re.findall(r'K\d{2}', fields.get('来源', '').split('\n')[0])
        if block['id'].startswith('K'):
            block['knowledge_ids'] = [block['id']]
            block['prerequisites'] = re.findall(r'K\d{2}', fields.get('来源', ''))
            block['chapter'] = ''
            block['keywords'] = sorted(set(re.findall(r'[A-Za-z][A-Za-z0-9_.]*', block['title']+' '+fields.get('函数语法', ''))))
            block['verification'] = '来源文档的核验记录；本应用未执行R代码'
            data['knowledge'].append(block)
        elif block['id'].startswith('Q'):
            block['question'] = fields.get('intro', '')
            data['questions'].append(block)
        else:
            data['errors'].append(block)
    wb = load_workbook(book, read_only=True, data_only=True)
    sheets = {s.title: list(s.values) for s in wb}
    index = {k['id']: k for k in data['knowledge']}
    # Header is row 5 in the supplied workbook; use the header names in the audit.
    for row in sheets['知识目录'][5:]:
        if str(row[0]) in index:
            index[row[0]]['catalog_row'] = [str(v or '') for v in row]
            index[row[0]]['level'] = str(row[2] or '')
    chapters = [(3,'环境与自助学习'),(8,'类型与缺失'),(18,'向量与字符串'),(24,'矩阵与数组'),(30,'数据框'),(34,'列表与批量处理'),(38,'函数与控制'),(43,'综合与包扩展')]
    for k in index.values():
        k['chapter'] = next(title for end,title in chapters if int(k['id'][1:])<=end)
    for row in sheets['知识关联'][5:]:
        if str(row[0]) in index and str(row[1]) in index:
            data['relations'].append({'from': row[0], 'to': row[1], 'type': str(row[2]), 'description': str(row[3] or '')})
    wb.close()
    for key, count in [('knowledge', 43), ('questions', 24), ('errors', 14), ('relations', 95)]:
        assert len(data[key]) == count, (key, len(data[key]), count)
    for key in ['knowledge', 'questions', 'errors']:
        assert len({x['id'] for x in data[key]}) == len(data[key])
        for x in data[key]:
            assert x['sources'], x['id']
            assert all(k in index for k in x['knowledge_ids']), x['id']
    for k in data['knowledge']:
        for f in ['解释', '函数语法', '参数说明', '运行示例', '易错提醒', '练习提示']:
            assert k['fields'].get(f), (k['id'], f)
    data['warnings'] = ['Excel说明标记39个条目已运行、4个包扩展待实测；保留Word逐条核验原文，不将全部条目视为已执行。',
                        '本次只核查资料结构、来源字段和代码换行，没有重新运行R代码或逐页审计PDF。']
    data['version'] = hashlib.sha256(doc.read_bytes()+book.read_bytes()).hexdigest()[:12]
    data['source_files'] = [doc.name, book.name]
    (ROOT/'data').mkdir(exist_ok=True)
    (ROOT/'data/course.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
    audit = {'counts': {k: len(data[k]) for k in ['knowledge','questions','errors','relations']},
             'version': data['version'], 'warnings': data['warnings'],
             'excel_headers': {k: list(v[4]) for k,v in sheets.items()},
             'multiline_examples': sum('\n' in k['fields']['运行示例'] for k in data['knowledge'])}
    (ROOT/'data/import_report.json').write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps(audit, ensure_ascii=False))


if __name__ == '__main__':
    main()
