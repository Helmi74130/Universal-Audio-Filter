// Stockage des audio contexts et filtres pour chaque élément
const audioContexts = new Map();

// Settings actuels
let currentSettings = {
  enabled: false,
  bassReduction: 50,
  voiceBoost: 10,
  volume: 100
};

// Charger les paramètres au démarrage
async function initSettings() {
  try {
    const result = await chrome.storage.local.get({
      enabled: false,
      bassReduction: 50,
      voiceBoost: 10,
      volume: 100
    });
    currentSettings = result;

    // Si le filtre était activé, l'appliquer automatiquement
    if (currentSettings.enabled) {
      processAllMediaElements();
    }
  } catch (error) {
    console.error('Erreur lors du chargement des settings:', error);
  }
}

// Créer les filtres audio pour un élément média
function createAudioFilters(mediaElement) {
  try {
    // Vérifier si l'élément a déjà un context
    if (audioContexts.has(mediaElement)) {
      return audioContexts.get(mediaElement);
    }

    // Vérifier si l'élément a déjà été connecté à un AudioContext
    // (évite l'erreur DOMException: "AudioNode already connected")
    if (mediaElement.dataset.audioFilterApplied === 'true') {
      console.warn('Élément déjà traité par un AudioContext, ignoré');
      return null;
    }

    // Créer un nouveau AudioContext
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const source = audioContext.createMediaElementSource(mediaElement);

    // Marquer l'élément comme traité
    mediaElement.dataset.audioFilterApplied = 'true';

    // Highpass Filter - Enlève les basses (musique)
    const highpassFilter = audioContext.createBiquadFilter();
    highpassFilter.type = 'highpass';
    highpassFilter.frequency.value = 300; // Fréquence de base
    highpassFilter.Q.value = 0.7;

    // Peaking Filter - Boost les voix (fréquences moyennes/hautes)
    const voiceFilter = audioContext.createBiquadFilter();
    voiceFilter.type = 'peaking';
    voiceFilter.frequency.value = 3000; // Zone des voix
    voiceFilter.Q.value = 1.0;
    voiceFilter.gain.value = 0; // Sera ajusté dynamiquement

    // Lowpass Filter optionnel - Réduit les aigus excessifs
    const lowpassFilter = audioContext.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.value = 8000; // Garde les aigus naturels
    lowpassFilter.Q.value = 0.7;

    // Gain Node - Contrôle du volume
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;

    // Connecter les filtres en série
    source
      .connect(highpassFilter)
      .connect(voiceFilter)
      .connect(lowpassFilter)
      .connect(gainNode)
      .connect(audioContext.destination);

    // Stocker le contexte et les filtres
    const filterData = {
      context: audioContext,
      source: source,
      highpass: highpassFilter,
      voice: voiceFilter,
      lowpass: lowpassFilter,
      gain: gainNode,
      element: mediaElement
    };

    audioContexts.set(mediaElement, filterData);

    return filterData;

  } catch (error) {
    // Erreur détaillée pour le debugging
    if (error.name === 'InvalidStateError' || error.name === 'NotSupportedError') {
      console.warn('Élément audio/vidéo déjà connecté à un AudioContext, ignoré:', error.message);
    } else {
      console.error('Erreur lors de la création des filtres audio:', error.name, error.message);
    }
    return null;
  }
}

// Appliquer les paramètres de filtre
function applyFilterSettings(filterData) {
  if (!filterData || !currentSettings.enabled) return;

  try {
    const { highpass, voice, gain } = filterData;

    // Calculer la fréquence du highpass selon la réduction des basses
    // 0% = 200Hz (peu de filtrage), 100% = 1000Hz (filtrage agressif)
    const bassFreq = 200 + (currentSettings.bassReduction / 100) * 800;
    highpass.frequency.setValueAtTime(bassFreq, filterData.context.currentTime);

    // Appliquer le boost de voix (0-20 dB)
    voice.gain.setValueAtTime(currentSettings.voiceBoost, filterData.context.currentTime);

    // Appliquer le volume (0-100%)
    const volumeValue = currentSettings.volume / 100;
    gain.gain.setValueAtTime(volumeValue, filterData.context.currentTime);

  } catch (error) {
    console.error('Erreur lors de l\'application des filtres:', error);
  }
}

// Supprimer les filtres et restaurer l'audio normal
function removeFilters(mediaElement) {
  try {
    const filterData = audioContexts.get(mediaElement);
    if (filterData) {
      // Déconnecter tous les nœuds
      filterData.source.disconnect();
      filterData.highpass.disconnect();
      filterData.voice.disconnect();
      filterData.lowpass.disconnect();
      filterData.gain.disconnect();

      // Fermer le contexte audio
      filterData.context.close();

      // Retirer le marqueur de l'élément
      delete mediaElement.dataset.audioFilterApplied;

      // Supprimer de la map
      audioContexts.delete(mediaElement);
    }
  } catch (error) {
    console.error('Erreur lors de la suppression des filtres:', error);
  }
}

// Traiter un élément média
function processMediaElement(mediaElement) {
  try {
    if (!currentSettings.enabled) {
      // Si désactivé, supprimer les filtres existants
      removeFilters(mediaElement);
      return;
    }

    // Créer les filtres si nécessaire
    let filterData = audioContexts.get(mediaElement);
    if (!filterData) {
      filterData = createAudioFilters(mediaElement);
    }

    // Appliquer les paramètres
    if (filterData) {
      applyFilterSettings(filterData);
    }

  } catch (error) {
    console.error('Erreur lors du traitement de l\'élément média:', error);
  }
}

// Traiter tous les éléments média sur la page
function processAllMediaElements() {
  try {
    // Trouver tous les éléments audio et vidéo
    const mediaElements = document.querySelectorAll('audio, video');

    mediaElements.forEach(element => {
      // Ignorer les éléments déjà traités si filtre désactivé
      if (!currentSettings.enabled && !audioContexts.has(element)) {
        return;
      }

      processMediaElement(element);
    });

  } catch (error) {
    console.error('Erreur lors du traitement des éléments média:', error);
  }
}

// Observer les nouveaux éléments média ajoutés dynamiquement
const observer = new MutationObserver((mutations) => {
  if (!currentSettings.enabled) return;

  // Utiliser un Set pour éviter les doublons
  const elementsToProcess = new Set();

  mutations.forEach((mutation) => {
    mutation.addedNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        // Vérifier si c'est un élément média
        if (node.tagName === 'AUDIO' || node.tagName === 'VIDEO') {
          elementsToProcess.add(node);
        }

        // Vérifier les enfants
        const mediaElements = node.querySelectorAll ? node.querySelectorAll('audio, video') : [];
        mediaElements.forEach(element => {
          elementsToProcess.add(element);
        });
      }
    });
  });

  // Traiter tous les éléments collectés
  elementsToProcess.forEach(element => {
    // Délai pour laisser l'élément se charger
    setTimeout(() => {
      processMediaElement(element);
    }, 100);
  });
});

// Démarrer l'observation du DOM (attendre que le body soit disponible)
function startObserving() {
  if (document.body) {
    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  } else {
    // Attendre que le DOM soit prêt
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        observer.observe(document.body, {
          childList: true,
          subtree: true
        });
      });
    }
  }
}

startObserving();

// Écouter les messages du popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'updateFilters') {
    currentSettings = message.settings;

    if (currentSettings.enabled) {
      // Activer et appliquer les filtres
      processAllMediaElements();
    } else {
      // Désactiver tous les filtres
      audioContexts.forEach((filterData, element) => {
        removeFilters(element);
      });
    }

    sendResponse({ success: true });
  }

  return true; // Indique qu'on va répondre de manière asynchrone
});

// Initialiser au chargement de la page
initSettings();

// Gérer les changements de page (SPA)
let lastUrl = location.href;
new MutationObserver(() => {
  const url = location.href;
  if (url !== lastUrl) {
    lastUrl = url;

    // Nettoyer les anciens contexts
    audioContexts.forEach((filterData, element) => {
      if (!document.body.contains(element)) {
        removeFilters(element);
      }
    });

    // Retraiter les éléments si activé
    if (currentSettings.enabled) {
      setTimeout(() => {
        processAllMediaElements();
      }, 1000);
    }
  }
}).observe(document, { subtree: true, childList: true });

// Nettoyer lors du déchargement
window.addEventListener('beforeunload', () => {
  audioContexts.forEach((filterData, element) => {
    removeFilters(element);
  });
});
