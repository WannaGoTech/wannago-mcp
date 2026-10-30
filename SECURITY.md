# Politique de Sécurité & Architecture Cryptographique : WannaGo MCP & ACP

## Protection des Moteurs Propriétaires (AES-256-GCM)
Les moteurs de génération de **WannaGo MCP** (`engine/wannago_brand.wgo` et `engine/wannago_video.wgo`) sont chiffrés via **AES-256-GCM** et déchiffrés exclusivement en mémoire vive (RAM) lors de la validation d'une clé signée `WANNAGO_API_KEY` (`wgo_trial_...` ou `wgo_live_...`).

## Signaler une Vulnérabilité ou Contacter le Support Sécurité
Pour toute question relative à la sécurité ou aux licences cryptographiques, contactez : **[contact@wannago.tech](mailto:contact@wannago.tech)**.
