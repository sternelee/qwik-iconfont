// Quota limits per plan
export const QUOTAS: Record<
  string,
  { maxProjects: number; maxIconsPerProject: number }
> = {
  free: { maxProjects: 10, maxIconsPerProject: 200 },
  pro: { maxProjects: Infinity, maxIconsPerProject: Infinity },
};

export function getQuota(plan: string | null) {
  return QUOTAS[plan || "free"] ?? QUOTAS.free;
}

export function isUnlimited(plan: string | null) {
  const q = getQuota(plan);
  return q.maxProjects === Infinity;
}
