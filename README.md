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
- l'autorisation de connexion vers Supabase et les providers IA

## Base de données Supabase

1. Créer un projet Supabase.
2. Ouvrir l'éditeur SQL.
3. Exécuter le contenu de [`supabase-schema.sql`](/Users/warren/Desktop/CRM/supabase-schema.sql).
4. Dans le CRM, en compte `Waxx`, ouvrir `Assistant IA`.
5. Renseigner :
   - l'URL du projet Supabase
   - la clé `anon`
   - le nom du workspace
6. Cliquer `Enregistrer`, puis `Synchroniser maintenant`.

Le CRM continuera à fonctionner en local tant que la BDD n'est pas configurée.

## Attention production

- Les clés API IA sont stockées côté navigateur dans cette V1.
- Pour une vraie production, il faut déplacer les appels IA côté backend pour ne jamais exposer les tokens.
- La clé `anon` Supabase est publique par nature, mais les policies RLS devront être resserrées si tu passes ensuite à une vraie gestion d'utilisateurs.
