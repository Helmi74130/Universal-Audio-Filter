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

### 🎯 Algorithme d'isolation vocale avancé (Web Audio API)

L'extension utilise un **algorithme professionnel multi-étages** pour isoler la voix :

#### Étape 1 : Élimination des basses (Musique) 🔇

1. **Notch Filters** - Ciblage précis des fréquences basse
   - `60 Hz` (Q=5.0) - Sub-bass (kick électronique)
   - `120 Hz` (Q=5.0) - Bass (ligne de basse)
   - `250 Hz` (Q=3.0) - Low-mids (guitare basse)

2. **Cascade de Highpass Filters** - Couper agressivement les basses
   - `Highpass 1` : 400-800 Hz (Q élevé, pente raide)
   - `Highpass 2` : 500-800 Hz (second étage pour renforcement)
   - Ajustable via slider "Réduction Basses"

#### Étape 2 : Boost des fréquences vocales 🎤

3. **Triple Peaking Filters** - Ciblage de la zone vocale (300Hz-3.5kHz)
   - `800 Hz` (+6 à 15 dB) - Fondamentale vocale (warmth)
   - `2000 Hz` (+12 à 20 dB) - **Clarté vocale** (intelligibilité maximale)
   - `3500 Hz` (+8 à 18 dB) - Présence vocale (brillance)
   - Ajustable via slider "Boost Voix"

#### Étape 3 : Suppression des hautes fréquences 🎸

4. **Lowpass Filter agressif**
   - `4500-3000 Hz` (adaptatif) - Coupe cymbales, hi-hat, instruments aigus
   - S'ajuste automatiquement selon le boost vocal

#### Étape 4 : Compression dynamique 🎚️

5. **DynamicsCompressor** - Réduction de la dynamique musicale
   - Threshold: -30 dB
   - Ratio: 12:1 à 20:1 (adaptatif)
   - Attack: 3ms (rapide)
   - Release: 250ms (modéré)
   - **Effet** : Réduit l'impact des pics musicaux

#### Étape 5 : Contrôle du volume final 🔊

6. **Gain Nodes** - Normalisation et contrôle
   - Pre-gain (1.5x) - Boost avant compression
   - Makeup gain (2.5-4.5x) - Compense la compression
   - Volume final (0-100%) - Contrôle utilisateur

### 📊 Chaîne de traitement complète

```
Audio Source
    ↓
[Notch 60Hz] → [Notch 120Hz] → [Notch 250Hz]
    ↓
[Highpass 400-800Hz] → [Highpass 500-800Hz]
    ↓
[Peaking 800Hz] → [Peaking 2kHz] → [Peaking 3.5kHz]
    ↓
[Lowpass 3000-4500Hz]
    ↓
[Pre-Gain 1.5x] → [Compressor 12:1] → [Makeup Gain 2.5x]
    ↓
[Volume Final 0-100%]
    ↓
Audio Output (Voix isolée 🎤)
```

### 🎛️ Ajustements intelligents

Les sliders contrôlent **plusieurs paramètres simultanément** :

**Slider "Réduction Basses"** :
- Fréquence des highpass (400-800Hz)
- Q factor des highpass (1.0-3.0)
- Ratio de compression (12:1-20:1)

**Slider "Boost Voix"** :
- Gain des 3 peaking filters
- Fréquence du lowpass (inversement)
- Makeup gain du compresseur

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
