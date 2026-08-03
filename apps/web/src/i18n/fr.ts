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
    dashboard: 'Tableau de bord',
    projects: 'Projets',
    users: 'Utilisateurs',
    clients: 'Clients',
    status: 'État du système',
  },

  /**
   * FR-068 – FR-073.
   *
   * Titles are written from the reader's point of view rather than from the
   * data's — "Ce qui m'attend" and not "Tâches en revue". Each dashboard exists
   * to answer one question its user actually asks, and the heading is that
   * question answered.
   */
  dashboard: {
    agencyTitle: 'L’agence en un coup d’œil',
    myDayTitle: 'Ce qui m’attend aujourd’hui',
    myWorkTitle: 'Mon travail',
    portalTitle: 'Vos projets',

    awaitingMyReview: 'À valider par vous',
    nothingToReview: 'Rien à valider pour l’instant.',
    blocked: 'Tâches bloquées',
    nothingBlocked: 'Aucune tâche bloquée.',
    awaitingClient: 'En attente du client',
    noneAwaitingClient: 'Aucun livrable en attente de décision.',
    awaitingMyApproval: 'En attente de votre décision',
    nothingToApprove: 'Aucun livrable ne vous attend pour le moment.',
    recentlyApproved: 'Approuvés récemment',
    nothingApprovedYet: 'Aucun livrable approuvé pour l’instant.',

    overdue: 'En retard',
    overdueAgencyWide: 'En retard, toute l’agence',
    noOverdue: 'Aucun retard.',
    dueSoonTitle: 'À échéance proche',
    dueSoon: 'Bientôt dû',
    nothingDueSoon: 'Aucune échéance dans les trois prochains jours.',

    myProjects: 'Mes projets',
    activeProjects: 'Projets en cours',
    noProjects: 'Aucun projet.',
    upcomingMilestones: 'Prochains jalons',
    noUpcomingMilestones: 'Aucun jalon à venir.',

    workload: 'Charge de l’équipe',
    noWorkload: 'Aucune tâche en cours.',
    noTasksInColumn: 'Rien ici.',
    empty: 'Rien à afficher.',

    openTasks: (count: number) => `${count} tâche${count === 1 ? '' : 's'} en cours`,
    overdueCount: (count: number) => `${count} en retard`,
    completedTotal: (count: number) =>
      `${count} tâche${count === 1 ? '' : 's'} terminée${count === 1 ? '' : 's'}.`,
    count: (total: number) => `${total}`,
    // A truncated list that does not admit it is truncated is worse than no
    // list: the reader concludes there are ten when there are twenty-seven.
    showingOf: (shown: number, total: number) => `${shown} sur ${total}`,
  },

  projects: {
    title: 'Projets',
    subtitle: 'Les projets que votre rôle vous permet de suivre.',
    createTitle: 'Nouveau projet',
    name: 'Nom du projet',
    description: 'Description',
    client: 'Client',
    manager: 'Chef de projet',
    startDate: 'Date de début',
    endDate: 'Date de fin',
    status: 'Statut',
    team: 'Équipe',
    teamSize: 'Personnes',
    milestones: 'Jalons',
    progress: 'Avancement',
    archived: 'Archivé',
    searchPlaceholder: 'Nom du projet',
    filterByStatus: 'Tous les statuts',
    selectClient: 'Sélectionner un client',
    selectManager: 'Sélectionner un chef de projet',
    addMember: 'Ajouter au projet',
    removeMember: 'Retirer',
    selectMember: 'Sélectionner un membre d’équipe',
    changeStatusTo: 'Faire passer à',
    reassignManager: 'Changer de chef de projet',
    noTransitions: 'Ce projet a atteint un statut final : aucun changement n’est possible.',
    // BR-28 — a Client Contact never sees the roster. Saying so beats an
    // empty panel that reads as "nobody is working on this".
    teamHiddenForClient: 'La composition de l’équipe est réservée à l’agence.',
    emptyTeam: 'Aucun membre d’équipe pour l’instant.',
    emptyMilestones: 'Aucun jalon défini.',
    backToList: '← Tous les projets',
  },

  tasks: {
    title: 'Tâches',
    createTitle: 'Nouvelle tâche',
    taskTitle: 'Intitulé',
    description: 'Description',
    milestone: 'Jalon',
    assignee: 'Assigné à',
    dueDate: 'Échéance',
    status: 'Statut',
    empty: 'Aucune tâche pour ce projet.',
    selectMilestone: 'Sélectionner un jalon',
    selectAssignee: 'Sélectionner un membre de l’équipe',
    milestoneRequiredFirst: 'Créez d’abord un jalon : une tâche appartient toujours à un jalon.',
    teamRequiredFirst:
      'Ajoutez d’abord un membre à l’équipe : une tâche doit être assignée à quelqu’un du projet.',
    blockedBecause: 'Bloquée :',
    blockReasonPrompt: 'Motif du blocage',
    // The BR-04 wording matters: it explains WHY rather than only refusing.
    completionIsManagerOnly: 'La validation d’une tâche revient au chef de projet.',
  },

  taskCommands: {
    start: 'Démarrer',
    'submit-review': 'Envoyer en revue',
    done: 'Valider',
    return: 'Renvoyer au travail',
    block: 'Bloquer',
    unblock: 'Débloquer',
    cancel: 'Annuler la tâche',
  },

  taskStatus: {
    TODO: 'À faire',
    IN_PROGRESS: 'En cours',
    IN_REVIEW: 'En revue',
    DONE: 'Terminée',
    BLOCKED: 'Bloquée',
    CANCELLED: 'Annulée',
  },

  milestones: {
    createTitle: 'Nouveau jalon',
    name: 'Nom du jalon',
    order: 'Position',
    dueDate: 'Échéance',
    add: 'Ajouter le jalon',
    remove: 'Supprimer',
  },

  deliverables: {
    title: 'Livrables',
    createTitle: 'Nouveau livrable',
    name: 'Nom du livrable',
    description: 'Description',
    dueDate: 'Échéance',
    empty: 'Aucun livrable pour ce projet.',
    version: 'Version',
    versionHistory: 'Historique des versions',
    files: 'Fichiers',
    addFile: 'Ajouter un fichier',
    noFiles: 'Aucun fichier sur cette version.',
    download: 'Télécharger',
    submit: 'Envoyer au client',
    startReview: 'Commencer la revue',
    approve: 'Approuver',
    requestChanges: 'Demander des modifications',
    changesPrompt: 'Que faut-il modifier ?',
    // FR-047 - the button is disabled with a reason rather than returning 422.
    submitNeedsFile: 'Ajoutez au moins un fichier avant de l’envoyer au client.',
    // BR-07 - approval is the end of the road, and saying so beats a page
    // where every control has silently disappeared.
    approvedNotice:
      'Ce livrable est approuvé. Il ne peut plus être modifié : créez un nouveau livrable si nécessaire.',
    awaitingClient: 'En attente de la décision du client.',
    decisionComment: 'Commentaire du client',
    allowedFormats: 'PDF, PNG, JPG, JPEG, SVG, DOCX, XLSX, PPTX, ZIP — 20 Mo maximum.',
  },

  deliverableStatus: {
    DRAFT: 'Brouillon',
    SUBMITTED: 'Envoyé au client',
    UNDER_REVIEW: 'En cours de revue',
    APPROVED: 'Approuvé',
    CHANGES_REQUESTED: 'Modifications demandées',
  },

  versionOutcome: {
    PENDING: 'En attente',
    APPROVED: 'Approuvée',
    CHANGES_REQUESTED: 'Modifications demandées',
  },

  projectStatus: {
    PLANNED: 'Planifié',
    IN_PROGRESS: 'En cours',
    ON_HOLD: 'En pause',
    COMPLETED: 'Terminé',
    CANCELLED: 'Annulé',
  },

  milestoneStatus: {
    NOT_STARTED: 'Non démarré',
    IN_PROGRESS: 'En cours',
    COMPLETED: 'Terminé',
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
   * Railway keeps the service running (ADR-0006), so the routine 15-minute
   * sleep this was written for is gone. It still earns its place: the first
   * request after a deploy waits on the Atlas connection, and a stopped
   * service takes just as long to come back. Without this message the
   * application simply looks broken, which during a demonstration is
   * indistinguishable from a failure (AR-09).
   */
  coldStart: {
    message: 'Démarrage du serveur en cours, cela peut prendre jusqu’à une minute…',
  },
} as const;
