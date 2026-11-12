# Assets 3D ALEX

- `low_poly_home_1.png` : image reçue sous l’extension `.glb`, vérifiée comme PNG.
- `popo_stickman_helmet.glb/part-000.bin` à `part-056.bin` : modèle Popo original, découpé sans perte en 57 morceaux binaires pour le dépôt et reconstitué par le chargeur.
- `characters.json` : 15 profils avec tailles, stades d’âge, teints et couleurs de combinaison pour Alex, sa famille et ses amis.
- `load-character.js` : fonctions pour reconstruire le modèle et appliquer l’apparence du profil choisi.

Les profils partagent le même maillage de base. La taille et les couleurs sont réglées à l’affichage, ce qui évite de stocker une copie lourde pour chaque personnage.

Les modèles de villa, de personnages cartoon et d’aires de jeux restent à ajouter.
