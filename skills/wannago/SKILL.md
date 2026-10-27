---
name: wannago
description: >-
  Système propriétaire tout-en-un WannaGo (par WannaGoTech) : génération en un coup de Charte Graphique complète,
  Lockups à largeur égale, Sites Web de Production (FR/EN/DE/AR), Vidéo de Lancement 20s (brag.mp4 + Frame 0),
  Création de comptes sociaux par téléphone/navigateur et Gestion des 9 réseaux sociaux.
---

# WannaGo — Moteur Unifié de Marque, Web, Vidéo de Lancement & Réseaux Sociaux

Toutes les règles d'ingénierie graphique, de design web haute précision, de vidéo de lancement 20s et d'automatisation sociale sont intégrées nativement dans les moteurs chiffrés de **WannaGo**.

## 1. Vérification de Licence (`WANNAGO_API_KEY`)
- Essai gratuit **3 jours (72h)** : Clé `wgo_trial_...` obtenue sur demande à **`contact@wannago.tech`** (arrêt automatique après 72h).
- Abonnement actif : Clé `wgo_live_...` obtenue auprès de **`contact@wannago.tech`**.
- Utilisez `wannago_verify_license` pour vérifier ou activer une clé directement depuis le chat.

## 2. Pipeline "Logo + Description = Marque Prête à Lancer" (`acp_launch_brand_one_shot`)
Un seul appel à `acp_launch_brand_one_shot` exécute :
- **Ingénierie Logo & Lockups (`01_Logos/`, `02_Logo_3D_and_Animations/`, `03_Favicons_and_App_Icons/`)** :
  - Conservation intacte du logo maître + synthèse vectorielle si `logoPath="auto"`.
  - Égalité mathématique stricte `Largeur Ligne 2 == Largeur Ligne 1` (`0.001pt`).
  - Icônes d'application Squircle `1024×1024` (`22.37%` de rayon continu, `>10%` de marge optique).
  - Studio 3D interactif (`1.022` pulse scale, transitions GPU `<180ms`).
- **Couleurs WCAG 2.1 AA/AAA, Papeterie & Signatures (`04_Headers_Letterhead_and_Stationery/`, `05_Email_Signatures/`, `07_Brand_Colors_and_Swatches/`)** :
  - Calcul de luminance relative et synthèse automatique d'un token d'encre profonde accessible (`>= 5.0:1` sur `#FFFFFF`).
  - Fichier binaire Adobe Swatch Exchange (`.ase`).
  - Signatures email `600px` compatibles Outlook (`font-variant-numeric: tabular-nums`, isolation BiDi `dir="ltr"` pour l'arabe).
- **Sites Web de Production & Dossiers Commerciaux (`09_Commercial_Presentations_A4/`, `11_Production_Website/`)** :
  - Contrat `DESIGN.md` + 4 sites web (`FR, EN, DE, AR`) structurés en 6 anatomies distinctes et 8 états interactifs.
  - 4 Brand Hubs interactifs + 4 Chartes Graphiques PDF HD + 4 Présentations Commerciales A4.
- **Vidéo de Lancement 20s (`wannago_generate_brag_video`)** :
  - Génère `brag.mp4` (`1920×1080` ou `1080×1920`, 30fps, 20s) synchronisée sur les temps forts musicaux + effets sonores + miniature `brag.jpg` incrustée en **Frame 0** + `share-copy.txt`.
- **9 Réseaux Sociaux & Téléphone Mobile (`social_*`, `wannago_phone_*`)** :
  - Création de comptes, lecture automatique des codes SMS OTP par ADB, publication multi-plateforme (`dryRun` et direct), planification, analytiques, boîte de réception, réponses, DM et veille de tendances sur X, LinkedIn, Instagram, Facebook, TikTok, YouTube, Bluesky, Threads et Reddit.
