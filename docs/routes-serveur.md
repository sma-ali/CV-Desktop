# Étape 5 : les routes serveur

Ce document fixe le contrat de l'étape 5 : le formulaire de contact (`/api/contact`) et les signes de vie du coffret (`/api/signes-de-vie`). Il complète [`docs/gestes.md`](gestes.md) (fiches, coffret, store) et [`docs/scene-3d.md`](scene-3d.md) (architecture, interdits CSP), qui restent valables. Deux parties (contact, signes de vie) se sont construites en parallèle, chacune dans son worktree, puis une passe d'assemblage les a fusionnées sur `feat/routes-serveur`.

## Périmètre

1. **`/api/contact`** : POST seulement, en JSON (envoi par `fetch`) ou en `application/x-www-form-urlencoded` (formulaire sans JavaScript). Validation zod côté serveur avec les mêmes limites que le navigateur, piège à robots, saisie trop rapide, contrôle de l'origine, corps borné, limite de débit, envoi par Mailjet ou dry run.
2. **Le formulaire** : un composant client unique (`src/components/contact/ContactForm.tsx`), accessible, qui marche aussi sans JavaScript. Il apparaît dans la version express (section Contact, ancre `#contact`) et dans la fiche de la carte de visite du bureau.
3. **`/api/signes-de-vie`** : GET et HEAD. Lecture d'un JSON public (adresse dans `LIFE_SIGNS_URL`), validée et filtrée par liste blanche, avec cache et repli sur les données d'exemple. Jamais d'erreur 500.
4. **Le bureau** : la page se régénère toutes les 10 minutes, et le navigateur rafraîchit les signes de vie à l'ouverture de la fiche du coffret si leur mesure a plus de 10 minutes.

Aucune des deux routes n'envoie d'en-tête CORS.

## Fichiers

| Fichier                                   | Rôle                                                                                     |
| ----------------------------------------- | ---------------------------------------------------------------------------------------- |
| `src/lib/contact/rules.ts`                | limites, nettoyage, codes d'erreur et états, partagés par le navigateur et le serveur    |
| `src/lib/contact/schema.ts`               | schéma zod de la requête (serveur), bâti sur les fonctions de `rules.ts`                 |
| `src/lib/contact/rate-limit.ts`           | interface `RateLimiter`, implémentation en mémoire, `clientKey()` (IP)                   |
| `src/lib/contact/mailer.ts`               | interface `Mailer`, Mailjet par `fetch`, dry run                                         |
| `src/lib/contact/handler.ts`              | le traitement d'un POST, sans dépendance à Next (testé en Vitest)                        |
| `src/app/api/contact/route.ts`            | branche le traitement sur ses outils (limite, envoi, horloge, journal) ; 405 ailleurs    |
| `src/lib/env/server.ts`                   | lecture centralisée et validée (zod) des variables du serveur                            |
| `src/lib/env/shared-keys.ts`              | complète `process.env` par `~/.config/cles/*.env` en local                               |
| `src/content/contact/`                    | textes du formulaire en FR et EN, validés par zod                                        |
| `src/components/contact/`                 | le formulaire et son style                                                               |
| `src/lib/life-signs/schema.ts`            | format du JSON public (zod, serveur seulement, non exporté par `index.ts`)               |
| `src/lib/life-signs/source.ts`            | `readLifeSigns()` (résultat ou cause) et `getLifeSigns()` (avec repli), cache et en-tête |
| `src/app/api/signes-de-vie/route.ts`      | GET et HEAD                                                                              |
| `src/components/desk/lifeSignsRefresh.ts` | rafraîchissement à l'ouverture du coffret (pur, testé), appelé par `DeskShell`           |

`src/lib/env/server.ts` et `src/lib/life-signs/source.ts` ne doivent jamais entrer dans le navigateur. Le paquet `server-only` n'est pas installé : `src/lib/env/server.ts` lève une erreur si `window` existe, et `source.ts` l'importe. La règle ESLint « ni zod ni module de contenu côté client » couvre aussi `src/components/contact/**` et `src/lib/contact/rules.ts`.

## `/api/contact`

### Champs

| Champ      | Règle                                                                                                                                                                                          |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `name`     | 1 à 100 caractères après nettoyage (espaces réduits), sans caractère de contrôle ni caractère de format invisible (`\p{Cf}`, marques de direction comprises), sauf les liants U+200C et U+200D |
| `email`    | adresse simple en ASCII imprimable, 254 caractères au plus, rien qui puisse déborder dans un en-tête d'e-mail                                                                                  |
| `message`  | 10 à 5000 caractères ; retours à la ligne ramenés à `\n` (même longueur que dans le navigateur)                                                                                                |
| `locale`   | `fr` ou `en`                                                                                                                                                                                   |
| `website`  | le piège (`HONEYPOT_FIELD`) : caché, hors de l'ordre de tabulation, `aria-hidden`, `autocomplete="off"`                                                                                        |
| `typingMs` | millisecondes depuis l'affichage du formulaire, mesurées par le navigateur ; toujours là en JSON, absent sans JavaScript                                                                       |
| `from`     | `express` ou `desk` : la page où renvoyer un envoi sans JavaScript                                                                                                                             |

L'horodatage de début de saisie est devenu une durée (`typingMs`) : l'horloge du visiteur peut être décalée de celle du serveur. Elle part de l'affichage du formulaire, pas de la première frappe : un message collé et des champs remplis par le navigateur ne passent pas pour un robot.

### Ordre du traitement

1. Origine : un en-tête `Origin` présent doit être celui du site (`SITE_URL`, `src/lib/site.ts`) ou l'hôte de la requête (local, aperçus Vercel), en HTTPS hors de `localhost`, `127.0.0.1` et `[::1]`. Sinon 403. Sans `Origin`, la requête passe (la limite de débit tient toujours).
2. Type de contenu : JSON ou formulaire, sinon 415.
3. Taille : 16 ko lus au plus (`Content-Length` d'abord, puis lecture bornée du flux), sinon 413.
4. Piège rempli (toute valeur non vide, quel que soit son type) : succès apparent, rien n'est envoyé.
5. Validation zod : 400 avec le code de chaque champ fautif.
6. Saisie trop rapide (`typingMs` sous 3000, ou absent d'un envoi JSON) : succès apparent, rien n'est envoyé.
7. Configuration de l'envoi absente : 503.
8. Limite de débit : 429 avec `Retry-After`.
9. Envoi : 502 s'il échoue.

Les envois refusés avant la limite (invalides, piège, saisie trop rapide) ne consomment pas le quota.

### Réponses

En JSON : `{ ok: true }` ou `{ ok: false, error, fields? }`, avec `Cache-Control: no-store`.

| Code           | Statut | Quand                                                              |
| -------------- | ------ | ------------------------------------------------------------------ |
| `validation`   | 400    | corps illisible ou champ fautif ; `fields` donne `{ champ: code }` |
| `origin`       | 403    | origine étrangère                                                  |
| `too_large`    | 413    | corps de plus de 16 ko                                             |
| `unsupported`  | 415    | autre type de contenu ; aussi en 405 (avec `Allow: POST`)          |
| `rate_limited` | 429    | limite atteinte, avec `Retry-After` en secondes                    |
| `send_failed`  | 502    | Mailjet a refusé, ou délai dépassé                                 |
| `unavailable`  | 503    | variables d'envoi absentes hors dry run                            |

Codes des champs : `required`, `too_short`, `too_long`, `invalid`. Les codes sont stables : le formulaire les traduit par le module de contenu (`content.contact`), en FR et en EN.

GET, PUT, PATCH, DELETE et OPTIONS répondent 405 avec `Allow: POST` ; HEAD suit GET.

### Sans JavaScript

Un formulaire envoyé en `x-www-form-urlencoded` reçoit un 303 vers sa page d'origine : `/<locale>/express?contact=<état>#contact-<état>`, ou `/<locale>?contact=<état>#contact-<état>` depuis le bureau (champ caché `from=desk`). États : `envoye`, ou `erreur-<code>` pour chaque code ci-dessus. La page étant statique, le message s'affiche par CSS `:target` : les huit messages sont rendus une seule fois par page, par `ExpressCv`.

### Le formulaire

- Labels, `aria-describedby` vers les erreurs, `aria-invalid`, région `aria-live` pour l'état, focus sur le premier champ fautif, bouton désactivé pendant l'envoi, compteur de longueur du message.
- Vérification dans le navigateur avec les fonctions de `rules.ts` (mêmes limites que le serveur, sans zod).
- Version express : replié dans un `<details>` « Écrire un message », ouvert d'office quand on arrive par `#contact`, masqué à l'impression (le CV tient toujours sur une page A4).
- Fiche de la carte : affiché directement, sur le papier clair. Échap dans un champ rempli ne repose pas la carte.
- Mention sous le formulaire : le message arrive par e-mail, via Mailjet, et n'est pas conservé sur le site.

### L'envoi

Interface `Mailer`. En production, Mailjet par `fetch`, sans SDK, sur l'API Send v3.1 (https://dev.mailjet.com/email/guides/send-api-v31/) :

- `POST https://api.mailjet.com/v3.1/send`, authentification Basic `MAILJET_API_KEY:MAILJET_API_SECRET`, délai de 8 s (`AbortSignal.timeout`) ;
- un message en texte seul (`TextPart`, aucune partie HTML), `From` = `CONTACT_FROM` (nom affiché « alismaani.fr »), `To` = `CONTACT_TO`, `ReplyTo` = le visiteur, sujet « Message du site | <nom> », corps avec nom, e-mail, langue et message, suivi des ouvertures et des clics coupé ;
- succès quand `Messages[0].Status` vaut `success` ; sinon `MailerError` avec la cause, le statut HTTP et les codes `mj-xxxx`, jamais le texte d'erreur de Mailjet (il peut contenir l'adresse du visiteur).

Dry run (`CONTACT_DRY_RUN=1`) : rien n'est envoyé, le journal dit seulement « message accepté (dry run) » et la longueur du message. La réponse d'un message passé par l'envoi porte alors `X-Contact-Dry-Run: sent`, jamais un succès de façade (piège, saisie trop rapide) : les tests de bout en bout prouvent ainsi que l'envoi a eu lieu. Hors dry run, l'en-tête n'existe pas.

Le journal ne contient jamais le texte du message, l'adresse du visiteur ni une valeur de clé.

### La limite de débit et sa limite

Interface `RateLimiter`, implémentation en mémoire (fenêtre glissante) :

- par IP : 5 envois par 10 minutes et 10 par heure, pour qu'une seule adresse ne vide pas le plafond de l'instance (`CONTACT_RATE_LIMIT_MAX` change le maximum, pour les tests de bout en bout où tout vient de localhost) ;
- pour toute l'instance : 30 envois par heure et 100 par jour, pour protéger le quota Mailjet (tous relevés au maximum par IP s'il est plus haut) ;
- IP : premier élément de `x-forwarded-for` (posé par Vercel), sinon `x-real-ip`, sinon « inconnu » (tous les inconnus partagent la même limite). Une IPv6 est ramenée à son préfixe /64 (un abonné en dispose d'ordinaire en entier) ; une IPv4 transcrite en IPv6 (`::ffff:a.b.c.d`) reste cette IPv4 ;
- table bornée à 10 000 clés : les entrées expirées sont purgées, puis les plus anciennes.

Le plafond de l'instance a un revers : des envois venus de nombreuses adresses peuvent l'atteindre et couper le formulaire pour tous, jusqu'à ce que la fenêtre glisse (le visiteur garde le lien vers l'e-mail).

Limite honnête : cette mémoire vit dans une instance du serveur. Sur Vercel, plusieurs instances peuvent tourner en même temps, chacune compte de son côté, et une instance froide repart de zéro. Elle freine un visiteur trop pressé ou un robot naïf, sans plus. La vraie barrière est une règle de limite de débit du pare-feu Vercel sur `/api/contact`, à poser à la mise en ligne. L'interface permet de brancher plus tard un stockage partagé sans toucher à la route.

## `/api/signes-de-vie`

GET et HEAD, toujours 200, JSON `LifeSigns`, `Cache-Control: public, max-age=0, s-maxage=600, stale-while-revalidate=86400`. Les données d'exemple (repli) ne restent que 30 s au CDN (`public, max-age=0, s-maxage=30`) : une panne passagère de la source ne s'affiche pas 10 minutes. POST, PUT et DELETE reçoivent le 405 de Next.

### Lecture du JSON public

`getLifeSigns()` (`src/lib/life-signs/source.ts`) est partagé par la route et la page du bureau :

- adresse dans `LIFE_SIGNS_URL`, https seulement, variable serveur jamais envoyée au navigateur ;
- `fetch` hors du cache de fetch de Next (`cache: 'no-store'`), délai de 3 s, redirections refusées, 32 Kio lus au plus ;
- le résultat validé, quelques centaines d'octets, est gardé 600 s par `unstable_cache` (clé `life-signs`, sans l'adresse). Un échec n'est jamais gardé : la lecture suivante réessaie ;
- validation zod (`schema.ts`), puis liste blanche : seuls les champs connus ressortent, même si le JSON en contient d'autres ;
- au moindre échec, données d'exemple (`sample: true`). Le journal dit « signes de vie : données d'exemple, cause <code> », sans l'adresse. Codes : `missing_url` (journalisé une fois par processus), `invalid_url`, `http_error`, `timeout`, `network`, `too_large`, `invalid_json`, `invalid_format`.

La page du bureau exporte `revalidate = 600` : le premier affichage porte des signes de vie de moins de 10 minutes environ.

### Format attendu

```jsonc
{
  "running": 3, // entier >= 0, projets en marche
  "lastActivityAt": "2026-11-02T10:16:00Z", // ISO 8601 avec fuseau (Z ou +01:00)
  "since": "2026-09-16T09:00:00Z", // premier jour, <= lastActivityAt
  "activity": [3, 5, 2, 0, 4, 6, 3, 7, 5, 2, 6, 4, 8, 5], // exactement 14 entiers >= 0, du plus ancien au jour de la mesure
  "measuredAt": "2026-11-02T12:30:00Z", // >= lastActivityAt, au plus 5 min dans le futur
}
```

Tout autre champ est ignoré ; `sample` est posé par le serveur. Le fichier doit être servi en https, sans redirection, et peser moins de 32 Kio. Il ne doit contenir aucun nom, aucun hôte, aucune adresse. Pour élargir le format plus tard (le contenu du coffret va changer) : ajouter le champ dans `schema.ts` et dans `LifeSigns` (`types.ts`), puis dans `toLifeSigns()` (`lifeSignsRefresh.ts`).

### Dans le navigateur

À l'ouverture de la fiche du coffret (y compris par `?prendre=chest`), si la mesure envoyée par le serveur a 10 minutes ou plus, `DeskShell` fait un GET `/api/signes-de-vie` (délai de 5 s), sans bloquer la fiche. Jamais deux requêtes à la fois, pas de nouvel essai avant 60 s. En cas d'échec ou de réponse mal formée, il garde ce qu'il a ; il ne remplace jamais de vraies données par l'exemple. La forme reçue est vérifiée sans zod (`toLifeSigns`, liste blanche). Les données d'exemple restent affichées comme telles (« Données d'exemple »).

### Pourquoi pas le cache de fetch

Le cache de fetch de Next (`next.revalidate`) lit tout le corps d'une réponse 200 pour le garder, avant la borne de 32 Kio, et cite l'adresse dans son journal au-delà de 2 Mo ; il ne garde pas une réponse en erreur (la source serait relue à chaque requête) et retire le signal, donc le délai, pendant un renouvellement en arrière-plan. Garder le résultat validé évite les trois.

### Limite connue

La page du bureau est régénérée toutes les 10 minutes : si la source échoue à ce moment-là, la page garde les données d'exemple jusqu'à la régénération suivante. La route, elle, ne les garde que 30 s.

## Variables d'environnement

| Variable                 | Rôle                                                                                         |
| ------------------------ | -------------------------------------------------------------------------------------------- |
| `CONTACT_TO`             | boîte qui reçoit les messages                                                                |
| `CONTACT_FROM`           | expéditeur, validé chez Mailjet, sur un domaine qu'Ali contrôle                              |
| `MAILJET_API_KEY`        | clé de l'API Mailjet                                                                         |
| `MAILJET_API_SECRET`     | secret de l'API Mailjet                                                                      |
| `CONTACT_DRY_RUN`        | `1` : rien n'est envoyé, le message accepté est seulement journalisé                         |
| `CONTACT_RATE_LIMIT_MAX` | envois permis par IP et par 10 minutes (5 par défaut)                                        |
| `LIFE_SIGNS_URL`         | adresse https du JSON public des signes de vie ; vide, le site affiche les données d'exemple |
| `CLES_DIR`               | remplace `~/.config/cles` (les tests le fixent à `/nonexistent`)                             |

Toutes sont lues et validées dans `src/lib/env/server.ts` (`readContactConfig`, `readRateLimitMax`, `readLifeSignsUrl`). Aucune n'a le préfixe `NEXT_PUBLIC_` : aucune n'entre dans le JavaScript du navigateur.

En local, Next charge le `.env` du projet, puis `shared-keys.ts` complète `process.env` avec `~/.config/cles/*.env`, sans jamais écraser une variable déjà posée et sans reprendre d'autres noms que ceux du site (`SHARED_KEY_NAMES`). Ce chargement ne tourne pas sur Vercel (`VERCEL` défini). Aucune valeur n'est jamais affichée : s'il manque des variables d'envoi, le journal donne leurs noms seulement.

`.env.example` liste les noms, sans valeur.

## Vérifier

- `npm run check` : Vitest couvre `src/lib/contact/{rules,rate-limit,mailer,handler}.test.ts` (limites, nettoyage, 429 et purge, origine, types de contenu, taille, piège, Mailjet avec `fetch` simulé : requête exacte, erreurs, délai, dry run, configuration manquante), `src/lib/env/env.test.ts`, `src/lib/life-signs/source.test.ts` (succès, liste blanche, chaque cause de repli, cache), `src/app/api/signes-de-vie/route.test.ts` et `src/components/desk/lifeSignsRefresh.test.ts`. Vitest fixe `CLES_DIR=/nonexistent`.
- `npm run test:e2e` : le serveur de test tourne en `CONTACT_DRY_RUN=1`, avec `CLES_DIR=/nonexistent` et `CONTACT_RATE_LIMIT_MAX=1000` (`webServer.env` de `playwright.config.ts`, que Playwright ajoute à `process.env`), sans `LIFE_SIGNS_URL`.
  - `contact.spec.ts` : version express FR et EN (les envois réussis attendent 3 s et vérifient `X-Contact-Dry-Run` : le message est passé par l'envoi), erreurs 400, 429 et 503 simulées (`page.route`), état d'envoi, piège, axe en clair et en sombre, envoi sans JavaScript, fiche de la carte FR et EN.
  - `contact-api.spec.ts` (ordinateur seulement) : 405, 415, 403, 413, 400, 303, piège (texte et non textuel), JSON sans durée, succès passé par l'envoi (`X-Contact-Dry-Run`).
  - `signes.spec.ts` : la route et ses en-têtes (ordinateur seulement), rafraîchissement à l'ouverture du coffret, horloge avancée d'une heure, en succès et en 503.

## Mise en ligne

Fait le 06/11/2026 :

- Compte Mailjet en offre gratuite, sans moyen de paiement.
- Domaine alismaani.fr validé chez Mailjet (enregistrement TXT de propriété), SPF complété (`include:spf.mailjet.com`, à côté de `include:mx.ovh.com`) et DKIM (`mailjet._domainkey`) posés chez OVH. Expéditeur : une adresse sur alismaani.fr.
- Variables `CONTACT_TO`, `CONTACT_FROM`, `MAILJET_API_KEY` et `MAILJET_API_SECRET` sur le projet Vercel (les deux clés en Sensitive), sans `CONTACT_DRY_RUN`. Premier envoi réel reçu.

- DMARC posé en `p=none` (observation, sans adresse de rapport).
- Règle du pare-feu Vercel « Limite du formulaire » : `/api/contact`, fenêtre fixe de 60 s, 10 requêtes par IP, puis 429. Vérifiée : 10 réponses 400 puis 429.

Reste à faire :

- Choisir où vit le JSON public des signes de vie, et ce qu'il mesure, puis poser `LIFE_SIGNS_URL`.

## À valider avec Ali

- Les textes du formulaire (`src/content/contact/`), dont la mention sur Mailjet.
- Le sujet de l'e-mail, toujours en français, et le nom d'expéditeur « alismaani.fr ».
- Le formulaire replié derrière « Écrire un message » dans la version express, ou ouvert d'office.
