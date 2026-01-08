export interface Pipeline {
    id: string
    name: string
    description: string | null
    position: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Stage {
    id: string
    pipeline_id: string
    name: string
    position: number
    is_active: boolean
    created_at: string
    updated_at: string
}

export interface Lead {
    id: string
    ad_id: string | null
    ad_name: string | null
    adset_id: string | null
    adset_name: string | null
    campaign_id: string | null
    campaign_name: string | null
    form_id: string | null
    lead_id: string | null
    platform: string | null
    page_id: string | null
    page_name: string | null
    form_name: string | null
    full_name: string | null
    email: string | null
    phone_number: string | null
    raw_full_name: string | null
    raw_email: string | null
    raw_phone_number: string | null
    custom_disclaimer_responses: string | null
    partner_name: string | null
    retailer_item_id: string | null
    vehicle: string | null
    form_created_time: string | null
    notes: string | null // Detalii/notițe despre client
    no_deal: boolean | null // Checkbox pentru "No Deal" în Vânzări
    call_back: boolean | null // Checkbox pentru "Call Back" în Vânzări
    nu_raspunde: boolean | null // Checkbox pentru "Nu Raspunde" în Vânzări
    city: string | null // Oraș
    judet: string | null // Județ pentru livrare
    strada: string | null // Stradă și număr pentru livrare
    company_name: string | null // Nume companie
    company_address: string | null // Adresa companiei
    address: string | null // Adresă
    address2: string | null // Adresă 2
    zip: string | null // Cod poștal
    country: string | null // Țară
    // Câmpuri pentru facturare
    billing_nume_prenume: string | null // Nume și prenume pentru facturare
    billing_nume_companie: string | null // Nume companie pentru facturare
    billing_cui: string | null // CUI pentru facturare
    billing_strada: string | null // Stradă pentru facturare
    billing_oras: string | null // Oraș pentru facturare
    billing_judet: string | null // Județ pentru facturare
    billing_cod_postal: string | null // Cod poștal pentru facturare
    created_at: string
    updated_at: string
}

export interface LeadPipeline {
    id: string
    lead_id: string
    pipeline_id: string
    stage_id: string
    assigned_at: string
    updated_at: string
    notes: string | null
}

export interface StageHistory {
    id: string
    lead_id: string
    pipeline_id: string
    from_stage_id: string | null
    to_stage_id: string
    moved_by: string | null
    moved_at: string
    notes: string | null
}

export interface PipelineWithStages extends Pipeline {
    stages: Stage[]
}

export interface LeadWithStage extends Lead {
    stage: string
    stage_id: string
    pipeline_id: string
    assignment_id: string
}

export interface KanbanLead {
    id: string
    name: string
    email: string
    phone: string
    stage: string
    createdAt: string
    campaignName?: string
    adName?: string
    formName?: string
    leadId: string
    stageId: string
    pipelineId: string
    assignmentId: string
    tags?: { id: string; name: string; color: 'green' | 'yellow' | 'red' }[]
    stageMovedAt?: string // data cand lead-ul a fost mutat in stage-ul curent
    technician?: string | null // Tehnicianul atribuit lead-ului
    // Câmpuri pentru quotes (când isQuote = true)
    isQuote?: boolean // true dacă acest card reprezintă o tăviță, nu un lead
    quoteId?: string // ID-ul tăviței (când isQuote = true)
    department?: string // Departamentul tăviței
    leadName?: string // Numele clientului (când isQuote = true)
    // Câmpuri pentru fișe (când isFisa = true)
    isFisa?: boolean // true dacă acest card reprezintă o fișă de serviciu
    fisaId?: string // ID-ul fișei (când isFisa = true)
    // Câmpuri adresă și companie
    city?: string | null
    company_name?: string | null
    company_address?: string | null
    address?: string | null
    address2?: string | null
    zip?: string | null
    strada?: string | null
    judet?: string | null
}

export interface KanbanQuote {
    id: string // quote id
    name: string // quote name (ex: "Tăbliță 1")
    leadId: string
    leadName: string // lead full_name
    leadEmail: string | null
    leadPhone: string | null
    stage: string
    stageId: string
    pipelineId: string
    createdAt: string
    department: string // departamentul tăviței
    technician_id: string | null // Tehnicianul atribuit tăviței (din items)
    technician?: string | null // Numele tehnicianului
}

export const STAGE_COLORS: Record<string, string> = {
    'LEAD VECHI': '#6B7280',
    'LEAD NOU': '#10B981',
    'MESSAGES': '#3B82F6',
    'NU RASPUNDE': '#F59E0B',
    'NO DEAL': '#EF4444',
    'CURIER TRIMIS': '#22C55E'
}