# L'usine et la nouvelle intro

Décision du 04/11/2026 : le coffret scellé devient une mini usine, et l'écran de chargement à l'ampoule laisse place à un écran plus sobre, suivi d'une arrivée où les objets tombent un à un.

## L'intro

1. **Écran de chargement** (`src/components/desk/Intro.tsx`, rendu par le serveur) : fond noir, « Ali Smaani », et un trait fin qui se trace au rythme du chargement réel (`introProgress`, `core/loading.ts`). Le rôle `progressbar` et son nom « Préparation du bureau » restent pour les lecteurs d'écran ; le lien « Lire le CV sans attendre » aussi. Sans JavaScript, il ne s'affiche pas ; si JavaScript ne démarre jamais, il s'efface seul au bout de 12 s.
2. **La chute** (`src/scene/core/drop.ts`, constantes `DROP`) : dans une pénombre (`DUSK_AMBIENT`, `NIGHT_FADE`), les 19 corps du bureau tombent un à un à leur place dans l'ordre de `DROP_ORDER` (gros objets du CV, petits, décor), penchés pendant la chute, avec un petit rebond et un choc sonore (si le son est ouvert). Avant son départ, un corps n'est pas dessiné (`body.waiting`). Le casque, pendu à son support, ne tombe pas ; l'écran reste fixe.
3. **La lampe en dernier** : elle est la dernière à tomber, et s'allume à `ARRIVAL.lampOn` (3.1 s), juste après. Le reste de la frise (écran, code, LED, fenêtre, HUD) suit, recalé pour que l'arrivée finisse toujours à `SETTLE` (10.4 s) : les liens de test en `?t=11000` restent valables.
4. Gestes : ni clic ni glisser avant `ARRIVAL.lampOn + 0.25` (on ne prend pas un objet qui tombe). Mouvement réduit : rien ne tombe, l'arrivée est sautée comme avant.

## L'usine

- **Modèle** (`src/scene/items/Factory.tsx`) : halle en brique à trois toits, bureau aux fenêtres allumées, cheminée qui fume, tapis roulant qui sort des cassettes. Même encombrement et même forme physique que le coffret ; l'identifiant interne reste `chest` (paramètres `?prendre=chest`, tests, physique). Présentée, elle fait un demi-tour (mode `spin`) ; le tremblement du coffret et son bruit sont retirés. Son rythme suit `activityPulse` (`factory.ts`).
- **Fiche** (`FactoryPanel.tsx`, `factoryView.ts`) : état « En marche | dernière vidéo il y a… », circuit en cinq étapes (validation humaine mise en avant), chiffres globaux (chaînes, vidéos, vidéos par jour, vues et j'aime en « plus de N » arrondi vers le bas), puis un genre par onglet (récits de fantasy, philosophie, billes 3D, quiz) avec ses lignes et son graphique sur 14 jours. Onglets ARIA, flèches gauche et droite, Début et Fin.
- **Données** : champ `factory` facultatif du JSON public (`src/lib/life-signs/schema.ts`), validé par zod côté serveur et vérifié à nouveau dans le navigateur (`lifeSignsRefresh.ts`). Sans lui, la fiche garde l'ancien bloc des signes de vie.

```json
"factory": {
  "channels": 7, "videos": 412, "perDay": 5, "views": 2431000, "likes": 38412,
  "genres": {
    "fantasy":    { "views": 312400, "retention": 41, "rejected": 14, "minutes": 22, "activity": [14 entiers] },
    "philosophy": { "views": 0, "activity": [14 entiers] },
    "marbles":    { "views": 0, "activity": [14 entiers] },
    "quiz":       { "views": 0, "activity": [14 entiers] }
  }
}
```

`retention`, `rejected` (en %) et `minutes` sont facultatifs : absents, leur ligne ne s'affiche pas.

## Règles de confidentialité

- Aucun nom de chaîne, de compte, de plateforme, ni aucun lien dans la fiche : des genres seulement. Testé dans `src/content/content.test.ts`.
- Les chiffres de l'exemple (`sample.ts`) viennent de la maquette : ils sont affichés avec la mention « Données d'exemple » et doivent être recomptés avant la mise en ligne (le nombre de chaînes compte celles produites par l'usine, publication automatique ou validée à la main).
