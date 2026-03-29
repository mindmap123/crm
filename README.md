# L'Atelier CRM

Prototype statique prêt pour une mise en ligne rapide.

## Local

```bash
npm run dev
```

Puis ouvrir `http://localhost:3000`.

## Déploiement Vercel

1. Créer un nouveau projet Vercel.
2. Importer ce dossier.
3. Déployer tel quel.

Le fichier [`vercel.json`](/Users/warren/Desktop/CRM/vercel.json) ajoute :
- les headers de sécurité utiles
- l'autorisation micro pour l'onglet IA
- une réécriture globale vers `index.html`

## Attention production

- Les clés API IA sont stockées côté navigateur dans cette V1.
- Pour une vraie production, il faut déplacer les appels IA côté backend pour ne jamais exposer les tokens.
