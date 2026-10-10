# AuraCode

L'IA qui pilote ton PC — propulsée par le cloud VTH.

## Installation (Windows, une commande)

Dans PowerShell :

```powershell
irm https://raw.githubusercontent.com/Grungyyt/auracode/main/scripts/install.ps1 | iex
```

Ouvre ensuite un **nouveau** terminal et tape :

```powershell
auracode
```

(Pas besoin de release GitHub : l'installeur télécharge directement les fichiers du repo. Node.js est installé automatiquement s'il manque.)

## Mise à jour automatique

AuraCode vérifie les nouvelles versions au démarrage. Pour mettre à jour :

```powershell
auracode update
```

## Utilisation

```powershell
auracode                  # plein écran : chat + autocomplétion /
auracode "ma question"    # réponse unique, sans interface
auracode setup            # assistant d'installation pastel
```

Dans l'interface : `/new` `/model` `/effort` `/quota` `/image` `/copy` `/export` `/theme` `/clear` `/help` — tape `/` pour les suggestions, `PgUp/PgDn` pour défiler.

## Première utilisation

```powershell
auracode login
```

Colle ta clé API (`ak-vth-...`) depuis `https://auth.vth-mc.fr/profile` (section Clés API IA).

## Alternative (npm, tous OS avec Node 18+)

```powershell
npm i -g auracode
auracode
```

## Développement

- `cli/` : le terminal (Node 18+, zéro dépendance).
- `web/` : la landing page (Vercel).
- `scripts/build-exe.js` : construit `auracode.exe` via Node SEA (optionnel).
- Un tag `git tag vX.Y.Z && git push --tags` déclenche le build du `.exe` et la release GitHub automatiquement.
