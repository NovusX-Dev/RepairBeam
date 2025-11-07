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
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  AlertCircle
} from "lucide-react";
import { PERMISSION_CATEGORIES } from "@shared/permissions";

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

export default function Users() {
  const { t } = useLocalization();
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("users");
  
  // Dialog states
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<Group | null>(null);

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

  // Create invitation mutation
  const createInvitationMutation = useMutation({
    mutationFn: async (data: typeof inviteForm) => {
      return apiRequest("POST", "/api/invitations", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: t("invitation_sent", "Invitation Sent"),
        description: t("invitation_sent_desc", "User invitation has been created successfully."),
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
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="users" data-testid="tab-users">
            <UsersIcon className="w-4 h-4 mr-2" />
            {t("users", "Users")}
          </TabsTrigger>
          <TabsTrigger value="groups" data-testid="tab-groups">
            <Shield className="w-4 h-4 mr-2" />
            {t("groups", "Groups")}
          </TabsTrigger>
        </TabsList>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
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
                  <Button
                    onClick={handleInviteUser}
                    disabled={!inviteForm.email || createInvitationMutation.isPending}
                    data-testid="button-send-invite"
                  >
                    {createInvitationMutation.isPending ? t("sending", "Sending...") : t("send_invitation", "Send Invitation")}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                          {user.id !== currentUser?.id && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleToggleUserStatus(user.id, user.status)}
                              data-testid={`button-toggle-status-${user.id}`}
                            >
                              {user.status === "active" ? t("suspend", "Suspend") : t("activate", "Activate")}
                            </Button>
                          )}
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
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancelInvitation(invitation.id)}
                            data-testid={`button-cancel-invitation-${invitation.id}`}
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            {t("cancel", "Cancel")}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Groups Tab */}
        <TabsContent value="groups" className="space-y-4">
          <div className="flex justify-end">
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
                </DialogFooter>
              </DialogContent>
            </Dialog>
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
                          {!group.isSystemGroup && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleEditGroup(group)}
                                data-testid={`button-edit-group-${group.id}`}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleDeleteGroup(group.id)}
                                data-testid={`button-delete-group-${group.id}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </>
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
      </Tabs>
    </div>
  );
}
