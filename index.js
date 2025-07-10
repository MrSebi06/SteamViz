import ForceGraph3D from "3d-force-graph";
import SpriteText from "https://esm.sh/three-spritetext";

// ===== CONFIGURATION =====
const CONFIG = {
    // Configuration des nœuds
    node: {
        textHeight: 100,
        textOffsetY: -100.0,
        colorBy: "genres",
        minSize: 1,
        maxSize: 10000
    },

    // Configuration des liens
    link: {
        opacity: 0.3,
        minWidth: 0.5,
        maxWidth: 20
    },

    // Configuration de la force physique
    physics: {
        chargeStrength: -10000
    },

    // Sources de données
    dataUrl: "data/games.json",
    configUrl: "data/config.json"
};

// Variables pour stocker les valeurs min/max des liens et nœuds
let linkValueRange = {
    min: 0,
    max: 1
};

let nodeValueRange = {
    min: 0,
    max: 1
};

// ===== FONCTIONS UTILITAIRES =====
/**
 * Interpolation linéaire entre deux valeurs
 * @param {number} start - Valeur de départ
 * @param {number} end - Valeur d'arrivée
 * @param {number} t - Facteur d'interpolation (0 à 1)
 * @returns {number} - Valeur interpolée
 */
function lerp(start, end, t) {
    return start + (end - start) * t;
}

/**
 * Normalise une valeur entre min et max (retourne une valeur entre 0 et 1)
 * @param {number} value - Valeur à normaliser
 * @param {number} min - Valeur minimale
 * @param {number} max - Valeur maximale
 * @returns {number} - Valeur normalisée entre 0 et 1
 */
function normalize(value, min, max) {
    if (max - min === 0) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
}

/**
 * Calcule l'épaisseur d'un lien en fonction de sa valeur
 * @param {number} value - Valeur du lien
 * @returns {number} - Épaisseur calculée
 */
function calculateLinkWidth(value) {
    // Normalise la valeur entre 0 et 1
    const normalizedValue = normalize(value, linkValueRange.min, linkValueRange.max);

    // Interpole entre l'épaisseur min et max
    return lerp(CONFIG.link.minWidth, CONFIG.link.maxWidth, normalizedValue);
}

/**
 * Calcule la taille d'un nœud en fonction de sa valeur
 * @param {number} value - Valeur du nœud
 * @returns {number} - Taille calculée
 */
function calculateNodeSize(value) {

    const normalizedValue = normalize(value, nodeValueRange.min, nodeValueRange.max);
    return lerp(CONFIG.node.minSize, CONFIG.node.maxSize, normalizedValue);
}

/**
 * Charge le fichier de configuration
 * @returns {Promise<Object>} - Promesse contenant la configuration
 */
async function loadConfiguration() {
    try {
        const response = await fetch(CONFIG.configUrl);
        if (!response.ok) {
            throw new Error(`Erreur lors du chargement de la configuration: ${response.status}`);
        }
        const configData = await response.json();

        // Met à jour les valeurs min/max des liens
        linkValueRange.min = configData.links_min_value || 0;
        linkValueRange.max = configData.links_max_value || 1;

        // Met à jour les valeurs min/max des nœuds
        nodeValueRange.min = configData.node_min_value || 0;
        nodeValueRange.max = configData.node_max_value || 1;
        return configData;
    } catch (error) {
        console.error("Erreur lors du chargement de la configuration:", error);
        return {
            links_min_value: 0,
            links_max_value: 1,
            node_min_value: 0,
            node_max_value: 1
        };
    }
}

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

    // Adapte la taille du texte en fonction de la taille du nœud
    // On utilise une interpolation pour que le texte soit proportionnel
    const nodeSize = calculateNodeSize(node.value);
    const textSizeRatio = 0.4; // Le texte fait 40% de la taille du nœud
    sprite.textHeight = nodeSize * textSizeRatio;

    // Ajuste la position verticale en fonction de la taille
    sprite.center.y = -(nodeSize * 0.15); // Position dynamique sous le nœud

    return sprite;
}

/**
 * Redimensionne le graphique pour s'adapter à son conteneur
 */
function resizeGraph() {
    // Vérifie que le graphique est initialisé
    if (!graph) return;

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

/**
 * Initialise et configure le graphique 3D
 * @returns {ForceGraph3D} - Instance du graphique configuré
 */
function initializeGraph() {
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

        // Définit la taille du nœud
        .nodeVal((node) => calculateNodeSize(node.players))

        // === Configuration des liens ===
        // Définit la largeur des liens avec interpolation linéaire
        .linkWidth((link) => calculateLinkWidth(link.value))

        // Définit l'opacité des liens
        .linkOpacity(CONFIG.link.opacity);

    // Configure la force de répulsion entre les nœuds
    graph.d3Force('charge').strength(CONFIG.physics.chargeStrength);

    return graph;
}

// ===== INITIALISATION =====
// Variable globale pour stocker l'instance du graphique
let graph;

// Fonction asynchrone pour initialiser l'application
async function initializeApp() {
    try {
        // 1. Charge d'abord la configuration
        await loadConfiguration();

        // 2. Initialise le graphique avec les valeurs chargées
        graph = initializeGraph();

        // 3. Redimensionne initialement le graphique
        resizeGraph();

        // 4. Configure l'observation du redimensionnement
        setupResizeObserver(graphContainer);

        graph.onEngineStop(() => {
            graph.zoomToFit(400);
            console.log("Zoom to fit activé");
        })

        console.log("Application initialisée avec succès");

    } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
    }
}

// Lance l'initialisation au chargement de la page
initializeApp();