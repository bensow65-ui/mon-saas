export interface UserSubscription {
  trialEndsAt: string;
  subscriptionStatus: "trial" | "active" | "expired";
}

const STORAGE_KEY = "factures_express_subscription_v1";
const TRIAL_DAYS = 5;

export function getOrCreateSubscription(nowDate: Date = new Date()): UserSubscription {
  if (typeof window === "undefined") {
    return {
      trialEndsAt: new Date(nowDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
      subscriptionStatus: "trial",
    };
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as UserSubscription;
      if (parsed.trialEndsAt && parsed.subscriptionStatus) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Erreur lecture abonnement:", e);
  }

  const created: UserSubscription = {
    trialEndsAt: new Date(nowDate.getTime() + TRIAL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
    subscriptionStatus: "trial",
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(created));
  } catch (e) {
    console.error("Erreur sauvegarde abonnement:", e);
  }

  return created;
}

export function setSubscriptionStatus(status: "trial" | "active" | "expired"): UserSubscription {
  const current = getOrCreateSubscription();
  const updated: UserSubscription = {
    ...current,
    subscriptionStatus: status,
  };

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }

  return updated;
}

export function checkUserAccess(
  user: UserSubscription,
  nowDate?: Date
): { canAccess: boolean; isTrial: boolean; daysLeft: number } {
  if (user.subscriptionStatus === "active") {
    return { canAccess: true, isTrial: false, daysLeft: 0 };
  }

  const now = nowDate ?? new Date(2026, 0, 1);
  const trialEnd = new Date(user.trialEndsAt);
  const diffTime = trialEnd.getTime() - now.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

  if (user.subscriptionStatus === "trial" && daysLeft > 0) {
    return { canAccess: true, isTrial: true, daysLeft };
  }

  return { canAccess: false, isTrial: false, daysLeft: 0 };
}