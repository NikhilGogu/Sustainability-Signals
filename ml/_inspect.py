import json
lines = open('ml/data/pages.jsonl','r',encoding='utf-8').readlines()
reports = {}
for l in lines:
    d = json.loads(l)
    k = d.get('k','')
    if k not in reports:
        reports[k] = {'pages': 0, 'chars': 0, 'company': d.get('company','?'), 'year': d.get('year')}
    reports[k]['pages'] += 1
    reports[k]['chars'] += d.get('text_chars', len(d.get('text','')))
print(f"Total pages: {len(lines)}")
print(f"Distinct reports: {len(reports)}")
for k, v in sorted(reports.items()):
    print(f"  {v['company']:20s} {v['year']}  {v['pages']:3d} pages  {v['chars']:>8,} chars  {k}")
