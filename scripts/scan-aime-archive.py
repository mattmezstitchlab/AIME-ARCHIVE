#!/usr/bin/env python3
from pathlib import Path
import json, re
from collections import Counter, defaultdict

ROOT = Path(__file__).resolve().parents[1]
EXTRACTED = ROOT / 'extracted'
OUT = ROOT / 'analysis'
OUT.mkdir(exist_ok=True)

EXTENSIONS = {'.ts','.tsx','.js','.jsx','.json','.css','.scss','.html','.md','.py','.sql','.vue','.svelte'}
SKIP = {'node_modules','.git','dist','build','.next','.cache','coverage'}
KEYWORDS = {
 '3D / WebGL':['three','@react-three','webgl','canvas','react-three-fiber'],
 'Timeline / temps':['timeline','timeblock','chronos','schedule','calendar','temporal'],
 'Flow / causalité':['flow','causal','rebond','propagat','graph','relation'],
 'AI / intention':['intent','intention','agent','llm','ai','prompt','semantic','semant'],
 'Canvas / surface':['canvas','surface','worldcanvas','figma'],
 'Animation':['framer-motion','motion','animation','gsap'],
 'Social / personnes':['guest','invite','person','profile','match','connection','rsvp'],
 'Mariage / événement':['wedding','mariage','event','prestataire','ceremon','table'],
 'AIME / identité':['aime','cerise','gaia','ripple','stamp','hera','nexus'],
 'Data / backend':['supabase','firebase','api','database','prisma'],
 'Navigation / UI':['router','navigation','command palette','drawer','modal','carousel','card'],
 'Broderie / textile':['stitch','broderie','point-de-croix','thread','pattern'],
}

projects=[]
for d in sorted(p for p in EXTRACTED.iterdir() if p.is_dir()):
    files=[]; text_parts=[]; tech=Counter(); concepts=Counter()
    for f in d.rglob('*'):
        if not f.is_file() or f.suffix.lower() not in EXTENSIONS or any(x in SKIP for x in f.parts): continue
        files.append(f)
        try: text=f.read_text(encoding='utf-8', errors='ignore')
        except: continue
        text_parts.append(text[:300000])
        low=text.lower()
        for group, terms in KEYWORDS.items():
            hits=sum(low.count(t.lower()) for t in terms)
            if hits: concepts[group]+=hits
        if 'react' in low: tech['React']+=1
        if 'vite' in low: tech['Vite']+=1
        if 'typescript' in low or f.suffix.lower() in {'.ts','.tsx'}: tech['TypeScript']+=1
        if 'tailwind' in low: tech['Tailwind']+=1
        if 'supabase' in low: tech['Supabase']+=1
        if 'three.js' in low or 'three' in low or 'react-three-fiber' in low: tech['Three.js / R3F']+=1
        if 'framer-motion' in low: tech['Framer Motion']+=1
    projects.append({'project':d.name,'files':len(files),'technologies':dict(tech),'concepts':dict(concepts)})

# Cross-project counts: how many distinct projects contain each concept.
concept_projects=defaultdict(list); tech_projects=defaultdict(list)
for p in projects:
    for k,v in p['concepts'].items():
        if v: concept_projects[k].append(p['project'])
    for k,v in p['technologies'].items():
        if v: tech_projects[k].append(p['project'])

(OUT/'projects.json').write_text(json.dumps(projects,ensure_ascii=False,indent=2),encoding='utf-8')
(OUT/'cross-project-map.md').write_text('\n'.join([
'# AIME — Cross-Project Map','',
'## Projects scanned',f"{len(projects)} extracted project directories",'',
'## Recurring concepts',
* [f"- **{k}** — {len(v)} projects" for k,v in sorted(concept_projects.items(), key=lambda x:-len(x[1]))],
'', '## Recurring technologies',
* [f"- **{k}** — {len(v)} projects" for k,v in sorted(tech_projects.items(), key=lambda x:-len(x[1]))],
'', '## Highest-signal projects',
* [f"- **{p['project']}** — " + ', '.join(sorted(p['concepts'], key=p['concepts'].get, reverse=True)[:5]) for p in sorted(projects,key=lambda x:sum(x['concepts'].values()),reverse=True)[:20]],
])+'\n',encoding='utf-8')

print(f'Scan terminé : {len(projects)} projets')
print(f'Rapports : {OUT}/projects.json et {OUT}/cross-project-map.md')
