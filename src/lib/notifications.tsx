import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Bell, Loader2, Check, X } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

interface Notification {
  id: string;
  type: 'lead_assigned' | 'lead_status_changed' | 'follow_up_due' | 'payment_received' | 'call_scheduled' | 'whatsapp_received' | 'task_assigned' | 'system';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  related_id?: string;
  related_type?: 'lead' | 'customer' | 'task' | 'payment';
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  fetchNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { userId, organizationId, isSuperAdmin, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (authLoading || !userId) return;
    
    try {
      let query = supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (!isSuperAdmin && organizationId) {
        // Get user's visible member IDs (for team leaders, etc.)
        const { data: memberIds } = await supabase.rpc('get_visible_member_ids', {
          p_user_id: userId
        });
        
        if (memberIds && memberIds.length > 0) {
          query = query.in('user_id', memberIds);
        } else {
          query = query.eq('user_id', userId);
        }
      } else if (!isSuperAdmin) {
        query = query.eq('user_id', userId);
      }
      // Superadmin sees all notifications

      const { data, error } = await query;
      if (error) throw error;
      setNotifications(data ?? []);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase.from('notifications').update({ read: true }).eq('id', id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unreadIds = notifications.filter(n => !n.read).map(n => n.id);
      if (unreadIds.length === 0) return;
      
      await supabase.from('notifications').update({ read: true }).in('id', unreadIds);
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      fetchNotifications();
    }
  }, [authLoading, userId, organizationId, isSuperAdmin]);

  // Real-time subscription
  useEffect(() => {
    if (!userId) return;
    
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: isSuperAdmin ? undefined : `user_id=eq.${userId}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications(prev => [newNotif, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, isSuperAdmin]);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications,
      unreadCount,
      loading,
      open,
      setOpen,
      markAsRead,
      markAllAsRead,
      fetchNotifications,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}

// Notification Bell Component
export function NotificationBell() {
  const { notifications, unreadCount, open, setOpen, markAsRead, markAllAsRead, loading } = useNotifications();

  if (loading) {
    return (
      <button className="relative rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
      </button>
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative rounded-lg border border-border p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-destructive text-white text-xs font-medium flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)}>
          <div className="absolute right-4 top-14 w-96 max-h-[60vh] bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-semibold">Notifications</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-primary hover:underline"
                  >
                    Mark all read
                  </button>
                )}
                <button onClick={() => setOpen(false)} className="p-1 hover:bg-muted rounded">
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="max-h-[50vh] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <ul className="divide-y divide-border">
                  {notifications.map((notif) => (
                    <li
                      key={notif.id}
                      className={`p-4 hover:bg-muted/50 transition-colors ${!notif.read ? 'bg-muted/30' : ''}`}
                      onClick={() => markAsRead(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                          notif.read ? 'bg-muted' : 'bg-primary/10'
                        }`}>
                          <Check className={`h-4 w-4 ${notif.read ? 'text-muted' : 'text-primary'}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`font-medium ${!notif.read ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {notif.title}
                          </p>
                          <p className="text-sm text-muted-foreground mt-0.5 truncate">
                            {notif.message}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(notif.created_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}