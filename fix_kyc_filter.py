with open('/workspaces/baobab-invest/baobab-api/src/routes/admin.ts', 'r') as f:
    c = f.read()

old = """    // Filtre par statut KYC
    if (kycFilter && kycFilter !== 'ALL') {
      where.kycStatus = kycFilter
    }"""

new = """    // Filtre par statut KYC
    if (kycFilter && kycFilter !== 'ALL') {
      if (kycFilter === 'NOT_SUBMITTED') {
        where.kycStatus = null
      } else {
        where.kycStatus = kycFilter
      }
    }"""

if old in c:
    c = c.replace(old, new)
    print("✅ Fix kycFilter NOT_SUBMITTED OK")
else:
    print("Pattern non trouvé")
    idx = c.find("Filtre par statut KYC")
    print(repr(c[idx:idx+200]))

with open('/workspaces/baobab-invest/baobab-api/src/routes/admin.ts', 'w') as f:
    f.write(c)
