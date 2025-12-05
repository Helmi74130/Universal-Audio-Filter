# 🎤 Universal Audio Filter

Une extension Chrome moderne qui enlève la musique et garde la voix sur **TOUS** les sites web avec audio.

## ✨ Fonctionnalités

- 🎵 **Filtre EQ avancé** : Réduit les basses (musique) et boost les voix
- 🌐 **Universel** : Fonctionne sur YouTube, Spotify, TikTok, et tous les sites avec audio
- 🎨 **Interface moderne** : Design inspiré de shadcn/ui
- ⚡ **Temps réel** : Ajustements instantanés des filtres
- 💾 **Persistance** : Vos paramètres sont sauvegardés automatiquement
- 🔄 **Multi-onglets** : Les paramètres se synchronisent entre tous vos onglets

## 🎛️ Contrôles

| Contrôle | Description | Plage |
|----------|-------------|-------|
| **Toggle principal** | Active/désactive le filtre audio | ON/OFF |
| **Réduction Basses** | Filtre les fréquences basses (musique) | 0-100% |
| **Boost Voix** | Amplifie les fréquences vocales (2-4kHz) | 0-20 dB |
| **Volume** | Contrôle du volume général | 0-100% |
| **Reset** | Restaure les valeurs par défaut | - |

## 📦 Installation

### Installation manuelle (mode développeur)

1. **Cloner ou télécharger** ce repository

2. **Créer les icônes** (obligatoire) :
   - Créez un dossier `icons/` dans le répertoire de l'extension
   - Ajoutez trois fichiers PNG :
     - `icon16.png` (16x16 pixels)
     - `icon48.png` (48x48 pixels)
     - `icon128.png` (128x128 pixels)
   - Vous pouvez utiliser un emoji 🎤 converti en PNG ou créer vos propres icônes

3. **Ouvrir Chrome** et aller sur `chrome://extensions/`

4. **Activer le mode développeur** (toggle en haut à droite)

5. **Cliquer sur "Charger l'extension non empaquetée"**

6. **Sélectionner le dossier** contenant les fichiers de l'extension

7. **C'est prêt !** L'icône de l'extension apparaît dans la barre d'outils

## 🚀 Utilisation

1. **Naviguez** vers n'importe quel site avec audio (YouTube, Spotify, etc.)

2. **Cliquez** sur l'icône de l'extension dans la barre d'outils

3. **Activez** le filtre avec le toggle principal

4. **Ajustez** les paramètres selon vos préférences :
   - Augmentez la réduction des basses pour isoler davantage la voix
   - Augmentez le boost voix pour améliorer la clarté
   - Ajustez le volume si nécessaire

5. **Les paramètres sont sauvegardés** automatiquement

## 🔧 Fonctionnement technique

### Architecture

```
┌─────────────┐      ┌──────────────┐      ┌─────────────┐
│   popup.js  │─────▶│ background.js│─────▶│ content.js  │
│  (Interface)│      │  (Messaging) │      │  (Filtres)  │
└─────────────┘      └──────────────┘      └─────────────┘
       │                                           │
       ▼                                           ▼
 chrome.storage                            Web Audio API
```

### Filtres audio (Web Audio API)

L'extension utilise une chaîne de filtres audio :

1. **Highpass Filter** (200-1000 Hz)
   - Enlève les fréquences basses (basse, kick, etc.)
   - Fréquence ajustable selon le slider "Réduction Basses"

2. **Peaking Filter** (3000 Hz)
   - Boost les fréquences vocales (2-4 kHz)
   - Gain ajustable de 0 à 20 dB

3. **Lowpass Filter** (8000 Hz)
   - Filtre optionnel pour réduire les aigus excessifs
   - Garde les harmoniques naturelles de la voix

4. **Gain Node**
   - Contrôle du volume de sortie final

### Gestion des edge cases

- ✅ Détection automatique des nouveaux éléments audio (MutationObserver)
- ✅ Support des sites SPA (Single Page Applications)
- ✅ Nettoyage automatique des contexts audio
- ✅ Gestion des erreurs gracieuse (pages système Chrome, etc.)
- ✅ Support de plusieurs éléments audio simultanés

## 🎨 Design

Interface moderne inspirée de **shadcn/ui** :
- Thème sombre avec dégradés
- Toggles et sliders stylisés
- Animations et transitions fluides
- Couleur accent : Rouge (#ef4444)
- Typographie : System font stack

## 📝 Structure des fichiers

```
Universal-Audio-Filter/
├── manifest.json       # Configuration de l'extension
├── popup.html          # Interface utilisateur
├── popup.js           # Logique de l'interface
├── content.js         # Filtres audio (Web Audio API)
├── background.js      # Service worker
├── icons/             # Icônes de l'extension
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md          # Documentation
```

## 🐛 Limitations connues

- L'extension ne fonctionne pas sur les pages système de Chrome (`chrome://`, `chrome-extension://`)
- Certains sites avec DRM peuvent bloquer la manipulation audio
- Les performances peuvent varier selon le nombre d'éléments audio sur la page

## 🔒 Permissions

L'extension nécessite les permissions suivantes :

- `activeTab` : Pour accéder à l'onglet actif
- `scripting` : Pour injecter le content script
- `storage` : Pour sauvegarder les paramètres
- `<all_urls>` : Pour fonctionner sur tous les sites

## 🛠️ Développement

### Prérequis

- Chrome ou Chromium version 88+
- Connaissances en JavaScript et Web Audio API

### Modification du code

1. Modifiez les fichiers sources
2. Rechargez l'extension dans `chrome://extensions/`
3. Testez sur différents sites

### Debugging

- **Console du popup** : Clic droit sur l'icône → Inspecter le popup
- **Console du content script** : F12 sur la page web
- **Service worker** : chrome://extensions/ → Détails → Inspecter le service worker

## 📄 Licence

Ce projet est sous licence MIT. Vous êtes libre de l'utiliser, le modifier et le distribuer.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Signaler des bugs
- Proposer des améliorations
- Soumettre des pull requests

## 📧 Support

Pour toute question ou problème, ouvrez une issue sur GitHub.

---

**Note** : Cette extension est fournie "telle quelle" et peut ne pas fonctionner parfaitement sur tous les sites. La qualité du filtrage dépend de la source audio originale.
