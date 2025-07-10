import ForceGraph3D from "3d-force-graph";
import SpriteText from "https://esm.sh/three-spritetext";

// ===== CONFIGURATION =====
const CONFIG = {
    // Configuration des nœuds
    node: {
        textHeight: 6,
        textOffsetY: -2.0,
        colorBy: "group"
    },

    // Configuration des liens
    link: {
        opacity: 0.7,
        // Largeur basée sur la racine carrée de la valeur
        widthCalculation: (value) => Math.sqrt(value)
    },

    // Configuration de la force physique
    physics: {
        chargeStrength: -1200
    },

    // Données source
    dataUrl: "data/test.json"
};

// ===== FONCTIONS UTILITAIRES =====
/**
 * Crée un objet texte 3D pour afficher le nom du nœud
 * @param {Object} node - Le nœud contenant les données
 * @returns {SpriteText} - Un sprite de texte 3D
 */
function createNodeLabel(node) {
    const sprite = new SpriteText(node.name);

    // Désactive l'écriture en profondeur pour éviter les problèmes de rendu
    sprite.material.depthWrite = false;

    // Applique la couleur du nœud au texte
    sprite.color = node.color;

    // Configure la taille et la position du texte
    sprite.textHeight = CONFIG.node.textHeight;
    sprite.center.y = CONFIG.node.textOffsetY;

    return sprite;
}

/**
 * Redimensionne le graphique pour s'adapter à son conteneur
 */
function resizeGraph() {
    const container = document.getElementById("3d-graph");
    const width = container.clientWidth;
    const height = container.clientHeight;

    graph.width(width).height(height);
}

/**
 * Configure un observateur pour redimensionner automatiquement le graphique
 * @param {HTMLElement} element - L'élément à observer
 */
function setupResizeObserver(element) {
    // Vérifie si ResizeObserver est supporté par le navigateur
    if (!window.ResizeObserver) {
        console.warn("ResizeObserver n'est pas supporté par ce navigateur");
        return;
    }

    const resizeObserver = new ResizeObserver((entries) => {
        // Redimensionne le graphique à chaque changement de taille
        entries.forEach(() => resizeGraph());
    });

    resizeObserver.observe(element);
}

// ===== INITIALISATION DU GRAPHIQUE =====
const graphContainer = document.getElementById("3d-graph");

// Création et configuration du graphique 3D
const graph = new ForceGraph3D(graphContainer)
    // Charge les données depuis le fichier JSON
    .jsonUrl(CONFIG.dataUrl)

    // === Configuration des nœuds ===
    // Affiche le nom du nœud au survol
    .nodeLabel((node) => node.name)

    // Colorie automatiquement les nœuds selon leur groupe
    .nodeAutoColorBy(CONFIG.node.colorBy)

    // Crée un objet 3D personnalisé pour chaque nœud (le texte)
    .nodeThreeObject(createNodeLabel)

    // Étend l'objet 3D au lieu de le remplacer (garde la sphère + ajoute le texte)
    .nodeThreeObjectExtend(true)

    // Définit la taille du nœud basée sur sa valeur
    .nodeVal((node) => node.value)

    // === Configuration des liens ===
    // Définit la largeur des liens selon leur valeur
    .linkWidth((link) => CONFIG.link.widthCalculation(link.value))

    // Définit l'opacité des liens
    .linkOpacity(CONFIG.link.opacity);

// Configure la force de répulsion entre les nœuds
graph.d3Force('charge').strength(CONFIG.physics.chargeStrength);

// ===== INITIALISATION =====
// Redimensionne initialement le graphique
resizeGraph();

// Configure l'observation du redimensionnement
setupResizeObserver(graphContainer);