"use client";

import { MaxWidthWrapper } from "@/_components/max-width-wrapper";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/trpc/client";
import { format } from "date-fns";
import { useMemo, useState } from "react";

type DateRange = "24h" | "7d" | "14d";
type LevelFilter = "all" | "info_above" | "error_only";

const levelBadgeVariant = (level: string): "default" | "secondary" | "destructive" | "outline" => {
  if (level === "error") return "destructive";
  if (level === "debug") return "outline";
  return "secondary";
};

const AdminPage = () => {
  const [dateRange, setDateRange] = useState<DateRange>("24h");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [search, setSearch] = useState("");

  const { data: logs, isPending } = trpc.cronLog.getAll.useQuery({ dateRange, level });

  const filteredLogs = useMemo(() => {
    if (!logs) return [];
    const term = search.toLowerCase().trim();
    if (!term) return logs;
    return logs.filter((log) => {
      const dataStr = log.data ? JSON.stringify(log.data).toLowerCase() : "";
      return (
        log.job.toLowerCase().includes(term) ||
        log.event.toLowerCase().includes(term) ||
        log.runId.toLowerCase().includes(term) ||
        dataStr.includes(term)
      );
    });
  }, [logs, search]);

  return (
    <MaxWidthWrapper>
      <Card className="w-full">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Cron Logs</CardTitle>
            <div className="flex items-center gap-x-2">
              <Input
                placeholder="Search job, event, run ID, data…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-64"
              />
              <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 hours</SelectItem>
                  <SelectItem value="7d">Last 7 days</SelectItem>
                  <SelectItem value="14d">Last 14 days</SelectItem>
                </SelectContent>
              </Select>
              <Select value={level} onValueChange={(v) => setLevel(v as LevelFilter)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All levels</SelectItem>
                  <SelectItem value="info_above">Info and above</SelectItem>
                  <SelectItem value="error_only">Errors only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>Job</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Level</TableHead>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isPending ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center">
                      <Spinner />
                    </TableCell>
                  </TableRow>
                ) : !filteredLogs.length ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      No logs found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-xs whitespace-nowrap">
                        {format(new Date(log.timestamp), "MMM d, HH:mm:ss")}
                      </TableCell>
                      <TableCell>{log.job}</TableCell>
                      <TableCell>{log.event}</TableCell>
                      <TableCell>
                        <Badge variant={levelBadgeVariant(log.level)}>{log.level}</Badge>
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {log.runId.slice(0, 8)}…
                      </TableCell>
                      <TableCell className="font-mono text-xs max-w-xs truncate">
                        {log.data ? JSON.stringify(log.data) : "—"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </MaxWidthWrapper>
  );
};

export default AdminPage;
