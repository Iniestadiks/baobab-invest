with open('/workspaces/baobab-invest/baobab-web/app/admin/page.tsx', 'r') as f:
    lines = f.readlines()

# Afficher les lignes 2760 à 2825 pour voir le contexte complet
for i, line in enumerate(lines[2758:2825], start=2759):
    print(i, repr(line.rstrip()))
