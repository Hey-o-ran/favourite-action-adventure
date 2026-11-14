import type { MessageKey } from './en-GB';

/** Simplified Chinese. It must have every key that `en-GB.ts` has, and use the same {values}. */
export const zhCN: Record<MessageKey, string> = {
  // Page
  'header.title': '宾塔兰银行 - 比伯格利博彩事业',
  'header.coins': '{amount} 枚金币',

  // Menu
  'menu.menu': '菜单',
  'menu.whatsNew': '最新动态',
  'menu.leaderboard': '排行榜',
  'menu.rules': '规则',
  'menu.admin': '仅限管理员',
  'menu.logout': '退出登录',
  'menu.back': '返回游戏',
  'menu.language': '语言',

  // Saving the balance
  'save.failed': '尚未保存，正在重试…',
  'save.dismiss': '关闭',
  'save.conflict': '你的余额在另一台设备上发生了变化，已为你刷新。',
  'save.reset': '你的余额无法保存，已恢复为上次保存的数值。',
  'wallet.loading': '正在加载你的余额…',
  'wallet.loadError': '无法加载你的余额。请检查网络连接后重试。',
  'wallet.tryAgain': '重试',

  // Problems that can happen on any screen
  'error.generic': '出了点问题，请重试。',
  'error.rateLimited': '请求过于频繁，请稍等片刻后重试。',
  'error.network': '无法连接到服务器。请检查网络连接后重试。',

  // Login
  'login.email': '邮箱',
  'login.password': '密码',
  'login.submit': '登录',
  'login.busy': '正在登录…',
  'login.register': '注册',
  'login.enterBoth': '请输入你的邮箱和密码。',
  'login.invalid': '邮箱或密码不正确。',
  'login.pending': '你的账号正在等待管理员审核，审核通过后即可登录。',
  'login.notConfirmed': '请先验证你的邮箱。点击“注册”可获取新的验证码。',

  // Registration
  'register.title': '创建你的账号',
  'register.displayName': '显示名称',
  'register.displayNameHint': '3–20 个字符。这是其他玩家看到的名称。',
  'register.passwordHint': '至少 8 个字符，需包含字母和数字。',
  'register.resendToConfirm': '重新发送验证码以验证此账号',
  'register.submit': '创建账号',
  'register.busy': '正在创建账号…',
  'register.backToLogin': '返回登录',
  'register.emailTaken': '此邮箱已注册过账号。',
  'register.nameTaken': '该显示名称已被使用。',
  'register.confirmTitle': '请查收邮件',
  'register.confirmIntro': '我们已向 {email} 发送了一个 6 位验证码。请输入验证码以验证你的邮箱。',
  'register.code': '验证码',
  'register.codeFormat': '请输入邮件中的 6 位验证码。',
  'register.codeWrong': '验证码不正确。',
  'register.codeExpired': '该验证码已过期，请重新获取。',
  'register.confirm': '确认',
  'register.resend': '重新发送验证码',
  'register.newCodeSent': '我们已向你发送了新的验证码。',
  'register.pendingTitle': '账号等待审核',
  'register.pendingText': '谢谢，你的邮箱已验证。管理员会审核你的账号，审核通过后即可登录。',

  // Checks on the registration form
  'validate.nameShort': '显示名称至少需要 3 个字符',
  'validate.nameLong': '显示名称最多 20 个字符',
  'validate.nameChars': '显示名称只能包含字母、数字、空格、_ 和 -',
  'validate.email': '请输入有效的邮箱地址',
  'validate.passwordShort': '密码至少需要 8 个字符',
  'validate.passwordLong': '密码太长',
  'validate.passwordLetter': '密码必须包含字母',
  'validate.passwordNumber': '密码必须包含数字',
};
