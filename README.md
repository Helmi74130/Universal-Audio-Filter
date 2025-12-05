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

### 🎯 Algorithme MID/SIDE + Filtrage Spectral (Web Audio API)

L'extension utilise une **technique de studio professionnel** pour séparer la voix de la musique en **temps réel** :

#### 🎚️ ÉTAPE 1 : Mid/Side Processing (RÉVOLUTIONNAIRE)

**Principe** : La voix est généralement au **centre** (mono), la musique est **panoramisée** (stéréo)

1. **Channel Splitter** - Séparer les canaux L et R
2. **Calcul MID** : `(L + R) / 2` → Contient surtout la **VOIX** 🎤
3. **Calcul SIDE** : `(L - R) / 2` → Contient surtout la **MUSIQUE** 🎵
4. **Gains adaptatifs** :
   - **Mid Gain** : 1.5x à 3.0x (boost la voix)
   - **Side Gain** : 0.3x à 0.01x (atténue drastiquement la musique)
   - Contrôlé par le slider "Réduction Basses"

**Résultat** : Séparation physique voix/musique AVANT tout filtrage !

#### 🔊 ÉTAPE 2 : Élimination totale des basses

1. **3 Notch Filters ultra-précis**
   - `80 Hz` (Q=10) - Sub-bass kick
   - `150 Hz` (Q=8) - Bass line
   - `220 Hz` (Q=6) - Low-mids guitare

2. **Cascade de 3 Highpass Filters**
   - `HP1` : 350-600 Hz (Q=2.0-4.0)
   - `HP2` : 450-700 Hz (Q=1.8-3.6)
   - `HP3` : 550-800 Hz (Q=1.5-3.0)
   - Pentes TRÈS raides (48dB/octave cumulé)
   - Ajustable dynamiquement

#### 🎤 ÉTAPE 3 : Boost vocal ultra-agressif

3. **Triple Peaking Filters** avec gains EXTRÊMES
   - `1000 Hz` : +15 à +25 dB (Fondamentale vocale)
   - `2500 Hz` : +18 à +28 dB (Clarté et intelligibilité MAX)
   - `4000 Hz` : +12 à +22 dB (Présence et brillance)
   - Q factor élevé (3.0-4.0) pour ciblage précis

#### ✂️ ÉTAPE 4 : Coupe des hautes fréquences

4. **Lowpass Filter + De-Esser**
   - Lowpass : 3000-4000 Hz (Q=3.0) - Coupe cymbales/hi-hat
   - De-Esser : -8 à -15 dB @ 6kHz - Réduit sibilantes

#### 🗜️ ÉTAPE 5 : Compression extrême

5. **DynamicsCompressor ultra-agressif**
   - Threshold : -35 dB
   - Ratio : 20:1 à 30:1 (écrase la dynamique)
   - Attack : 1ms (instantané)
   - Release : 100ms (rapide)
   - **Effet** : Nivelle la musique résiduelle

#### 🔊 ÉTAPE 6 : Normalisation finale

6. **Triple Gain Stage**
   - Pre-gain : 1.8x
   - Makeup gain : 3.5x à 7.0x (adaptatif)
   - Volume final : 0-100% (contrôle utilisateur)

### 📊 Chaîne de traitement complète

```
🎵 Audio Stéréo Source (L + R)
         ↓
    ┌────────────┐
    │  SPLITTER  │ Séparer L et R
    └────────────┘
         ↓    ↓
    ┌────┴────┴────┐
    │  MID/SIDE    │ 🔥 SÉPARATION RÉVOLUTIONNAIRE
    │  PROCESSING  │ Mid (voix) + Side (musique)
    └──────────────┘
         ↓
    Mid×3.0 + Side×0.01  ← Musique ÉCRASÉE !
         ↓
[Notch 80Hz] → [Notch 150Hz] → [Notch 220Hz]
         ↓
[HP 350-600Hz] → [HP 450-700Hz] → [HP 550-800Hz]
         ↓                      (Cascade 48dB/octave)
[Peak 1kHz +25dB] → [Peak 2.5kHz +28dB] → [Peak 4kHz +22dB]
         ↓                      (Boost vocal EXTRÊME)
[Lowpass 3-4kHz] → [De-Esser -15dB @ 6kHz]
         ↓                      (Coupe cymbales)
[Pre-Gain 1.8x] → [Compressor 30:1] → [Makeup 7x]
         ↓                      (Écrase la dynamique)
[Volume Final 0-100%]
         ↓
🎤 VOIX ISOLÉE (Musique quasi-inexistante)
```

### 🎛️ Ajustements intelligents

Les sliders contrôlent **plusieurs paramètres simultanément** pour un résultat optimal :

**Slider "Réduction Basses" (0-100%)** - LE PLUS IMPORTANT !
- 🎚️ **Ratio Mid/Side** : Side Gain 0.3x → 0.01x (atténuation musique)
- 🎚️ **Mid Gain** : 1.5x → 3.0x (amplification voix)
- 🔊 **Highpass cascade** : 350-600Hz / 450-700Hz / 550-800Hz
- 📐 **Q factor** : 2.0 → 4.0 (pentes de plus en plus raides)
- 🗜️ **Compression** : Ratio 20:1 → 30:1 (écrase davantage)

**À 100%** : Musique Side atténuée à 1%, voix Mid boostée à 300% !

**Slider "Boost Voix" (0-20 dB)** :
- 🎤 **Peaking 1kHz** : +15 → +25 dB
- 🎤 **Peaking 2.5kHz** : +18 → +28 dB (band principale)
- 🎤 **Peaking 4kHz** : +12 → +22 dB
- ✂️ **Lowpass** : 4000Hz → 3400Hz (coupe plus d'aigus)
- 📉 **De-Esser** : -8dB → -14dB (réduit sibilantes)
- 🔊 **Makeup Gain** : 3.5x → 6.5x (compense le boost)

**Slider "Volume" (0-100%)** :
- Simple contrôle du gain final

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
