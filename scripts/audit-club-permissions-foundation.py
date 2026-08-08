from pathlib import Path

roots=[Path('backend'),Path('src'),Path('prisma')]
needles=['ClubMember','clubMember','membership','Membership','club portal','clubPortal','requireClub','authorize','role','permission']
print('=== SCHEMA FILES ===')
for p in Path('.').rglob('schema.prisma'):
    print(p)
    text=p.read_text(errors='ignore')
    for n in ['model Club','model User','model ClubMember','model ClubMembership','enum Club']:
        i=text.find(n)
        if i>=0:
            print('\n---',n,'---\n',text[i:i+3000])

print('\n=== RELEVANT FILES ===')
count=0
for root in roots:
    if not root.exists(): continue
    for p in root.rglob('*'):
        if not p.is_file() or p.suffix not in {'.ts','.tsx','.js','.prisma'}: continue
        text=p.read_text(errors='ignore')
        hits=[n for n in needles if n in text]
        if not hits: continue
        print(f'\n### {p} hits={hits[:5]}')
        lines=text.splitlines()
        shown=0
        for idx,line in enumerate(lines):
            if any(n in line for n in needles):
                lo=max(0,idx-5); hi=min(len(lines),idx+12)
                print(f'-- lines {lo+1}-{hi} --')
                print('\n'.join(lines[lo:hi]))
                shown+=1
                if shown>=6: break
        count+=1
        if count>=35: break
    if count>=35: break
