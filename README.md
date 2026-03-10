# NEXORA V3 Atlas Site

## Lancement recommandé (entrée Atlas unique)

```bash
/Users/mohyi/atlas/run-atlas-fusion.sh
```

Commande unique pour redemarrer Atlas avec le code courant et mettre a jour les donnees:

```bash
cd /Users/mohyi/atlas && npm run start:refresh
```

Lien opératoire:
- Atlas intégré: `http://127.0.0.1:4173`

Notes:
- l’URL racine est l’unique point d’entrée recommandé
- le shell expose seulement la vue cockpit et un contexte historique, sans vue parallèle dédiée
- les chemins internes de compatibilité restent disponibles pour diagnostic, pas comme UX opératoire

Ports custom:

```bash
ATLAS_HOST=127.0.0.1 ATLAS_PORT=4273 /Users/mohyi/atlas/run-atlas-fusion.sh
```

Le bouton **Mettre à jour** appelle `/api/refresh`, lance `atlas:generate` dans `/Users/mohyi/mcp`, resynchronise les données dans `/Users/mohyi/atlas/data`, puis alimente le shell intégré.

Régénération terminal-first équivalente:

```bash
npm --prefix /Users/mohyi/mcp run atlas:generate
cd /Users/mohyi/atlas && npm run sync:data
```

## Mode dual (fallback)

```bash
/Users/mohyi/atlas/run-atlas-dual.sh
```

## Validation des contrats de données (MBE-1092)

Valider tous les datasets Atlas contre les schémas versionnés:

```bash
node /Users/mohyi/atlas/scripts/validate-atlas-contracts.mjs
```

Valider un dataset précis:

```bash
node /Users/mohyi/atlas/scripts/validate-atlas-contracts.mjs --dataset architecture-score
```

Références:
- `/Users/mohyi/atlas/data/contracts/manifest.json`
- `/Users/mohyi/atlas/docs/atlas-data-contracts.md`
