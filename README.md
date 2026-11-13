# Simulacre

Une expérience de simulation de vie centrée sur **Néo**, un personnage qui part d'une feuille blanche et apprend tout seul, dans une villa et un parc fermés.

## Le principe : on n'apprend rien à Néo

- Il naît avec **4 gestes de base** (pousser, tirer, saisir, frapper), des **besoins** (faim, soif, fatigue, hygiène) et une **forte envie** d'essayer et de découvrir.
- Les autres gestes (monter, tourner, grimper, sauter, courir) s'apprennent en les tentant.
- Tout ce qu'il comprend est rangé par lui dans des fichiers (`brain.js`) : sensations, essais, causes et effets, familles d'objets, mots, envies, habitudes.
- Son cerveau ne contient **aucun nom d'objet ou de personne** : seulement des identifiants anonymes. Le monde (`world.js`) ne lui donne que des perceptions et des sensations après ses gestes.
- Chaque stade de vie (Nourrisson → Homme) a des **compétences physiques et mentales** à acquérir, lues dans son corps et dans ses fichiers (`evaluateStageGoals` dans `sim.js`).

## Fichiers principaux

| Fichier | Rôle |
|---|---|
| `brain.js` | le cerveau de Néo (fichiers, essais, causes, concepts, objectifs) |
| `world.js` | le monde côté observateur : perception, réactions des objets et des équipements |
| `sim.js` | la simulation (Web Worker) : corps, besoins, déplacements, stades |
| `dialogue.js`, `social.js`, `play.js`, `home.js` | conversations, relations, jeux, maison |
| `app.js`, `dashboard.js`, `index.html`, `styles.css` | l'interface et la scène 3D |
| `test/` | tests sans navigateur (ignorance, reproductibilité, stades) |

## Lancer

```
npm test            # tests
npm run build       # construit le dossier dist/
cd dist && python3 -m http.server 8000
```

Puis ouvrir http://localhost:8000. La 3D charge Three.js depuis un CDN.

## Versions

Numérotation `vMAJEUR.MINEUR` (fichier `VERSION`, historique dans `VERSIONS.md`).

## Crédits
Modèles 3D du quartier : Kenney (kenney.nl) — City Kit Roads, City Kit Suburban, Mini Shop, licence CC0.
