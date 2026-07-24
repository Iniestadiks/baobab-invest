with open('/workspaces/baobab-invest/baobab-web/app/admin/page.tsx', 'r') as f:
    lines = f.readlines()

# Supprimer les lignes 2786 à 2809 incluses (index 2785 à 2808)
new_lines = lines[:2785] + lines[2809:]

with open('/workspaces/baobab-invest/baobab-web/app/admin/page.tsx', 'w') as f:
    f.writelines(new_lines)

print("OK - doublons supprimes, lignes 2786-2809 effacees")
