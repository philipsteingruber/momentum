export const verifyCronAuth = (req: Request): boolean => {
  const authHeader = req.headers.get("Authorization");
  return authHeader !== `Bearer ${process.env.CRON_SECRET}`;
};
