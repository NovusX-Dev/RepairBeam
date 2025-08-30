import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useTenant } from "@/hooks/useTenant";
import { useLocalization } from "@/contexts/LocalizationContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Trophy,
  Star,
  Flame,
  Target,
  Zap,
  Award,
  TrendingUp,
  Gift,
  Users,
  CheckCircle,
  Clock,
  Calendar,
} from "lucide-react";

interface UserProgress {
  id: string;
  level: number;
  experience: number;
  totalActions: number;
  streakDays: number;
  lastActiveDate: string | null;
}

interface Achievement {
  id: string;
  key: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  requiredValue: number;
  experienceReward: number;
  isHidden: boolean;
}

interface UserAchievement {
  id: string;
  achievement: Achievement;
  unlockedAt: string;
}

interface Activity {
  id: string;
  activityType: string;
  experienceGained: number;
  createdAt: string;
}

export function GamificationTracker() {
  const { user } = useAuth();
  const { tenant } = useTenant();
  const { t } = useLocalization();
  const [showAchievements, setShowAchievements] = useState(false);

  // Fetch user progress
  const { data: progress } = useQuery<UserProgress>({
    queryKey: ['/api/gamification/progress', user?.id, tenant?.id],
    enabled: !!user && !!tenant,
  });

  // Fetch user achievements
  const { data: achievements = [] } = useQuery<UserAchievement[]>({
    queryKey: ['/api/gamification/achievements', user?.id, tenant?.id],
    enabled: !!user && !!tenant,
  });

  // Fetch recent activities
  const { data: activities = [] } = useQuery<Activity[]>({
    queryKey: ['/api/gamification/activities', user?.id, tenant?.id],
    enabled: !!user && !!tenant,
  });

  if (!user || !tenant || !progress) {
    return null;
  }

  const experienceToNextLevel = ((progress.level) * 100) - progress.experience;
  const progressPercentage = (progress.experience % 100);
  
  const getActivityIcon = (activityType: string) => {
    switch (activityType) {
      case 'client_created': return <Users className="w-4 h-4" />;
      case 'ticket_completed': return <CheckCircle className="w-4 h-4" />;
      case 'sale_completed': return <Target className="w-4 h-4" />;
      case 'daily_login': return <Calendar className="w-4 h-4" />;
      default: return <Star className="w-4 h-4" />;
    }
  };

  const getAchievementIcon = (icon: string) => {
    switch (icon) {
      case 'trophy': return <Trophy className="w-6 h-6" />;
      case 'star': return <Star className="w-6 h-6" />;
      case 'flame': return <Flame className="w-6 h-6" />;
      case 'target': return <Target className="w-6 h-6" />;
      case 'zap': return <Zap className="w-6 h-6" />;
      case 'award': return <Award className="w-6 h-6" />;
      case 'gift': return <Gift className="w-6 h-6" />;
      default: return <Trophy className="w-6 h-6" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'clients': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'tickets': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'sales': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300';
      case 'engagement': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const recentAchievements = achievements?.slice(0, 3) || [];

  return (
    <div className="space-y-6">
      {/* Main Progress Card */}
      <Card className="bg-gradient-to-r from-primary/10 to-secondary/10 border-primary/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/20">
                <TrendingUp className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-xl">
                  {t('gamification.level', 'Level')} {progress.level}
                </CardTitle>
                <CardDescription>
                  {t('gamification.experience_points', '{exp} XP').replace('{exp}', progress.experience.toString())}
                </CardDescription>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-primary">{progress.streakDays}</div>
              <div className="text-sm text-muted-foreground flex items-center gap-1">
                <Flame className="w-4 h-4" />
                {t('gamification.day_streak', 'day streak')}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{t('gamification.progress_to_next', 'Progress to next level')}</span>
              <span>{experienceToNextLevel} XP {t('gamification.remaining', 'remaining')}</span>
            </div>
            <Progress value={progressPercentage} className="h-3" />
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">{progress.totalActions}</div>
              <div className="text-sm text-muted-foreground">
                {t('gamification.total_actions', 'Total Actions')}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{achievements?.length || 0}</div>
              <div className="text-sm text-muted-foreground">
                {t('gamification.achievements', 'Achievements')}
              </div>
            </div>
            <div className="text-center">
              <Dialog open={showAchievements} onOpenChange={setShowAchievements}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" data-testid="button-view-achievements">
                    <Trophy className="w-4 h-4 mr-2" />
                    {t('gamification.view_all', 'View All')}
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Trophy className="w-5 h-5" />
                      {t('gamification.achievements_title', 'Your Achievements')}
                    </DialogTitle>
                    <DialogDescription>
                      {t('gamification.achievements_desc', 'Track your progress and unlock new badges')}
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    {achievements && achievements.length > 0 ? (
                      achievements.map((userAchievement: UserAchievement) => (
                        <div
                          key={userAchievement.id}
                          className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30"
                        >
                          <div className="text-yellow-500">
                            {getAchievementIcon(userAchievement.achievement.icon)}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-medium">{userAchievement.achievement.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              {userAchievement.achievement.description}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge variant="outline" className={getCategoryColor(userAchievement.achievement.category)}>
                                {userAchievement.achievement.category}
                              </Badge>
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {new Date(userAchievement.unlockedAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm font-medium text-primary">
                              +{userAchievement.achievement.experienceReward} XP
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <Trophy className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p>{t('gamification.no_achievements', 'No achievements unlocked yet')}</p>
                        <p className="text-sm">
                          {t('gamification.start_using', 'Start using the app to earn your first badges!')}
                        </p>
                      </div>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Achievements */}
      {recentAchievements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="w-5 h-5" />
              {t('gamification.recent_achievements', 'Recent Achievements')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {recentAchievements.map((userAchievement: UserAchievement) => (
                <div
                  key={userAchievement.id}
                  className="flex items-center gap-3 p-3 border rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                >
                  <div className="text-yellow-500">
                    {getAchievementIcon(userAchievement.achievement.icon)}
                  </div>
                  <div className="flex-1">
                    <h5 className="font-medium">{userAchievement.achievement.title}</h5>
                    <p className="text-sm text-muted-foreground">
                      {userAchievement.achievement.description}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300">
                    +{userAchievement.achievement.experienceReward} XP
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Activity */}
      {activities && activities.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              {t('gamification.recent_activity', 'Recent Activity')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {activities?.slice(0, 5).map((activity: Activity) => (
                <div
                  key={activity.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="text-primary">
                    {getActivityIcon(activity.activityType)}
                  </div>
                  <div className="flex-1">
                    <span className="text-sm">
                      {t(`gamification.activity.${activity.activityType}`, activity.activityType.replace('_', ' '))}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {new Date(activity.createdAt).toLocaleDateString()}
                  </div>
                  {activity.experienceGained > 0 && (
                    <Badge variant="outline" className="text-xs">
                      +{activity.experienceGained} XP
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}