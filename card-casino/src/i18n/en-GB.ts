/**
 * Every piece of text players see, in British English. This is the source of truth: a new text goes here first,
 * and `zh-CN.ts` must then have the same key (the typecheck fails if it does not).
 * `{name}` marks a value that is filled in when the text is shown.
 */
export const enGB = {
  // Page
  'header.title': 'Bintarland Bank - Bibergly Betting Business',
  'header.coins': '{amount} coins',

  // Menu
  'menu.menu': 'Menu',
  'menu.whatsNew': "What's new",
  'menu.leaderboard': 'Leaderboard',
  'menu.rules': 'Rules',
  'menu.admin': 'ADMIN ONLY',
  'menu.logout': 'Log out',
  'menu.back': 'Back to game',
  'menu.language': 'Language',

  // Saving the balance
  'save.failed': 'Not saved yet. Retrying…',
  'save.dismiss': 'Dismiss',
  'save.conflict': 'Your balance changed on another device and was refreshed.',
  'save.reset': 'Your balance could not be saved and was reset to the last saved value.',
  'wallet.loading': 'Loading your balance…',
  'wallet.loadError': 'Could not load your balance. Check your connection and try again.',
  'wallet.tryAgain': 'Try again',

  // Problems that can happen on any screen
  'error.generic': 'Something went wrong. Please try again.',
  'error.rateLimited': 'Too many requests. Please wait a moment and try again.',
  'error.network': 'Could not reach the server. Check your connection and try again.',

  // Login
  'login.email': 'Email',
  'login.password': 'Password',
  'login.submit': 'Log in',
  'login.busy': 'Logging in…',
  'login.register': 'Register',
  'login.enterBoth': 'Enter your email and password.',
  'login.invalid': 'Incorrect email or password.',
  'login.pending': 'Your account is waiting for admin approval. You can log in once it is approved.',
  'login.notConfirmed': 'Confirm your email address first. Use Register to get a new confirmation code.',

  // Registration
  'register.title': 'Create your account',
  'register.displayName': 'Display name',
  'register.displayNameHint': '3–20 characters. This is the name other players see.',
  'register.passwordHint': 'At least 8 characters, with a letter and a number.',
  'register.resendToConfirm': 'Resend the code to confirm this account',
  'register.submit': 'Create account',
  'register.busy': 'Creating account…',
  'register.backToLogin': 'Back to login',
  'register.emailTaken': 'An account with this email already exists.',
  'register.nameTaken': 'That display name is already taken.',
  'register.confirmTitle': 'Check your email',
  'register.confirmIntro': 'We sent a 6-digit code to {email}. Enter it to confirm your email address.',
  'register.code': 'Confirmation code',
  'register.codeFormat': 'Enter the 6-digit code from your email.',
  'register.codeWrong': 'The confirmation code is incorrect.',
  'register.codeExpired': 'That code has expired. Request a new one.',
  'register.confirm': 'Confirm',
  'register.resend': 'Resend code',
  'register.newCodeSent': 'We sent you a new code.',
  'register.pendingTitle': 'Account pending approval',
  'register.pendingText':
    'Thanks, your email is confirmed. An admin will review your account, and you can log in once it is approved.',

  // Checks on the registration form
  'validate.nameShort': 'Display name must be at least 3 characters',
  'validate.nameLong': 'Display name must be at most 20 characters',
  'validate.nameChars': 'Display name may only contain letters, numbers, spaces, _ and -',
  'validate.email': 'Enter a valid email address',
  'validate.passwordShort': 'Password must be at least 8 characters',
  'validate.passwordLong': 'Password is too long',
  'validate.passwordLetter': 'Password must contain a letter',
  'validate.passwordNumber': 'Password must contain a number',
} as const;

export type MessageKey = keyof typeof enGB;
