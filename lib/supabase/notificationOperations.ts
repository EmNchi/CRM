'use client'

import { supabaseBrowser } from './supabaseClient'

const supabase = supabaseBrowser()

// =============================================================================
// TYPES
// =============================================================================

export interface Notification {
  id: string
  user_id: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
  read: boolean
  created_at: string
  read_at?: string | null
}

export type NotificationType = 
  | 'tray_received'       // Tăviță primită pentru procesare
  | 'tray_completed'      // Tăviță finalizată de tehnician
  | 'tray_urgent'         // Tăviță urgentă
  | 'service_assigned'    // Serviciu atribuit tehnicianului
  | 'message_received'    // Mesaj nou în conversație
  | 'system'              // Notificare de sistem

export interface CreateNotificationParams {
  userId: string
  type: NotificationType
  title: string
  message: string
  data?: Record<string, any>
}

// =============================================================================
// CREATE NOTIFICATION
// =============================================================================

/**
 * Creează o notificare pentru un utilizator
 */
export async function createNotification(params: CreateNotificationParams): Promise<{ success: boolean; error?: string; notification?: Notification }> {
  try {
    const { data, error } = await supabase
      .from('notifications')
      .insert({
        user_id: params.userId,
        type: params.type,
        title: params.title,
        message: params.message,
        data: params.data || {},
        read: false,
      })
      .select()
      .single()
    
    if (error) {
      console.error('[createNotification] Error:', error.message)
      return { success: false, error: error.message }
    }
    
    return { success: true, notification: data }
  } catch (err: any) {
    console.error('[createNotification] Exception:', err.message)
    return { success: false, error: err.message }
  }
}

// =============================================================================
// NOTIFY TECHNICIANS ABOUT NEW TRAYS
// =============================================================================

/**
 * Notifică toți tehnicienii din departamentele relevante despre tăvițele noi
 * @param trays - Lista de tăvițe trimise
 * @param departmentTechnicianMap - Map de department_id -> technician_ids
 */
export async function notifyTechniciansAboutNewTrays(params: {
  trays: Array<{
    id: string
    number: string
    size: string
    department_id?: string
    instrument_count?: number
  }>
  serviceFileId: string
  clientName?: string
}): Promise<{ success: boolean; notifiedCount: number; errors: string[] }> {
  try {
    const errors: string[] = []
    let notifiedCount = 0
    
    // 1. Obține toate department_id-urile unice din tăvițe
    const departmentIds = new Set<string>()
    
    // Obține items-urile din tăvițe pentru a determina departamentele
    for (const tray of params.trays) {
      const { data: items } = await supabase
        .from('tray_items')
        .select('department_id')
        .eq('tray_id', tray.id)
        .not('department_id', 'is', null)
      
      items?.forEach(item => {
        if (item.department_id) departmentIds.add(item.department_id)
      })
    }
    
    if (departmentIds.size === 0) {
      return { success: true, notifiedCount: 0, errors: ['Nu s-au găsit departamente pentru tăvițe'] }
    }
    
    // 2. Obține tehnicienii din fiecare departament (membri cu rol 'technician' sau 'member' în pipeline-ul departamentului)
    const { data: pipelines } = await supabase
      .from('pipelines')
      .select('id, name, department_id')
      .in('department_id', Array.from(departmentIds))
    
    if (!pipelines || pipelines.length === 0) {
      return { success: true, notifiedCount: 0, errors: ['Nu s-au găsit pipeline-uri pentru departamente'] }
    }
    
    // 3. Obține membrii cu acces la aceste pipeline-uri
    const pipelineIds = pipelines.map(p => p.id)
    
    const { data: permissions } = await supabase
      .from('pipeline_permissions')
      .select('user_id, pipeline_id')
      .in('pipeline_id', pipelineIds)
    
    if (!permissions || permissions.length === 0) {
      return { success: true, notifiedCount: 0, errors: ['Nu s-au găsit tehnicieni pentru departamente'] }
    }
    
    // 4. Creează notificări pentru fiecare tehnician
    const uniqueUserIds = [...new Set(permissions.map(p => p.user_id))]
    
    for (const userId of uniqueUserIds) {
      // Determină ce tăvițe sunt relevante pentru acest utilizator
      const userPipelines = permissions.filter(p => p.user_id === userId).map(p => p.pipeline_id)
      const userDepartments = pipelines.filter(p => userPipelines.includes(p.id)).map(p => p.department_id)
      
      // Găsește tăvițele relevante (cele care au instrumente în departamentele utilizatorului)
      const relevantTrays: string[] = []
      for (const tray of params.trays) {
        const { data: items } = await supabase
          .from('tray_items')
          .select('department_id')
          .eq('tray_id', tray.id)
          .in('department_id', userDepartments)
          .limit(1)
        
        if (items && items.length > 0) {
          relevantTrays.push(tray.number || tray.id)
        }
      }
      
      if (relevantTrays.length === 0) continue
      
      const result = await createNotification({
        userId,
        type: 'tray_received',
        title: '🔔 Tăvițe noi pentru procesare',
        message: `Ai primit ${relevantTrays.length} tăviț${relevantTrays.length === 1 ? 'ă' : 'e'} noi pentru procesare${params.clientName ? ` de la ${params.clientName}` : ''}: ${relevantTrays.join(', ')}`,
        data: {
          trayNumbers: relevantTrays,
          serviceFileId: params.serviceFileId,
          clientName: params.clientName,
          receivedAt: new Date().toISOString(),
        }
      })
      
      if (result.success) {
        notifiedCount++
      } else {
        errors.push(`Eroare notificare user ${userId}: ${result.error}`)
      }
    }
    
    return { success: true, notifiedCount, errors }
  } catch (err: any) {
    console.error('[notifyTechniciansAboutNewTrays] Exception:', err.message)
    return { success: false, notifiedCount: 0, errors: [err.message] }
  }
}

// =============================================================================
// GET USER NOTIFICATIONS
// =============================================================================

/**
 * Obține notificările pentru utilizatorul curent
 */
export async function getUserNotifications(params?: {
  unreadOnly?: boolean
  limit?: number
}): Promise<{ notifications: Notification[]; error?: string }> {
  try {
    
    let query = supabase
      .from('notifications')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (params?.unreadOnly) {
      query = query.eq('read', false)
    }
    
    if (params?.limit) {
      query = query.limit(params.limit)
    }
    
    const { data, error } = await query
    
    if (error) {
      return { notifications: [], error: error.message }
    }
    
    return { notifications: data || [] }
  } catch (err: any) {
    return { notifications: [], error: err.message }
  }
}

// =============================================================================
// MARK NOTIFICATION AS READ
// =============================================================================

/**
 * Marchează o notificare ca citită
 */
export async function markNotificationAsRead(notificationId: string): Promise<{ success: boolean; error?: string }> {
  try {
    
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

/**
 * Marchează toate notificările ca citite pentru utilizatorul curent
 */
export async function markAllNotificationsAsRead(): Promise<{ success: boolean; error?: string }> {
  try {
    
    const { error } = await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('read', false)
    
    if (error) {
      return { success: false, error: error.message }
    }
    
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

// =============================================================================
// GET UNREAD COUNT
// =============================================================================

/**
 * Obține numărul de notificări necitite
 */
export async function getUnreadNotificationCount(): Promise<{ count: number; error?: string }> {
  try {
    
    const { count, error } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('read', false)
    
    if (error) {
      return { count: 0, error: error.message }
    }
    
    return { count: count || 0 }
  } catch (err: any) {
    return { count: 0, error: err.message }
  }
}

