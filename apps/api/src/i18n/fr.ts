/**
 * French user-facing messages (NFR-01, NFR-06).
 *
 * Every string the API can show a human lives here, not inline at the throw
 * site. The interface is French-only in v1 — no i18n framework, no locale
 * negotiation (00-Project-Foundation.md section 6) — but centralising the
 * strings means adding a second language later is a new file, not a hunt
 * through every service.
 *
 * Wording rule: say what happened and what to do next. "Interdit" tells the
 * user nothing they can act on.
 */
export const fr = {
  common: {
    validationFailed: 'La requête contient des données invalides.',
    notFound: 'Ressource introuvable.',
    forbidden: "Vous n'êtes pas autorisé à effectuer cette action.",
    internalError: 'Une erreur interne est survenue. Veuillez réessayer.',
  },

  auth: {
    /**
     * One message for a wrong password, an unknown address AND a deactivated
     * account. Naming the real cause would let anyone test which addresses are
     * registered (FR-001).
     */
    invalidCredentials: 'Adresse e-mail ou mot de passe incorrect.',
    unauthenticated: 'Authentification requise. Veuillez vous reconnecter.',
    currentPasswordIncorrect: 'Le mot de passe actuel est incorrect.',
  },

  users: {
    notFound: 'Utilisateur introuvable.',
    emailAlreadyExists: 'Cette adresse e-mail est déjà utilisée.',
    usernameAlreadyExists: "Ce nom d'utilisateur est déjà utilisé.",
    usernameImmutable:
      "Le nom d'utilisateur ne peut pas être modifié : il sert à identifier l'utilisateur dans les mentions.",
    skillRequired: "Une compétence est obligatoire pour un membre d'équipe.",
    skillNotApplicable: "Seul un membre d'équipe peut avoir une compétence.",
    clientRequired: 'Un contact client doit être rattaché à une organisation cliente.',
    clientNotApplicable: 'Seul un contact client peut être rattaché à une organisation cliente.',
    roleMustBeInternal:
      "Ce rôle n'est pas valide ici. Un contact client se crée depuis l'organisation cliente concernée.",
    lastActiveAdministrator:
      'Le dernier administrateur actif ne peut pas être désactivé. Créez ou réactivez un autre administrateur au préalable.',
    hasOpenTasks:
      'Cet utilisateur a encore des tâches en cours. Réaffectez-les ou annulez-les avant de le désactiver.',
    cannotDeactivateSelf: 'Vous ne pouvez pas désactiver votre propre compte.',
  },

  projects: {
    notFound: 'Projet introuvable.',
    endBeforeStart: 'La date de fin ne peut pas précéder la date de début.',
    invalidStatusTransition: (from: string, to: string) =>
      `Le passage du statut « ${from} » à « ${to} » n'est pas autorisé.`,
    invalidProjectManager: 'Le responsable doit être un chef de projet ou un administrateur actif.',
    invalidTeamMember: "Seul un membre d'équipe actif peut être ajouté à l'équipe du projet.",
    alreadyTeamMember: 'Cette personne fait déjà partie de l’équipe du projet.',
    teamLimitReached: 'L’équipe du projet a atteint sa taille maximale.',
    milestoneLimitReached: 'Ce projet a atteint son nombre maximal de jalons.',
    milestoneOrderTaken: 'Un autre jalon occupe déjà cette position dans la feuille de route.',
    milestoneNotFound: 'Jalon introuvable.',
    archived: 'Ce projet est archivé et ne peut plus être modifié.',
  },

  clients: {
    notFound: 'Organisation cliente introuvable.',
    nameAlreadyExists: 'Une organisation cliente porte déjà ce nom.',
    archived: "Cette organisation cliente est archivée et n'accepte plus de nouveaux projets.",
  },
} as const;
