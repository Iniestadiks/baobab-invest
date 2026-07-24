with open('/workspaces/baobab-invest/baobab-web/app/admin/page.tsx', 'r') as f:
    c = f.read()

c = c.replace(
    'import { authGet, authPost, authPatch } from "@/lib/api";',
    'import { authGet, authPost, authPatch, authFetch } from "@/lib/api";'
)

delete_btn = '                          <button onClick={async () => {\n                            const newRole = prompt(`Changer r\u00f4le de ${u.firstName}'

if delete_btn in c:
    insert = '                          <button onClick={async () => {\n                            if (!window.confirm("Supprimer " + u.email + " ?")) return;\n                            const res = await authFetch("/api/admin/users/" + u.id, { method: "DELETE" });\n                            const data = await res.json();\n                            if (data.success) { flash("Supprime"); loadData(); }\n                            else if (data.canAnonymize) { if (window.confirm("Anonymiser ?")) { const r = await authFetch("/api/admin/users/" + u.id + "/anonymize", { method: "PATCH" }); const d = await r.json(); if (d.success) { flash("Anonymise"); loadData(); } } }\n                            else flash("Erreur: " + data.message);\n                          }} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded-lg border border-red-200">\n                            Suppr.\n                          </button>\n                          <button onClick={async () => {\n                            const newRole = prompt(`Changer r\u00f4le de ${u.firstName}'
    c = c.replace(delete_btn, insert)
    print("OK - bouton ajoute")
else:
    print("Pattern non trouve")
    idx = c.find("Changer")
    print(repr(c[idx-100:idx+50]))

with open('/workspaces/baobab-invest/baobab-web/app/admin/page.tsx', 'w') as f:
    f.write(c)
