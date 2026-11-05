# APP VLM-Robotics avec 3DVerse

**Composants principaux** : React, Node.js, [3Dverse](https://3dverse.com), WebSockets (`ws`), ESLint, Vite

---

## Commandes disponibles

```bash

make              # Lancer toute les dépendances successivement
npm run dev       # Lancer le site en mode développement
npm run build     # Construire l'exécutable à déployer
npm run preview   # Lancer le site avec l’intégration Vite
npm run server    # Lancer le serveur WebSocket (en cours de développement)
npm run full      # Lancer le WSComm pour 3Dverse, voir doc ci dessous
```

---

## Accès à l'application (sans make)

1. Lancer le site (`npm run dev`).
2. Ouvrir **Google Chrome** (de préférence).
3. Naviguer vers : [http://localhost:5173/](http://localhost:5173/)
4. Entrer le **UUID de la scène** du projet 3DVerse **ou** cliquer sur **"Empty layout"** pour tester une version légère.

---

## Contrôles de navigation

### Souris

- **Click gauche** : Travelling
- **Molette** : Zoom in/out
- **Click droit** : Drag fluide
- **Click molette** : Drag fixe

(upcoming) : - **Double Click gauche** : AutoTravel

### Clavier

- `J` : Affiche le nom et l'UUID de toutes les entités
- `M` : Déplace l'entité principale de `Y +0.5` et `Z +5`
- `R` : Réinitialise la position de l'entité principale (`X=0`, `Y=0`, `Z=0`)
- `K` : Fixe la caméra sur l'entité principale _(WIP)_

---

## Utilisation du serveur WebSocket

### Websocket blender :

```
blender && import server_blender.py
run server_blender.py -> port 8767 (local)
python3 client_blender.py
>>> [name] [flag] [arg1] [arg2] [arg3]
```

Flags :
-I : Incrémente la position initiale
-P : Donne une position à l'objet
-A : Donne une orientation à l'objet (En Quaternions)

### Syntaxe :

```
[!commande] (entité_UUID) (valeur)
```

- Toute commande **doit** commencer par un `!`
- Les commandes non préfixées **ne seront pas interprétées**
- L'UUID correspond à l'identifiant unique d'une entité (exemple : `123-456-78910112-420`)
- La valeur est un **entier (`int`)**

### Aide :

```bash
!help
```

Affiche la liste des commandes disponibles.

---

## Développé par

- **David FRANCOIS** (`amoeb4`)
- **Clément BILLY** (`billygrosmollets`)

pour la société **VLM-Robotics**

https://www.linkedin.com/company/vlm-robotics/posts/?feedView=all
