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
