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

    // ===== ALGORITHME MID/SIDE + FILTRAGE SPECTRAL TEMPS RÉEL =====
    // Technique pro : séparer le centre (voix) du panoramique (musique)

    // 1. SPLITTER STEREO - Séparer les canaux L et R
    const splitter = audioContext.createChannelSplitter(2);
    const merger = audioContext.createChannelMerger(2);

    // 2. CALCULER MID (L+R) et SIDE (L-R)
    // Mid = voix (généralement au centre)
    // Side = musique (instruments panoramisés)

    const midGain = audioContext.createGain();
    midGain.gain.value = 2.0; // Boost le centre (voix)

    const sideGain = audioContext.createGain();
    sideGain.gain.value = 0.05; // Atténue drastiquement les côtés (musique)

    // Gains pour calculer Mid et Side
    const leftForMid = audioContext.createGain();
    leftForMid.gain.value = 0.5;
    const rightForMid = audioContext.createGain();
    rightForMid.gain.value = 0.5;

    const leftForSide = audioContext.createGain();
    leftForSide.gain.value = 0.5;
    const rightForSide = audioContext.createGain();
    rightForSide.gain.value = -0.5; // Inversion pour Side

    // Summer nodes pour Mid et Side
    const midSummer = audioContext.createGain();
    const sideSummer = audioContext.createGain();

    // 3. FILTRES ULTRA-AGRESSIFS SUR LE SIGNAL COMBINÉ

    // Highpass cascade 3 étages (coupe TOUT en dessous de 350-700Hz)
    const highpass1 = audioContext.createBiquadFilter();
    highpass1.type = 'highpass';
    highpass1.frequency.value = 350;
    highpass1.Q.value = 2.0;

    const highpass2 = audioContext.createBiquadFilter();
    highpass2.type = 'highpass';
    highpass2.frequency.value = 450;
    highpass2.Q.value = 1.8;

    const highpass3 = audioContext.createBiquadFilter();
    highpass3.type = 'highpass';
    highpass3.frequency.value = 550;
    highpass3.Q.value = 1.5;

    // Notch filters pour éliminer les harmoniques musicales communes
    const notch80Hz = audioContext.createBiquadFilter();
    notch80Hz.type = 'notch';
    notch80Hz.frequency.value = 80;
    notch80Hz.Q.value = 10;

    const notch150Hz = audioContext.createBiquadFilter();
    notch150Hz.type = 'notch';
    notch150Hz.frequency.value = 150;
    notch150Hz.Q.value = 8;

    const notch220Hz = audioContext.createBiquadFilter();
    notch220Hz.type = 'notch';
    notch220Hz.frequency.value = 220;
    notch220Hz.Q.value = 6;

    // Peaking filters TRÈS agressifs sur les fréquences vocales
    const voiceLow = audioContext.createBiquadFilter();
    voiceLow.type = 'peaking';
    voiceLow.frequency.value = 1000; // Fondamentale vocale masculine/féminine
    voiceLow.Q.value = 3.0;
    voiceLow.gain.value = 15;

    const voiceMid = audioContext.createBiquadFilter();
    voiceMid.type = 'peaking';
    voiceMid.frequency.value = 2500; // Clarté et intelligibilité
    voiceMid.Q.value = 4.0;
    voiceMid.gain.value = 18;

    const voiceHigh = audioContext.createBiquadFilter();
    voiceHigh.type = 'peaking';
    voiceHigh.frequency.value = 4000; // Présence et brillance
    voiceHigh.Q.value = 3.5;
    voiceHigh.gain.value = 12;

    // Lowpass TRÈS agressif (coupe TOUT au-dessus de 3500-5000Hz)
    const lowpass = audioContext.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 4000;
    lowpass.Q.value = 3.0; // Pente très raide

    // 4. COMPRESSEUR MULTI-BAND SIMULÉ
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -35;
    compressor.knee.value = 25;
    compressor.ratio.value = 20; // TRÈS agressif
    compressor.attack.value = 0.001; // Instantané
    compressor.release.value = 0.1; // Rapide

    // 5. DE-ESSER (enlever les sibilantes trop fortes)
    const deEsser = audioContext.createBiquadFilter();
    deEsser.type = 'highshelf';
    deEsser.frequency.value = 6000;
    deEsser.gain.value = -8; // Atténue les "S" et cymbales

    // 6. GAINS FINAUX
    const preGain = audioContext.createGain();
    preGain.gain.value = 1.8;

    const makeupGain = audioContext.createGain();
    makeupGain.gain.value = 3.5; // Compense toutes les pertes

    const finalGain = audioContext.createGain();
    finalGain.gain.value = 1.0;

    // ===== CONNEXION MID/SIDE PROCESSING =====

    // Split input stéréo
    source.connect(splitter);

    // Calculer MID (L+R)/2
    splitter.connect(leftForMid, 0);
    splitter.connect(rightForMid, 1);
    leftForMid.connect(midSummer);
    rightForMid.connect(midSummer);

    // Calculer SIDE (L-R)/2
    splitter.connect(leftForSide, 0);
    splitter.connect(rightForSide, 1);
    leftForSide.connect(sideSummer);
    rightForSide.connect(sideSummer);

    // Appliquer gains Mid et Side
    midSummer.connect(midGain);
    sideSummer.connect(sideGain);

    // Recombiner Mid et Side
    const combiner = audioContext.createGain();
    midGain.connect(combiner);
    sideGain.connect(combiner);

    // ===== CHAÎNE DE FILTRAGE COMPLÈTE =====
    combiner
      // Étape 1 : Élimination totale des basses
      .connect(notch80Hz)
      .connect(notch150Hz)
      .connect(notch220Hz)
      .connect(highpass1)
      .connect(highpass2)
      .connect(highpass3)

      // Étape 2 : Boost ultra-agressif des fréquences vocales
      .connect(voiceLow)
      .connect(voiceMid)
      .connect(voiceHigh)

      // Étape 3 : Coupe des aigus (cymbales, hi-hat)
      .connect(lowpass)
      .connect(deEsser)

      // Étape 4 : Compression et normalisation
      .connect(preGain)
      .connect(compressor)
      .connect(makeupGain)
      .connect(finalGain)
      .connect(audioContext.destination);

    // Stocker tous les nœuds
    const filterData = {
      context: audioContext,
      source: source,

      // Mid/Side processing
      splitter: splitter,
      merger: merger,
      midGain: midGain,
      sideGain: sideGain,
      leftForMid: leftForMid,
      rightForMid: rightForMid,
      leftForSide: leftForSide,
      rightForSide: rightForSide,
      midSummer: midSummer,
      sideSummer: sideSummer,
      combiner: combiner,

      // Filtres
      notch80Hz: notch80Hz,
      notch150Hz: notch150Hz,
      notch220Hz: notch220Hz,
      highpass1: highpass1,
      highpass2: highpass2,
      highpass3: highpass3,
      voiceLow: voiceLow,
      voiceMid: voiceMid,
      voiceHigh: voiceHigh,
      lowpass: lowpass,
      deEsser: deEsser,

      // Compression et gains
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

    // ===== 1. MID/SIDE RATIO (Réduction Basses = atténuation Side/musique) =====
    const bassReductionFactor = currentSettings.bassReduction / 100;

    // Mid Gain : 1.5 à 3.0 (boost la voix au centre)
    const midGainValue = 1.5 + (bassReductionFactor * 1.5);
    filterData.midGain.gain.setValueAtTime(midGainValue, currentTime);

    // Side Gain : 0.3 à 0.01 (atténue la musique panoramisée)
    // Plus bassReduction est élevé, plus on coupe le Side
    const sideGainValue = 0.3 - (bassReductionFactor * 0.29);
    filterData.sideGain.gain.setValueAtTime(sideGainValue, currentTime);

    // ===== 2. HIGHPASS CASCADE (selon bassReduction) =====
    // 0% = 350/450/550 Hz (modéré)
    // 100% = 600/700/800 Hz (TRÈS agressif)
    const hp1Freq = 350 + (bassReductionFactor * 250);
    const hp2Freq = 450 + (bassReductionFactor * 250);
    const hp3Freq = 550 + (bassReductionFactor * 250);

    filterData.highpass1.frequency.setValueAtTime(hp1Freq, currentTime);
    filterData.highpass2.frequency.setValueAtTime(hp2Freq, currentTime);
    filterData.highpass3.frequency.setValueAtTime(hp3Freq, currentTime);

    // Q factor de plus en plus agressif
    const qFactor = 2.0 + (bassReductionFactor * 2.0); // 2.0 à 4.0
    filterData.highpass1.Q.setValueAtTime(qFactor, currentTime);
    filterData.highpass2.Q.setValueAtTime(qFactor * 0.9, currentTime);
    filterData.highpass3.Q.setValueAtTime(qFactor * 0.75, currentTime);

    // ===== 3. BOOST VOCAL (slider Boost Voix) =====
    const voiceBoost = currentSettings.voiceBoost;

    // Gain sur les 3 bandes vocales (formules optimisées)
    filterData.voiceLow.gain.setValueAtTime(
      Math.min(15 + (voiceBoost * 0.5), 25), // 15 à 25 dB
      currentTime
    );

    filterData.voiceMid.gain.setValueAtTime(
      Math.min(18 + (voiceBoost * 0.8), 28), // 18 à 28 dB (band principale)
      currentTime
    );

    filterData.voiceHigh.gain.setValueAtTime(
      Math.min(12 + (voiceBoost * 0.6), 22), // 12 à 22 dB
      currentTime
    );

    // ===== 4. LOWPASS ADAPTATIF =====
    // Plus on boost la voix, plus on coupe les aigus (cymbales)
    const lowpassFreq = 4000 - (voiceBoost * 30); // 4000 à 3400 Hz
    filterData.lowpass.frequency.setValueAtTime(
      Math.max(lowpassFreq, 3000),
      currentTime
    );

    // ===== 5. DE-ESSER =====
    // Atténuation des sibilantes selon le boost vocal
    const deEsserGain = -8 - (voiceBoost * 0.3); // -8 à -14 dB
    filterData.deEsser.gain.setValueAtTime(
      Math.max(deEsserGain, -15),
      currentTime
    );

    // ===== 6. COMPRESSEUR =====
    // Ratio plus agressif si bassReduction élevé
    const compressionRatio = 20 + (bassReductionFactor * 10); // 20:1 à 30:1
    filterData.compressor.ratio.setValueAtTime(compressionRatio, currentTime);

    // ===== 7. VOLUME FINAL =====
    const volumeValue = currentSettings.volume / 100;
    filterData.gain.gain.setValueAtTime(volumeValue, currentTime);

    // Makeup gain adaptatif
    const makeupGainValue = 3.5 + (voiceBoost * 0.15); // 3.5 à 6.5
    filterData.makeupGain.gain.setValueAtTime(
      Math.min(makeupGainValue, 7.0),
      currentTime
    );

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

      // Mid/Side processing
      if (filterData.splitter) filterData.splitter.disconnect();
      if (filterData.leftForMid) filterData.leftForMid.disconnect();
      if (filterData.rightForMid) filterData.rightForMid.disconnect();
      if (filterData.leftForSide) filterData.leftForSide.disconnect();
      if (filterData.rightForSide) filterData.rightForSide.disconnect();
      if (filterData.midSummer) filterData.midSummer.disconnect();
      if (filterData.sideSummer) filterData.sideSummer.disconnect();
      if (filterData.midGain) filterData.midGain.disconnect();
      if (filterData.sideGain) filterData.sideGain.disconnect();
      if (filterData.combiner) filterData.combiner.disconnect();

      // Filtres notch
      if (filterData.notch80Hz) filterData.notch80Hz.disconnect();
      if (filterData.notch150Hz) filterData.notch150Hz.disconnect();
      if (filterData.notch220Hz) filterData.notch220Hz.disconnect();

      // Filtres highpass
      if (filterData.highpass1) filterData.highpass1.disconnect();
      if (filterData.highpass2) filterData.highpass2.disconnect();
      if (filterData.highpass3) filterData.highpass3.disconnect();

      // Filtres vocaux
      if (filterData.voiceLow) filterData.voiceLow.disconnect();
      if (filterData.voiceMid) filterData.voiceMid.disconnect();
      if (filterData.voiceHigh) filterData.voiceHigh.disconnect();

      // Lowpass et de-esser
      if (filterData.lowpass) filterData.lowpass.disconnect();
      if (filterData.deEsser) filterData.deEsser.disconnect();

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
