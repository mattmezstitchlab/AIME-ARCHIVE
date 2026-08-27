#!/usr/bin/env python3
from pathlib import Path
from collections import defaultdict, Counter
import re, json

ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'extracted'; OUT=ROOT/'analysis'; OUT.mkdir(exist_ok=True)
SKIP={'node_modules','.git','dist','build','.next','.cache','coverage'}
EXT={'.ts','.tsx','.js','.jsx','.vue','.svelte','.py','.sql','.css','.scss','.md','.json'}
PATTERNS={
 'intent_engine':r'\b(intent|intention|intentengine|intent engine|semantic|ambigu|confidence|uncertainty)\b',
 'ai_agent':r'\b(agent|llm|openai|anthropic|prompt|ai|completion|embedding)\b',
 'timeline':r'\b(timeline|timeblock|time block|schedule|scheduler|duration|chronos|calendar)\b',
 'flow_graph':r'\b(flow|causal|causality|node|nodes|edge|edges|graph|relation|dependency|propagat|cascade)\b',
 'people_matching':r'\b(match|matching|compatib|connection|connect|guest|invitee|person|profile|rsvp)\b',
 'world_entities':r'\b(entity|entities|resource|constraint|scenario|world|place|event)\b',
 'canvas_spatial':r'\b(canvas|spatial|surface|viewport|zoom|pan|drag|drop|orbit)\b',
 '3d':r'\b(three|three\.js|webgl|react-three|fiber|drei|scene|mesh|camera)\b',
 'cards_ui':r'\b(card|carousel|stack|drawer|modal|commandpalette|command palette)\b',
 'animation':r'\b(framer-motion|motion|animate|animation|transition|gsap|spring)\b',
 'data_backend':r'\b(supabase|firebase|prisma|api|database|postgres|graphql)\b',
 'transformation':r'\b(transform|generate|convert|parse|analy[sz]|derive|map|project)\b',
}
FUNC=re.compile(r'\b(?:function|const|let|var)\s+([A-Za-z_$][\w$]*)\s*(?:=|\()',re.M)
COMP=re.compile(r'\b(?:function\s+|const\s+)([A-Z][A-Za-z0-9_$]*)\s*(?:=|\()',re.M)

def files_for(p):
 for f in p.rglob('*'):
  if f.is_file() and f.suffix.lower() in EXT and not any(x in SKIP for x in f.parts): yield f

projects=[]; primitive_projects=defaultdict(set); primitive_hits=defaultdict(Counter); symbol_projects=defaultdict(set); symbol_examples=defaultdict(list)
for p in sorted(x for x in SRC.iterdir() if x.is_dir()):
 text='\n'.join((f.read_text(encoding='utf-8',errors='ignore')[:500000] for f in files_for(p)))
 low=text.lower(); rec={'project':p.name,'files':0,'primitives':{},'symbols':[]}
 for f in files_for(p): rec['files']+=1
 for name,pat in PATTERNS.items():
  hits=len(re.findall(pat,low,re.I))
  if hits:
   rec['primitives'][name]=hits; primitive_projects[name].add(p.name); primitive_hits[name][p.name]=hits
 for m in FUNC.finditer(text):
  s=m.group(1); symbol_projects[s].add(p.name)
  if len(symbol_examples[s])<5: symbol_examples[s].append(f'{p.name}:{s}')
 rec['symbols']=sorted(set(m.group(1) for m in COMP.finditer(text)))[:100]
 projects.append(rec)

# Candidate shared symbols: same symbol name appearing in at least 3 projects.
shared=[{'symbol':s,'projects':sorted(ps),'examples':symbol_examples[s]} for s,ps in symbol_projects.items() if len(ps)>=3]
shared.sort(key=lambda x:(-len(x['projects']),x['symbol'].lower()))

rank=[]
for k,ps in primitive_projects.items():
 rank.append({'primitive':k,'project_count':len(ps),'projects':sorted(ps),'total_hits':sum(primitive_hits[k].values())})
rank.sort(key=lambda x:(-x['project_count'],-x['total_hits']))

(OUT/'primitive-map.json').write_text(json.dumps({'projects':projects,'primitive_ranking':rank,'shared_symbols':shared},ensure_ascii=False,indent=2),encoding='utf-8')
md=['# AIME — Structural Primitive Map','',f'Projects scanned: {len(projects)}','', '## Primitive candidates (by project coverage)','']
for x in rank: md.append(f"- **{x['primitive']}** — {x['project_count']} projects, {x['total_hits']} signals")
md += ['', '## Shared code symbols (3+ projects)','']
for x in shared[:100]: md.append(f"- **{x['symbol']}** — {len(x['projects'])} projects: {', '.join(x['projects'][:12])}{'…' if len(x['projects'])>12 else ''}")
md += ['', '## Interpretation','', 'This is a structural signal map, not proof that projects implement identical mechanisms. High-coverage candidates should be inspected in source before becoming AIME Core primitives.']
(OUT/'primitive-map.md').write_text('\n'.join(md)+'\n',encoding='utf-8')
print(f'Scan structurel terminé : {len(projects)} projets')
print(f'Primitives candidates : {len(rank)}')
print(f'Symboles partagés (3+ projets) : {len(shared)}')
print(f'Rapports : {OUT}/primitive-map.md et {OUT}/primitive-map.json')
