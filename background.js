// Service worker pour l'extension Universal Audio Filter

// Installation de l'extension
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Universal Audio Filter installé avec succès');

    // Initialiser les paramètres par défaut
    chrome.storage.local.set({
      enabled: false,
      bassReduction: 50,
      voiceBoost: 10,
      volume: 100
    });

  } else if (details.reason === 'update') {
    console.log('Universal Audio Filter mis à jour');
  }
});

// Gérer les messages entre popup et content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Ici on peut gérer des messages globaux si nécessaire
  // Pour l'instant, la communication directe popup -> content script suffit

  if (message.action === 'getSettings') {
    // Retourner les paramètres actuels
    chrome.storage.local.get({
      enabled: false,
      bassReduction: 50,
      voiceBoost: 10,
      volume: 100
    }, (settings) => {
      sendResponse(settings);
    });
    return true; // Réponse asynchrone
  }

  return false;
});

// Écouter les changements de storage pour synchroniser entre onglets
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'local') {
    // Notifier tous les onglets des changements
    chrome.tabs.query({}, (tabs) => {
      const settings = {};

      // Construire l'objet settings à partir des changements
      Object.keys(changes).forEach(key => {
        settings[key] = changes[key].newValue;
      });

      // Envoyer aux content scripts de tous les onglets
      tabs.forEach(tab => {
        if (tab.id) {
          chrome.tabs.sendMessage(tab.id, {
            action: 'updateFilters',
            settings: settings
          }).catch(() => {
            // Ignorer les erreurs (pages système, etc.)
          });
        }
      });
    });
  }
});

// Garder le service worker actif si nécessaire
chrome.runtime.onStartup.addListener(() => {
  console.log('Universal Audio Filter démarré');
});
