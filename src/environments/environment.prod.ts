export const environment = {
  // This is the environment for development
  production: true,

  // The frontend bundled with Cyclos is not standalone: it allows redirects to the classic frontend
  standalone: false,

  // The API path / URL when in standalone mode
  apiUrl: '/api',

  // Keep false for now. Can be enabled after full third-party compatibility validation.
  zonelessChangeDetection: false
};
