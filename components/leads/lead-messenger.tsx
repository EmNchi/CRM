'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, MessageSquare, Loader2, User, Paperclip, X, AtSign, Wrench, Tag, Users } from 'lucide-react'
import { useAuth } from '@/lib/contexts/AuthContext'
import { format, isToday, isYesterday, formatDistanceToNow } from 'date-fns'
import { ro } from 'date-fns/locale/ro'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const supabase = supabaseBrowser()

export interface LeadMessage {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  message_type: string
  file_url?: string | null
  created_at: string
  updated_at?: string
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
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [senderNamesCache, setSenderNamesCache] = useState<Record<string, string>>({})
  const [attachedImages, setAttachedImages] = useState<Array<{ file: File; preview: string }>>([])
  const [mentionSuggestions, setMentionSuggestions] = useState<Array<{ id: string; name: string; type: string }>>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState('')
  const [messageAttachments, setMessageAttachments] = useState<Record<string, any[]>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const conversationInitializedRef = useRef(false)
  const isMounted = useRef(true)

  // Handle file attachment
  const handleAttachImage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files) return

    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/')) {
        toast.error('Doar imagini sunt acceptate')
        return
      }

      const reader = new FileReader()
      reader.onload = (e) => {
        const preview = e.target?.result as string
        setAttachedImages((prev) => [...prev, { file, preview }])
      }
      reader.readAsDataURL(file)
    })
  }, [])

  // Remove attached image
  const removeAttachedImage = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Handle @mention suggestions
  const handleMentionInput = useCallback(async (text: string) => {
    const lastAtIndex = text.lastIndexOf('@')
    
    // Daca nu e @, ascunde dropdown
    if (lastAtIndex === -1) {
      setShowMentions(false)
      setMentionQuery('')
      return
    }

    // Extrage textul dupa @
    const afterAt = text.substring(lastAtIndex + 1)
    
    // Daca am spatiu dupa @, inchidem dropdown
    if (afterAt.includes(' ')) {
      setShowMentions(false)
      setMentionQuery('')
      return
    }

    setMentionQuery(afterAt.toLowerCase())

    try {
      const suggestions: Array<{ id: string; name: string; type: string }> = []
      const searchTerm = `%${afterAt}%`

      // Cauta servicii din tray_items
      const { data: servicesData } = await (supabase
        .from('tray_items')
        .select('id, item_name')
        .ilike('item_name', searchTerm)
        .limit(5) as any)

      if (servicesData && Array.isArray(servicesData)) {
        (servicesData as any[]).forEach((s: any) => {
          if (s.item_name) {
            suggestions.push({
              id: s.id,
              name: s.item_name,
              type: 'serviciu',
            })
          }
        })
      }

      // Cauta taguri din lead_tags
      const { data: tagsData } = await (supabase
        .from('lead_tags')
        .select('id, tag_name')
        .ilike('tag_name', searchTerm)
        .limit(3) as any)

      if (tagsData && Array.isArray(tagsData)) {
        (tagsData as any[]).forEach((t: any) => {
          if (t.tag_name) {
            suggestions.push({
              id: t.id,
              name: t.tag_name,
              type: 'tag',
            })
          }
        })
      }

      // Cauta tehnicienii
      const { data: techniciansData } = await (supabase
        .from('technicians')
        .select('id, name')
        .ilike('name', searchTerm)
        .limit(3) as any)

      if (techniciansData && Array.isArray(techniciansData)) {
        (techniciansData as any[]).forEach((t: any) => {
          if (t.name) {
            suggestions.push({
              id: t.id,
              name: t.name,
              type: 'tehnician',
            })
          }
        })
      }

      setMentionSuggestions(suggestions)
      setShowMentions(true) // Arata dropdown chiar daca e gol, pentru a arata "No results"
    } catch (error) {
      console.error('Error fetching mention suggestions:', error)
    }
  }, [])

  // Insert mention
  const insertMention = useCallback((mention: { id: string; name: string; type: string }) => {
    const lastAtIndex = newMessage.lastIndexOf('@')
    const before = newMessage.substring(0, lastAtIndex)
    const after = newMessage.substring(lastAtIndex + 1)
    
    // Gaseste pozitia spatiului dupa @mention
    const spaceIndex = after.search(/\s/)
    const afterMention = spaceIndex === -1 ? '' : after.substring(spaceIndex)

    setNewMessage(`${before}@${mention.name} ${afterMention}`)
    setShowMentions(false)
    setMentionQuery('')
    
    // Focus back on textarea
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 0)
  }, [newMessage])

  // Obține numele expeditorului din sender_id
  const getSenderName = useCallback(async (senderId: string) => {
    // Dacă e user-ul curent, returnează userName
    if (senderId === user?.id) {
      return userName || user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'User'
    }

    try {
      // Verifica cache-ul mai întâi
      if (senderNamesCache[senderId]) {
        return senderNamesCache[senderId]
      }

      // 1. Caută în technicians tabel
      const { data: techData } = await supabase
        .from('technicians')
        .select('name')
        .eq('user_id', senderId)
        .single()

      if (techData?.name) {
        setSenderNamesCache((prev) => ({ ...prev, [senderId]: techData.name }))
        return techData.name
      }

      // 2. Caută în app_members pentru email (și eventual display_name dacă exista)
      const { data: memberData } = await supabase
        .from('app_members')
        .select('email, display_name')
        .eq('user_id', senderId)
        .single()

      if (memberData) {
        // Prioritate: display_name > email prefix
        const displayName = memberData.display_name || memberData.email?.split('@')[0] || 'User'
        setSenderNamesCache((prev) => ({ ...prev, [senderId]: displayName }))
        return displayName
      }

      // 3. Fallback - nu gasim user-ul, returnez User
      setSenderNamesCache((prev) => ({ ...prev, [senderId]: 'User' }))
      return 'User'
    } catch (error) {
      console.error('Error fetching sender name:', error)
      setSenderNamesCache((prev) => ({ ...prev, [senderId]: 'User' }))
      return 'User'
    }
  }, [user?.id, user?.email, user?.user_metadata?.display_name, userName, senderNamesCache])

  // Pre-load sender names for all messages
  useEffect(() => {
    const senderIds = new Set(messages.map((msg) => msg.sender_id))
    
    senderIds.forEach((senderId) => {
      if (senderNamesCache[senderId]) return // Skip if already cached
      
      // Load sender name
      getSenderName(senderId)
    })
  }, [messages, senderNamesCache, getSenderName])

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

  // Inițializează conversația la primeiro load
  useEffect(() => {
    if (!leadId || !user || conversationInitializedRef.current) return

    async function ensureConversation() {
      try {
        // Încearcă să găsești conversația existentă
        const { data: convData } = await supabase
          .from('conversations')
          .select('id')
          .eq('related_id', leadId)
          .eq('type', 'lead')
          .single()

        if (convData) {
          setConversationId(convData.id)
          conversationInitializedRef.current = true
          return
        }

        // Dacă nu există, creează una nouă
        const { data: newConv, error: createError } = await supabase
          .from('conversations')
          .insert({
            related_id: leadId,
            type: 'lead',
            created_by: user.id,
          })
          .select('id')
          .single()

        if (createError) {
          console.error('Error creating conversation:', createError?.message)
          conversationInitializedRef.current = true
          setLoading(false)
          return
        }

        if (newConv) {
          setConversationId(newConv.id)
        }

        conversationInitializedRef.current = true
      } catch (error) {
        console.error('Error ensuring conversation:', error)
        conversationInitializedRef.current = true
        setLoading(false)
      }
    }

    ensureConversation()
  }, [leadId, user])

  // incarca mesajele pentru acest lead
  useEffect(() => {
    if (!leadId || !conversationId) return

    async function loadMessages() {
      setLoading(true)
      try {
        // Încarcă mesajele pentru această conversație
        const { data, error } = await supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId)
          .order('created_at', { ascending: true })

        if (error) {
          console.error('Error loading messages:', error.message || error)
        } else if (isMounted.current) {
          setMessages(data || [])
        }
      } catch (error) {
        console.error('Error loading messages:', error)
      } finally {
        if (isMounted.current) {
          setLoading(false)
        }
      }
    }

    loadMessages()

    // subscribe la modificari in timp real
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          if (!isMounted.current) return

          if (payload.eventType === 'INSERT') {
            // Adaugă mesajul nou doar dacă nu e deja în lista (evita duplicate din optimistic update)
            setMessages((prev) => {
              const exists = prev.some((msg) => msg.id === payload.new.id)
              if (exists) return prev
              return [...prev, payload.new as LeadMessage]
            })
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
      isMounted.current = false
      supabase.removeChannel(channel)
    }
  }, [leadId, conversationId])

  // Load attachments for messages
  useEffect(() => {
    async function loadAttachments() {
      const messageIds = messages
        .filter((msg) => msg.message_type === 'image')
        .map((msg) => msg.id)

      if (messageIds.length === 0) return

      try {
        const { data, error } = await supabase
          .from('message_attachments')
          .select('*')
          .in('message_id', messageIds)

        if (error) throw error

        if (data) {
          const attachmentsByMessage: Record<string, any[]> = {}
          data.forEach((attachment) => {
            if (!attachmentsByMessage[attachment.message_id]) {
              attachmentsByMessage[attachment.message_id] = []
            }
            attachmentsByMessage[attachment.message_id].push(attachment)
          })
          setMessageAttachments(attachmentsByMessage)
        }
      } catch (error) {
        console.error('Error loading attachments:', error)
      }
    }

    loadAttachments()
  }, [messages])

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
    // Expect conversationId sa existe - daca nu, nu trimite mesaj
    if ((!messageText && attachedImages.length === 0) || !user || !userRole || sending || !conversationId) {
      if (!conversationId) {
        toast.error('Conversația se inițializează. Așteptați câteva secunde și reîncercați.')
      }
      return
    }

    try {
      setSending(true)
      let uploadedImageUrls: string[] = []

      // Upload imagini atasate
      if (attachedImages.length > 0) {
        for (const { file } of attachedImages) {
          const fileExt = file.name.split('.').pop()
          const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`
          const filePath = `messages/${conversationId}/${fileName}`

          const { data, error } = await supabase.storage
            .from('tray_images')
            .upload(filePath, file)

          if (error) {
            console.error('Upload error:', error)
            toast.error('Eroare la upload imagine')
            continue
          }

          uploadedImageUrls.push(data?.path || '')
        }
      }

      // optimistic update - adauga mesajul local imediat
      const tempId = `temp-${Date.now()}`
      const optimisticMessage: LeadMessage = {
        id: tempId,
        conversation_id: conversationId,
        sender_id: user.id,
        content: messageText,
        message_type: attachedImages.length > 0 ? 'image' : 'text',
        created_at: new Date().toISOString(),
      }

      setPendingMessage(tempId)
      setMessages((prev) => [...prev, optimisticMessage])
      setNewMessage('')
      setAttachedImages([])

      // Inserează mesajul în baza de date
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: messageText,
          message_type: attachedImages.length > 0 ? 'image' : 'text',
          has_attachments: uploadedImageUrls.length > 0,
        })
        .select()
        .single()

      if (error) throw error

      // Salvează attachment-urile
      if (uploadedImageUrls.length > 0 && data) {
        const attachments = uploadedImageUrls.map((url) => ({
          message_id: data.id,
          url: url, // Trebuie url, nu file_url
          attachment_type: 'image',
          display_name: 'Imagine',
          mime_type: 'image/*',
        }))

        const { error: attachError } = await supabase
          .from('message_attachments')
          .insert(attachments)

        if (attachError) {
          console.error('Error saving attachments:', attachError)
        }
      }

      // Înlocuiește mesajul optimist (temp) cu mesajul real din DB
      setMessages((prev) => {
        // Găsește indexul mesajului optimist și înlocuiește-l
        const updatedMessages = prev.map((msg) => 
          msg.id === tempId ? (data as LeadMessage) : msg
        )
        return updatedMessages
      })
      setPendingMessage(null)
      toast.success('Mesaj trimis cu succes')
    } catch (error: any) {
      console.error('Error sending message:', error)
      // Elimină mesajul optimist dacă a eșuat
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')))
      toast.error('Eroare la trimiterea mesajului', {
        description: error?.message || 'Te rugăm să încerci din nou.',
      })
    } finally {
      setSending(false)
    }
  }, [newMessage, attachedImages, user, userRole, sending, conversationId])

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

  if (loading) {
    return (
      <div className="mt-4 p-4 rounded-lg border bg-muted/50">
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Se inițializează mesageria...</span>
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
                    {group.messages.map((msg, idx) => {
                      const isOwnMessage = msg.sender_id === user.id
                      const isPending = pendingMessage === msg.id
                      const isRecent = isToday(new Date(msg.created_at))
                      const messageKey = `${msg.id}-${idx}`
                      // Get sender name from cache
                      const senderName = senderNamesCache[msg.sender_id] || 'User'

                      return (
                        <div
                          key={messageKey}
                          className={cn(
                            'flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300',
                            isOwnMessage ? 'justify-end' : 'justify-start'
                          )}
                        >
                          {/* Avatar pentru mesajele altora */}
                          {!isOwnMessage && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium bg-muted text-muted-foreground">
                              <User className="h-4 w-4" />
                            </div>
                          )}

                          <div className={cn('flex flex-col gap-1', isOwnMessage ? 'items-end' : 'items-start', 'max-w-[75%]')}>
                            {/* Nume expeditor */}
                            {!isOwnMessage && (
                              <span className="text-xs font-semibold text-muted-foreground px-1">
                                {senderName}
                              </span>
                            )}

                            {/* Bula de mesaj */}
                            <div
                              className={cn(
                                'rounded-lg px-3 py-2 shadow-sm',
                                isOwnMessage
                                  ? 'bg-primary text-primary-foreground rounded-br-sm'
                                  : 'bg-muted text-muted-foreground rounded-bl-sm',
                                isPending && 'opacity-60'
                              )}
                            >
                              {/* Imagine atasata */}
                              {msg.message_type === 'image' && messageAttachments[msg.id] && (
                                <div className="mb-2 max-w-xs">
                                  <div className="flex gap-2 flex-wrap">
                                    {messageAttachments[msg.id].map((attachment) => (
                                      <div
                                        key={attachment.id}
                                        className="relative group cursor-pointer"
                                        onClick={() => {
                                          window.open(attachment.url, '_blank')
                                        }}
                                      >
                                        <img
                                          src={attachment.url}
                                          alt="message attachment"
                                          className="max-w-[200px] max-h-[200px] rounded-md object-cover border border-muted"
                                        />
                                        <div className="absolute inset-0 bg-black/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <span className="text-white text-xs">Click pentru a deschide</span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Mențiuni inline */}
                              <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                {msg.content.split(/(@\w+)/g).map((part, i) => {
                                  if (part.startsWith('@')) {
                                    return (
                                      <span
                                        key={i}
                                        className={cn(
                                          'font-semibold',
                                          isOwnMessage ? 'text-primary-foreground/90' : 'text-primary'
                                        )}
                                      >
                                        {part}
                                      </span>
                                    )
                                  }
                                  return part
                                })}
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
        <div className="border-t bg-muted/30 p-3 space-y-3">
          {/* Preview imagini atasate */}
          {attachedImages.length > 0 && (
            <div className="flex gap-2 flex-wrap">
              {attachedImages.map((img, idx) => (
                <div key={idx} className="relative">
                  <img src={img.preview} alt="preview" className="h-20 w-20 object-cover rounded border border-muted" />
                  <button
                    type="button"
                    onClick={() => removeAttachedImage(idx)}
                    className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Mention suggestions - Discord style */}
          {showMentions && (
            <div className="bg-popover border border-popover-foreground/10 rounded-lg shadow-lg p-2 space-y-0.5">
              {mentionSuggestions.length === 0 ? (
                <div className="text-xs text-muted-foreground px-2 py-2 text-center">
                  Nicio sugestie pentru "{mentionQuery}"
                </div>
              ) : (
                <>
                  <div className="text-xs font-semibold text-muted-foreground px-2 py-1">
                    Mențiuni ({mentionSuggestions.length}):
                  </div>
                  <div className="max-h-[240px] overflow-y-auto">
                    {mentionSuggestions.map((suggestion, idx) => {
                      const getIcon = () => {
                        switch (suggestion.type) {
                          case 'serviciu':
                            return <Wrench className="h-4 w-4" />
                          case 'tag':
                            return <Tag className="h-4 w-4" />
                          case 'tehnician':
                            return <Users className="h-4 w-4" />
                          default:
                            return <AtSign className="h-4 w-4" />
                        }
                      }

                      const getColor = () => {
                        switch (suggestion.type) {
                          case 'serviciu':
                            return 'text-blue-500'
                          case 'tag':
                            return 'text-amber-500'
                          case 'tehnician':
                            return 'text-purple-500'
                          default:
                            return 'text-muted-foreground'
                        }
                      }

                      return (
                        <button
                          key={`${suggestion.type}-${suggestion.id}`}
                          type="button"
                          onClick={() => insertMention(suggestion)}
                          className="w-full text-left px-2 py-2 hover:bg-accent rounded text-sm flex items-center gap-2.5 transition-colors"
                        >
                          <span className={`${getColor()} flex-shrink-0`}>{getIcon()}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-foreground truncate">{suggestion.name}</div>
                            <div className="text-xs text-muted-foreground">{suggestion.type}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )}

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
                onChange={(e) => {
                  setNewMessage(e.target.value)
                  handleMentionInput(e.target.value)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    handleSendMessage()
                  }
                }}
                placeholder={
                  !conversationId
                    ? 'Se inițializează mesageria...'
                    : isTechnician
                    ? 'Scrie un mesaj pentru recepție... (@pentru mențiuni)'
                    : 'Scrie un mesaj pentru tehnician... (@pentru mențiuni)'
                }
                disabled={sending || !conversationId || loading}
                className="min-h-[40px] max-h-[120px] resize-none pr-10"
                rows={1}
              />
              {newMessage.trim() && (
                <div className="absolute bottom-2 right-2 text-[10px] text-muted-foreground">
                  Enter pentru trimitere, Shift+Enter pentru linie nouă
                </div>
              )}
            </div>

            {/* Attach Image Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={sending || !conversationId || loading}
              size="icon"
              className="shrink-0 relative"
              title="Atașează imagini"
            >
              <Paperclip className="h-4 w-4" />
            </button>

            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleAttachImage}
              className="hidden"
            />

            <Button
              type="submit"
              disabled={!newMessage.trim() || sending || !conversationId || loading}
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

