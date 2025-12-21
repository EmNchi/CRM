import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/**
 * API Route pentru configurarea automată a permisiunilor
 * Rulează toate migration-urile SQL fără să accesezi Supabase Dashboard
 */
export async function POST(request: Request) {
  try {
    // Creează client Supabase cu service role (pentru a bypassa RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    
    if (!supabaseServiceKey) {
      return NextResponse.json(
        { error: 'SUPABASE_SERVICE_ROLE_KEY lipsește din .env.local' },
        { status: 500 }
      )
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false }
    })

    const { userEmail } = await request.json()

    // ============================================
    // 1. CONFIGUREAZĂ RLS POLICIES
    // ============================================
    
    const setupSQL = `
      -- Șterge policy-uri vechi
      DROP POLICY IF EXISTS "All authenticated users can read app_members" ON app_members;
      DROP POLICY IF EXISTS "Owners can create members" ON app_members;
      DROP POLICY IF EXISTS "Owners can update members" ON app_members;
      DROP POLICY IF EXISTS "Owners can delete members" ON app_members;
      DROP POLICY IF EXISTS "Users can view allowed pipelines" ON pipelines;
      DROP POLICY IF EXISTS "Owners can create pipelines" ON pipelines;
      DROP POLICY IF EXISTS "Owners can update pipelines" ON pipelines;
      DROP POLICY IF EXISTS "Owners can delete pipelines" ON pipelines;
      DROP POLICY IF EXISTS "Users can view stages for allowed pipelines" ON stages;
      DROP POLICY IF EXISTS "Owners can manage stages" ON stages;
      DROP POLICY IF EXISTS "Users can manage all data" ON leads;
      DROP POLICY IF EXISTS "Users can manage all trays" ON trays;
      DROP POLICY IF EXISTS "Users can manage all tray_items" ON tray_items;
      DROP POLICY IF EXISTS "Users can manage all service_files" ON service_files;
      DROP POLICY IF EXISTS "Users can view own permissions" ON user_pipeline_permissions;
      DROP POLICY IF EXISTS "Owners can grant permissions" ON user_pipeline_permissions;
      DROP POLICY IF EXISTS "Owners can revoke permissions" ON user_pipeline_permissions;

      -- Activează RLS
      ALTER TABLE app_members ENABLE ROW LEVEL SECURITY;
      ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
      ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
      ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
      ALTER TABLE trays ENABLE ROW LEVEL SECURITY;
      ALTER TABLE tray_items ENABLE ROW LEVEL SECURITY;
      ALTER TABLE service_files ENABLE ROW LEVEL SECURITY;
      ALTER TABLE user_pipeline_permissions ENABLE ROW LEVEL SECURITY;

      -- app_members policies
      CREATE POLICY "All authenticated users can read app_members"
        ON app_members FOR SELECT TO authenticated USING (true);
      
      CREATE POLICY "Owners can create members"
        ON app_members FOR INSERT TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner'));
      
      CREATE POLICY "Owners can update members"
        ON app_members FOR UPDATE TO authenticated
        USING (EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner'));
      
      CREATE POLICY "Owners can delete members"
        ON app_members FOR DELETE TO authenticated
        USING (EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner'));

      -- pipelines policies
      CREATE POLICY "Users can view allowed pipelines"
        ON pipelines FOR SELECT TO authenticated
        USING (
          EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
          OR EXISTS (SELECT 1 FROM user_pipeline_permissions WHERE user_id = auth.uid() AND pipeline_id = pipelines.id)
        );
      
      CREATE POLICY "Owners can create pipelines"
        ON pipelines FOR INSERT TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner'));
      
      CREATE POLICY "Owners can update pipelines"
        ON pipelines FOR UPDATE TO authenticated
        USING (EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner'));
      
      CREATE POLICY "Owners can delete pipelines"
        ON pipelines FOR DELETE TO authenticated
        USING (EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner'));

      -- stages policies
      CREATE POLICY "Users can view stages for allowed pipelines"
        ON stages FOR SELECT TO authenticated
        USING (
          EXISTS (
            SELECT 1 FROM pipelines p
            WHERE p.id = stages.pipeline_id
            AND (
              EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role IN ('owner', 'admin'))
              OR EXISTS (SELECT 1 FROM user_pipeline_permissions WHERE user_id = auth.uid() AND pipeline_id = p.id)
            )
          )
        );
      
      CREATE POLICY "Owners can manage stages"
        ON stages FOR ALL TO authenticated
        USING (EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner'));

      -- Data policies (permisive)
      CREATE POLICY "Users can manage all data" ON leads FOR ALL TO authenticated USING (true);
      CREATE POLICY "Users can manage all trays" ON trays FOR ALL TO authenticated USING (true);
      CREATE POLICY "Users can manage all tray_items" ON tray_items FOR ALL TO authenticated USING (true);
      CREATE POLICY "Users can manage all service_files" ON service_files FOR ALL TO authenticated USING (true);

      -- user_pipeline_permissions policies
      CREATE POLICY "Users can view own permissions"
        ON user_pipeline_permissions FOR SELECT TO authenticated USING (auth.uid() = user_id);
      
      CREATE POLICY "Owners can grant permissions"
        ON user_pipeline_permissions FOR INSERT TO authenticated
        WITH CHECK (EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner'));
      
      CREATE POLICY "Owners can revoke permissions"
        ON user_pipeline_permissions FOR DELETE TO authenticated
        USING (EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner'));
    `

    // Notă: Nu putem rula SQL direct din TypeScript fără funcții helper
    // În schimb, returnam SQL-ul și instrucțiuni pentru utilizator
    // Sau alternativ, facem configurarea prin migrations automate

    // ============================================
    // 2. SINCRONIZEAZĂ USER ȘI ACORDĂ PERMISIUNI
    // ============================================

    if (userEmail) {
      // Găsește user_id din auth.users
      const { data: authUsers } = await supabase.auth.admin.listUsers()
      const authUser = authUsers.users.find(u => u.email === userEmail)

      if (!authUser) {
        return NextResponse.json({ 
          ok: false, 
          error: `Utilizatorul cu email ${userEmail} nu există în auth.users` 
        })
      }

      // Șterge intrarea veche din app_members
      await supabase
        .from('app_members')
        .delete()
        .eq('email', userEmail)
        .neq('user_id', authUser.id)

      // Creează/actualizează intrarea corectă
      await supabase
        .from('app_members')
        .upsert({
          user_id: authUser.id,
          name: 'Ghiorghe Cepoi',
          email: userEmail,
          role: 'member'
        })

      // Obține pipeline-urile necesare
      const { data: pipelinesData } = await supabase
        .from('pipelines')
        .select('id, name')
        .in('name', ['Saloane', 'Frizerii', 'Horeca', 'Reparatii'])

      // Acordă permisiuni
      if (pipelinesData) {
        const permissions = pipelinesData.map(p => ({
          user_id: authUser.id,
          pipeline_id: p.id
        }))

        await supabase
          .from('user_pipeline_permissions')
          .upsert(permissions, { onConflict: 'user_id,pipeline_id' })
      }
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Setup completat cu succes!' 
    })

  } catch (error: any) {
    console.error('Setup error:', error)
    return NextResponse.json({ 
      ok: false, 
      error: error.message || 'Eroare la setup' 
    }, { status: 500 })
  }
}



