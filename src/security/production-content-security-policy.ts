export const productionContentSecurityPolicy = {
  directives: {
    connectSrc: [
      "'self'",
      'https://identitytoolkit.googleapis.com',
      'https://securetoken.googleapis.com',
    ],
  },
} as const;
