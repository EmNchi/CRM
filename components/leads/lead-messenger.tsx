'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, MessageSquare, Loader2, User, Wrench } from 'lucide-react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { ro } from 'date-fns/locale/ro'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const supabase = supabaseBrowser()

export interface LeadMessage {
  id: string
  lead_id: string
  sender_id: string
  sender_name: string
  sender_role: string
  message: string
  created_at: string
}

interface LeadMessengerProps {
  leadId: string
  leadTechnician?: string | null
}

export default function LeadMessenger({ leadId, leadTechnician }: LeadMessengerProps) {
  const { user } = useAuth()
  const [messages, setMessages] = useState<LeadMessage[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [userName, setUserName] = useState<string>('')
  const [pendingMessage, setPendingMessage] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // obtine rolul si numele utilizatorului
  useEffect(() => {
    async function fetchUserInfo() {
      if (!user) return

      // obtine rolul din app_members
      const { data: memberData } = await supabase
        .from('app_members')
        .select('role')
        .eq('user_id', user.id)
        .single()

      if (memberData) {
        setUserRole(memberData.role)
      }

      // verifica daca este tehnician
      const { data: techData } = await supabase
        .from('technicians')
        .select('name')
        .eq('user_id', user.id)
        .single()

      if (techData) {
        setUserName(techData.name)
        setUserRole('technician')
      } else {
        // daca nu este tehnician, foloseste email-ul sau numele din metadata
        setUserName(user.email?.split('@')[0] || 'User')
      }
    }

    fetchUserInfo()
  }, [user])

  // incarca mesajele pentru acest lead
  useEffect(() => {
    if (!leadId) return

    async function loadMessages() {
      setLoading(true)
      try {
        const { data, error } = await supabase
          .from('lead_messages')
          .select('*')
          .eq('lead_id', leadId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error loading messages:', error)
        } else {
          setMessages(data || [])
        }
      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        setLoading(false)
      }
    }

    loadMessages()

    // subscribe la modificari in timp real
    const channel = supabase
      .channel(`lead_messages:${leadId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lead_messages',
          filter: `lead_id=eq.${leadId}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMessages((prev) => [...prev, payload.new as LeadMessage])
          } else if (payload.eventType === 'UPDATE') {
            setMessages((prev) =>
              prev.map((msg) => (msg.id === payload.new.id ? (payload.new as LeadMessage) : msg))
            )
          } else if (payload.eventType === 'DELETE') {
            setMessages((prev) => prev.filter((msg) => msg.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [leadId])

  // scroll la ultimul mesaj cu debounce pentru performanta
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
    return () => clearTimeout(timeoutId)
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`
    }
  }, [newMessage])

  // Trimite mesaj cu optimistic update
  const handleSendMessage = useCallback(async () => {
    const messageText = newMessage.trim()
    if (!messageText || !user || !userRole || sending) return

    // optimistic update - adauga mesajul local imediat
    const tempId = `temp-${Date.now()}`
    const optimisticMessage: LeadMessage = {
      id: tempId,
      lead_id: leadId,
      sender_id: user.id,
      sender_name: userName,
      sender_role: userRole,
      message: messageText,
      created_at: new Date().toISOString(),
    }

    setPendingMessage(tempId)
    setMessages((prev) => [...prev, optimisticMessage])
    setNewMessage('')
    setSending(true)

    try {
      const { data, error } = await supabase
        .from('lead_messages')
        .insert({
          lead_id: leadId,
          sender_id: user.id,
          sender_name: userName,
          sender_role: userRole,
          message: messageText,
        })
        .select()
        .single()

      if (error) throw error

      // inlocuieste mesajul optimist cu cel real
      setMessages((prev) =>
        prev.map((msg) => (msg.id === tempId ? data : msg))
      )
      setPendingMessage(null)
      toast.success('Mesaj trimis cu succes')
    } catch (error: any) {
      console.error('Error sending message:', error)
      // elimina mesajul optimist in caz de eroare
      setMessages((prev) => prev.filter((msg) => msg.id !== tempId))
      setNewMessage(messageText) // restaureaza textul
      setPendingMessage(null)
      toast.error('Eroare la trimiterea mesajului', {
        description: error?.message || 'Te rugăm să încerci din nou.',
      })
    } finally {
      setSending(false)
    }
  }, [newMessage, user, userRole, sending, leadId, userName])

  // verifica daca utilizatorul este receptie sau tehnician
  const isReception = userRole === 'admin' || userRole === 'owner' || userRole === 'member'
  const isTechnician = userRole === 'technician'

  // grupeaza mesajele pe zile pentru o afisare mai clara
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: LeadMessage[] }[] = []
    let currentDate = ''
    let currentGroup: LeadMessage[] = []

    messages.forEach((msg) => {
      const msgDate = format(new Date(msg.created_at), 'yyyy-MM-dd')
      if (msgDate !== currentDate) {
        if (currentGroup.length > 0) {
          groups.push({ date: currentDate, messages: currentGroup })
        }
        currentDate = msgDate
        currentGroup = [msg]
      } else {
        currentGroup.push(msg)
      }
    })

    if (currentGroup.length > 0) {
      groups.push({ date: currentDate, messages: currentGroup })
    }

    return groups
  }, [messages])

  // formateaza data pentru header-ul de grup
  const formatGroupDate = useCallback((dateStr: string) => {
    const date = new Date(dateStr)
    if (isToday(date)) return 'Astăzi'
    if (isYesterday(date)) return 'Ieri'
    return format(date, 'dd MMMM yyyy', { locale: ro })
  }, [])

  if (!user) {
    return (
      <div className="mt-4 p-4 rounded-lg border bg-muted/50">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>Trebuie să fii autentificat pentru a folosi mesageria.</span>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-4 space-y-3">
      {/* Header cu informații */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <label className="font-medium text-foreground">Mesagerie</label>
        </div>
        {leadTechnician && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Wrench className="h-3 w-3" />
            <span>Tehnician: {leadTechnician}</span>
          </div>
        )}
      </div>

      {/* Zona de mesaje */}
      <div className="border rounded-lg bg-card shadow-sm overflow-hidden">
        <ScrollArea className="h-[350px]">
          <div className="p-4">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="text-sm text-muted-foreground">Se încarcă mesajele...</p>
              </div>
            ) : groupedMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full min-h-[200px] gap-3">
                <div className="rounded-full bg-muted p-4">
                  <MessageSquare className="h-8 w-8 text-muted-foreground" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground mb-1">
                    Nu există mesaje încă
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Trimite primul mesaj pentru a începe conversația
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {groupedMessages.map((group) => (
                  <div key={group.date} className="space-y-3">
                    {/* Header pentru grupul de zile */}
                    <div className="flex items-center gap-2 my-4">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs font-medium text-muted-foreground px-2">
                        {formatGroupDate(group.date)}
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>

                    {/* Mesajele din grup */}
                    {group.messages.map((msg) => {
                      const isOwnMessage = msg.sender_id === user.id
                      const isFromTechnician = msg.sender_role === 'technician'
                      const isPending = pendingMessage === msg.id
                      const isRecent = isToday(new Date(msg.created_at))

                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            'flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300',
                            isOwnMessage ? 'justify-end' : 'justify-start'
                          )}
                        >
                          {/* Avatar pentru mesajele altora */}
                          {!isOwnMessage && (
                            <div
                              className={cn(
                                'flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium',
                                isFromTechnician
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100'
                                  : 'bg-muted text-muted-foreground'
                              )}
                            >
                              {isFromTechnician ? (
                                <Wrench className="h-4 w-4" />
                              ) : (
                                <User className="h-4 w-4" />
                              )}
                            </div>
                          )}

                          <div className={cn('flex flex-col gap-1', isOwnMessage ? 'items-end' : 'items-start', 'max-w-[75%]')}>
                            {/* Numele expeditorului */}
                            {!isOwnMessage && (
                              <div className="flex items-center gap-1.5 px-1">
                                <span className="text-xs font-medium text-foreground">
                                  {msg.sender_name}
                                </span>
                                {isFromTechnician && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-100">
                                    Tehnician
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Bula de mesaj */}
                            <div
                              className={cn(
                                'rounded-lg px-3 py-2 shadow-sm',
                                isOwnMessage
                                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                                  : isFromTechnician
                                  ? 'bg-blue-50 text-blue-900 dark:bg-blue-950 dark:text-blue-100 rounded-bl-sm border border-blue-200 dark:border-blue-800'
                                  : 'bg-muted text-muted-foreground rounded-bl-sm',
                                isPending && 'opacity-60'
                              )}
                            >
                              <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                {msg.message}
                              </div>
                              <div
                                className={cn(
                                  'flex items-center gap-1 mt-1.5 text-[10px]',
                                  isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                                )}
                              >
                                {isPending && (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                )}
                                <span>
                                  {isRecent
                                    ? formatDistanceToNow(new Date(msg.created_at), {
                                        addSuffix: true,
                                        locale: ro,
                                      })
                                    : format(new Date(msg.created_at), 'HH:mm', { locale: ro })}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Avatar pentru mesajele proprii */}
                          {isOwnMessage && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-medium">
                              <User className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </ScrollArea>

        {/* Input pentru mesaj nou */}
        <div className="border-t bg-muted/30 p-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSendMessage()
            }}
            className="flex gap-2 items-end"
          >
            <div className="flex-1 relative">
              <Textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder={
                  isTechnician
                    ? 'Scrie un mesaj pentru recepție...'
                    : 'Scrie un mesaj pentru tehnician...'
                }
                disabled={sending}
                className="min-h-[40px] max-h-[120px] resize-none pr-10"
                rows={1}
              />
              {newMessage.trim() && (
                <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                  Enter pentru trimitere, Shift+Enter pentru linie nouă
                </div>
              )}
            </div>
            <Button
              type="submit"
              disabled={!newMessage.trim() || sending}
              size="icon"
              className="shrink-0"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}

