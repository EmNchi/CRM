'use client'

import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { supabaseBrowser } from '@/lib/supabase/supabaseClient'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Send, MessageSquare, Loader2, User, Paperclip, X, Wrench } from 'lucide-react'
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
  tray_id?: string | null
  created_at: string
  updated_at?: string
}

interface LeadMessengerProps {
  leadId: string
  leadTechnician?: string | null
  selectedQuoteId?: string | null
}

export default function LeadMessenger({ leadId, leadTechnician, selectedQuoteId }: LeadMessengerProps) {
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
  const [messageAttachments, setMessageAttachments] = useState<Record<string, any[]>>({})
  const [showTrayImagePicker, setShowTrayImagePicker] = useState(false)
  const [trayImages, setTrayImages] = useState<Array<{ id: string; file_path: string }>>([])
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const conversationInitializedRef = useRef(false)
  const isMounted = useRef(true)

  // Handle file attachment

  // Attach tray image
  const handleAttachTrayImage = useCallback((imagePath: string) => {
    // Obține public URL din storage
    const publicUrl = supabase.storage.from('tray_images').getPublicUrl(imagePath).data.publicUrl
    
    // Creează un fake File object pentru a-l salva ca attachment
    setAttachedImages((prev) => [
      ...prev,
      {
        file: new File([publicUrl], imagePath, { type: 'image/reference' }),
        preview: publicUrl,
      },
    ])
    
    setShowTrayImagePicker(false)
    toast.success('Imagine adăugată din tăviță')
  }, [])

  // Remove attached image
  const removeAttachedImage = useCallback((index: number) => {
    setAttachedImages((prev) => prev.filter((_, i) => i !== index))
  }, [])

  // Obține rolul și numele utilizatorului
  useEffect(() => {
    if (!user) return
    
    // Setează imediat un rol implicit pentru a permite trimiterea mesajelor
    // Folosește auth.display_name ca valoare implicită
    setUserRole('member')
    setUserName(user.user_metadata?.display_name || user.email?.split('@')[0] || 'Utilizator')

    async function fetchUserInfo() {
      if (!user) return
      try {
        // Încearcă să obțină rolul și name din app_members
        const { data: memberData, error } = await (supabase
          .from('app_members')
          .select('role, name')
          .eq('user_id', user.id)
          .maybeSingle() as any)

        if (!error && memberData) {
          setUserRole(memberData.role)
          // Prioritate: app_members.name > auth.display_name > email
          setUserName(memberData.name || user.user_metadata?.display_name || user.email?.split('@')[0] || 'Utilizator')
        }
      } catch (err) {
        console.error('Error fetching user info:', err)
        // Păstrăm valorile implicite setate mai sus
      }
    }

    fetchUserInfo()
  }, [user])

  // Inițializează conversația la primul load
  // CAUTA conversația existentă (creată automat când se creează/mută lead-ul)
  useEffect(() => {
    if (!leadId || !user) return

    async function loadConversation() {
      try {
        // Verificăm că leadId este un ID valid de lead (nu de service_file)
        const { data: leadCheck, error: leadCheckError } = await (supabase
          .from('leads')
          .select('id')
          .eq('id', leadId)
          .maybeSingle() as any)
        
        if (leadCheckError || !leadCheck) {
          console.warn('⚠️ LeadMessenger: leadId nu este un ID valid de lead:', leadId)
          if (isMounted.current) setLoading(false)
          return
        }
        
        console.log('Loading conversation for lead ID:', leadId)

        // Încearcă să găsești conversația existentă pentru LEAD
        const { data: convData, error: searchError } = await (supabase
          .from('conversations')
          .select('id')
          .eq('related_id', leadId)
          .eq('type', 'lead')
          .maybeSingle() as any)

        if (searchError && searchError.code !== 'PGRST116') {
          // PGRST116 = no rows found, asta e OK
          console.error('Error searching conversation:', searchError?.message)
          if (isMounted.current) setLoading(false)
          return
        }

        if (convData) {
          console.log('Found existing conversation for lead:', convData.id)
          if (isMounted.current) setConversationId(convData.id)
          conversationInitializedRef.current = true
        } else {
          // Nu există conversație pentru acest lead - va fi creată când se trimit tăvițele din Recepție
          console.log('No conversation found for lead:', leadId)
          if (isMounted.current) setConversationId(null)
          conversationInitializedRef.current = true
        }

        if (isMounted.current) setLoading(false)
      } catch (error) {
        console.error('Error loading conversation:', error)
        if (isMounted.current) setLoading(false)
      }
    }

    // Always load conversation when leadId changes
    loadConversation()
  }, [leadId, user])


  // incarca mesajele pentru acest lead
  useEffect(() => {
    if (!leadId || !conversationId) return

    async function loadMessages() {
      setLoading(true)
      try {
        // Încarcă mesajele pentru această conversație
        const { data, error } = await (supabase
          .from('messages')
          .select('*')
          .eq('conversation_id', conversationId as string)
          .order('created_at', { ascending: true }) as any)

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

  // Load tray images din tray curent (selectedQuoteId = tray_id)
  useEffect(() => {
    async function loadTrayImages() {
      if (!selectedQuoteId) {
        setTrayImages([])
        return
      }

      try {
        // Caută imaginile din tray-ul curent folosind tray_id
        const { data: imagesData, error } = await supabase
          .from('tray_images')
          .select('id, file_path, filename, url')
          .eq('tray_id', selectedQuoteId)
          .order('created_at', { ascending: false })

        if (error) {
          console.error('Error loading tray images:', error)
          return
        }

        if (imagesData) {
          setTrayImages(imagesData)
          console.log('Loaded tray images for tray', selectedQuoteId, ':', imagesData.length)
        }
      } catch (error) {
        console.error('Error loading tray images:', error)
      }
    }

    loadTrayImages()
  }, [selectedQuoteId])
  useEffect(() => {
    async function loadImages() {
      const messageIds = messages
        .filter((msg) => msg.message_type === 'image')
        .map((msg) => msg.id)

      if (messageIds.length === 0) return

      try {
        // Load messages cu tray_id
        const { data: messagesWithImages } = await (supabase
          .from('messages')
          .select('id, tray_id')
          .in('id', messageIds)
          .not('tray_id', 'is', null) as any)

        if (!messagesWithImages || messagesWithImages.length === 0) return

        // Cauta imagini din traiele specificate
        const trayIds = messagesWithImages.map((m: any) => m.tray_id).filter(Boolean) as string[]
        const { data: imagesData } = await supabase
          .from('tray_images')
          .select('id, file_path, tray_id')
          .in('tray_id', trayIds)

        if (imagesData) {
          // Creează map de tray_id -> imagini (luăm prima imagine din tray)
          const trayImageMap: Record<string, string> = {}
          imagesData.forEach((img: any) => {
            if (!trayImageMap[img.tray_id]) {
              trayImageMap[img.tray_id] = img.file_path
            }
          })
          
          // Salvează în state
          const messageImages: Record<string, string> = {}
          messagesWithImages.forEach((msg: any) => {
            if (msg.tray_id && trayImageMap[msg.tray_id]) {
              messageImages[msg.id] = trayImageMap[msg.tray_id]
            }
          })
          setMessageAttachments(messageImages as any)
        }
      } catch (error) {
        console.error('Error loading images:', error)
      }
    }

    loadImages()
  }, [messages])

  // Încarcă numele expeditorilor pentru mesajele din conversație
  useEffect(() => {
    if (messages.length === 0 || !user) return

    const currentUserId = user.id // Capturăm user.id pentru a evita erori TypeScript

    async function loadSenderNames() {
      // Găsește expeditorii unici care nu sunt utilizatorul curent și nu sunt în cache
      const uniqueSenderIds = [...new Set(messages.map(m => m.sender_id))]
        .filter(id => id !== currentUserId && !senderNamesCache[id])

      if (uniqueSenderIds.length === 0) return

      try {
        // Încarcă name din app_members
        const { data: membersData } = await (supabase
          .from('app_members')
          .select('user_id, name')
          .in('user_id', uniqueSenderIds) as any)

        if (membersData && membersData.length > 0) {
          const newCache: Record<string, string> = { ...senderNamesCache }
          membersData.forEach((member: any) => {
            if (member.name) {
              newCache[member.user_id] = member.name
            }
          })
          setSenderNamesCache(newCache)
        }
      } catch (error) {
        console.error('Error loading sender names:', error)
      }
    }

    loadSenderNames()
  }, [messages, user, senderNamesCache])

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
    const hasImages = attachedImages.length > 0
    
    // Verificări pentru trimitere
    if (!messageText && !hasImages) {
      return // Nu trimite mesaje goale
    }
    if (!user) {
      toast.error('Trebuie să fii autentificat pentru a trimite mesaje.')
      return
    }
    if (!userRole) {
      toast.error('Se încarcă informațiile utilizatorului. Așteptați câteva secunde.')
      return
    }
    if (sending) {
      return // Deja se trimite un mesaj
    }
    if (!conversationId) {
      toast.error('Conversația se inițializează. Așteptați câteva secunde și reîncercați.')
      return
    }

    try {
      setSending(true)
      
      // Salvează imaginile și trimite mesajele pentru fiecare
      const imagesToSend = [...attachedImages]
      setAttachedImages([])
      setNewMessage('')

      // Trimite mai întâi mesajele cu imagini (dacă există)
      for (const img of imagesToSend) {
        // Imaginea din tray_images - file_path este în img.file.name
        const filePath = img.file.name
        // Construim URL-ul complet pentru imagine
        const imageUrl = supabase.storage.from('tray_images').getPublicUrl(filePath).data.publicUrl
        
        const tempImgId = `temp-img-${Date.now()}-${Math.random()}`
        const optimisticImgMessage: LeadMessage = {
          id: tempImgId,
          conversation_id: conversationId,
          sender_id: user.id,
          content: imageUrl, // Salvăm URL-ul complet
          message_type: 'image',
          created_at: new Date().toISOString(),
        }

        setPendingMessage(tempImgId)
        setMessages((prev) => [...prev, optimisticImgMessage])

        // Inserează mesajul cu imagine în baza de date
        const { data: imgData, error: imgError } = await supabase
          .from('messages')
          .insert({
            conversation_id: conversationId as string,
            sender_id: user.id,
            content: imageUrl,
            message_type: 'image',
          } as any)
          .select()
          .single()

        if (imgError) {
          console.error('Insert image error:', imgError)
          // Elimină mesajul optimist
          setMessages((prev) => prev.filter((msg) => msg.id !== tempImgId))
          toast.error('Eroare la trimiterea imaginii')
        } else if (imgData) {
          const imgDataAny = imgData as any
          // Înlocuiește mesajul optimist cu cel real
          setMessages((prev) => prev.map((msg) => 
            msg.id === tempImgId ? (imgDataAny as LeadMessage) : msg
          ))
        }
      }

      // Apoi trimite mesajul text (dacă există)
      if (messageText) {
        const tempId = `temp-${Date.now()}`
        const optimisticMessage: LeadMessage = {
          id: tempId,
          conversation_id: conversationId,
          sender_id: user.id,
          content: messageText,
          message_type: 'text',
          created_at: new Date().toISOString(),
        }

        setPendingMessage(tempId)
        setMessages((prev) => [...prev, optimisticMessage])

        // Inserează mesajul în baza de date
        const { data, error } = await (supabase
          .from('messages')
          .insert({
            conversation_id: conversationId as string,
            sender_id: user.id,
            content: messageText,
            message_type: 'text',
          })
          .select()
          .single() as any)

        if (error) {
          console.error('Insert error details:', { error, message: error?.message, code: error?.code, details: error?.details })
          throw error
        }

        if (!data) {
          throw new Error('Nu s-au primit date după insert')
        }

        // Înlocuiește mesajul optimist (temp) cu mesajul real din DB
        setMessages((prev) => {
          const updatedMessages = prev.map((msg) => 
            msg.id === tempId ? (data as LeadMessage) : msg
          )
          return updatedMessages
        })
      }
      
      setPendingMessage(null)
      toast.success(hasImages && messageText ? 'Mesaj și imagini trimise' : hasImages ? 'Imagine trimisă' : 'Mesaj trimis')
    } catch (error: any) {
      console.error('Error sending message:', error, error?.message)
      // Elimină mesajul optimist dacă a eșuat
      setMessages((prev) => prev.filter((msg) => !msg.id.startsWith('temp-')))
      
      let errorMsg = 'Eroare necunoscută'
      if (typeof error === 'string') {
        errorMsg = error
      } else if (error?.message) {
        errorMsg = error.message
      } else if (error?.error_description) {
        errorMsg = error.error_description
      }
      
      toast.error('Eroare la trimiterea mesajului', {
        description: errorMsg,
      })
    } finally {
      setSending(false)
    }
  }, [newMessage, user, userRole, sending, conversationId])

  // verifica daca utilizatorul este receptie sau tehnician
  const isReception = userRole === 'admin' || userRole === 'owner' || userRole === 'member'
  const isTechnician = userRole === 'technician'

  // grupeaza mesajele pe zile pentru o afisare mai clara
  const groupedMessages = useMemo(() => {
    const groups: { date: string; messages: LeadMessage[] }[] = []
    let currentDate = ''
    let currentGroup: LeadMessage[] = []

    // Arată toate mesajele de nivel lead (fără filtrare pe tray)
    const filteredMessages = messages

    filteredMessages.forEach((msg) => {
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
  }, [messages, selectedQuoteId])

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
          <span className="text-sm text-muted-foreground">Se încarcă mesageria...</span>
        </div>
      </div>
    )
  }

  // Dacă nu e conversație, afișează mesaj că nu există
  if (!conversationId) {
    return (
      <div className="mt-4 p-4 rounded-lg border bg-muted/50">
        <div className="flex flex-col items-center justify-center gap-2">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground text-center">
            Nu s-a găsit conversație pentru acest lead
          </span>
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
        <ScrollArea className="h-[700px]">
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
                      // Pentru mesajele proprii folosim userName, pentru altele din cache
                      const senderName = isOwnMessage 
                        ? userName 
                        : (senderNamesCache[msg.sender_id] || 'Utilizator')

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
                              {/* Imagine - afișare directă din content */}
                              {msg.message_type === 'image' ? (
                                <div className="max-w-xs">
                                  <button
                                    type="button"
                                    onClick={() => window.open(msg.content, '_blank')}
                                    className="group relative block"
                                  >
                                    <img
                                      src={msg.content}
                                      alt="message image"
                                      className="max-w-[200px] max-h-[200px] rounded-md object-cover border border-muted"
                                    />
                                    <div className="absolute inset-0 bg-black/50 rounded-md opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                      <span className="text-white text-xs">Click pentru a deschide</span>
                                    </div>
                                  </button>
                                </div>
                              ) : (
                                /* Mesaj text */
                                <div className="text-sm whitespace-pre-wrap break-words leading-relaxed">
                                  {msg.content}
                                </div>
                              )}

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
                  !conversationId
                    ? 'Conversația se va crea când se apasă "Trimite Tăvițe" din Recepție'
                    : isTechnician
                    ? 'Scrie un mesaj pentru recepție...'
                    : 'Scrie un mesaj pentru tehnician...'
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

            {/* Attach Image Button - cu picker pentru imagini din tray curent */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowTrayImagePicker(!showTrayImagePicker)}
                disabled={sending || !conversationId || loading}
                className="p-2 rounded hover:bg-muted/50 transition-colors shrink-0"
                title="Atașează imagini din tăviță"
              >
                <Paperclip className="h-4 w-4" />
              </button>

              {/* Picker pentru imagini din tray curent */}
              {showTrayImagePicker && (
                <div className="absolute bottom-full right-0 mb-2 bg-popover border rounded-xl shadow-xl p-4 z-50 min-w-[320px] max-w-md">
                  {trayImages.length > 0 ? (
                    <>
                      <div className="text-sm font-semibold text-foreground mb-3">
                        Imagini din tăviță ({trayImages.length}):
                      </div>
                      <div className="grid grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-1">
                        {trayImages.map((img) => (
                          <button
                            key={img.id}
                            type="button"
                            onClick={() => handleAttachTrayImage(img.file_path)}
                            className="group relative aspect-square"
                          >
                            <img
                              src={supabase.storage.from('tray_images').getPublicUrl(img.file_path).data.publicUrl}
                              alt="tray image"
                              className="w-full h-full object-cover rounded-lg border-2 border-muted hover:border-primary transition-all hover:scale-105"
                            />
                            <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <span className="text-white text-sm font-medium">+ Atașează</span>
                            </div>
                          </button>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-muted-foreground py-4 text-center">
                      Nu sunt imagini în tăviță
                    </div>
                  )}
                </div>
              )}

              {/* File input pentru upload */}
            </div>

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

