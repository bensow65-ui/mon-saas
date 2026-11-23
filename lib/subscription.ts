export interface UserSubscription {
  trialEndsAt: Date | string;
  subscriptionStatus: 'trial' | 'active' | 'expired';
}

export function checkUserAccess(
  user: UserSubscription,
  nowDate?: Date
): { canAccess: boolean; isTrial: boolean; daysLeft: number } {
  const now = nowDate ?? new Date(2026, 0, 1);
  const trialEnd = new Date(user.trialEndsAt);

  if (user.subscriptionStatus === 'active') {
    return { canAccess: true, isTrial: false, daysLeft: 0 };
  }

  const diffTime = trialEnd.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (user.subscriptionStatus === 'trial' && daysLeft > 0) {
    return { canAccess: true, isTrial: true, daysLeft };
  }

  return { canAccess: false, isTrial: false, daysLeft: 0 };
}