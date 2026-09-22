import { Router } from 'express';
import { authController } from './auth.controller';
import { authGuard, validate, authLimiter, auditLog } from '../../middleware';
import { registerSchema, loginSchema } from './auth.schema';

const router = Router();

// Public routes (rate-limited to prevent brute force)
router.post(
  '/register',
  authLimiter,
  validate(registerSchema),
  auditLog('user_register'),
  authController.register
);

router.post(
  '/verify-otp',
  authLimiter,
  auditLog('user_verify_otp'),
  authController.verifyOtp
);

router.post(
  '/resend-otp',
  authLimiter,
  auditLog('user_resend_otp'),
  authController.resendOtp
);

router.post(
  '/login',
  authLimiter,
  validate(loginSchema),
  auditLog('user_login'),
  authController.login
);

router.post(
  '/forgot-password',
  authLimiter,
  auditLog('user_forgot_password'),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  authLimiter,
  auditLog('user_reset_password'),
  authController.resetPassword
);

router.post(
  '/refresh',
  authLimiter,
  authController.refresh
);

// Protected routes (require valid access token)
router.post(
  '/logout',
  authGuard,
  auditLog('user_logout'),
  authController.logout
);

router.get(
  '/me',
  authGuard,
  authController.me
);

router.patch(
  '/profile',
  authGuard,
  auditLog('user_update_profile'),
  authController.updateProfile
);

router.post(
  '/onboarding/complete',
  authGuard,
  auditLog('user_complete_onboarding'),
  authController.completeOnboarding
);

export default router;
