# NEXORA V3 Atlas Site

- Version modifiée (UX/data cockpit): `http://127.0.0.1:4173`
- Version legacy (build MCP): `http://127.0.0.1:4174`

## Lancer les deux versions (avec bouton Mettre à jour actif)

```bash
/Users/mohyi/atlas/run-atlas-dual.sh
```

## Ports custom (si 4173/4174 sont déjà utilisés)

```bash
ATLAS_MODERN_PORT=4273 ATLAS_LEGACY_PORT=4274 /Users/mohyi/atlas/run-atlas-dual.sh
```

Le refresh exécute `atlas:generate` dans `/Users/mohyi/mcp`, puis synchronise les données vers `/Users/mohyi/atlas/data`.
