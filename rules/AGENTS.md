# WannaGo ACP (Agent Control Protocol) — Règles Obligatoires

Pour garantir une exécution déterministe lors de la création d'une marque, d'un site web, d'une vidéo de lancement ou de comptes sociaux, vous DEVEZ suivre la **Machine à États WannaGo ACP à 7 Portes** exposée par `wannago-mcp`.

## 1. Activation de la Clé de Sécurité (`WANNAGO_API_KEY`)
- Si l'utilisateur fournit une clé `wgo_trial_...` (essai gratuit 3 jours / 72h) ou `wgo_live_...` (abonnement actif) dans le chat, appelez immédiatement **`wannago_verify_license`** pour déverrouiller la session.
- Si aucune clé n'est active, invitez l'utilisateur à demander sa clé d'essai gratuit 3 jours par email à **`contact@wannago.tech`**.

## 2. Règle "Logo + Description = Marque Prête à Lancer"
Dès que l'utilisateur souhaite créer une identité de marque, un site web ou lancer un produit :
1. Demandez uniquement **2 entrées** dans le chat :
   - **Entrée 1 — Logo** : Chemin vers un fichier logo existant (`.png`, `.svg`, `.jpg`), OU `"auto"` pour synthétiser un emblème vectoriel géométrique + wordmark à largeur égale.
   - **Entrée 2 — Description de l'activité** : Nom de la marque, activité, produits/services clés et coordonnées.
2. Appelez immédiatement **`acp_launch_brand_one_shot`** (ou vérifiez l'état via **`acp_get_status`**).

## 3. Les 7 Portes ACP (Exécutées Automatiquement par `acp_launch_brand_one_shot`)
1. **`GATE_1_BRIEF_AND_LOGO`** : Validation du logo et du brief + règle d'attribution institutionnelle (la société mère `WannaGoTech` apparaît uniquement dans le colophon, jamais comme slogan).
2. **`GATE_2_LOGO_SUITE_AND_EQUAL_WIDTH`** : Lockups vectoriels à largeur mathématiquement égale (`Largeur Ligne 2 == Largeur Ligne 1` à `0.001pt`), icônes Squircle `1024px` (`22.37%` rayon, `>10%` marge optique), `favicon.ico` multi-couches et Studio 3D interactif (`1.022` échelle).
3. **`GATE_3_WCAG_TOKENS_AND_STATIONERY`** : Palette calibrée WCAG 2.1 AA/AAA avec synthèse automatique d'encre profonde accessible (`>= 5.0:1` sur blanc), nuancier binaire `.ase`, papeterie A4, bannières sociales ajustées et signatures email `600px` (`tabular-nums`, isolation BiDi RTL).
4. **`GATE_4_WEB_AND_COMMERCIAL_SUITE`** : Contrat `DESIGN.md`, 4 Sites Web de Production (`FR, EN, DE, AR`) à 6 anatomies de sections et 8 états interactifs, 4 Brand Hubs, 4 Chartes Graphiques PDF HD, 4 Présentations A4 et **Vidéo de Lancement 20s (`brag.mp4` + miniature `brag.jpg` incrustée en Frame 0 + `share-copy.txt`)**.
5. **`GATE_5_11_SKILL_AUDIT_CERTIFICATION`** : Audit statique et mathématique certifiant `0 anomalie (P0 0 · P1 0 · P2 0)` et `100 / 100`.
6. **`GATE_6_SOCIAL_ACCOUNTS_AND_PHONE_ARTEMIS`** : Création et connexion des comptes sur les 9 réseaux (`x`, `linkedin`, `instagram`, `facebook`, `tiktok`, `youtube`, `bluesky`, `threads`, `reddit`) via navigateur persistant ou téléphone Android connecté (`wannago_phone_status`, `wannago_phone_read_otp`).
7. **`GATE_7_BRAND_LAUNCH_CAMPAIGN`** : Prévisualisation (`dryRun: true`) ou publication de la campagne de lancement inaugurale.
