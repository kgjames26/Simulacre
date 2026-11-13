# Versions de Simulacre

Numérotation : `vMAJEUR.MINEUR` (fichier `VERSION`, affichée en bas du site).
- MAJEUR : changement de fond (nouveau système, refonte).
- MINEUR : amélioration ou correction.

Pour publier : modifier `VERSION`, committer, puis `git tag vX.Y`.

- v2.5 : apprentissage libre (parc, jouets, gestes appris, courir), compétences par stade, cortex associatif (idées, souvenirs croisés)
- v2.4 : le temps fictif passe 144 fois plus vite (1 jour = 10 minutes de simulation)
- v2.3 : correctif mobile : barre de caméra et bulle « Ce que Néo perçoit » ne se chevauchent plus
- v2.2 : correctif : entrée dans l’expérience bloquée par un ancien cache
- v2.1 : interface simplifiée en 5 pages, vocabulaire clair, scène 3D améliorée
- v2.0 : cerveau en fichiers, contrat d'ignorance, nouvelle interface
- v1.0 : version initiale

## v2.5 (suite) — partage par paliers et entraide
- Personne d'autre n'apprend : niveaux écrits d'avance (amis du parc 6, Juliette 14, parents 30).
- Les savoirs publiés de Néo vont d'abord aux amis du parc, puis à chacun des autres quand Néo en sait plus que leur niveau.
- Envie d'aider = une règle, pas une méthode : qui apprécie quelqu'un veut qu'il aille mieux, avec une intensité liée au lien et au caractère (`care`). Néo va vers ceux qu'il aime bien quand ils vont moins bien ; ce qu'il fait ensuite dépend de ce qu'il a appris.
- Parents : calculs très rares (1 échange sur ~53), +1000 mots (3000 au total pour Joseph et Marie), +1000 phrases d'échange.
- Jardin : 3 pancartes (10 chiffres, 26 lettres, 500 mots avec un dessin emoji chacun), vues par Néo comme de simples lieux « écrits ».

## v2.6
- Un ordinateur à l'étage (seul Néo y accède, aucune explication). Ce que Néo y écrit vient de ce qu'il sait et arrive dans une boîte aux lettres mise en évidence ; ce que l'utilisateur y écrit, Néo le lit à l'écran.
- Néo ne sait pas si on lit ses messages ni à qui ils vont. Quand, seul, il écrit après une surprise, sous un besoin fort ou en se répétant, le message est signalé (« créateur ») avec son contexte : jour, heure, âge, dernier événement, mots connus.

## v2.7
- Joseph et Marie vieillissent quand Néo est adulte : cheveux gris, déplacements plus lents (×0,6), fatigue plus rapide donc davantage de sommeil. Marie n'arrose plus quand elle est âgée.
- Un arbre dans le jardin : Joseph le scie, le débite, empile le bois contre le mur de la maison et recharge le chauffage à bois quand il fait froid (saisons et nuits simulées). L'arbre repousse vite.
- Mur d'outils extérieur (scie, marteau, clous, colle à bois, vis, tournevis, arrosoir, tuyau d'eau, robinet) : seuls la scie, l'arrosoir et le tuyau sont utilisés par les adultes ; Néo peut toucher les autres ou assembler quelque chose de lui-même (plaisir et confiance, jamais demandé).
- 4 fleurs près de la maison, arrosées par Marie (arrosoir déposé, tuyau, remplissage, arrosage) : plaisir et confiance.
- Sentiments amoureux : tendresse, attirance, complicité ; actes (regard, main, cadeau, câlin, baiser, dispute) avec effets individuels ; une seule relation, sexe opposé, jamais la famille ; séparations possibles ; jamais un objectif.
- Confiance en soi ajoutée aux personnages. Tous les nouveaux objets sont modélisés en 3D (atelier-view.js).
- v2.7b : Joseph âgé n'ira plus au bois. La hache abat l'arbre (il tombe) et le débite vite ; la scie, plus lente, produit de jolies planches rangées près de la maison. L'arbre laisse tomber des pommes qui disparaissent après un moment ; Néo peut en manger (en saisissant), personne d'autre ne le sait.

## v2.8 — le quartier
- Monde cohérent avec les kits Kenney (routes, maisons de banlieue, mini-commerce, licence CC0) : maison de Néo, petits voisins juste à côté, routes et trottoirs, commerce de proximité à pied (≈ 65 m), grand quartier résidentiel plus loin.
- Accès : les autres propriétés sont fermées à Néo par les collisions ; jusqu'à 5 ans il ne sort pas de sa propriété (portail fermé).
- Maison de Néo : aucun invité avant l'adolescence ; ensuite un ami n'entre que s'il est accompagné d'un parent (Marie les fait entrer, les reçoit, les raccompagne).
- Pénurie : plus de réapprovisionnement magique. Le commerce est l'unique source, sans argent : quota de prélèvement par personne et par jour fictif (8), stock du commerce limité (60/jour). Joseph et Marie font les courses quand le garde-manger se vide.
- Camarades : ils ne progressent pas seuls ; ils reprennent en miroir ce que Néo a déjà fait sur les équipements du parc.
- Un commerçant silencieux tient la caisse. Personne n'explique jamais rien.
- Crédits : Kenney (kenney.nl), City Kit Roads, City Kit Suburban, Mini Shop — CC0.

## v3.0 — remise à plat
- Cerveau réorganisé en un seul fichier (`cerveau.js`) avec des régions claires (sens, corps, espace, objets, mémoire, causes, social, émotions, envies) et un carrefour d'associations. Capacités physiques (équilibre, course, force, endurance) et confiance en soi dans le cerveau.
- Interdits des parents évolutifs : maison → jardin → étage → aire de jeux → chemin du commerce → quartier. Néo est retenu au bord, s'en souvient, puis retente.
- Monde cohérent : l'aire de jeux devient un parc public à côté de la propriété (clôture, petite porte, entrée sur la rue) ; arbre et pancarte des mots ramenés dans le jardin ; plaque « A·L·E·X » retirée.
- Néo se déplace vraiment (vitesse liée à son équilibre) : il explore et apprend bien plus.
- Site refait : 4 pages (monde, cerveau, croissance, entourage), thème clair, mobile revu.
- Bugs corrigés : conversations jamais affichées, rendu 3D bloqué par les pommes, ordinateur jamais dessiné, courses impossibles (câlin des parents qui les retenait, marche coupée à 50 s), journal répétitif.
- Allègement : ancien système de « découvertes » et compteurs retirés, rendu de secours supprimé, construction automatique de la liste des fichiers.
- Nouvelle partie (sauvegarde v5).

## v3.1
- Sommeil : à chaque endormissement, le cerveau rejoue la journée (renforce les liens), efface les liens faibles, fusionne les souvenirs redondants, oublie les essais ratés et causes inutiles, puis rêve de choses vues mais peu explorées, qui deviennent des envies au réveil. Nouvel onglet « Ses nuits ».
- Caméra : plus de boutons +/− (roulette ou pincement) ; toucher un personnage le suit et zoome ; glisser arrête le suivi.
- Contacts : aucune partie du corps ne passe sous le sol ; les personnages ne se traversent plus (pas de côté, croisement dans les passages étroits).
- Démarche des personnages : accélération et freinage, virages progressifs, pas propre à chacun, contre-rotation bassin/épaules le long de la colonne (6 vertèbres), balancement des bras, genou fléchi, tête stable, respiration au repos.
- Le jeu démarre à vitesse réelle.

## v3.2
- Croissance : chaque étape de vie se déplie : ce qui est prévu, ce qui est en cours, ce qui a été accompli (avec la date).
- Les enfants du même âge que Néo ne parlent plus d'eux-mêmes : ils ne disent que des mots ou phrases que Néo a validés.
- Jauges du monde : tête triste à gauche, tête heureuse à droite, la barre entre les deux (rassasié, reposé, désaltéré, bien-être, confiance).
- Chaque chose du monde a un nom (avec son article) ; Joseph, Marie et Juliette en parlent en la montrant, Néo peut apprendre ces mots. Nouveaux lieux nommés : portail, petite porte, trottoir, rue, commerce, maison des voisins, tas de bois, robinet…
- Calculs des parents vraiment rares.
- Leadership pour chaque personnage ; celui de Néo se construit quand les autres le suivent ou reprennent ses découvertes. Les enfants qui en ont moins que lui le suivent.
- Carte : déplacement au doigt ou à la souris réparé (bloqué après avoir choisi un étage), bouton plein écran, bouton Étage/Rez corrigé, murs et toits transparents devant le personnage suivi.

## v3.3
- Traits de caractère pour tous (curiosité, persévérance, prudence, sociabilité, empathie, créativité, indépendance, patience, optimisme, leadership), qui évoluent avec ce que chacun vit ; ceux de Néo vivent dans son cerveau et influencent son exploration et son envie d'aider.
- Règle du langage des autres personnages : vocabulaire des parents débloqué par étape de vie (+ mots de Néo s'il est au moins aussi jeune) ; Juliette parle comme ses parents.
- Règle : toute chose nommée entre automatiquement dans le langage de Joseph, Marie et Juliette.
- Joseph et Marie : 6 000 mots (dont 3 000 pluriels et conjugaisons) et 2 000 phrases d'échange (au lieu de 1 000).
- Commerce : droit de 14 par personne et par jour (au lieu de 8) : toute la famille avait faim.
- Correction : « Regardu » dans d'anciennes phrases.

## v3.4 — affichage en panneaux
- Toutes les pages utilisent le même système : des boutons qui ouvrent des panneaux, avec des sous-panneaux (plusieurs niveaux). Chaque panneau a une icône, un titre, un sous-titre et une pastille de résumé ; leur état ouvert/fermé est retenu.
- Plus de contraste (texte plus sombre, barre du haut foncée, bordures et pastilles plus marquées).
- Boutons refaits (hauteur, bordures, survol, appui, focus) ; outils de la carte en groupes.
- Nouveau : les familles de choses (ressemblances) dans « Ce qu’il comprend ».

## v3.5
- Deux sortes de jauges, cohérentes partout, plus aucun pourcentage seul :
  - ce qui est bon ou mauvais (besoins, humeur, liens) : tête triste à gauche, tête épanouie à droite ; l'humeur se lit désormais « Se sent bien, Rassuré, Serein, Intéressé » ;
  - ce qui n'est ni bon ni mauvais (caractère, capacités, leadership, sentiments) : un mot à chaque bout (peu ↔ très, débutant ↔ expert), barre bleue.

## v3.6
- « Son entourage » devient « Sa sociabilité ». Les personnes sont classées par affinité avec Néo ; toucher un nom ouvre sa fiche : affinité avec Néo, compétences, caractère.
- Les liens deviennent un sous-panneau des personnes : on choisit un premier puis un second personnage pour voir leur relation.
- Vitesse : deux boutons clairs (×1 / Rapide). En rapide, la simulation va aussi vite que l'appareil le permet ; la vitesse réelle s'affiche en direct (ex. ×200). Menu Paramètres (⚙) : puissance allouée à la simulation (25 à 100 %).
- Tous les arbres (jardin, parc, quartier) se coupent à la hache et repoussent. Joseph abat ceux du jardin ; Néo peut prendre la hache (et d'autres outils) et abattre un arbre s'il le découvre.
- Les parents ne nourrissent plus Néo « par magie » : un repas prêt, sinon un en-cas pris dans le garde-manger. S'occuper de Néo crée de l'affinité.

## v3.7
- Mêmes règles de périmètre pour tous les PNJ que pour Néo, depuis leur propre maison et selon leur âge. Les quatre enfants du début vivent chez eux : Timéo et Nathan dans la maison à côté de l'aire de jeux, Lidia et Rose dans celle d'en face. Petits, ils restent à l'intérieur ; ils sortent dans leur jardin, puis vont à l'aire de jeux en grandissant. La nuit, ils rentrent.
- Juliette suit la règle des grands frères et sœurs : s'occuper de Néo et jouer avec lui, et aussi avec les autres de son âge ou plus grands.
- Des familles de tous âges dans toutes les maisons du quartier (≈100 habitants, invisibles dans la fenêtre de contrôle) : faim, nuit à la maison, courses au commerce avec le même quota, jeux au jardin et à l'aire de jeux, langage selon l'âge, caractère. Le commerce est approvisionné pour tout le quartier.
- La carte : dix copies de l'aire de jeux du début, une près de chaque petit pâté de maisons ; le quartier calculé est agrandi à toutes les maisons.
- Le leadership n'est plus mis en avant : c'est un trait de caractère parmi les autres.
- « Les liens entre deux personnes » passe au-dessus de la liste des personnes.
- Monde : « Ses conversations » montre en direct tout échange où Néo est impliqué (il parle ou on lui parle).
- Lyra s'appelle maintenant Lidia.
- Recommencer : on choisit l'étape de vie de départ. Le corps de Néo et ses permissions prennent l'âge choisi, et les proches aussi (sa sœur, ses amis, les voisins) ; son cerveau reste vierge.

## v3.8
- Vue du monde : un encadré « Néo dit, entend, pense » montre ce que Néo dit, ce qu'il entend et ce qu'il pense (« Je pense que… »), avec un haut-parleur pour l'écouter en synthèse vocale.
- Quand on s'adresse à Néo, la phrase commence par « Néo, … » ; quand Néo parle à quelqu'un, le nom de cette personne vient à la fin.
- « Ce qui se dit » : un haut-parleur « Écouter » à côté de « Tout le monde » ; l'ancien bouton du bas disparaît.
- À côté de la vitesse : l'année et le jour simulés (aussi sur téléphone).
- Croissance : « Où il en est » fusionne dans « Les étapes de sa vie ». « Son corps » (gestes, capacités, défis) passe du cerveau à la croissance.
- Nouvelles capacités : saut, psychomotricité, motricité fine, gestion de la douleur (elles grandissent avec ce qu'il fait : sauter, essayer, manipuler, se faire mal).
- Nouvelle page « Ses découvertes » : tout ce qu'il a trouvé, rangé par genre (corps, objets, jeux, aire de jeux, portes, endroits, besoins, personnes, mots, idées, familles, habitudes, lieux).
