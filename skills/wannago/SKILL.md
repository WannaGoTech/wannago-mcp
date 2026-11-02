---
name: wannago
description: >-
  Système propriétaire tout-en-un WannaGo v3.1 (par WannaGoTech) : Protocole Interactif Zéro-Invention par Chat,
  Charte Graphique complète, Lockups à largeur égale, Packs Bios/Avatars/Couvertures 9 Réseaux,
  Sites Web WordPress & Pressable (Collaborateur Isolé Mono-Site, Partenaire Automattic), Everything-API,
  Vidéo 20s (Promo.mp4), Design de Posts & Carrousels PDF, Audit Image Anti-IA, LinkedIn Complet Sans Sales Navigator,
  Détection des Heures de Pointe, Stratégie Datée (.md), Rappels, Rapports et Gestion des Publicités.
---

# WannaGo v3.1 : Moteur Souverain de Marque, Web, Vidéo 20s (Promo.mp4), Marketing Digital & 9 Réseaux Sociaux (WannaGoTech)

Toutes les règles d'ingénierie graphique, de design web, de vidéo de lancement 20s (`Promo.mp4`), de calibration optique Anti-IA, de marketing digital, de gestion LinkedIn sans abonnement Pro et d'automatisation sociale sont intégrées nativement et labellisées **WannaGoTech** dans `wannago-mcp` (zéro dépendance externe hormis nos partenaires officiels).

## 0. Protocole Interactif par Chat — Zéro Invention (`wannago_interactive_discovery`)
- **Ne jamais rien inventer** : Avant de créer une charte graphique, un site web, un post ou une stratégie de contenu, appelez `wannago_interactive_discovery` et posez des questions à l'utilisateur dans le chat :
  - Demandez ses **inspirations visuelles** (2-3 marques ou designs de référence).
  - Demandez ses **préférences ou interdits de couleurs** et son ton éditorial.
  - Demandez ses **coordonnées réelles exactes** (email, téléphone, adresse, site) et ses vrais produits/services.
  - Demandez sa validation dans le chat à chaque étape.

## 1. Vérification de Licence (`WANNAGO_API_KEY`) & Isolation Mono-Site Pressable/WordPress
- Essai gratuit **3 jours (72h)** : Clé `wgo_trial_...` obtenue sur demande à **`contact@wannago.tech`** (arrêt automatique après 72h).
- Abonnement actif : Clé `wgo_live_...` obtenue auprès de **`contact@wannago.tech`**.
- **Isolation Collaborateur Mono-Site Pressable/WordPress (`wannago_pressable_collaborator_isolation`)** :
  - L'utilisateur (`collaboratorEmail`) est ajouté **exclusivement comme Collaborateur de son propre site unique** (`siteId` / `siteName`).
  - **Tous les autres sites de WannaGoTech restent 100 % isolés et invisibles** (`otherWannaGoTechSitesVisible: false`, `masterAccountListingBlocked: true`).

## 2. Pipeline "Logo + Description + Inspirations = Marque, API & Marketing Prêts à Lancer" (`acp_launch_brand_one_shot`)
Un seul appel à `acp_launch_brand_one_shot` exécute les 7 Portes ACP :
- **Ingénierie Logo & Lockups (`01_Logos/`, `02_Logo_3D_and_Animations/`, `03_Favicons_and_App_Icons/`)** :
  - Égalité mathématique stricte `Largeur Ligne 2 == Largeur Ligne 1` (`0.001pt`), icônes Squircle `1024x1024` (`22.37%` rayon, `>10%` marge optique) et Studio 3D interactif.
- **Couleurs WCAG 2.1 AA/AAA, Papeterie, Signatures & Packs Réseaux Sociaux (`wannago_generate_social_profile_packs`)** :
  - Palette accessible (`>= 5.0:1`), fichier `.ase`, signatures `600px` et **Bios, Descriptions, Photos de Profil (`800x800`) et Bannières de Couverture aux dimensions exactes des 9 plateformes**.
- **Sites Web de Production, Thème WordPress & Pressable Isolé (`wannago_wordpress_pressable_deploy` + `wannago_pressable_collaborator_isolation`)** :
  - Contrat `DESIGN.md` + 4 sites web (`FR, EN, DE, AR`) + Thème Bloc WordPress + Isolation Collaborateur Mono-Site.
  - **Partenaire Officiel Automattic par WannaGoTech** : **Le support et la création du site web sont 100 % GRATUITS (`0 EUR` — seul l'hébergement premium est facturé)** via **`contact@wannago.tech`**.
- **Conversion de Lien en API Live (`wannago_url_to_everything_api`)** : Transforme tout lien de site web en API REST JSON + OpenAPI 3.1 (`12_Everything_API/`).
- **Vidéo de Lancement 20s (`wannago_generate_promo_video`)** : Génère `Promo.mp4` (`1920x1080` ou `1080x1920`, 30fps, 20s) + miniature `Promo.jpg` en **Frame 0** + `share-copy.txt`.

## 3. Marketing Digital Souverain WannaGoTech (100 % REA — 36 Outils MCP)
1. **Design de Posts & Carrousels PDF (`wannago_design_social_post`)** :
   - Génère des visuels éditoriaux Apple HIG + Anti-IA en `1080x1350` (4:5 portrait mobile prioritaire), `1080x1080` (1:1), `1080x1920` (9:16 Story/Reel), `1920x1080` (16:9) et **Carrousels PDF natifs LinkedIn (`Carousel_LinkedIn_<Marque>.pdf`)**.
2. **Audit Anti-IA des Images & Rendu Réseaux Sociaux (`wannago_audit_visual_and_post`)** :
   - Détecte les artefacts IA (saturation néon `sat_p95 > 0.88`, lissage plastique `edge_energy < 6.5`) et applique automatiquement la **Calibration Optique Naturelle WannaGoTech** (micro-grain capteur photographique ISO-100, compression des hautes lumières néon et micro-contraste optique) pour que l'image ne fasse jamais "générée par IA".
   - Vérifie les **Safe Zones UI** (zones d'interface TikTok, Reels, LinkedIn, X) pour garantir qu'aucun texte ni logo n'est masqué dans le fil d'actualité.
3. **Détection des Heures de Pointe — Zéro Publication au Hasard (`wannago_detect_peak_hours`)** :
   - Calcule les fenêtres algorithmiques de vélocité maximale ("Golden Velocity Windows") par plateforme, fuseau horaire et segment d'audience (`b2b_decision_makers`, `b2c_consumers`, `tech_developers`, `luxury_lifestyle`).
4. **Stratégie de Contenu Datée (`CONTENT_STRATEGY_CALENDAR.md`), Rappels & Rapports (`wannago_content_strategy_planner`, `wannago_schedule_reminders`, `wannago_generate_marketing_report`)** :
   - Génère le plan éditorial daté dans `CONTENT_STRATEGY_CALENDAR.md`, planifie des rappels automatiques avant chaque publication et produit des rapports de performance `MARKETING_REPORT_<DATE>.md`.
5. **Gestion Complète de LinkedIn SANS Sales Navigator ni Abonnement Pro (`wannago_linkedin_sovereign_suite`)** :
   - Constructeur Booléen avancé, recherche Google X-Ray (`site:linkedin.com/in/`) contournant la limite commerciale LinkedIn, extraction des commentateurs de posts viraux, architecture de post Dwell-Time (`<140 car.` avant "voir plus", 0 lien externe dans le corps + lien en 1er commentaire pour éviter la pénalité de `-40%` de portée), notes d'invitation `<195 car.` et CRM Markdown local `LINKEDIN_PROSPECTS_CRM.md`.
6. **Gestion des Campagnes Publicitaires Payantes (`wannago_ads_campaign_manager`)** :
   - Plan média complet TOF/MOF/BOF (`ADS_CAMPAIGN_MASTERPLAN.md`) sur Meta Ads, Google Ads, LinkedIn Ads, TikTok Ads et X Ads avec matrice créative A/B Anti-IA, liens UTM et règles automatiques de coupe-circuit CPA/ROAS.
