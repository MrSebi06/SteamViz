import ForceGraph3D from "3d-force-graph";
import { UnrealBloomPass } from "https://esm.sh/three/examples/jsm/postprocessing/UnrealBloomPass.js";
import SpriteText from "https://esm.sh/three-spritetext";

// ===== CONFIGURATION =====
const CONFIG = {
  // Configuration des nœuds
  node: {
    textHeight: 10,
    textOffsetY: 0.0,
    colorBy: "genres", // Mode de coloration par défaut
    minSize: 1,
    maxSize: 10000,
  },

  // Configuration des liens
  link: {
    opacity: 0.3,
    minWidth: 0.5,
    maxWidth: 30,
  },

  // Configuration de la force physique
  physics: {
    chargeStrength: -20000,
  },

  // Sources de données
  dataUrl: "data/games.json",
  configUrl: "data/config.json",
};

// Variables globales pour les données et le graphique
let graph;
let originalData = null; // Données originales complètes
let filteredData = null; // Données filtrées selon le slider
let currentColorMode = "genres"; // Mode de coloration actuel
let currentGenreFilter = "all"; // Genre actuellement sélectionné pour le filtrage
let genreColorMap = new Map(); // Map pour stocker les couleurs par genre
let maxNodeCount = 4000; // Valeur max du slider

// Variables pour stocker les valeurs min/max des liens et nœuds
let linkValueRange = {
  min: 0,
  max: 1,
};

let nodeValueRange = {
  min: 0,
  max: 1,
};

let linksCountRange = {
  min: 0,
  max: 1,
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
 * Convertit une valeur HSL en couleur hexadécimale
 * @param {number} h - Teinte (0-360)
 * @param {number} s - Saturation (0-100)
 * @param {number} l - Luminosité (0-100)
 * @returns {string} - Couleur au format hexadécimal
 */
function hslToHex(h, s, l) {
  l /= 100;
  const a = (s * Math.min(l, 1 - l)) / 100;
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

/**
 * Génère une couleur basée sur un index et le nombre total d'éléments
 * Répartit les couleurs sur tout le spectre de teinte
 * @param {number} index - Index de l'élément
 * @param {number} total - Nombre total d'éléments
 * @returns {string} - Couleur au format hexadécimal
 */
function generateSpectrumColor(index, total) {
  // Répartit les teintes sur 360 degrés
  const hue = (index * 360) / total;
  // Saturation élevée pour des couleurs vives
  const saturation = 85;
  // Luminosité modérée pour une bonne lisibilité
  const lightness = 55;

  return hslToHex(hue, saturation, lightness);
}

/**
 * Génère une couleur bleue basée sur une valeur normalisée
 * @param {number} normalizedValue - Valeur entre 0 et 1
 * @returns {string} - Couleur au format hexadécimal
 */
function generateBlueColor(normalizedValue) {
  // Palette de bleu : du bleu très pâle au bleu très foncé
  const lightness = lerp(85, 25, normalizedValue); // De 85% (pâle) à 25% (foncé)
  const saturation = lerp(30, 90, normalizedValue); // De 30% à 90% de saturation
  const hue = 220; // Teinte bleue

  return hslToHex(hue, saturation, lightness);
}

/**
 * Calcule l'épaisseur d'un lien en fonction de sa valeur
 * @param {number} value - Valeur du lien
 * @returns {number} - Épaisseur calculée
 */
function calculateLinkWidth(value) {
  const normalizedValue = normalize(
    value,
    linkValueRange.min,
    linkValueRange.max,
  );
  return lerp(CONFIG.link.minWidth, CONFIG.link.maxWidth, normalizedValue);
}

/**
 * Calcule la taille d'un nœud en fonction de sa valeur
 * @param {number} value - Valeur du nœud
 * @returns {number} - Taille calculée
 */
function calculateNodeSize(value) {
  const normalizedValue = normalize(
    value,
    nodeValueRange.min,
    nodeValueRange.max,
  );
  return lerp(CONFIG.node.minSize, CONFIG.node.maxSize, normalizedValue);
}

// ===== FONCTIONS DE LISTE DÉROULANTE DES GENRES =====
/**
 * Remplit la liste déroulante avec tous les genres disponibles
 */
function populateGenreDropdown() {
  const genreSelect = document.getElementById("genre-select");

  // Vide la liste (garde seulement "Tous les genres")
  genreSelect.innerHTML = '<option value="all">Tous les genres</option>';

  if (!originalData || !originalData.nodes) return;

  // Collecte tous les genres uniques
  const allGenres = new Set();
  originalData.nodes.forEach((node) => {
    const genres = node.genres.split(",").map((g) => g.trim());
    genres.forEach((genre) => allGenres.add(genre));
  });

  // Trie les genres alphabétiquement et les ajoute à la liste
  const sortedGenres = Array.from(allGenres).sort();
  sortedGenres.forEach((genre) => {
    const option = document.createElement("option");
    option.value = genre;
    option.textContent = genre;
    genreSelect.appendChild(option);
  });
}

/**
 * Filtre les nodes selon le genre sélectionné
 * @param {Array} nodes - Tableau des nodes à filtrer
 * @returns {Array} - Tableau des nodes filtrés
 */
function filterNodesByGenre(nodes) {
  if (currentGenreFilter === "all") {
    return nodes;
  }

  return nodes.filter((node) => {
    const nodeGenres = node.genres.split(",").map((g) => g.trim());
    return nodeGenres.includes(currentGenreFilter);
  });
}

// ===== FONCTIONS DE MODAL =====
/**
 * Formate un nombre avec des séparateurs de milliers
 * @param {number} num - Nombre à formater
 * @returns {string} - Nombre formaté
 */
function formatNumber(num) {
  return num.toLocaleString("fr-FR"); // Format français avec espaces comme séparateurs
}

/**
 * Affiche la modal avec les détails d'un node
 * @param {Object} node - Le node sélectionné
 */
function showNodeModal(node) {
  const modal = document.getElementById("node-modal");
  const nameElement = document.getElementById("modal-node-name");
  const genresElement = document.getElementById("modal-genres");
  const playersElement = document.getElementById("modal-players");
  const linksElement = document.getElementById("modal-links");

  // Remplit les informations
  nameElement.textContent = node.name;
  genresElement.textContent = node.genres;
  playersElement.textContent = formatNumber(node.players);
  linksElement.textContent = formatNumber(node.links);

  // Affiche la modal
  modal.style.display = "flex";
}

/**
 * Cache la modal de détails
 */
function hideNodeModal() {
  const modal = document.getElementById("node-modal");
  modal.style.display = "none";
}

/**
 * Configure les gestionnaires d'événements pour la modal
 */
function setupModalEventHandlers() {
  const modal = document.getElementById("node-modal");
  const closeButton = document.getElementById("modal-close");

  // Ferme la modal en cliquant sur le bouton de fermeture
  closeButton.addEventListener("click", hideNodeModal);

  // Ferme la modal en cliquant sur l'overlay (mais pas sur le contenu)
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      hideNodeModal();
    }
  });

  // Ferme la modal avec la touche Échap
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      hideNodeModal();
    }
  });
}

// ===== FONCTIONS DE COLORATION =====
/**
 * Normalise une chaîne de genres (trie et nettoie)
 * @param {string} genreString - Chaîne de genres séparés par des virgules
 * @returns {string} - Chaîne de genres normalisée
 */
function normalizeGenres(genreString) {
  return genreString
    .split(",")
    .map((genre) => genre.trim()) // Supprime les espaces
    .sort() // Trie alphabétiquement
    .join(", "); // Rejoint avec une virgule et un espace
}

/**
 * Assigne les couleurs selon le mode genres
 * @param {Array} nodes - Tableau des nœuds
 */
function assignGenreColors(nodes) {
  // Groupe les nodes par genres identiques
  const genreGroups = new Map();

  nodes.forEach((node) => {
    const normalizedGenres = normalizeGenres(node.genres);
    if (!genreGroups.has(normalizedGenres)) {
      genreGroups.set(normalizedGenres, []);
    }
    genreGroups.get(normalizedGenres).push(node);
  });

  // Génère les couleurs pour chaque groupe
  const genreTypes = Array.from(genreGroups.keys());
  genreColorMap.clear();

  genreTypes.forEach((genreType, index) => {
    const color = generateSpectrumColor(index, genreTypes.length);
    genreColorMap.set(genreType, color);
  });

  // Assigne les couleurs aux nodes
  nodes.forEach((node) => {
    const normalizedGenres = normalizeGenres(node.genres);
    node.color = genreColorMap.get(normalizedGenres);
  });
}

/**
 * Assigne les couleurs selon le nombre de links
 * @param {Array} nodes - Tableau des nœuds
 */
function assignLinksColors(nodes) {
  nodes.forEach((node) => {
    const normalizedLinks = normalize(
      node.links,
      linksCountRange.min,
      linksCountRange.max,
    );
    node.color = generateBlueColor(normalizedLinks);
  });
}

/**
 * Met à jour les couleurs des nodes selon le mode actuel
 */
function updateNodeColors() {
  if (!filteredData || !filteredData.nodes) return;

  if (currentColorMode === "genres") {
    assignGenreColors(filteredData.nodes);
  } else if (currentColorMode === "links_quantity") {
    assignLinksColors(filteredData.nodes);
  }

  // Rafraîchit le graphique
  if (graph) {
    graph.nodeColor((node) => node.color);
  }
}

// ===== FONCTIONS DE FILTRAGE =====
/**
 * Filtre les données selon le nombre de nodes souhaité et le genre sélectionné
 * @param {number} maxNodes - Nombre maximum de nodes à afficher
 */
function filterDataByNodeCount(maxNodes) {
  if (!originalData) return;

  // Applique d'abord le filtre par genre
  let genreFilteredNodes = filterNodesByGenre(originalData.nodes);

  // Puis prend les N premiers nodes, limité par le nombre disponible
  const availableNodes = genreFilteredNodes.length;
  const nodesToShow = Math.min(maxNodes, availableNodes);
  const filteredNodes = genreFilteredNodes.slice(0, nodesToShow);
  const nodeIds = new Set(filteredNodes.map((node) => node.id));

  // Filtre les liens pour ne garder que ceux entre les nodes sélectionnés
  const filteredLinks = originalData.links.filter(
    (link) =>
      nodeIds.has(link.source.id || link.source) &&
      nodeIds.has(link.target.id || link.target),
  );

  filteredData = {
    nodes: filteredNodes,
    links: filteredLinks,
  };

  // Met à jour les couleurs
  updateNodeColors();

  // Met à jour le graphique
  if (graph) {
    graph.graphData(filteredData);
  }

  // Met à jour l'affichage du nombre de nodes visibles
  updateNodeCountDisplay(filteredNodes.length, genreFilteredNodes.length);
}

/**
 * Met à jour l'affichage du compteur de nodes
 * @param {number} visible - Nombre de nodes actuellement visibles
 * @param {number} available - Nombre de nodes disponibles après filtrage par genre
 */
function updateNodeCountDisplay(visible, available) {
  const nodeCountValue = document.getElementById("node-count-value");
  const nodeCountMax = document.getElementById("node-count-max");
  const nodeSlider = document.getElementById("node-count-slider");

  if (nodeCountValue) {
    nodeCountValue.textContent = visible;
  }

  // Met à jour l'affichage du maximum selon le filtrage par genre
  if (nodeCountMax) {
    nodeCountMax.textContent = available;
  }

  // Met à jour la valeur max du slider selon le filtrage par genre
  if (nodeSlider) {
    nodeSlider.max = available;
    if (parseInt(nodeSlider.value) > available) {
      nodeSlider.value = available;
    }
  }
}

// ===== FONCTIONS DE CONFIGURATION =====
/**
 * Charge le fichier de configuration
 * @returns {Promise<Object>} - Promesse contenant la configuration
 */
async function loadConfiguration() {
  try {
    const response = await fetch(CONFIG.configUrl);
    if (!response.ok) {
      throw new Error(
        `Erreur lors du chargement de la configuration: ${response.status}`,
      );
    }
    const configData = await response.json();

    // Met à jour les valeurs min/max des liens
    linkValueRange.min = configData.links_min_value || 0;
    linkValueRange.max = configData.links_max_value || 1;

    // Met à jour les valeurs min/max des nœuds
    nodeValueRange.min = configData.node_min_value || 0;
    nodeValueRange.max = configData.node_max_value || 1;

    // Met à jour les valeurs min/max des links count
    linksCountRange.min = configData.node_min_links || 0;
    linksCountRange.max = configData.node_max_links || 1;

    // Le nombre max de nodes est maintenant fixé à 4000
    // mais on peut quand même récupérer le nombre réel de nodes disponibles
    // maxNodeCount reste à 4000 pour le slider

    return configData;
  } catch (error) {
    console.error("Erreur lors du chargement de la configuration:", error);
    return {
      links_min_value: 0,
      links_max_value: 1,
      node_min_value: 0,
      node_max_value: 1,
      node_min_links: 0,
      node_max_links: 1,
      nodes_count: 4000,
    };
  }
}

/**
 * Charge les données des jeux
 * @returns {Promise<Object>} - Promesse contenant les données
 */
async function loadGameData() {
  try {
    const response = await fetch(CONFIG.dataUrl);
    if (!response.ok) {
      throw new Error(
        `Erreur lors du chargement des données: ${response.status}`,
      );
    }
    return await response.json();
  } catch (error) {
    console.error("Erreur lors du chargement des données:", error);
    return { nodes: [], links: [] };
  }
}

// ===== FONCTIONS DE RENDU =====
/**
 * Crée un objet texte 3D pour afficher le nom du nœud
 * @param {Object} node - Le nœud contenant les données
 * @returns {SpriteText} - Un sprite de texte 3D
 */
function createNodeLabel(node) {
  const sprite = new SpriteText(node.name);
  sprite.material.depthWrite = false;
  sprite.color = node.color;

  const nodeSize = calculateNodeSize(node.players);

  // Calcul logarithmique de la taille du texte
  const minTextHeight = 2;
  const maxTextHeight = 100;

  // Normalise d'abord la taille du node entre 0 et 1
  const normalizedSize = normalize(
    nodeSize,
    CONFIG.node.minSize,
    CONFIG.node.maxSize,
  );

  // Applique une fonction logarithmique
  const logScale = Math.log1p(normalizedSize * 10) / Math.log1p(10);

  // Interpole entre min et max avec l'échelle logarithmique
  sprite.textHeight = lerp(minTextHeight, maxTextHeight, logScale);

  // Position au-dessus du node
  const nodeRadius = Math.cbrt(nodeSize);
  sprite.center.y = -(nodeRadius + 1) * 0.15;

  return sprite;
}

/**
 * Redimensionne le graphique pour s'adapter à son conteneur
 */
function resizeGraph() {
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
  if (!window.ResizeObserver) {
    console.warn("ResizeObserver n'est pas supporté par ce navigateur");
    return;
  }

  const resizeObserver = new ResizeObserver((entries) => {
    entries.forEach(() => resizeGraph());
  });

  resizeObserver.observe(element);
}

// ===== GESTIONNAIRES D'ÉVÉNEMENTS =====
/**
 * Configure les gestionnaires d'événements pour les contrôles
 */
function setupEventHandlers() {
  // Boutons de coloration
  const genresButton = document.getElementById("genres");
  const linksButton = document.getElementById("links_quantity");

  // Slider de contrôle du nombre de nodes
  const nodeSlider = document.getElementById("node-count-slider");
  const nodeCountValue = document.getElementById("node-count-value");
  const nodeCountMax = document.getElementById("node-count-max");

  // Liste déroulante des genres
  const genreSelect = document.getElementById("genre-select");

  // Détermine le nombre de nodes disponibles
  const availableNodes = originalData
    ? originalData.nodes.length
    : maxNodeCount;
  const initialValue = Math.min(maxNodeCount, availableNodes);

  // Met à jour les valeurs du slider
  nodeSlider.max = maxNodeCount;
  nodeSlider.value = initialValue;
  nodeCountValue.textContent = initialValue;
  nodeCountMax.textContent = maxNodeCount;

  // Gestion du bouton Genres
  genresButton.addEventListener("click", () => {
    currentColorMode = "genres";
    updateNodeColors();

    // Met à jour l'apparence des boutons
    genresButton.classList.add("active");
    linksButton.classList.remove("active");

    // Affiche/cache la liste déroulante selon le mode
    const genreFilter = document.querySelector(".genre-filter");
    genreFilter.style.display =
      currentColorMode === "genres" ? "block" : "none";
  });

  // Gestion du bouton Linked numbers
  linksButton.addEventListener("click", () => {
    currentColorMode = "links_quantity";
    updateNodeColors();

    // Met à jour l'apparence des boutons
    linksButton.classList.add("active");
    genresButton.classList.remove("active");

    // Cache la liste déroulante
    const genreFilter = document.querySelector(".genre-filter");
    genreFilter.style.display = "none";
  });

  // Gestion de la liste déroulante des genres
  genreSelect.addEventListener("change", (event) => {
    currentGenreFilter = event.target.value;
    const currentNodeCount = parseInt(nodeSlider.value);
    filterDataByNodeCount(currentNodeCount);
  });

  // Gestion du slider
  nodeSlider.addEventListener("input", (event) => {
    const nodeCount = parseInt(event.target.value);
    filterDataByNodeCount(nodeCount);
  });

  // Active le bouton genres par défaut
  genresButton.classList.add("active");

  // Affiche la liste déroulante par défaut (mode genres)
  const genreFilter = document.querySelector(".genre-filter");
  genreFilter.style.display = "block";
}

// ===== INITIALISATION DU GRAPHIQUE =====
const graphContainer = document.getElementById("3d-graph");

/**
 * Initialise et configure le graphique 3D
 * @returns {ForceGraph3D} - Instance du graphique configuré
 */
function initializeGraph() {
  const highlightNodes = new Set();
  const highlightLinks = new Set();
  let hoverNode = null;
  const graph = new ForceGraph3D(graphContainer)
    .backgroundColor("#000003")

    // === Configuration des nœuds ===
    .nodeLabel((node) => node.name)

    // Utilise la couleur personnalisée de chaque node
    .nodeColor((node) => node.color)

    // Crée un objet 3D personnalisé pour chaque nœud (le texte)
    .nodeThreeObject(createNodeLabel)

    // Étend l'objet 3D au lieu de le remplacer
    .nodeThreeObjectExtend(true)

    // Définit la taille du nœud
    .nodeVal((node) => calculateNodeSize(node.players))

    .onNodeClick((node) => {
      // Affiche la modal de détails
      showNodeModal(node);

      // Animation de zoom sur le node (comportement existant)
      const distance = calculateNodeSize(node.players) * 0.2;
      const distRatio = 1 + distance / Math.hypot(node.x, node.y, node.z);

      const newPos =
        node.x || node.y || node.z
          ? {
              x: node.x * distRatio,
              y: node.y * distRatio,
              z: node.z * distRatio,
            }
          : { x: 0, y: 0, z: distance };

      graph.cameraPosition(newPos, node, 3000);
    })
    .onNodeDragEnd((node) => {
      node.fx = node.x;
      node.fy = node.y;
      node.fz = node.z;
    })
    // === Configuration des liens ===
    .linkWidth((link) => calculateLinkWidth(link.value))
    .linkOpacity(CONFIG.link.opacity);

  // Configure la force de répulsion entre les nœuds
  graph.d3Force("charge").strength(CONFIG.physics.chargeStrength);

  return graph;
}

// ===== INITIALISATION =====
/**
 * Fonction asynchrone pour initialiser l'application
 */
async function initializeApp() {
  try {
    // 1. Charge d'abord la configuration
    await loadConfiguration();

    // 2. Charge les données des jeux
    originalData = await loadGameData();

    // 3. Initialise les données filtrées avec toutes les données
    filteredData = {
      nodes: [...originalData.nodes],
      links: [...originalData.links],
    };

    // 4. Assigne les couleurs initiales (mode genres)
    updateNodeColors();

    // 5. Remplit la liste déroulante des genres
    populateGenreDropdown();

    // 6. Initialise le graphique
    graph = initializeGraph();

    // 7. Charge les données dans le graphique
    graph.graphData(filteredData);

    // 8. Configure les gestionnaires d'événements
    setupEventHandlers();
    setupModalEventHandlers();

    // 9. Redimensionne initialement le graphique
    resizeGraph();

    // 10. Configure l'observation du redimensionnement
    setupResizeObserver(graphContainer);

    // 11. Zoom automatique à la fin du calcul de layout
    graph.onEngineStop(() => graph.zoomToFit(400));

    console.log("Application initialisée avec succès");
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
  }
}

// Lance l'initialisation au chargement de la page
initializeApp();
