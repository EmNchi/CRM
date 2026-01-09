'use client'

import { useState, useEffect, useCallback } from 'react'
import { Bell, Check, CheckCheck, Trash2, Package, MessageSquare, AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { useAuth } from '@/lib/contexts/AuthContext'
import { formatDistanceToNow } from 'date-fns'
import { ro } from 'date-fns/locale'

interface Notification {
  id: string
  user_id: string
  type: string
  title: string
  message: string
  data: Record<string, any>
  read: boolean
  created_at: string
  read_at: string | null
}

const getNotificationIcon = (type: string) => {
  switch (type) {
    case 'tray_received':
      return <Package className="h-4 w-4 text-blue-500" />
    case 'tray_completed':
      return <Check className="h-4 w-4 text-green-500" />
    case 'tray_urgent':
      return <AlertTriangle className="h-4 w-4 text-amber-500" />
    case 'message_received':
      return <MessageSquare className="h-4 w-4 text-purple-500" />
    default:
      return <Info className="h-4 w-4 text-gray-500" />
  }
}

export function NotificationBell() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)

  // Încarcă notificările - NU include supabase în dependențe (e singleton)
  const loadNotifications = useCallback(async () => {
    if (!user?.id) return
    
    try {
      const supabase = supabaseBrowser()
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20)
      
      if (error) {
        console.error('[NotificationBell] Error loading notifications:', error.message)
        return
      }
      
      setNotifications(data || [])
      setUnreadCount(data?.filter(n => !n.read).length || 0)
    } catch (err: any) {
      console.error('[NotificationBell] Exception:', err.message)
    } finally {
      setLoading(false)
    }
  }, [user?.id]) // ← DOAR user?.id, NU supabase

  // Încarcă la mount
  useEffect(() => {
    loadNotifications()
  }, [loadNotifications])

  // Real-time subscription - creează o singură dată când user.id se schimbă
  useEffect(() => {
    if (!user?.id) return

    const supabase = supabaseBrowser()
    const channel = supabase
      .channel(`user-notifications-${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Adaugă notificarea nouă în listă
        setNotifications(prev => [payload.new as Notification, ...prev])
        setUnreadCount(prev => prev + 1)
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        // Actualizează notificarea
        setNotifications(prev => 
          prev.map(n => n.id === payload.new.id ? payload.new as Notification : n)
        )
        // Recalculează unread count
        setNotifications(prev => {
          setUnreadCount(prev.filter(n => !n.read).length)
          return prev
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user?.id]) // ← DOAR user?.id

  // Marchează ca citită
  const markAsRead = async (notificationId: string) => {
    try {
      const supabase = supabaseBrowser()
      await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('id', notificationId)
      
      setNotifications(prev => 
        prev.map(n => n.id === notificationId ? { ...n, read: true, read_at: new Date().toISOString() } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
    } catch (err: any) {
      console.error('[NotificationBell] Error marking as read:', err.message)
    }
  }

  // Marchează toate ca citite
  const markAllAsRead = async () => {
    if (!user?.id) return
    
    try {
      const supabase = supabaseBrowser()
      await supabase
        .from('notifications')
        .update({ read: true, read_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('read', false)
      
      setNotifications(prev => 
        prev.map(n => ({ ...n, read: true, read_at: new Date().toISOString() }))
      )
      setUnreadCount(0)
    } catch (err: any) {
      console.error('[NotificationBell] Error marking all as read:', err.message)
    }
  }

  // Șterge notificare
  const deleteNotification = async (notificationId: string) => {
    try {
      const supabase = supabaseBrowser()
      await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId)
      
      const notification = notifications.find(n => n.id === notificationId)
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1))
      }
    } catch (err: any) {
      console.error('[NotificationBell] Error deleting notification:', err.message)
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative p-2 hover:bg-sidebar-accent"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-5 w-5 rounded-full bg-red-500 text-white text-xs font-bold flex items-center justify-center animate-pulse">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-80 p-0" 
        align="end" 
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b bg-muted/30">
          <h3 className="font-semibold text-sm">Notificări</h3>
          {unreadCount > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-7 text-xs gap-1"
              onClick={markAllAsRead}
            >
              <CheckCheck className="h-3 w-3" />
              Citește toate
            </Button>
          )}
        </div>
        
        {/* Lista de notificări */}
        <ScrollArea className="h-[300px]">
          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Se încarcă...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center">
              <Bell className="h-10 w-10 mx-auto mb-2 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">Nicio notificare</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    "p-3 hover:bg-muted/50 transition-colors cursor-pointer group",
                    !notification.read && "bg-blue-50/50 dark:bg-blue-950/20"
                  )}
                  onClick={() => !notification.read && markAsRead(notification.id)}
                >
                  <div className="flex gap-3">
                    <div className="shrink-0 mt-0.5">
                      {getNotificationIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn(
                          "text-sm",
                          !notification.read && "font-medium"
                        )}>
                          {notification.title}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 opacity-0 group-hover:opacity-100 shrink-0"
                          onClick={(e) => {
                            e.stopPropagation()
                            deleteNotification(notification.id)
                          }}
                        >
                          <Trash2 className="h-3 w-3 text-muted-foreground" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.message}
                      </p>
                      <p className="text-xs text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { 
                          addSuffix: true, 
                          locale: ro 
                        })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="shrink-0">
                        <div className="h-2 w-2 rounded-full bg-blue-500" />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
        
        {/* Footer */}
        {notifications.length > 0 && (
          <div className="p-2 border-t bg-muted/30">
            <Button 
              variant="ghost" 
              size="sm" 
              className="w-full text-xs"
              onClick={() => {
                setOpen(false)
                // Poți adăuga navigare către pagina de notificări
              }}
            >
              Vezi toate notificările
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}

