// Contenu de la bibliothèque = {commande} : {valeur}

const help = "!time : Affiche l'heure\n!help : Affiche ce panneau\n";

export const messageLibrary = {
  "!help": help,
  1: "A",
  2: "AA",
  3: "AAA",
  "!time": () => new Date().toLocaleTimeString(),
};
