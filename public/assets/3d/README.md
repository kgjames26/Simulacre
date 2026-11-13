# Assets 3D ALEX

- `low_poly_home_1.png` : image reçue sous l’extension `.glb`, vérifiée comme PNG.
- `popo_stickman_helmet.glb/part-000.bin` à `part-056.bin` : personnage Popo de base, reconstitué sans perte par `load-character.js`.
- `big_housse.glb.gz/part-000.bin` à `part-105.bin` : modèle de villa compressé sans perte en gzip, chargé par `loadHouseModel()`.
- `kids_playground._cyprus_v_1.1.zip/part-000.bin` à `part-147.bin` : archive Cyprus conservée sans perte. Elle contient `scene.gltf`, `scene.bin`, les textures et `license.txt`; `loadPlaygroundSourceZip()` la reconstitue.
- `characters.json` : profils de Néo à plusieurs âges et des autres personnages.
- `load-character.js` : fonctions de reconstitution et d’application des variantes.

Le modèle loft, l’autre structure de jeu et le personnage cartoon restent à ajouter.
