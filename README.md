# NEXORA V3 Atlas Site

## Lancement recommandé (fusion: un seul site)

```bash
/Users/mohyi/atlas/run-atlas-fusion.sh
```

Liens disponibles:
- Shell fusion (mode Modern / Legacy / Comparaison): `http://127.0.0.1:4173`
- Modern directement: `http://127.0.0.1:4173/modern/`
- Legacy directement: `http://127.0.0.1:4173/legacy/`

Ports custom:

```bash
ATLAS_HOST=127.0.0.1 ATLAS_PORT=4273 /Users/mohyi/atlas/run-atlas-fusion.sh
```

Le bouton **Mettre à jour** appelle `/api/refresh`, lance `atlas:generate` dans `/Users/mohyi/mcp`, puis resynchronise les données dans `/Users/mohyi/atlas/data`.

## Mode dual (fallback)

```bash
/Users/mohyi/atlas/run-atlas-dual.sh
```
