import { useState, useEffect } from "react";
import { BurnLinkLogo } from "@/components/BurnLinkLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Database,
  MessageSquare,
  FileText,
  Activity,
  Eye,
  Trash2,
  Clock,
  Shield,
  Search,
  Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Secret {
  id: string;
  type: string;
  created_at: number;
  destroyed_at: number | null;
  view_count: number;
  view_limit: number;
  expiration: string;
  has_password: boolean;
  encrypted_payload: string;
  participants: string[];
  retention_policy: string;
  access_count: number;
}

interface LogEntry {
  id: string;
  secret_id: string;
  event_type: string;
  participant_id: string | null;
  event_timestamp: number;
  metadata: any;
}

interface Statistics {
  total_secrets: number;
  active_secrets: number;
  destroyed_secrets: number;
  total_messages: number;
  total_files: number;
  total_voice_notes: number;
  total_views: number;
}

export default function Admin() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [statistics, setStatistics] = useState<Statistics | null>(null);
  const [selectedSecret, setSelectedSecret] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const { toast } = useToast();

  const handleLogin = () => {
    if (password === "admin123") {
      setAuthenticated(true);
      loadAdminData();
    } else {
      toast({
        title: "Access Denied",
        description: "Invalid admin password",
        variant: "destructive",
      });
    }
  };

  const loadAdminData = async () => {
    try {
      // Load all secrets
      const { data: secretsData } = await supabase
        .from("secrets")
        .select("*")
        .order("created_at", { ascending: false });

      if (secretsData) {
        setSecrets(secretsData);
      }

      // Load all logs
      const { data: logsData } = await supabase
        .from("secret_logs")
        .select("*")
        .order("event_timestamp", { ascending: false })
        .limit(100);

      if (logsData) {
        setLogs(logsData);
      }

      // Calculate statistics
      const stats: Statistics = {
        total_secrets: secretsData?.length || 0,
        active_secrets: secretsData?.filter((s) => !s.destroyed_at).length || 0,
        destroyed_secrets: secretsData?.filter((s) => s.destroyed_at).length || 0,
        total_messages: 0,
        total_files: 0,
        total_voice_notes: 0,
        total_views: secretsData?.reduce((acc, s) => acc + s.view_count, 0) || 0,
      };

      const { data: messagesData } = await supabase
        .from("chat_messages")
        .select("id", { count: "exact", head: true });
      stats.total_messages = messagesData ? 0 : 0;

      const { data: filesData } = await supabase
        .from("stored_files")
        .select("id", { count: "exact", head: true });
      stats.total_files = filesData ? 0 : 0;

      const { data: voiceData } = await supabase
        .from("stored_voice_notes")
        .select("id", { count: "exact", head: true });
      stats.total_voice_notes = voiceData ? 0 : 0;

      setStatistics(stats);
    } catch (error) {
      console.error("Error loading admin data:", error);
      toast({
        title: "Error",
        description: "Failed to load admin data",
        variant: "destructive",
      });
    }
  };

  const viewSecretDetails = async (secretId: string) => {
    setSelectedSecret(secretId);
    const { data: secretLogs } = await supabase
      .from("secret_logs")
      .select("*")
      .eq("secret_id", secretId)
      .order("event_timestamp", { ascending: false });

    if (secretLogs) {
      setLogs(secretLogs);
    }
  };

  const exportData = () => {
    const data = {
      secrets: secrets,
      logs: logs,
      statistics: statistics,
      exported_at: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `burnlink-retention-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ago`;
    if (hours > 0) return `${hours}h ago`;
    if (minutes > 0) return `${minutes}m ago`;
    return `${seconds}s ago`;
  };

  const filteredSecrets = secrets.filter(
    (s) =>
      s.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      s.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-primary" />
            <CardTitle>Admin Access</CardTitle>
            <CardDescription>
              Enter the admin password to view all retained data
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                placeholder="Enter admin password"
              />
            </div>
            <Button onClick={handleLogin} className="w-full" variant="ember">
              <Shield className="w-4 h-4" />
              Login
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Demo password: admin123
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 backdrop-blur-md bg-background/50 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BurnLinkLogo />
            <Badge variant="destructive">ADMIN PANEL</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadAdminData}>
              Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportData}>
              <Download className="w-4 h-4" />
              Export Data
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        {statistics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Secrets</CardTitle>
                <Database className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.total_secrets}</div>
                <p className="text-xs text-muted-foreground">
                  {statistics.active_secrets} active, {statistics.destroyed_secrets} destroyed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Chat Messages</CardTitle>
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.total_messages}</div>
                <p className="text-xs text-muted-foreground">All retained permanently</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{statistics.total_views}</div>
                <p className="text-xs text-muted-foreground">Fully logged</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Audit Logs</CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{logs.length}</div>
                <p className="text-xs text-muted-foreground">Events tracked</p>
              </CardContent>
            </Card>
          </div>
        )}

        <Tabs defaultValue="secrets" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="secrets">All Secrets</TabsTrigger>
            <TabsTrigger value="logs">Audit Logs</TabsTrigger>
            <TabsTrigger value="retention">Retention Policy</TabsTrigger>
          </TabsList>

          <TabsContent value="secrets" className="space-y-4">
            <div className="flex items-center gap-2">
              <Search className="w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search secrets..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            <div className="space-y-2">
              {filteredSecrets.map((secret) => (
                <Card
                  key={secret.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => viewSecretDetails(secret.id)}
                >
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-sm font-mono">{secret.id}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-1">
                          <Badge variant="outline">{secret.type}</Badge>
                          {secret.destroyed_at && (
                            <Badge variant="destructive">
                              <Trash2 className="w-3 h-3 mr-1" />
                              Destroyed
                            </Badge>
                          )}
                          <span className="text-xs">
                            {formatDuration(Date.now() - secret.created_at)}
                          </span>
                        </CardDescription>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          {secret.view_count}/{secret.view_limit} views
                        </div>
                        <div className="flex items-center gap-1 mt-1">
                          <Activity className="w-3 h-3" />
                          {secret.access_count} accesses
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs space-y-1">
                      <div>
                        <span className="text-muted-foreground">Created:</span>{" "}
                        {formatTimestamp(secret.created_at)}
                      </div>
                      {secret.destroyed_at && (
                        <div>
                          <span className="text-muted-foreground">Destroyed:</span>{" "}
                          {formatTimestamp(secret.destroyed_at)}
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">Retention:</span>{" "}
                        {secret.retention_policy}
                      </div>
                      <div className="mt-2 p-2 bg-muted rounded text-xs font-mono truncate">
                        {secret.encrypted_payload.substring(0, 100)}...
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="logs" className="space-y-2">
            {selectedSecret && (
              <div className="mb-4">
                <Badge>Showing logs for: {selectedSecret}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  className="ml-2"
                  onClick={() => {
                    setSelectedSecret(null);
                    loadAdminData();
                  }}
                >
                  Show all logs
                </Button>
              </div>
            )}

            {logs.map((log) => (
              <Card key={log.id}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{log.event_type}</Badge>
                        <span className="text-xs text-muted-foreground">
                          {formatTimestamp(log.event_timestamp)}
                        </span>
                      </div>
                      <div className="text-xs font-mono text-muted-foreground">
                        Secret: {log.secret_id}
                      </div>
                      {log.participant_id && (
                        <div className="text-xs text-muted-foreground">
                          Participant: {log.participant_id}
                        </div>
                      )}
                      {log.metadata && Object.keys(log.metadata).length > 0 && (
                        <div className="mt-2 p-2 bg-muted rounded text-xs">
                          <pre>{JSON.stringify(log.metadata, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                    <Clock className="w-4 h-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          <TabsContent value="retention" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Data Retention Policy</CardTitle>
                <CardDescription>
                  All data is retained permanently for compliance and audit purposes
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    What is retained:
                  </h4>
                  <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                    <li>All text secrets (encrypted payloads)</li>
                    <li>All file uploads (encrypted content)</li>
                    <li>All voice recordings (encrypted audio)</li>
                    <li>All chat messages (full conversation history)</li>
                    <li>Complete audit trail of all operations</li>
                    <li>View counts, access times, participant IDs</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Data is never deleted:
                  </h4>
                  <ul className="list-disc list-inside text-sm space-y-1 text-muted-foreground">
                    <li>Secrets marked as "destroyed" remain in database</li>
                    <li>Chat messages persist even after room destruction</li>
                    <li>Audit logs are permanent and immutable</li>
                    <li>All operations are tracked with timestamps</li>
                  </ul>
                </div>

                <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg">
                  <p className="text-sm font-medium text-destructive mb-2">Legal Notice</p>
                  <p className="text-xs text-muted-foreground">
                    This system implements full data retention that may conflict with user
                    expectations of privacy. Users are told content is destroyed, but all data
                    is permanently retained. Ensure legal compliance and proper disclosure in
                    your privacy policy.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
