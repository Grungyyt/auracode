# AuraCode

L'IA qui pilote ton PC — propulsée par le cloud VTH.

## Installation (Windows, sans Node requis)

Dans PowerShell :

```powershell
irm https://raw.githubusercontent.com/Grungyyt/auracode/main/scripts/install.ps1 | iex
```

Ouvre ensuite un **nouveau** terminal et tape :

```powershell
auracode
```

## Mise à jour automatique

AuraCode vérifie les nouvelles versions au démarrage. Pour mettre à jour :

```powershell
auracode update
```

## Alternative (npm, tous OS avec Node 18+)

```powershell
npm i -g auracode
auracode
```

## Première utilisation

```powershell
auracode login
```

Colle ta clé API (`ak-vth-...`) depuis `https://auth.vth-mc.fr/profile` (section Clés API IA).

## Développement

- `cli/` : le terminal (Node 18+, zéro dépendance).
- `web/` : la landing page (Vercel).
- `scripts/build-exe.js` : construit `auracode.exe` via Node SEA.
- Un tag `git tag vX.Y.Z && git push --tags` déclenche le build du `.exe` et la release GitHub automatiquement.
