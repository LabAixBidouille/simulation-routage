# Simulation de Routage

Ce projet est une application web pédagogique conçue pour illustrer le fonctionnement des algorithmes de routage. L'application simule la transmission d'un "paquet" (représenté par une balle) entre des nœuds (représentant des élèves ou des points de réseau) disposés sur un canevas. Le chemin emprunté par le paquet est calculé en temps réel à l'aide de la triangulation de Delaunay et plusieurs stratégies de routage peuvent être testées.

## Fonctionnalités

- **Ajout et modification de nœuds** : Cliquez sur le canevas pour ajouter des nœuds. Chaque nœud peut changer de couleur (représentant son adresse) via un clic.
- **Triangulation de Delaunay** : Affichage automatique du graphe généré par la triangulation des nœuds.
- **Simulation de routage** : Animation du déplacement du paquet entre les nœuds avec diverses stratégies de sélection (voisin le plus proche de la destination, angle le plus proche, plus petit saut, premier voisin sur la gauche, aléatoire sans réutiliser une arrête, etc.).
- **Visualisation du chemin** : Les segments empruntés par le paquet sont affichés et leurs statistiques (nombre d'arrêtes, longueur totale du chemin, distance directe) sont calculées et présentées.
- **Drag & Drop** : Possibilité de déplacer les nœuds, avec réinitialisation automatique du chemin si un nœud du chemin est modifié.

## Prérequis

- [Node.js](https://nodejs.org/) (version 14 ou supérieure)
- npm (ou yarn)

## Installation

Clonez ce dépôt GitHub :

```bash
git clone https://github.com/LabAixBidouille/simulation-routage.git
cd simulation-routage
```

Installez les dépendances :

```bash
npm install
```

## Lancer l'application en local
Pour démarrer le serveur de développement :

```bash
npm run dev
```
Ouvrez ensuite votre navigateur à l'adresse http://localhost:3000.

## Structure du projet
- app/ ou pages/ : Contient les pages de l'application (selon la version Next.js utilisée).
- components/ : Composants React, notamment le composant principal GraphSimulator qui gère la simulation.
- styles/ : Feuilles de style, notamment si vous utilisez Tailwind CSS ou un autre framework CSS.
- public/ : Fichiers statiques (images, etc.).

## Contribuer
Les contributions sont les bienvenues ! Soumettez une pull request en expliquant clairement les changements apportés.

## Licence
Ce projet est sous licence MIT. Consultez le fichier LICENSE pour plus d'informations.

