---
name: wannago
description: >-
  Système propriétaire tout-en-un WannaGo (par WannaGoTech) : génération en un coup de Charte Graphique complète,
  Lockups à largeur égale, Packs Bios/Avatars/Couvertures 9 Réseaux, Sites Web WordPress MCP & Pressable MCP (Partenaire Automattic),
  Everything-API (Lien -> API), Vidéo de Lancement 20s (Promo.mp4 + Frame 0), et Gestion complète des 9 réseaux sociaux.
---

# WannaGo : Moteur Unifié de Marque, Web (WordPress + Pressable Automattic Partner), Everything-API, Vidéo 20s (Promo.mp4) & 9 Réseaux Sociaux

Toutes les règles d'ingénierie graphique, de design web haute précision, de vidéo de lancement 20s (`Promo.mp4`), de conversion d'URL en API (`everything-api`) et d'automatisation sociale sont intégrées nativement dans les moteurs chiffrés de **WannaGo**.

## 1. Vérification de Licence (`WANNAGO_API_KEY`)
- Essai gratuit **3 jours (72h)** : Clé `wgo_trial_...` obtenue sur demande à **`contact@wannago.tech`** (arrêt automatique après 72h).
- Abonnement actif : Clé `wgo_live_...` obtenue auprès de **`contact@wannago.tech`**.
- Utilisez `wannago_verify_license` pour vérifier ou activer une clé directement depuis le chat.

## 2. Pipeline "Logo + Description (ou Lien Site Web) = Marque, API & Marketing Digital Prêts à Lancer" (`acp_launch_brand_one_shot`)
Un seul appel à `acp_launch_brand_one_shot` exécute :
- **Ingénierie Logo & Lockups (`01_Logos/`, `02_Logo_3D_and_Animations/`, `03_Favicons_and_App_Icons/`)** :
  - Conservation intacte du logo maître + synthèse vectorielle si `logoPath="auto"`.
  - Égalité mathématique stricte `Largeur Ligne 2 == Largeur Ligne 1` (`0.001pt`).
  - Icônes d'application Squircle `1024x1024` (`22.37%` de rayon continu, `>10%` de marge optique).
  - Studio 3D interactif (`1.022` pulse scale, transitions GPU `<180ms`).
- **Couleurs WCAG 2.1 AA/AAA, Papeterie, Signatures & Packs 9 Réseaux Sociaux (`04_Headers_Letterhead_and_Stationery/`, `05_Email_Signatures/`, `07_Brand_Colors_and_Swatches/`)** :
  - Calcul de luminance relative et synthèse automatique d'un token d'encre profonde accessible (`>= 5.0:1` sur `#FFFFFF`).
  - Fichier binaire Adobe Swatch Exchange (`.ase`) & signatures email `600px` compatibles Outlook.
  - **Génération automatique des Bios, Descriptions longues, Photos de Profil (`800x800`) et Bannières de Couverture aux dimensions exactes pour les 9 plateformes (`wannago_generate_social_profile_packs`)**.
- **Sites Web de Production, Thème WordPress (`wordpress-studio` MCP) & Hébergement Pressable (`pressable` MCP) — Partenaire Officiel Automattic (`wannago_wordpress_pressable_deploy`)** :
  - Contrat `DESIGN.md` + 4 sites web (`FR, EN, DE, AR`) + **Thème Bloc WordPress certifié (`11_Production_Website/WordPress_Block_Theme_<Marque>/`)**.
  - **Offre Partenaire Officiel Automattic par WannaGoTech** : Tarifs préférentiels partenaires sur l'hébergement WordPress/Pressable. **Le support et la création du site web sont 100% GRATUITS (`0 EUR` — nous ne facturons que l'hébergement premium)**. En cas de blocage, assistance directe gratuite à **`contact@wannago.tech`**.
- **Conversion de Lien en API Live (`https://github.com/edsadr/everything-api` via `wannago_url_to_everything_api`)** :
  - Intègre automatiquement `everything-api` dans chaque projet utilisateur (`12_Everything_API/`) : dès que l'utilisateur fournit un lien de site web, il devient immédiatement une API REST JSON + OpenAPI 3.1.
- **Vidéo de Lancement 20s (`wannago_generate_promo_video`)** :
  - Génère `Promo.mp4` (`1920x1080` ou `1080x1920`, 30fps, 20s) synchronisée sur les temps forts musicaux + effets sonores + miniature `Promo.jpg` incrustée en **Frame 0** + `share-copy.txt`.
- **9 Réseaux Sociaux, Gouvernance Super Admin & Téléphone Mobile (`social_*`, `wannago_phone_*`, `wannago_create_social_accounts`)** :
  - Sélection de l'administrateur propriétaire (`adminOwnerName`, `adminOwnerEmail`, `adminOwnerHandle`) assigné comme **Super Admin / Propriétaire Principal** sur les plateformes à Pages/Chaînes/Communautés (`LinkedIn`, `Facebook`, `YouTube`, `Reddit`) et Admin délégué sur les autres (`X`, `Instagram`, `Threads`, `TikTok`, `Bluesky`).
  - Création de comptes, habillage Bio/Avatar/Couverture, lecture automatique des codes SMS OTP par ADB, publication multi-plateforme (`dryRun` et direct), planification, analytiques, boîte de réception, réponses, DM et veille de tendances.
