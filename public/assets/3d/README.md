# Assets 3D ALEX

- `low_poly_home_1.png` : image reçue sous l’extension `.glb`, vérifiée comme PNG.
- `popo_stickman_helmet.glb/part-000.bin` à `part-056.bin` : personnage de base Popo, reconstitué sans perte par `load-character.js`.
- `big_housse.glb.gz/part-000.bin` à `part-105.bin` : maison source compressée sans perte en gzip, à décompresser avec `loadHouseModel()`.
- `characters.json` : 15 profils de personnage avec stades, échelles, teints et couleurs.
- `load-character.js` : reconstitution des assets et application des variantes.

La maison source fait 10,1 Mo. Elle est conservée en gzip (2,96 Mo) pour réduire le transfert. Les modèles loft et aires de jeux restent à ajouter.
