with open('/workspaces/baobab-invest/baobab-web/app/admin/page.tsx', 'r') as f:
    c = f.read()

lines = c.split('\n')
for i, line in enumerate(lines):
    if 'Suppr' in line:
        print(i+1, repr(line))
