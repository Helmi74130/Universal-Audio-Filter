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

    // ===== ALGORITHME D'ISOLATION VOCALE AVANCÉ =====

    // 1. NOTCH FILTERS - Éliminer les sub-bass et bass (musique électronique)
    const notch60Hz = audioContext.createBiquadFilter();
    notch60Hz.type = 'notch';
    notch60Hz.frequency.value = 60;
    notch60Hz.Q.value = 5.0; // Q élevé pour cibler précisément

    const notch120Hz = audioContext.createBiquadFilter();
    notch120Hz.type = 'notch';
    notch120Hz.frequency.value = 120;
    notch120Hz.Q.value = 5.0;

    const notch250Hz = audioContext.createBiquadFilter();
    notch250Hz.type = 'notch';
    notch250Hz.frequency.value = 250;
    notch250Hz.Q.value = 3.0;

    // 2. CASCADE DE HIGHPASS FILTERS - Couper agressivement les basses
    const highpass1 = audioContext.createBiquadFilter();
    highpass1.type = 'highpass';
    highpass1.frequency.value = 400; // Premier étage
    highpass1.Q.value = 1.5; // Q élevé pour pente raide

    const highpass2 = audioContext.createBiquadFilter();
    highpass2.type = 'highpass';
    highpass2.frequency.value = 500; // Second étage (cascade)
    highpass2.Q.value = 1.0;

    // 3. PEAKING FILTERS - Boost des fréquences vocales (zone 300Hz-3.5kHz)
    // Fondamentale vocale (warmth)
    const voiceLow = audioContext.createBiquadFilter();
    voiceLow.type = 'peaking';
    voiceLow.frequency.value = 800;
    voiceLow.Q.value = 1.5;
    voiceLow.gain.value = 6; // Boost modéré

    // Clarté vocale (intelligibilité)
    const voiceMid = audioContext.createBiquadFilter();
    voiceMid.type = 'peaking';
    voiceMid.frequency.value = 2000;
    voiceMid.Q.value = 2.0;
    voiceMid.gain.value = 12; // Boost agressif (sera ajusté)

    // Présence vocale (brillance)
    const voiceHigh = audioContext.createBiquadFilter();
    voiceHigh.type = 'peaking';
    voiceHigh.frequency.value = 3500;
    voiceHigh.Q.value = 2.0;
    voiceHigh.gain.value = 8;

    // 4. LOWPASS FILTER - Couper les cymbales et instruments aigus
    const lowpassFilter = audioContext.createBiquadFilter();
    lowpassFilter.type = 'lowpass';
    lowpassFilter.frequency.value = 4500; // Plus agressif que 8000Hz
    lowpassFilter.Q.value = 1.5; // Pente raide

    // 5. COMPRESSEUR DYNAMIQUE - Réduire la dynamique de la musique
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -30; // Commence à compresser tôt
    compressor.knee.value = 20; // Transition douce
    compressor.ratio.value = 12; // Compression agressive
    compressor.attack.value = 0.003; // Rapide
    compressor.release.value = 0.25; // Modéré

    // 6. GAIN NODES - Contrôle du volume et makeup gain
    const preGain = audioContext.createGain();
    preGain.gain.value = 1.5; // Boost avant compression

    const makeupGain = audioContext.createGain();
    makeupGain.gain.value = 2.5; // Compenser la compression

    const finalGain = audioContext.createGain();
    finalGain.gain.value = 1.0; // Volume final

    // ===== CONNEXION DE LA CHAÎNE DE FILTRES =====
    // L'ordre est crucial pour la qualité du résultat !
    source
      // Étape 1 : Éliminer les basses fréquences (musique)
      .connect(notch60Hz)
      .connect(notch120Hz)
      .connect(notch250Hz)
      .connect(highpass1)
      .connect(highpass2)

      // Étape 2 : Booster les fréquences vocales
      .connect(voiceLow)
      .connect(voiceMid)
      .connect(voiceHigh)

      // Étape 3 : Couper les hautes fréquences (cymbales, hi-hat)
      .connect(lowpassFilter)

      // Étape 4 : Compression dynamique
      .connect(preGain)
      .connect(compressor)
      .connect(makeupGain)

      // Étape 5 : Contrôle du volume final
      .connect(finalGain)
      .connect(audioContext.destination);

    // Stocker tous les filtres pour ajustement dynamique
    const filterData = {
      context: audioContext,
      source: source,

      // Filtres de suppression des basses
      notch60Hz: notch60Hz,
      notch120Hz: notch120Hz,
      notch250Hz: notch250Hz,
      highpass1: highpass1,
      highpass2: highpass2,

      // Filtres de boost vocal
      voiceLow: voiceLow,
      voiceMid: voiceMid,
      voiceHigh: voiceHigh,

      // Filtre passe-bas
      lowpass: lowpassFilter,

      // Compression et gain
      compressor: compressor,
      preGain: preGain,
      makeupGain: makeupGain,
      gain: finalGain,

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
    const currentTime = filterData.context.currentTime;

    // ===== 1. AJUSTEMENT DES FILTRES HIGHPASS (Réduction Basses) =====
    // 0% = 400Hz (filtrage modéré)
    // 50% = 500Hz (filtrage standard)
    // 100% = 800Hz (filtrage TRÈS agressif - coupe presque tout sauf voix)
    const bassReductionFactor = currentSettings.bassReduction / 100;

    const highpassFreq1 = 400 + (bassReductionFactor * 400); // 400-800Hz
    const highpassFreq2 = 500 + (bassReductionFactor * 300); // 500-800Hz

    filterData.highpass1.frequency.setValueAtTime(highpassFreq1, currentTime);
    filterData.highpass2.frequency.setValueAtTime(highpassFreq2, currentTime);

    // Ajuster aussi le Q des highpass pour plus d'agressivité
    const qFactor = 1.0 + (bassReductionFactor * 2.0); // Q: 1.0 à 3.0
    filterData.highpass1.Q.setValueAtTime(qFactor, currentTime);
    filterData.highpass2.Q.setValueAtTime(qFactor * 0.8, currentTime);

    // ===== 2. AJUSTEMENT DU BOOST VOCAL =====
    // Le slider "Boost Voix" contrôle l'intensité des peaking filters
    // 0 dB = son naturel
    // 10 dB = boost modéré (défaut)
    // 20 dB = boost agressif

    const voiceBoost = currentSettings.voiceBoost;

    // Répartir le boost sur les 3 bandes vocales
    filterData.voiceLow.gain.setValueAtTime(
      Math.min(6 + (voiceBoost * 0.3), 15),
      currentTime
    );

    filterData.voiceMid.gain.setValueAtTime(
      Math.min(12 + (voiceBoost * 0.6), 20), // Band principale
      currentTime
    );

    filterData.voiceHigh.gain.setValueAtTime(
      Math.min(8 + (voiceBoost * 0.4), 18),
      currentTime
    );

    // ===== 3. AJUSTEMENT DU LOWPASS (pour encore plus d'isolation) =====
    // Plus le boost vocal est élevé, plus on coupe les aigus
    const lowpassFreq = 4500 - (voiceBoost * 50); // 4500Hz à 3500Hz
    filterData.lowpass.frequency.setValueAtTime(
      Math.max(lowpassFreq, 3000),
      currentTime
    );

    // ===== 4. AJUSTEMENT DU COMPRESSEUR =====
    // Plus la réduction des basses est forte, plus on compresse
    const compressionRatio = 12 + (bassReductionFactor * 8); // 12:1 à 20:1
    filterData.compressor.ratio.setValueAtTime(compressionRatio, currentTime);

    // ===== 5. AJUSTEMENT DU VOLUME FINAL =====
    const volumeValue = currentSettings.volume / 100;
    filterData.gain.gain.setValueAtTime(volumeValue, currentTime);

    // Ajuster le makeup gain en fonction du boost vocal
    const makeupGainValue = 2.5 + (voiceBoost * 0.1); // Compenser la perte de volume
    filterData.makeupGain.gain.setValueAtTime(makeupGainValue, currentTime);

  } catch (error) {
    console.error('Erreur lors de l\'application des filtres:', error);
  }
}

// Supprimer les filtres et restaurer l'audio normal
function removeFilters(mediaElement) {
  try {
    const filterData = audioContexts.get(mediaElement);
    if (filterData) {
      // Déconnecter tous les nœuds dans l'ordre inverse
      filterData.source.disconnect();

      // Filtres notch
      if (filterData.notch60Hz) filterData.notch60Hz.disconnect();
      if (filterData.notch120Hz) filterData.notch120Hz.disconnect();
      if (filterData.notch250Hz) filterData.notch250Hz.disconnect();

      // Filtres highpass
      if (filterData.highpass1) filterData.highpass1.disconnect();
      if (filterData.highpass2) filterData.highpass2.disconnect();

      // Filtres vocaux
      if (filterData.voiceLow) filterData.voiceLow.disconnect();
      if (filterData.voiceMid) filterData.voiceMid.disconnect();
      if (filterData.voiceHigh) filterData.voiceHigh.disconnect();

      // Lowpass
      if (filterData.lowpass) filterData.lowpass.disconnect();

      // Compression et gains
      if (filterData.preGain) filterData.preGain.disconnect();
      if (filterData.compressor) filterData.compressor.disconnect();
      if (filterData.makeupGain) filterData.makeupGain.disconnect();
      if (filterData.gain) filterData.gain.disconnect();

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
