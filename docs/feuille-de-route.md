# Feuille de route

Chaque étape se termine par un site qui tourne, des tests verts et un commit. On montre le résultat à Ali avant de passer à la suivante.

## 1. Socle

Next.js (App Router) + TypeScript strict, ESLint, Prettier, Vitest, Playwright, CI GitHub Actions (lint, types, tests unitaires, E2E). Module de contenu FR/EN typé et validé par zod, rempli depuis le CV. Tests du contenu : aucun champ vide, mêmes clés en FR et en EN, aucun tiret cadratin.

## 2. Version express d'abord

La page CV en HTML, FR/EN, accessible, imprimable, avec métadonnées et données structurées (Person). Elle sert aussi de repli sans WebGL. C'est la page la plus importante pour un recruteur : elle doit être parfaite avant la 3D.

## 3. Le bureau en 3D

Port du prototype en composants R3F : plateau, lampe, écran au code TypeScript, objets du CV, décor, lumière selon l'heure du visiteur, arrivée (lampe qui s'allume, montée de caméra), mode auto, prefers-reduced-motion. Chargement progressif : la page s'affiche tout de suite, la scène arrive ensuite.

## 4. Les gestes

Prendre un objet (il se soulève et tourne), le retourner, le faire glisser avec de vraies collisions, fiches liées à chaque objet. Nouveaux objets pour Netherbrain et Homelab. Coffret scellé et ses signes de vie. Mise en page téléphone sans bords coupés.

## 5. Les routes serveur

`/api/contact` : validation zod, piège à robots, limite de débit, envoi d'e-mail, réponses d'erreur claires, tests. `/api/signes-de-vie` : lecture d'un JSON public avec cache et repli sur des données d'exemple, tests.

Fait sur la branche `feat/routes-serveur`, en attente de la validation d'Ali : contrat dans [`routes-serveur.md`](routes-serveur.md). Restent pour la mise en ligne : compte Mailjet, adresse expéditrice et DNS, variables sur Vercel, règle du pare-feu Vercel sur `/api/contact`, hébergement du JSON public des signes de vie.

## 6. Tests réels et performances

Suite Playwright des parcours : clic sur un objet, retournement, glisser, formulaire, version express, bascule FR/EN, téléphone. Budget de poids, Lighthouse, test sur un vrai téléphone.

## 7. Mise en ligne

Dépôt public, projet Vercel, variables d'environnement, bascule d'alismaani.fr avec son accord, mentions légales.
