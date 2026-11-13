# Simulacre

Une expérience d'intelligence autonome centrée sur **Néo**. Il naît sans rien savoir et apprend tout seul : son corps, les objets, les mots, les autres, le monde autour de sa maison.

## Le principe : on n'apprend rien à Néo

- **Inné** : 4 gestes de mains (pousser, tirer, saisir, frapper), les besoins de tout humain (faim, soif, fatigue, hygiène) et une très forte envie d'explorer, d'essayer et de s'améliorer.
- **Appris** : tout le reste. Les autres gestes (monter, tourner, grimper, sauter), la marche (corps articulé qui essaie des milliers de mouvements), la course, la force, l'endurance, les causes et effets, les familles d'objets, les mots, les habitudes.
- Son cerveau ne contient **aucun nom** : seulement des identifiants anonymes et des sensations. Le monde (`world.js`) ne lui donne que ce qu'il perçoit et ce qu'il ressent après un geste.
- Chaque étape de vie (Nourrisson → Homme) demande des **compétences physiques et mentales** d'un humain de cet âge.
- **Interdits des parents** : Néo n'a le droit d'aller que dans certaines zones (la maison, puis le jardin, l'étage, l'aire de jeux, le chemin du commerce, tout le quartier). Ils s'élargissent à chaque étape. Personne ne les lui explique : il les découvre en étant retenu, s'en souvient, puis l'oublie peu à peu et retente. Les autres maisons lui sont toujours fermées.

## Règles du jeu (à respecter pour toute évolution)

1. **On n'apprend rien à Néo.** Personne ne lui explique rien, ni par des mots ni par des tutoriels.
2. **Les autres n'apprennent pas seuls.** Ce que Néo comprend passe d'abord à ses amis du parc, puis à sa famille quand il en sait plus qu'elle.
3. **Langage des autres personnages** : il est tiré du langage de Joseph et Marie et débloqué par étape de vie (nourrisson : rien ; bébé : quelques mots simples ; puis de plus en plus — `MOTS_PAR_ETAPE` dans `french-words.js`). Juliette parle comme ses parents. On y ajoute les mots de Néo si Néo est au moins aussi jeune que l'enfant. Un personnage plus jeune que Néo suivra la règle de base.
4. **Tout a un nom.** Chaque chose ajoutée au monde reçoit un nom (avec son article, voir `avecArticle` dans `world.js`) ; ce nom entre automatiquement dans le langage de Joseph, Marie et Juliette, qui peuvent alors en parler.
5. **Caractère vivant.** Chaque personnage a des traits (curiosité, persévérance, prudence, sociabilité, empathie, créativité, indépendance, patience, optimisme, leadership) qui évoluent avec ce qu'il vit.
6. **Interdits évolutifs.** Les zones permises à Néo s'élargissent avec l'âge ; jamais chez les autres.

## Le cerveau (`cerveau.js`)

Chaque région garde sa propre mémoire ; le carrefour des **associations** les croise en permanence.

| Région | Ce qu'elle retient |
|---|---|
| sens | ce qu'il perçoit à l'instant |
| corps | gestes, capacités (équilibre, course, force, endurance), défis physiques réussis ou non |
| espace | endroits connus, limites rencontrées |
| objets | choses repérées, familles par ressemblance, signes écrits |
| mémoire | essais et souvenirs complets |
| causes | « si je fais ceci à cela, il se passe ça » |
| social | personnes, ce qu'elles lui apportent |
| émotions | humeur, peur, frustration, ennui, confiance en soi |
| envies | questions, objectifs, habitudes |
| associations | liens entre tout, rappel des souvenirs, idées par analogie, vérifiées par l'essai |

## Le monde

La villa de Néo et son jardin ; à côté, l'aire de jeux publique des petits voisins ; la rue, le commerce de proximité (seule source de nourriture, sans argent, avec un droit par personne et par jour) et le grand quartier résidentiel (kits Kenney, CC0).

Les autres personnages n'apprennent pas seuls : ce que Néo comprend passe d'abord à ses amis du parc, puis à sa famille quand il en sait plus qu'elle. Un ordinateur à l'étage, que seul Néo peut utiliser, n'est expliqué nulle part.

## Fichiers

| Fichier | Rôle |
|---|---|
| `cerveau.js` | le cerveau de Néo (régions + associations) |
| `world.js` | ce que le monde perçoit et répond |
| `sim.js` | la simulation (Web Worker) : corps, besoins, déplacements, étapes |
| `monde.js`, `quartier.js` | interdits, commerce, visites ; plan du quartier |
| `home.js`, `bricolage.js`, `play.js`, `social.js`, `dialogue.js` | maison, jardin et outils, jouets, relations, paroles |
| `app.js`, `*-view.js` | la scène 3D |
| `dashboard.js`, `index.html`, `styles.css` | l'interface |
| `test/` | tests sans navigateur |

## Lancer

```
npm test            # tests
npm run build       # construit dist/
cd dist && python3 -m http.server 8000
```
