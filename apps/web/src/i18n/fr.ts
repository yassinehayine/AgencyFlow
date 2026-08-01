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
    cancel: 'Annuler',
    save: 'Enregistrer',
    create: 'Créer',
    search: 'Rechercher',
    none: '—',
    yes: 'Oui',
    no: 'Non',
    previous: 'Précédent',
    next: 'Suivant',
    pageOf: (page: number, total: number) => `Page ${page} sur ${total}`,
    emptyList: 'Aucun résultat.',
  },

  auth: {
    loginTitle: 'Connexion',
    loginSubtitle: 'Accédez à votre espace AgencyFlow.',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    submit: 'Se connecter',
    submitting: 'Connexion…',
    logout: 'Se déconnecter',
    // Deliberately vague, and identical for every cause. Distinguishing them
    // would tell anyone which addresses are registered (FR-001).
    failed: 'Adresse e-mail ou mot de passe incorrect.',
    sessionExpired: 'Votre session a expiré. Veuillez vous reconnecter.',
    forbidden: 'Vous n’avez pas accès à cette page.',
  },

  nav: {
    users: 'Utilisateurs',
    clients: 'Clients',
    status: 'État du système',
  },

  users: {
    title: 'Utilisateurs',
    subtitle: 'Comptes de l’agence et contacts clients.',
    createTitle: 'Nouvel utilisateur',
    name: 'Nom complet',
    username: 'Nom d’utilisateur',
    usernameHint: 'Minuscules, 3 à 30 caractères. Définitif : il sert aux mentions.',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    passwordHint: '8 caractères minimum.',
    role: 'Rôle',
    skill: 'Compétence',
    skillHint: 'Obligatoire pour un membre d’équipe uniquement.',
    active: 'Actif',
    inactive: 'Inactif',
    filterByRole: 'Tous les rôles',
    filterBySkill: 'Toutes les compétences',
    searchPlaceholder: 'Nom, nom d’utilisateur ou e-mail',
  },

  clients: {
    title: 'Clients',
    subtitle: 'Organisations clientes de l’agence.',
    createTitle: 'Nouvelle organisation cliente',
    name: 'Nom de l’organisation',
    contactEmail: 'E-mail de contact',
    contactPhone: 'Téléphone',
    address: 'Adresse',
    notes: 'Notes',
    archived: 'Archivé',
    searchPlaceholder: 'Nom de l’organisation',
    contacts: 'Contacts',
    addContact: 'Ajouter un contact',
  },

  roles: {
    ADMINISTRATOR: 'Administrateur',
    PROJECT_MANAGER: 'Chef de projet',
    TEAM_MEMBER: 'Membre d’équipe',
    CLIENT_CONTACT: 'Contact client',
  },

  skills: {
    BACKEND: 'Backend',
    FRONTEND: 'Frontend',
    UI_UX: 'UI/UX',
    GRAPHIC_DESIGN: 'Design graphique',
    QA: 'Qualité (QA)',
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
