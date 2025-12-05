// Valeurs par défaut
const DEFAULT_SETTINGS = {
  enabled: false,
  bassReduction: 50,
  voiceBoost: 10,
  volume: 100
};

// Éléments DOM
const mainToggle = document.getElementById('mainToggle');
const statusText = document.getElementById('statusText');
const statusEmoji = document.getElementById('statusEmoji');
const status = document.getElementById('status');
const controls = document.getElementById('controls');

const bassSlider = document.getElementById('bassSlider');
const bassValue = document.getElementById('bassValue');
const voiceSlider = document.getElementById('voiceSlider');
const voiceValue = document.getElementById('voiceValue');
const volumeSlider = document.getElementById('volumeSlider');
const volumeValue = document.getElementById('volumeValue');
const resetButton = document.getElementById('resetButton');

// État actuel
let currentSettings = { ...DEFAULT_SETTINGS };

// Charger les paramètres sauvegardés au démarrage
async function loadSettings() {
  try {
    const result = await chrome.storage.local.get(DEFAULT_SETTINGS);
    currentSettings = result;
    updateUI();
  } catch (error) {
    console.error('Erreur lors du chargement des paramètres:', error);
  }
}

// Sauvegarder les paramètres
async function saveSettings() {
  try {
    await chrome.storage.local.set(currentSettings);
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
  }
}

// Mettre à jour l'UI selon l'état actuel
function updateUI() {
  // Toggle
  mainToggle.classList.toggle('active', currentSettings.enabled);

  // Textes et emoji
  if (currentSettings.enabled) {
    statusText.textContent = 'Filtre activé';
    statusEmoji.textContent = '🎤';
    status.textContent = 'Audio filtré - Voix isolée';
    status.classList.add('active');
    controls.classList.remove('disabled');
  } else {
    statusText.textContent = 'Filtre désactivé';
    statusEmoji.textContent = '🎵';
    status.textContent = 'Prêt à filtrer l\'audio';
    status.classList.remove('active');
    controls.classList.add('disabled');
  }

  // Sliders
  bassSlider.value = currentSettings.bassReduction;
  bassValue.textContent = `${currentSettings.bassReduction}%`;

  voiceSlider.value = currentSettings.voiceBoost;
  voiceValue.textContent = `${currentSettings.voiceBoost} dB`;

  volumeSlider.value = currentSettings.volume;
  volumeValue.textContent = `${currentSettings.volume}%`;

  // Effet de progress sur les sliders
  updateSliderProgress();
}

// Mettre à jour l'effet de progress visuel sur les sliders
function updateSliderProgress() {
  bassSlider.style.setProperty('--value', `${currentSettings.bassReduction}%`);
  voiceSlider.style.setProperty('--value', `${(currentSettings.voiceBoost / 20) * 100}%`);
  volumeSlider.style.setProperty('--value', `${currentSettings.volume}%`);
}

// Envoyer les paramètres au content script
async function applyFilters() {
  try {
    // Récupérer l'onglet actif
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab || !tab.id) {
      console.error('Aucun onglet actif trouvé');
      return;
    }

    // Envoyer le message au content script
    await chrome.tabs.sendMessage(tab.id, {
      action: 'updateFilters',
      settings: currentSettings
    });

  } catch (error) {
    console.error('Erreur lors de l\'application des filtres:', error);
    // L'erreur peut survenir si la page n'a pas de content script (pages système Chrome)
  }
}

// Event Listeners

// Toggle principal
mainToggle.addEventListener('click', async () => {
  currentSettings.enabled = !currentSettings.enabled;
  updateUI();
  await saveSettings();
  await applyFilters();

  // Animation de feedback
  mainToggle.style.transform = 'scale(0.95)';
  setTimeout(() => {
    mainToggle.style.transform = 'scale(1)';
  }, 100);
});

// Slider Basses
bassSlider.addEventListener('input', async (e) => {
  currentSettings.bassReduction = parseInt(e.target.value);
  bassValue.textContent = `${currentSettings.bassReduction}%`;
  updateSliderProgress();

  if (currentSettings.enabled) {
    await applyFilters();
  }
});

bassSlider.addEventListener('change', async () => {
  await saveSettings();
});

// Slider Voix
voiceSlider.addEventListener('input', async (e) => {
  currentSettings.voiceBoost = parseInt(e.target.value);
  voiceValue.textContent = `${currentSettings.voiceBoost} dB`;
  updateSliderProgress();

  if (currentSettings.enabled) {
    await applyFilters();
  }
});

voiceSlider.addEventListener('change', async () => {
  await saveSettings();
});

// Slider Volume
volumeSlider.addEventListener('input', async (e) => {
  currentSettings.volume = parseInt(e.target.value);
  volumeValue.textContent = `${currentSettings.volume}%`;
  updateSliderProgress();

  if (currentSettings.enabled) {
    await applyFilters();
  }
});

volumeSlider.addEventListener('change', async () => {
  await saveSettings();
});

// Bouton Reset
resetButton.addEventListener('click', async () => {
  currentSettings = { ...DEFAULT_SETTINGS, enabled: currentSettings.enabled };
  updateUI();
  await saveSettings();

  if (currentSettings.enabled) {
    await applyFilters();
  }

  // Animation de feedback
  resetButton.style.transform = 'scale(0.95)';
  setTimeout(() => {
    resetButton.style.transform = 'scale(1)';
  }, 100);
});

// Initialisation au chargement
loadSettings();
