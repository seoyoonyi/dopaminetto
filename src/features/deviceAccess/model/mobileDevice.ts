export function isMobileUserAgent(userAgent: string): boolean {
  const normalizedUserAgent = userAgent.toLowerCase();

  if (!normalizedUserAgent) {
    return false;
  }

  /**
   * Chrome의 User-Agent 축소 정책으로 인해 향후 userAgentData 보완이 필요할 수 있다.
   */
  return (
    normalizedUserAgent.includes("iphone") ||
    normalizedUserAgent.includes("ipod") ||
    (normalizedUserAgent.includes("android") && normalizedUserAgent.includes("mobile"))
  );
}
