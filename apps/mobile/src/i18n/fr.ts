/**
 * Every user-facing string in the mobile application.
 *
 * Same rule as the web client (09-Frontend-Design.md §6): no French literal
 * appears in a component. Keys are named by MEANING, never by their current
 * text.
 *
 * A separate file from `apps/web/src/i18n/fr.ts` rather than a shared one, and
 * that is a considered choice. The two surfaces genuinely differ — a phone
 * says "Approuver" where a desk screen has room for "Approuver le livrable" —
 * and a shared file would either force identical wording on both or fill with
 * platform-suffixed keys. What IS shared lives in `@agencyflow/contracts`:
 * the enums and rules, not the prose.
 */
export const fr = {
  common: {
    appName: 'AgencyFlow',
    loading: 'Chargement…',
    retry: 'Réessayer',
    cancel: 'Annuler',
  },

  auth: {
    portalTitle: 'Portail client',
    signIn: 'Se connecter',
    signingIn: 'Connexion…',
    signOut: 'Se déconnecter',
    email: 'Adresse e-mail',
    password: 'Mot de passe',
    subtitle: 'Connectez-vous pour suivre vos projets et valider vos livrables.',

    emailRequired: 'Saisissez votre adresse e-mail.',
    emailInvalid: 'Cette adresse e-mail n’est pas valide.',
    passwordRequired: 'Saisissez votre mot de passe.',

    /**
     * FR-007, BR-11 — there is no registration endpoint to point anyone at.
     * Saying where accounts come from is more useful than a link that leads
     * nowhere.
     */
    noAccountHint: 'Vos identifiants vous sont fournis par votre agence.',

    /**
     * Shown when a valid account signs in but is not a Client Contact.
     *
     * Deliberately not phrased as a refusal of the person. Nothing here is
     * built for an agency role — no task board, no administration — so the
     * honest message is that the application is the wrong one, and the web
     * workspace is the right one (ADR-0007).
     */
    portalOnlyTitle: 'Application réservée aux clients',
    portalOnlyBody:
      'Cette application mobile est destinée aux contacts clients. Les comptes de l’agence disposent de l’espace de travail complet sur le web.',
  },

  portal: {
    dashboardPlaceholder: 'Le tableau de bord arrive en Phase 5.',
  },

  errors: {
    /** The request never reached the server. */
    network: 'Impossible de joindre le serveur. Vérifiez votre connexion, puis réessayez.',
    /** It reached the server and nothing came back in time. */
    timeout: 'Le serveur met trop de temps à répondre. Réessayez dans un instant.',
    /** Anything that is not an `ApiError` — a genuine defect, not a refusal. */
    unexpected: 'Une erreur inattendue est survenue.',
    /**
     * A 401 on an ALREADY authenticated request. Unlike a failed sign-in, this
     * one has a knowable cause: the session was valid and no longer is —
     * expired after 12 hours, or the account was deactivated or its role
     * changed since (ADR-0005, FR-009, FR-010).
     */
    sessionEnded: 'Votre session a pris fin. Veuillez vous reconnecter.',

    notFoundTitle: 'Page introuvable',
    notFoundBody: 'Cette adresse ne correspond à aucun écran de l’application.',
    backToStart: 'Revenir au début',
  },
} as const;
