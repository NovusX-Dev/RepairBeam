import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocalization } from "@/contexts/LocalizationContext";
import { useAuth } from "@/hooks/useAuth";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DateRangePicker } from "@/components/search-filter/DateRangePicker";
import { 
  UserPlus, 
  Users as UsersIcon, 
  Shield, 
  Edit, 
  Trash2, 
  Mail, 
  Phone, 
  UserCog,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  FileText,
  Eye,
  KeyRound,
  Copy,
  Check
} from "lucide-react";
import { format } from "date-fns";
import { PermissionGate } from "@/components/PermissionGate";
import { usePermissions } from "@/contexts/PermissionContext";
import { PERMISSIONS, PERMISSION_CATEGORIES } from "@shared/permissions";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  telegram: string | null;
  role: string;
  status: string;
  tenantId: string | null;
}

interface Group {
  id: string;
  name: string;
  description: string | null;
  permissions: string[];
  isDefault: boolean;
  isSystemGroup: boolean;
  tenantId: string;
}

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
}

interface UserGroup {
  id: string;
  userId: string;
  groupId: string;
  tenantId: string;
  createdAt: Date;
}

interface AuditLog {
  id: string;
  tenantId: string;
  userId: string | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: any;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
  user?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string | null;
  };
}

export default function Users() {
  const { t } = useLocalization();
  const { user: currentUser } = useAuth();
  const { hasPermission } = usePermissions();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("users");
  
  // Dialog states
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);
  const [isManageUserGroupsDialogOpen, setIsManageUserGroupsDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isBulkInviteDialogOpen, setIsBulkInviteDialogOpen] = useState(false);
  const [selectedLogDetails, setSelectedLogDetails] = useState<AuditLog | null>(null);
  const [isLogDetailsDialogOpen, setIsLogDetailsDialogOpen] = useState(false);
  const [temporaryPassword, setTemporaryPassword] = useState<string | null>(null);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordCopied, setPasswordCopied] = useState(false);

  // Activity tab filters
  const [activitySearchTerm, setActivitySearchTerm] = useState("");
  const [selectedActivityAction, setSelectedActivityAction] = useState<string>("all");
  const [activityDateRange, setActivityDateRange] = useState<{ from: Date | undefined; to: Date | undefined }>({
    from: undefined,
    to: undefined,
  });

  // Form states
  const [inviteForm, setInviteForm] = useState({
    email: "",
    firstName: "",
    lastName: "",
    phone: "",
    telegram: "",
    groupIds: [] as string[],
  });

  const [groupForm, setGroupForm] = useState({
    name: "",
    description: "",
    permissions: [] as string[],
    isDefault: false,
  });

  const [bulkInviteForm, setBulkInviteForm] = useState({
    emailsText: "",
    groupIds: [] as string[],
  });

  const [bulkInviteResults, setBulkInviteResults] = useState<{
    email: string;
    status: 'pending' | 'success' | 'error';
    message?: string;
  }[]>([]);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Fetch users
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: activeTab === "users",
  });

  // Fetch groups
  const { data: groups = [], isLoading: groupsLoading } = useQuery<Group[]>({
    queryKey: ["/api/groups"],
  });

  // Fetch invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/invitations"],
    enabled: activeTab === "users",
  });

  // Fetch user groups for selected user
  const { data: selectedUserGroups = [], isLoading: userGroupsLoading } = useQuery<UserGroup[]>({
    queryKey: ["/api/users", selectedUser?.id, "groups"],
    enabled: !!selectedUser && isManageUserGroupsDialogOpen,
  });

  // Fetch audit logs for Activity tab
  const buildActivityQueryParams = () => {
    const params = new URLSearchParams();
    params.append("resource", "user");
    if (selectedActivityAction !== "all") params.append("action", selectedActivityAction);
    if (activityDateRange.from) params.append("startDate", activityDateRange.from.toISOString());
    if (activityDateRange.to) params.append("endDate", activityDateRange.to.toISOString());
    return params.toString();
  };

  const { data: activityLogsData, isLoading: activityLogsLoading } = useQuery<{
    logs: AuditLog[];
    total: number;
  }>({
    queryKey: ["/api/audit-logs", "user", selectedActivityAction, activityDateRange.from, activityDateRange.to],
    enabled: activeTab === "activity" && hasPermission(PERMISSIONS.AUDIT_LOGS_READ),
  });

  // Create invitation mutation
  const createInvitationMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      return apiRequest("POST", "/api/invitations", data);
    },
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      
      if (response.temporaryPassword) {
        setTemporaryPassword(response.temporaryPassword);
        setIsPasswordDialogOpen(true);
      }
      
      toast({
        title: t("user_created", "User Created"),
        description: t("user_created_desc", "User has been created successfully with a temporary password."),
      });
      setIsInviteDialogOpen(false);
      resetInviteForm();
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("invitation_failed", "Failed to create invitation"),
        variant: "destructive",
      });
    },
  });

  // Create group mutation
  const createGroupMutation = useMutation({
    mutationFn: async (data: typeof groupForm) => {
      return apiRequest("POST", "/api/groups", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: t("group_created", "Group Created"),
        description: t("group_created_desc", "Permission group has been created successfully."),
      });
      setIsGroupDialogOpen(false);
      resetGroupForm();
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("group_creation_failed", "Failed to create group"),
        variant: "destructive",
      });
    },
  });

  // Update group mutation
  const updateGroupMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof groupForm }) => {
      return apiRequest("PUT", `/api/groups/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: t("group_updated", "Group Updated"),
        description: t("group_updated_desc", "Permission group has been updated successfully."),
      });
      setIsGroupDialogOpen(false);
      setEditingGroup(null);
      resetGroupForm();
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("group_update_failed", "Failed to update group"),
        variant: "destructive",
      });
    },
  });

  // Delete group mutation
  const deleteGroupMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/groups/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/groups"] });
      toast({
        title: t("group_deleted", "Group Deleted"),
        description: t("group_deleted_desc", "Permission group has been deleted successfully."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("group_deletion_failed", "Failed to delete group"),
        variant: "destructive",
      });
    },
  });

  // Delete invitation mutation
  const deleteInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/invitations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: t("invitation_cancelled", "Invitation Cancelled"),
        description: t("invitation_cancelled_desc", "User invitation has been cancelled."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("invitation_cancellation_failed", "Failed to cancel invitation"),
        variant: "destructive",
      });
    },
  });

  // Resend invitation mutation
  const resendInvitationMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/invitations/${id}/resend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: t("invitation_resent", "Invitation Resent"),
        description: t("invitation_resent_desc", "Invitation has been resent successfully."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("invitation_resend_failed", "Failed to resend invitation"),
        variant: "destructive",
      });
    },
  });

  // Update user status mutation
  const updateUserStatusMutation = useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      return apiRequest("PATCH", `/api/users/${userId}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t("user_updated", "User Updated"),
        description: t("user_status_updated_desc", "User status has been updated successfully."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("user_update_failed", "Failed to update user"),
        variant: "destructive",
      });
    },
  });

  // Reset user password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("POST", `/api/users/${userId}/reset-password`);
    },
    onSuccess: (response: any) => {
      if (response.temporaryPassword) {
        setTemporaryPassword(response.temporaryPassword);
        setIsPasswordDialogOpen(true);
      }
      toast({
        title: t("password_reset", "Password Reset"),
        description: t("password_reset_desc", "User password has been reset successfully."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("password_reset_failed", "Failed to reset password"),
        variant: "destructive",
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: t("user_deleted", "User Deleted"),
        description: t("user_deleted_desc", "User has been deleted successfully."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("user_deletion_failed", "Failed to delete user"),
        variant: "destructive",
      });
    },
  });

  // Add user to group mutation
  const addUserToGroupMutation = useMutation({
    mutationFn: async ({ userId, groupId }: { userId: string; groupId: string }) => {
      return apiRequest("POST", `/api/users/${userId}/groups`, { groupId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me/permissions"] });
      toast({
        title: t("user_group_added", "User Added to Group"),
        description: t("user_group_added_desc", "User has been added to the group successfully."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("user_group_add_failed", "Failed to add user to group"),
        variant: "destructive",
      });
    },
  });

  // Remove user from group mutation
  const removeUserFromGroupMutation = useMutation({
    mutationFn: async ({ userId, groupId }: { userId: string; groupId: string }) => {
      return apiRequest("DELETE", `/api/users/${userId}/groups/${groupId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users", selectedUser?.id, "groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me/permissions"] });
      toast({
        title: t("user_group_removed", "User Removed from Group"),
        description: t("user_group_removed_desc", "User has been removed from the group successfully."),
      });
    },
    onError: (error: any) => {
      toast({
        title: t("error", "Error"),
        description: error.message || t("user_group_remove_failed", "Failed to remove user from group"),
        variant: "destructive",
      });
    },
  });

  const resetInviteForm = () => {
    setInviteForm({
      email: "",
      firstName: "",
      lastName: "",
      phone: "",
      telegram: "",
      groupIds: [],
    });
  };

  const resetGroupForm = () => {
    setGroupForm({
      name: "",
      description: "",
      permissions: [],
      isDefault: false,
    });
  };

  const handleInviteUser = () => {
    createInvitationMutation.mutate(inviteForm);
  };

  const handleCreateGroup = () => {
    if (editingGroup) {
      updateGroupMutation.mutate({ id: editingGroup.id, data: groupForm });
    } else {
      createGroupMutation.mutate(groupForm);
    }
  };

  const handleEditGroup = (group: Group) => {
    setEditingGroup(group);
    setGroupForm({
      name: group.name,
      description: group.description || "",
      permissions: group.permissions,
      isDefault: group.isDefault,
    });
    setIsGroupDialogOpen(true);
  };

  const handleDeleteGroup = (id: string) => {
    if (confirm(t("confirm_delete_group", "Are you sure you want to delete this group?"))) {
      deleteGroupMutation.mutate(id);
    }
  };

  const handleCancelInvitation = (id: string) => {
    if (confirm(t("confirm_cancel_invitation", "Are you sure you want to cancel this invitation?"))) {
      deleteInvitationMutation.mutate(id);
    }
  };

  const handleResendInvitation = (id: string) => {
    resendInvitationMutation.mutate(id);
  };

  const handleToggleUserStatus = (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "suspended" : "active";
    updateUserStatusMutation.mutate({ userId, status: newStatus });
  };

  const togglePermission = (permission: string) => {
    setGroupForm(prev => ({
      ...prev,
      permissions: prev.permissions.includes(permission)
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission]
    }));
  };

  const toggleGroupForInvite = (groupId: string) => {
    setInviteForm(prev => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter(id => id !== groupId)
        : [...prev.groupIds, groupId]
    }));
  };

  const handleManageUserGroups = (user: User) => {
    setSelectedUser(user);
    setIsManageUserGroupsDialogOpen(true);
  };

  const handleToggleUserGroup = (groupId: string) => {
    if (!selectedUser) return;
    
    const isInGroup = selectedUserGroups.some(ug => ug.groupId === groupId);
    
    if (isInGroup) {
      removeUserFromGroupMutation.mutate({ userId: selectedUser.id, groupId });
    } else {
      addUserToGroupMutation.mutate({ userId: selectedUser.id, groupId });
    }
  };

  const getUserGroupNames = (userId: string) => {
    return [];
  };

  const toggleGroupForBulkInvite = (groupId: string) => {
    setBulkInviteForm(prev => ({
      ...prev,
      groupIds: prev.groupIds.includes(groupId)
        ? prev.groupIds.filter(id => id !== groupId)
        : [...prev.groupIds, groupId]
    }));
  };

  const parseEmailsFromText = (text: string) => {
    const lines = text.split('\n').filter(line => line.trim());
    const results: { email: string; firstName?: string; lastName?: string }[] = [];
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      // Try to parse email and name (formats: "email" or "email, name" or "email\tname")
      const parts = trimmed.split(/[,\t]/).map(p => p.trim());
      const email = parts[0];
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        continue; // Skip invalid emails
      }
      
      let firstName = "";
      let lastName = "";
      
      if (parts.length > 1) {
        const nameParts = parts[1].split(' ').filter(p => p);
        firstName = nameParts[0] || "";
        lastName = nameParts.slice(1).join(' ') || "";
      }
      
      results.push({ email, firstName, lastName });
    }
    
    return results;
  };

  const handleBulkInvite = async () => {
    const emails = parseEmailsFromText(bulkInviteForm.emailsText);
    
    if (emails.length === 0) {
      toast({
        title: t("error", "Error"),
        description: t("no_valid_emails", "No valid email addresses found"),
        variant: "destructive",
      });
      return;
    }

    // Initialize results
    setBulkInviteResults(emails.map(e => ({ email: e.email, status: 'pending' as const })));
    setIsBulkProcessing(true);

    // Process each invitation
    for (let i = 0; i < emails.length; i++) {
      const { email, firstName, lastName } = emails[i];
      
      try {
        await apiRequest("POST", "/api/invitations", {
          email,
          firstName: firstName || "",
          lastName: lastName || "",
          phone: "",
          telegram: "",
          groupIds: bulkInviteForm.groupIds,
        });
        
        setBulkInviteResults(prev => 
          prev.map((r, idx) => 
            idx === i ? { ...r, status: 'success' as const, message: t("sent", "Sent") } : r
          )
        );
      } catch (error: any) {
        setBulkInviteResults(prev => 
          prev.map((r, idx) => 
            idx === i ? { ...r, status: 'error' as const, message: error.message || t("failed", "Failed") } : r
          )
        );
      }
    }

    setIsBulkProcessing(false);
    queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
    
    const successCount = bulkInviteResults.filter(r => r.status === 'success').length;
    const errorCount = bulkInviteResults.filter(r => r.status === 'error').length;
    
    toast({
      title: t("bulk_invite_complete", "Bulk Invite Complete"),
      description: t("bulk_invite_summary", `Sent: ${successCount}, Failed: ${errorCount}`),
    });
  };

  const resetBulkInviteForm = () => {
    setBulkInviteForm({
      emailsText: "",
      groupIds: [],
    });
    setBulkInviteResults([]);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            {t("user_management", "User Management")}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t("user_management_desc", "Manage users, permissions, and access control")}
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className={`grid w-full max-w-md ${hasPermission(PERMISSIONS.AUDIT_LOGS_READ) ? 'grid-cols-3' : 'grid-cols-2'}`}>
          <TabsTrigger value="users" data-testid="tab-users">
            <UsersIcon className="w-4 h-4 mr-2" />
            {t("users", "Users")}
          </TabsTrigger>
          <TabsTrigger value="groups" data-testid="tab-groups">
            <Shield className="w-4 h-4 mr-2" />
            {t("groups", "Groups")}
          </TabsTrigger>
          {hasPermission(PERMISSIONS.AUDIT_LOGS_READ) && (
            <TabsTrigger value="activity" data-testid="tab-activity">
              <FileText className="w-4 h-4 mr-2" />
              {t("activity_logs", "Activity")}
            </TabsTrigger>
          )}
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end gap-2">
            <PermissionGate permission={PERMISSIONS.USERS_INVITE}>
              <Button 
                variant="outline"
                onClick={() => setIsBulkInviteDialogOpen(true)}
                data-testid="button-bulk-invite"
              >
                <Mail className="w-4 h-4 mr-2" />
                {t("bulk_invite", "Bulk Invite")}
              </Button>
            </PermissionGate>
            <PermissionGate permission={PERMISSIONS.USERS_INVITE}>
              <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
                <DialogTrigger asChild>
                  <Button data-testid="button-invite-user">
                    <UserPlus className="w-4 h-4 mr-2" />
                    {t("invite_user", "Invite User")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle>{t("invite_new_user", "Invite New User")}</DialogTitle>
                    <DialogDescription>
                      {t("invite_user_desc", "Send an invitation to a new team member")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">{t("email", "Email")} *</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@example.com"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                      data-testid="input-invite-email"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">{t("first_name", "First Name")}</Label>
                      <Input
                        id="firstName"
                        value={inviteForm.firstName}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, firstName: e.target.value }))}
                        data-testid="input-invite-firstname"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">{t("last_name", "Last Name")}</Label>
                      <Input
                        id="lastName"
                        value={inviteForm.lastName}
                        onChange={(e) => setInviteForm(prev => ({ ...prev, lastName: e.target.value }))}
                        data-testid="input-invite-lastname"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="phone">{t("phone", "Phone")}</Label>
                    <Input
                      id="phone"
                      value={inviteForm.phone}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, phone: e.target.value }))}
                      data-testid="input-invite-phone"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telegram">{t("telegram", "Telegram")}</Label>
                    <Input
                      id="telegram"
                      value={inviteForm.telegram}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, telegram: e.target.value }))}
                      data-testid="input-invite-telegram"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t("assign_groups", "Assign to Groups")}</Label>
                    <ScrollArea className="h-32 border rounded-md p-3">
                      {groups.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{t("no_groups_available", "No groups available. Create a group first.")}</p>
                      ) : (
                        <div className="space-y-2">
                          {groups.map(group => (
                            <div key={group.id} className="flex items-center space-x-2">
                              <Checkbox
                                id={`invite-group-${group.id}`}
                                checked={inviteForm.groupIds.includes(group.id)}
                                onCheckedChange={() => toggleGroupForInvite(group.id)}
                                data-testid={`checkbox-invite-group-${group.id}`}
                              />
                              <label
                                htmlFor={`invite-group-${group.id}`}
                                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                              >
                                {group.name}
                              </label>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsInviteDialogOpen(false)}
                      data-testid="button-cancel-invite"
                    >
                      {t("cancel", "Cancel")}
                    </Button>
                    <PermissionGate permission={PERMISSIONS.USERS_INVITE}>
                      <Button
                        onClick={handleInviteUser}
                        disabled={!inviteForm.email || createInvitationMutation.isPending}
                        data-testid="button-send-invite"
                      >
                        {createInvitationMutation.isPending ? t("sending", "Sending...") : t("send_invitation", "Send Invitation")}
                      </Button>
                    </PermissionGate>
                  </DialogFooter>
                </DialogContent>
            </Dialog>
            </PermissionGate>
          </div>

          {/* Active Users Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t("active_users", "Active Users")}</CardTitle>
              <CardDescription>{t("active_users_desc", "Manage user accounts and permissions")}</CardDescription>
            </CardHeader>
            <CardContent>
              {usersLoading ? (
                <p className="text-center text-muted-foreground py-8">{t("loading", "Loading...")}</p>
              ) : users.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("no_users_found", "No users found")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name", "Name")}</TableHead>
                      <TableHead>{t("email", "Email")}</TableHead>
                      <TableHead>{t("role", "Role")}</TableHead>
                      <TableHead>{t("status", "Status")}</TableHead>
                      <TableHead className="text-right">{t("actions", "Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map(user => (
                      <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                        <TableCell className="font-medium">
                          {user.firstName || user.lastName
                            ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                            : t("unnamed_user", "Unnamed User")}
                        </TableCell>
                        <TableCell>{user.email || t("no_email", "No email")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{user.role}</Badge>
                        </TableCell>
                        <TableCell>
                          {user.status === "active" ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {t("active", "Active")}
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="w-3 h-3 mr-1" />
                              {t("suspended", "Suspended")}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <PermissionGate permission={PERMISSIONS.USERS_MANAGE_GROUPS}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleManageUserGroups(user)}
                                data-testid={`button-manage-groups-${user.id}`}
                              >
                                <Shield className="w-3 h-3 mr-1" />
                                {t("manage_groups", "Manage Groups")}
                              </Button>
                            </PermissionGate>
                            {user.id !== currentUser?.id && (
                              <>
                                <PermissionGate permission={PERMISSIONS.USERS_UPDATE}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => resetPasswordMutation.mutate(user.id)}
                                    disabled={resetPasswordMutation.isPending}
                                    data-testid={`button-reset-password-${user.id}`}
                                  >
                                    <KeyRound className="w-3 h-3 mr-1" />
                                    {t("reset_password", "Reset Password")}
                                  </Button>
                                </PermissionGate>
                                <PermissionGate permission={PERMISSIONS.USERS_UPDATE}>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleToggleUserStatus(user.id, user.status)}
                                    data-testid={`button-toggle-status-${user.id}`}
                                  >
                                    {user.status === "active" ? t("suspend", "Suspend") : t("activate", "Activate")}
                                  </Button>
                                </PermissionGate>
                                <PermissionGate permission={PERMISSIONS.USERS_DELETE}>
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        data-testid={`button-delete-user-${user.id}`}
                                      >
                                        <Trash2 className="w-3 h-3 mr-1" />
                                        {t("delete_user", "Delete")}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>{t("delete_user_confirm", "Delete User?")}</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          {t("delete_user_desc", "This action cannot be undone. This will permanently delete the user account and remove all associated data.")}
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>{t("cancel", "Cancel")}</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => deleteUserMutation.mutate(user.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          {t("delete_user", "Delete User")}
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </PermissionGate>
                              </>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pending Invitations Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t("pending_invitations", "Pending Invitations")}</CardTitle>
              <CardDescription>{t("pending_invitations_desc", "Invitations waiting to be accepted")}</CardDescription>
            </CardHeader>
            <CardContent>
              {invitationsLoading ? (
                <p className="text-center text-muted-foreground py-8">{t("loading", "Loading...")}</p>
              ) : invitations.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("no_invitations_found", "No pending invitations")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("email", "Email")}</TableHead>
                      <TableHead>{t("name", "Name")}</TableHead>
                      <TableHead>{t("status", "Status")}</TableHead>
                      <TableHead>{t("expires", "Expires")}</TableHead>
                      <TableHead className="text-right">{t("actions", "Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invitations.map(invitation => (
                      <TableRow key={invitation.id} data-testid={`row-invitation-${invitation.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Mail className="w-4 h-4 mr-2 text-muted-foreground" />
                            {invitation.email}
                          </div>
                        </TableCell>
                        <TableCell>
                          {invitation.firstName || invitation.lastName
                            ? `${invitation.firstName || ''} ${invitation.lastName || ''}`.trim()
                            : t("not_specified", "Not specified")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">
                            <AlertCircle className="w-3 h-3 mr-1" />
                            {invitation.status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {new Date(invitation.expiresAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <PermissionGate permission={PERMISSIONS.USERS_INVITE}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleResendInvitation(invitation.id)}
                                disabled={resendInvitationMutation.isPending}
                                data-testid={`button-resend-invitation-${invitation.id}`}
                              >
                                <RefreshCw className="w-4 h-4 mr-1" />
                                {t("resend", "Resend")}
                              </Button>
                            </PermissionGate>
                            <PermissionGate permission={PERMISSIONS.USERS_INVITE}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleCancelInvitation(invitation.id)}
                                data-testid={`button-cancel-invitation-${invitation.id}`}
                              >
                                <Trash2 className="w-4 h-4 mr-1" />
                                {t("cancel", "Cancel")}
                              </Button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Manage User Groups Dialog */}
          <Dialog 
            open={isManageUserGroupsDialogOpen} 
            onOpenChange={(open) => {
              setIsManageUserGroupsDialogOpen(open);
              if (!open) setSelectedUser(null);
            }}
          >
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{t("manage_user_groups", "Manage User Groups")}</DialogTitle>
                <DialogDescription>
                  {selectedUser && (
                    <>
                      {t("manage_groups_for", "Manage group memberships for")}{" "}
                      <strong>
                        {selectedUser.firstName || selectedUser.lastName
                          ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim()
                          : selectedUser.email || t("unnamed_user", "Unnamed User")}
                      </strong>
                    </>
                  )}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {userGroupsLoading ? (
                  <p className="text-center text-muted-foreground py-8">{t("loading", "Loading...")}</p>
                ) : groups.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">{t("no_groups_available", "No groups available. Create a group first.")}</p>
                ) : (
                  <ScrollArea className="h-96">
                    <div className="space-y-2 pr-4">
                      {groups.map(group => {
                        const isInGroup = selectedUserGroups.some(ug => ug.groupId === group.id);
                        return (
                          <div 
                            key={group.id} 
                            className="flex items-start justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                          >
                            <div className="flex items-start space-x-3 flex-1">
                              <PermissionGate permission={PERMISSIONS.USERS_MANAGE_GROUPS}>
                                <Checkbox
                                  id={`user-group-${group.id}`}
                                  checked={isInGroup}
                                  onCheckedChange={() => handleToggleUserGroup(group.id)}
                                  disabled={addUserToGroupMutation.isPending || removeUserFromGroupMutation.isPending}
                                  data-testid={`checkbox-user-group-${group.id}`}
                                />
                              </PermissionGate>
                              <div className="flex-1">
                                <label
                                  htmlFor={`user-group-${group.id}`}
                                  className="font-medium leading-none cursor-pointer"
                                >
                                  {group.name}
                                  {group.isDefault && (
                                    <Badge variant="secondary" className="ml-2">
                                      {t("default", "Default")}
                                    </Badge>
                                  )}
                                  {group.isSystemGroup && (
                                    <Badge variant="outline" className="ml-2">
                                      {t("system", "System")}
                                    </Badge>
                                  )}
                                </label>
                                {group.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {group.description}
                                  </p>
                                )}
                                <p className="text-xs text-muted-foreground mt-1">
                                  {group.permissions.length} {t("permissions", "permissions")}
                                </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsManageUserGroupsDialogOpen(false)}
                  data-testid="button-close-manage-groups"
                >
                  {t("close", "Close")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          <div className="flex justify-end">
            <PermissionGate permission={PERMISSIONS.GROUPS_CREATE}>
              <Dialog 
                open={isGroupDialogOpen} 
                onOpenChange={(open) => {
                  setIsGroupDialogOpen(open);
                  if (!open) {
                    setEditingGroup(null);
                    resetGroupForm();
                  }
                }}
              >
                <DialogTrigger asChild>
                  <Button data-testid="button-create-group">
                    <Shield className="w-4 h-4 mr-2" />
                    {t("create_group", "Create Group")}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>
                      {editingGroup ? t("edit_group", "Edit Group") : t("create_new_group", "Create New Group")}
                    </DialogTitle>
                    <DialogDescription>
                      {t("group_desc", "Define a permission group to control access to features")}
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="groupName">{t("group_name", "Group Name")} *</Label>
                    <Input
                      id="groupName"
                      placeholder={t("group_name_placeholder", "e.g., Technicians, Managers")}
                      value={groupForm.name}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, name: e.target.value }))}
                      data-testid="input-group-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="groupDescription">{t("description", "Description")}</Label>
                    <Textarea
                      id="groupDescription"
                      placeholder={t("group_description_placeholder", "Describe what this group can access")}
                      value={groupForm.description}
                      onChange={(e) => setGroupForm(prev => ({ ...prev, description: e.target.value }))}
                      rows={3}
                      data-testid="input-group-description"
                    />
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="isDefault"
                      checked={groupForm.isDefault}
                      onCheckedChange={(checked) => setGroupForm(prev => ({ ...prev, isDefault: checked }))}
                      data-testid="switch-group-default"
                    />
                    <Label htmlFor="isDefault" className="cursor-pointer">
                      {t("default_group", "Assign to new users by default")}
                    </Label>
                  </div>
                  <Separator />
                  <div className="space-y-3">
                    <Label>{t("permissions", "Permissions")}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t("permissions_desc", "Select which actions this group can perform")}
                    </p>
                    <ScrollArea className="h-96 border rounded-md p-4">
                      <div className="space-y-6">
                        {Object.entries(PERMISSION_CATEGORIES).map(([category, info]) => (
                          <div key={category} className="space-y-3">
                            <div className="flex items-center space-x-2">
                              <Shield className="w-4 h-4 text-primary" />
                              <h3 className="font-semibold">{info.label}</h3>
                            </div>
                            <p className="text-sm text-muted-foreground ml-6">{info.description}</p>
                            <div className="ml-6 grid grid-cols-2 gap-2">
                              {info.permissions.map(permission => (
                                <div key={permission} className="flex items-center space-x-2">
                                  <Checkbox
                                    id={`permission-${permission}`}
                                    checked={groupForm.permissions.includes(permission)}
                                    onCheckedChange={() => togglePermission(permission)}
                                    data-testid={`checkbox-permission-${permission}`}
                                  />
                                  <label
                                    htmlFor={`permission-${permission}`}
                                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                  >
                                    {permission.split(':')[1]}
                                  </label>
                                </div>
                              ))}
                            </div>
                            <Separator className="mt-3" />
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setIsGroupDialogOpen(false);
                        setEditingGroup(null);
                        resetGroupForm();
                      }}
                      data-testid="button-cancel-group"
                    >
                      {t("cancel", "Cancel")}
                    </Button>
                    <PermissionGate permission={editingGroup ? PERMISSIONS.GROUPS_UPDATE : PERMISSIONS.GROUPS_CREATE}>
                      <Button
                        onClick={handleCreateGroup}
                        disabled={!groupForm.name || groupForm.permissions.length === 0 || createGroupMutation.isPending || updateGroupMutation.isPending}
                        data-testid="button-save-group"
                      >
                        {createGroupMutation.isPending || updateGroupMutation.isPending
                          ? t("saving", "Saving...")
                          : editingGroup
                          ? t("update_group", "Update Group")
                          : t("create_group", "Create Group")}
                      </Button>
                    </PermissionGate>
                  </DialogFooter>
                </DialogContent>
            </Dialog>
            </PermissionGate>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{t("permission_groups", "Permission Groups")}</CardTitle>
              <CardDescription>{t("permission_groups_desc", "Manage access control groups")}</CardDescription>
            </CardHeader>
            <CardContent>
              {groupsLoading ? (
                <p className="text-center text-muted-foreground py-8">{t("loading", "Loading...")}</p>
              ) : groups.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">{t("no_groups_found", "No groups found. Create your first group to get started.")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("group_name", "Group Name")}</TableHead>
                      <TableHead>{t("description", "Description")}</TableHead>
                      <TableHead>{t("permissions_count", "Permissions")}</TableHead>
                      <TableHead>{t("default", "Default")}</TableHead>
                      <TableHead className="text-right">{t("actions", "Actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {groups.map(group => (
                      <TableRow key={group.id} data-testid={`row-group-${group.id}`}>
                        <TableCell className="font-medium">
                          <div className="flex items-center">
                            <Shield className="w-4 h-4 mr-2 text-primary" />
                            {group.name}
                            {group.isSystemGroup && (
                              <Badge variant="secondary" className="ml-2">System</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="max-w-md truncate">
                          {group.description || t("no_description", "No description")}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{group.permissions.length} permissions</Badge>
                        </TableCell>
                        <TableCell>
                          {group.isDefault ? (
                            <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                              <CheckCircle2 className="w-3 h-3 mr-1" />
                              {t("yes", "Yes")}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">{t("no", "No")}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right space-x-2">
                          {/* Edit button - always shown, but disabled for users without permission */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditGroup(group)}
                            disabled={!hasPermission(PERMISSIONS.GROUPS_UPDATE)}
                            data-testid={`button-edit-group-${group.id}`}
                            title={!hasPermission(PERMISSIONS.GROUPS_UPDATE) ? "You don't have permission to edit groups" : "Edit group"}
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                          
                          {/* Delete button - only for non-system groups and only with permission */}
                          {!group.isSystemGroup && (
                            <PermissionGate permission={PERMISSIONS.GROUPS_DELETE}>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteGroup(group.id)}
                                data-testid={`button-delete-group-${group.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </PermissionGate>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Activity Tab */}
        <TabsContent value="activity" className="space-y-4">
          <Card className="border-[#00FFFF]/20 bg-gradient-to-br from-[#0A1128] to-[#1a2744]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-[#00FFFF]" />
                {t("activity_logs", "Activity Logs")}
              </CardTitle>
              <CardDescription>
                {t("activity_logs_desc", "View user-related activity and audit logs")}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Filters */}
              <div className="flex flex-wrap gap-4">
                <div className="flex-1 min-w-[200px]">
                  <Label htmlFor="activity-action">{t("filter_by_action", "Filter by Action")}</Label>
                  <Select 
                    value={selectedActivityAction} 
                    onValueChange={setSelectedActivityAction}
                  >
                    <SelectTrigger id="activity-action" data-testid="select-activity-action">
                      <SelectValue placeholder={t("all_actions", "All Actions")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t("all_actions", "All Actions")}</SelectItem>
                      <SelectItem value="create">{t("create", "Create")}</SelectItem>
                      <SelectItem value="update">{t("update", "Update")}</SelectItem>
                      <SelectItem value="delete">{t("delete", "Delete")}</SelectItem>
                      <SelectItem value="login">{t("login", "Login")}</SelectItem>
                      <SelectItem value="logout">{t("logout", "Logout")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <Label>{t("filter_by_date", "Filter by Date Range")}</Label>
                  <DateRangePicker 
                    value={activityDateRange}
                    onChange={setActivityDateRange}
                  />
                </div>
              </div>

              {/* Activity Logs Table */}
              {activityLogsLoading ? (
                <p className="text-center text-muted-foreground py-8">{t("loading", "Loading...")}</p>
              ) : !activityLogsData?.logs || activityLogsData.logs.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t("no_activity_logs", "No activity logs found")}</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("timestamp", "Timestamp")}</TableHead>
                        <TableHead>{t("user", "User")}</TableHead>
                        <TableHead>{t("action", "Action")}</TableHead>
                        <TableHead>{t("resource", "Resource")}</TableHead>
                        <TableHead>{t("details", "Details")}</TableHead>
                        <TableHead className="text-right">{t("actions", "Actions")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activityLogsData.logs.map((log) => (
                        <TableRow key={log.id} data-testid={`row-activity-${log.id}`}>
                          <TableCell className="font-medium">
                            {format(new Date(log.createdAt), "MMM dd, yyyy HH:mm:ss")}
                          </TableCell>
                          <TableCell>
                            {log.user 
                              ? `${log.user.firstName || ''} ${log.user.lastName || ''}`.trim() || log.user.email || t("unknown", "Unknown")
                              : log.userId || t("system", "System")}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              className={
                                log.action === "create" ? "bg-green-500/20 text-green-400 border-green-500/30" :
                                log.action === "update" ? "bg-blue-500/20 text-blue-400 border-blue-500/30" :
                                log.action === "delete" ? "bg-red-500/20 text-red-400 border-red-500/30" :
                                log.action === "login" ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" :
                                "bg-gray-500/20 text-gray-400 border-gray-500/30"
                              }
                            >
                              {log.action}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">
                              {log.resource}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-xs truncate">
                            {log.details ? JSON.stringify(log.details).substring(0, 100) : "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedLogDetails(log);
                                setIsLogDetailsDialogOpen(true);
                              }}
                              data-testid={`button-view-log-${log.id}`}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Activity Log Details Dialog */}
      <Dialog open={isLogDetailsDialogOpen} onOpenChange={setIsLogDetailsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("activity_log_details", "Activity Log Details")}</DialogTitle>
          </DialogHeader>
          {selectedLogDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-semibold">{t("timestamp", "Timestamp")}</Label>
                  <p className="text-sm">{format(new Date(selectedLogDetails.createdAt), "PPpp")}</p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">{t("user", "User")}</Label>
                  <p className="text-sm">
                    {selectedLogDetails.user 
                      ? `${selectedLogDetails.user.firstName || ''} ${selectedLogDetails.user.lastName || ''}`.trim() || selectedLogDetails.user.email
                      : selectedLogDetails.userId || t("system", "System")}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">{t("action", "Action")}</Label>
                  <p className="text-sm">
                    <Badge>{selectedLogDetails.action}</Badge>
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-semibold">{t("resource", "Resource")}</Label>
                  <p className="text-sm">
                    <Badge variant="outline">{selectedLogDetails.resource}</Badge>
                  </p>
                </div>
                {selectedLogDetails.resourceId && (
                  <div className="col-span-2">
                    <Label className="text-sm font-semibold">{t("resource_id", "Resource ID")}</Label>
                    <p className="text-sm font-mono">{selectedLogDetails.resourceId}</p>
                  </div>
                )}
                {selectedLogDetails.ipAddress && (
                  <div>
                    <Label className="text-sm font-semibold">{t("ip_address", "IP Address")}</Label>
                    <p className="text-sm font-mono">{selectedLogDetails.ipAddress}</p>
                  </div>
                )}
              </div>
              <div>
                <Label className="text-sm font-semibold">{t("details", "Details")}</Label>
                <ScrollArea className="h-48 w-full border rounded-md p-3 mt-2 bg-slate-50 dark:bg-slate-900">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(selectedLogDetails.details, null, 2)}
                  </pre>
                </ScrollArea>
              </div>
              {selectedLogDetails.userAgent && (
                <div>
                  <Label className="text-sm font-semibold">{t("user_agent", "User Agent")}</Label>
                  <p className="text-xs text-muted-foreground mt-1">{selectedLogDetails.userAgent}</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setIsLogDetailsDialogOpen(false)} data-testid="button-close-log-details">
              {t("close", "Close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Invite Dialog */}
      <Dialog 
        open={isBulkInviteDialogOpen} 
        onOpenChange={(open) => {
          setIsBulkInviteDialogOpen(open);
          if (!open) resetBulkInviteForm();
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("bulk_invite", "Bulk Invite")}</DialogTitle>
            <DialogDescription>
              {t("bulk_invite_desc", "Invite multiple users at once. Enter one email per line, optionally with name separated by comma or tab.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bulk-emails">
                {t("email_addresses", "Email Addresses")}
              </Label>
              <Textarea
                id="bulk-emails"
                placeholder={`user1@example.com\nuser2@example.com, John Doe\nuser3@example.com\tJane Smith`}
                value={bulkInviteForm.emailsText}
                onChange={(e) => setBulkInviteForm(prev => ({ ...prev, emailsText: e.target.value }))}
                rows={8}
                className="font-mono text-sm"
                disabled={isBulkProcessing}
                data-testid="textarea-bulk-emails"
              />
              <p className="text-xs text-muted-foreground">
                {t("bulk_invite_format", "Format: email or email, Full Name (one per line)")}
              </p>
            </div>

            <div className="space-y-2">
              <Label>{t("assign_groups", "Assign to Groups")}</Label>
              <ScrollArea className="h-32 border rounded-md p-3">
                {groups.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("no_groups_available", "No groups available. Create a group first.")}</p>
                ) : (
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <div key={group.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`bulk-group-${group.id}`}
                          checked={bulkInviteForm.groupIds.includes(group.id)}
                          onCheckedChange={() => toggleGroupForBulkInvite(group.id)}
                          disabled={isBulkProcessing}
                          data-testid={`checkbox-bulk-group-${group.id}`}
                        />
                        <Label
                          htmlFor={`bulk-group-${group.id}`}
                          className="text-sm font-normal cursor-pointer flex items-center gap-2"
                        >
                          <Shield className="w-3 h-3 text-primary" />
                          {group.name}
                          {group.isDefault && (
                            <Badge variant="secondary" className="text-xs">Default</Badge>
                          )}
                        </Label>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </div>

            {/* Processing Results */}
            {bulkInviteResults.length > 0 && (
              <div className="space-y-2">
                <Label>{t("processing_status", "Processing Status")}</Label>
                <ScrollArea className="h-48 border rounded-md p-3 bg-slate-50 dark:bg-slate-900">
                  <div className="space-y-1">
                    {bulkInviteResults.map((result, index) => (
                      <div 
                        key={index} 
                        className="flex items-center justify-between text-sm p-2 rounded border"
                        data-testid={`result-${index}`}
                      >
                        <span className="font-mono truncate flex-1">{result.email}</span>
                        {result.status === 'pending' && (
                          <Badge variant="secondary" className="ml-2">
                            {t("pending", "Pending")}...
                          </Badge>
                        )}
                        {result.status === 'success' && (
                          <Badge className="ml-2 bg-green-500/10 text-green-500 border-green-500/20">
                            <CheckCircle2 className="w-3 h-3 mr-1" />
                            {result.message || t("success", "Success")}
                          </Badge>
                        )}
                        {result.status === 'error' && (
                          <Badge variant="destructive" className="ml-2">
                            <XCircle className="w-3 h-3 mr-1" />
                            {result.message || t("error", "Error")}
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsBulkInviteDialogOpen(false)}
              disabled={isBulkProcessing}
              data-testid="button-cancel-bulk-invite"
            >
              {t("cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleBulkInvite}
              disabled={isBulkProcessing || !bulkInviteForm.emailsText.trim()}
              data-testid="button-send-bulk-invites"
            >
              {isBulkProcessing ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  {t("processing", "Processing")}...
                </>
              ) : (
                <>
                  <Mail className="w-4 h-4 mr-2" />
                  {t("send_invitations", "Send Invitations")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Temporary Password Display Dialog */}
      <Dialog 
        open={isPasswordDialogOpen} 
        onOpenChange={(open) => {
          setIsPasswordDialogOpen(open);
          if (!open) {
            setTemporaryPassword(null);
            setPasswordCopied(false);
          }
        }}
      >
        <DialogContent data-testid="dialog-temporary-password">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="w-5 h-5 text-primary" />
              {t("temporary_password", "Temporary Password")}
            </DialogTitle>
            <DialogDescription>
              {t("temporary_password_shown_once", "This password will only be shown once. Please save it securely and share it with the user.")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="bg-muted p-4 rounded-lg border border-primary/20">
              <p className="text-xs text-muted-foreground mb-2">
                {t("password", "Password")}:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-2xl font-mono font-bold tracking-wide text-primary">
                  {temporaryPassword}
                </code>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (temporaryPassword) {
                      navigator.clipboard.writeText(temporaryPassword);
                      setPasswordCopied(true);
                      setTimeout(() => setPasswordCopied(false), 2000);
                    }
                  }}
                  data-testid="button-copy-password"
                >
                  {passwordCopied ? (
                    <>
                      <Check className="w-4 h-4 mr-1" />
                      {t("copied", "Copied!")}
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-1" />
                      {t("copy", "Copy")}
                    </>
                  )}
                </Button>
              </div>
            </div>

            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <div className="text-sm text-yellow-600 dark:text-yellow-500">
                  <p className="font-medium">{t("important", "Important")}</p>
                  <p className="text-xs mt-1">
                    {t("password_will_not_be_shown_again", "This password will not be shown again. The user must change it on their first login.")}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setIsPasswordDialogOpen(false);
                setTemporaryPassword(null);
                setPasswordCopied(false);
              }}
              data-testid="button-close-password-dialog"
            >
              {t("i_have_saved_password", "I've Saved the Password")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
