# cv_desktop

Site CV d'Ali Smaani, servi sur alismaani.fr. On arrive sur le plateau d'un bureau en 3D low poly, vu de haut, et les objets portent le CV : on les prend en main, on les retourne, on les fait glisser. Une version express en HTML donne le même CV en une page, pour le recruteur pressé et pour les moteurs de recherche.

Dépôt GitHub public (sma-ali/CV-Desktop, à créer au premier push). Ce fichier est donc public : rien de privé ici, le contexte privé est dans `CLAUDE.local.md` (ignoré par git).

## Référence visuelle

`prototype/bureau-plateau.html` est le prototype validé (Three.js r128 en un seul fichier). Il fixe l'ambiance, la palette, les objets, l'arrivée et le comportement des gestes. Le vrai site le reproduit et l'améliore, il ne le recopie pas tel quel. Ouvrir le fichier dans un navigateur suffit. Paramètres de test du prototype : `?t=11000` (saute à 11 s), `&fige` (gèle l'horloge, et donc aussi les gestes), `?auto=0`, `?heure=14`, `?express`.

Défauts connus du prototype, à corriger dans le vrai site :

- en vue large, le code de l'écran est illisible (8 px) ;
- sur téléphone, le bureau tient dans une bande et ses bords sont coupés ;
- le micro sur son bras se lit mal vu de dessus, le coffret est petit et sombre ;
- les collisions entre objets sont des cercles, un portable peut chevaucher la carte.

## Pile technique

- Next.js (App Router) + TypeScript strict, React Three Fiber + drei pour la 3D, Three.js récent.
- Contenu typé en FR et EN, validé par zod, dans un seul module de contenu : la scène 3D et la version express lisent la même source.
- Routes serveur en TypeScript : `/api/contact` (formulaire) et `/api/signes-de-vie` (activité du coffret scellé).
- Tests : Vitest pour la logique et le contenu, Playwright pour les parcours réels (clic sur un objet, retournement, glisser, formulaire, version express, FR/EN). CI GitHub Actions.
- Hébergement : Vercel, domaine alismaani.fr (DNS chez OVH).

## Contenu

Source unique des faits : le CV d'Ali en HTML, version FR et version EN (chemins dans `CLAUDE.local.md`). Ne rien inventer, ne rien arrondir : dates, intitulés et chiffres viennent de là. Si le CV et le prototype divergent, le CV gagne.

- Expériences : Défi métiers (développeur web Drupal/PHP, sept. 2020 à août 2023) ; DARES (ingénieur applicatif et gestion de données, support N1/N2, janv. 2024 à juin 2026).
- Projets publics : Netherbrain et Homelab, chacun un objet du bureau avec sa fiche et son lien GitHub (vérifier que le dépôt est public avant de lier).
- Projets perso : un coffret scellé qui donne des signes de vie (activité, ancienneté, graphique sur 14 jours) sans jamais dire ce qu'ils sont.
- Contact : formulaire, e-mail et LinkedIn. Pas de téléphone, pas d'âge sur le site.
- Décor perso (gants, manette, figurines, mangas, matériel de stream) : décor seulement, sans marque, jeu, anime ni pseudo réels.

## Règles d'écriture

- Commits, docs et commentaires en français ; identifiants du code en anglais.
- Commits Conventional, forme sèche, en minuscules, sans point final, environ 50 caractères (`feat: fiche du livre`). Aucune attribution d'IA dans les commits ni les PR.
- Jamais de tiret cadratin ni de demi-cadratin comme ponctuation, ni dans le code ni dans les textes du site. Séparateur : `|` ou `-`.
- Textes du site : vouvoiement, phrases courtes et naturelles.

## Socle à respecter dès le premier commit

- Secrets hors du dépôt : le projet lit son `.env` local puis `~/.config/cles/*.env` ; sur Vercel, variables d'environnement. Ne jamais afficher la valeur d'une clé.
- Validation côté serveur de toute entrée (zod), limite de débit et piège à robots sur le formulaire, messages d'erreur utiles.
- En-têtes de sécurité, pas de CORS ouvert.
- États de chargement, d'erreur et repli sans WebGL : si la 3D ne démarre pas, la version express s'affiche.
- prefers-reduced-motion respecté, navigation au clavier, textes alternatifs.
- README qui lance le projet en local en quelques minutes.
- Vérifier que chaque paquet ajouté existe et est le bon.

## Feuille de route

Voir `docs/feuille-de-route.md`.
