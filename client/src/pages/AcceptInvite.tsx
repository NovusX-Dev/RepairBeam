import { useState, useEffect } from "react";
import { useLocation, useRoute } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocalization } from "@/contexts/LocalizationContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Mail, 
  Users, 
  Shield,
  Loader2
} from "lucide-react";

interface Invitation {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  telegram: string | null;
  status: string;
  groupIds: string[];
  expiresAt: Date;
  createdAt: Date;
  tenantId: string;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
}

export default function AcceptInvite() {
  const [, params] = useRoute("/accept-invite/:token");
  const token = params?.token;
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { t } = useLocalization();
  const { toast } = useToast();
  const [acceptanceStatus, setAcceptanceStatus] = useState<'pending' | 'success' | 'error'>('pending');

  // Fetch invitation details
  const { data: invitation, isLoading: invitationLoading, error: invitationError } = useQuery<Invitation>({
    queryKey: ["/api/invitations/token", token],
    enabled: !!token,
    retry: false,
  });

  // Fetch groups to display names
  const { data: groups = [] } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
    enabled: false, // We'll fetch this only if needed
  });

  // Accept invitation mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/invitations/accept/${token}`);
    },
    onSuccess: () => {
      setAcceptanceStatus('success');
      toast({
        title: t("invitation_accepted", "Invitation Accepted"),
        description: t("invitation_accepted_desc", "Welcome to your new organization!"),
      });
      // Redirect to home after a short delay
      setTimeout(() => {
        navigate("/");
        window.location.reload(); // Reload to update user context
      }, 2000);
    },
    onError: (error: any) => {
      setAcceptanceStatus('error');
      toast({
        title: t("error", "Error"),
        description: error.message || t("invitation_accept_failed", "Failed to accept invitation"),
        variant: "destructive",
      });
    },
  });

  const handleAccept = () => {
    if (!user) {
      toast({
        title: t("authentication_required", "Authentication Required"),
        description: t("please_login_first", "Please log in to accept this invitation"),
        variant: "destructive",
      });
      return;
    }
    acceptMutation.mutate();
  };

  // Loading state
  if (authLoading || invitationLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-slate-900/50 border-cyan-500/20">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
              <p className="text-slate-400">{t("loading", "Loading")}...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error states
  if (!token || invitationError || !invitation) {
    const errorMessage = invitationError 
      ? (invitationError as any).message 
      : t("invitation_not_found", "Invitation not found");

    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-slate-900/50 border-red-500/20">
          <CardHeader className="bg-gradient-to-r from-red-900/50 to-red-800/50 border-b border-red-500/20">
            <div className="flex items-center gap-3">
              <XCircle className="h-6 w-6 text-red-400" />
              <CardTitle className="text-white">
                {t("invitation_error", "Invitation Error")}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <p className="text-slate-300">{errorMessage}</p>
              <Button 
                onClick={() => navigate("/")} 
                className="w-full bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                data-testid="button-go-home"
              >
                {t("go_to_home", "Go to Home")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (acceptanceStatus === 'success') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-6">
        <Card className="w-full max-w-md bg-slate-900/50 border-green-500/20">
          <CardHeader className="bg-gradient-to-r from-green-900/50 to-green-800/50 border-b border-green-500/20">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 text-green-400" />
              <CardTitle className="text-white">
                {t("success", "Success")}!
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <p className="text-slate-300">
                {t("invitation_accepted_redirecting", "Invitation accepted! Redirecting you to the application...")}
              </p>
              <Loader2 className="h-8 w-8 animate-spin text-cyan-400 mx-auto" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main invitation display
  const invitedName = invitation.firstName && invitation.lastName 
    ? `${invitation.firstName} ${invitation.lastName}`
    : invitation.firstName || invitation.lastName || invitation.email;

  const isExpired = new Date() > new Date(invitation.expiresAt);
  const isAlreadyProcessed = invitation.status !== 'pending';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-950 flex items-center justify-center p-6">
      <Card className="w-full max-w-lg bg-slate-900/50 border-cyan-500/20">
        <CardHeader className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 border-b border-cyan-500/20">
          <div className="flex items-center gap-3">
            <Mail className="h-6 w-6 text-cyan-400" />
            <div>
              <CardTitle className="text-white">
                {t("team_invitation", "Team Invitation")}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {t("join_organization", "You've been invited to join an organization")}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-6">
          {/* Invitation Details */}
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-400">
                {t("invited_as", "Invited As")}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <Mail className="h-4 w-4 text-cyan-400" />
                <p className="text-white font-medium">{invitedName}</p>
              </div>
              <p className="text-sm text-slate-400 mt-1">{invitation.email}</p>
            </div>

            {invitation.groupIds && invitation.groupIds.length > 0 && (
              <div>
                <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                  <Shield className="h-4 w-4" />
                  {t("assigned_groups", "Assigned Groups")}
                </label>
                <div className="mt-2 flex flex-wrap gap-2">
                  {invitation.groupIds.map((groupId: string, index: number) => (
                    <Badge 
                      key={groupId} 
                      variant="outline" 
                      className="border-cyan-500/30 text-cyan-400 bg-cyan-500/5"
                      data-testid={`badge-group-${index}`}
                    >
                      <Users className="h-3 w-3 mr-1" />
                      {groups.find(g => g.id === groupId)?.name || `Group ${index + 1}`}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="text-sm font-medium text-slate-400">
                {t("expires", "Expires")}
              </label>
              <p className="text-slate-300 mt-1">
                {new Date(invitation.expiresAt).toLocaleDateString()} {new Date(invitation.expiresAt).toLocaleTimeString()}
              </p>
            </div>
          </div>

          {/* Status Messages */}
          {isExpired && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-400 mt-0.5" />
                <div>
                  <p className="font-medium text-red-400">
                    {t("invitation_expired", "Invitation Expired")}
                  </p>
                  <p className="text-sm text-red-300 mt-1">
                    {t("invitation_expired_desc", "This invitation has expired. Please contact the organization administrator for a new invitation.")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isAlreadyProcessed && !isExpired && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="font-medium text-yellow-400">
                    {t("invitation_already_processed", "Invitation Already Processed")}
                  </p>
                  <p className="text-sm text-yellow-300 mt-1">
                    {t("invitation_already_processed_desc", "This invitation has already been accepted or cancelled.")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {!user && !isExpired && !isAlreadyProcessed && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-400">
                    {t("authentication_required", "Authentication Required")}
                  </p>
                  <p className="text-sm text-blue-300 mt-1">
                    {t("login_to_accept", "Please log in with your invited email address to accept this invitation.")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-slate-700">
            <Button
              variant="outline"
              onClick={() => navigate("/")}
              className="flex-1 border-slate-700"
              data-testid="button-cancel"
            >
              {t("cancel", "Cancel")}
            </Button>
            {!isExpired && !isAlreadyProcessed && (
              <Button
                onClick={handleAccept}
                disabled={!user || acceptMutation.isPending}
                className="flex-1 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600"
                data-testid="button-accept-invitation"
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t("accepting", "Accepting")}...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    {t("accept_invitation", "Accept Invitation")}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
