/**
 * Every user-facing string in the application (09-Frontend-Design.md section 6).
 *
 * No French literal appears in a component. That gives one place to review
 * wording, and it is the difference between a one-hour and a one-week job if
 * internationalisation is ever added - which is out of scope for v1 (NFR-02).
 *
 * Keys are named by MEANING, never by their current text.
 */
export const fr = {
  common: {
    appName: 'AgencyFlow',
    loading: 'Chargement…',
    retry: 'Réessayer',
    error: 'Une erreur est survenue',
  },

  health: {
    title: 'État du système',
    subtitle: 'Vérification de la connexion entre le client, l’API et ses dépendances.',
    apiReachable: 'API accessible',
    apiUnreachable: 'API inaccessible',
    database: 'Base de données',
    storage: 'Stockage de fichiers',
    uptime: 'Temps de fonctionnement',
    version: 'Version',
    checkedAt: 'Vérifié à',
    seconds: 's',
  },

  status: {
    up: 'Disponible',
    down: 'Indisponible',
    unknown: 'Inconnu',
  },

  /**
   * Displayed while the first request is in flight for an unusually long time.
   *
   * Render's free tier sleeps after ~15 minutes idle, so a cold start can take
   * 30-60 seconds (AR-09). Without this message the application simply looks
   * broken, which during a demonstration is indistinguishable from a failure.
   */
  coldStart: {
    message: 'Démarrage du serveur en cours, cela peut prendre jusqu’à une minute…',
  },
} as const;
