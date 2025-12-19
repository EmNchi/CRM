/**
 * ============================================
 * SETUP COMPLET: Sistem Permisiuni
 * ============================================
 * 
 * Rulează acest script în Supabase Dashboard → SQL Editor
 */

-- ============================================
-- 1. CURĂȚARE: Șterge policy-uri vechi
-- ============================================

-- app_members
DROP POLICY IF EXISTS "Users can view their own member data" ON app_members;
DROP POLICY IF EXISTS "Authenticated users can view all members" ON app_members;
DROP POLICY IF EXISTS "All authenticated users can read app_members" ON app_members;
DROP POLICY IF EXISTS "Users can view all members" ON app_members;
DROP POLICY IF EXISTS "app_members_read_own" ON app_members;
DROP POLICY IF EXISTS "app_members_self" ON app_members;
DROP POLICY IF EXISTS "Owners can create members" ON app_members;
DROP POLICY IF EXISTS "Owners can update members" ON app_members;
DROP POLICY IF EXISTS "Owners can delete members" ON app_members;

-- pipelines
DROP POLICY IF EXISTS "Users can view pipelines they have access to" ON pipelines;
DROP POLICY IF EXISTS "Users can view allowed pipelines" ON pipelines;
DROP POLICY IF EXISTS "Owners can create pipelines" ON pipelines;
DROP POLICY IF EXISTS "Owners can update pipelines" ON pipelines;
DROP POLICY IF EXISTS "Owners can delete pipelines" ON pipelines;

-- stages
DROP POLICY IF EXISTS "Users can view stages for allowed pipelines" ON stages;
DROP POLICY IF EXISTS "Owners can manage stages" ON stages;

-- leads, trays, tray_items, service_files
DROP POLICY IF EXISTS "Users can manage all data" ON leads;
DROP POLICY IF EXISTS "Users can manage all trays" ON trays;
DROP POLICY IF EXISTS "Users can manage all tray_items" ON tray_items;
DROP POLICY IF EXISTS "Users can manage all service_files" ON service_files;

-- user_pipeline_permissions
DROP POLICY IF EXISTS "Users can view own permissions" ON user_pipeline_permissions;
DROP POLICY IF EXISTS "Owners can grant permissions" ON user_pipeline_permissions;
DROP POLICY IF EXISTS "Owners can revoke permissions" ON user_pipeline_permissions;

-- ============================================
-- 2. ACTIVARE RLS
-- ============================================

ALTER TABLE app_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipelines ENABLE ROW LEVEL SECURITY;
ALTER TABLE stages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE trays ENABLE ROW LEVEL SECURITY;
ALTER TABLE tray_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pipeline_permissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. app_members POLICIES
-- ============================================

CREATE POLICY "All authenticated users can read app_members"
  ON app_members FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Owners can create members"
  ON app_members FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can update members"
  ON app_members FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can delete members"
  ON app_members FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ============================================
-- 4. pipelines POLICIES
-- ============================================

CREATE POLICY "Users can view allowed pipelines"
  ON pipelines FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM app_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
    OR
    EXISTS (
      SELECT 1 FROM user_pipeline_permissions
      WHERE user_id = auth.uid() AND pipeline_id = pipelines.id
    )
  );

CREATE POLICY "Owners can create pipelines"
  ON pipelines FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can update pipelines"
  ON pipelines FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can delete pipelines"
  ON pipelines FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ============================================
-- 5. stages POLICIES
-- ============================================

CREATE POLICY "Users can view stages for allowed pipelines"
  ON stages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM pipelines p
      WHERE p.id = stages.pipeline_id
      AND (
        EXISTS (
          SELECT 1 FROM app_members
          WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
        )
        OR
        EXISTS (
          SELECT 1 FROM user_pipeline_permissions
          WHERE user_id = auth.uid() AND pipeline_id = p.id
        )
      )
    )
  );

CREATE POLICY "Owners can manage stages"
  ON stages FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner')
  );

-- ============================================
-- 6. leads, trays, tray_items, service_files POLICIES
-- ============================================

CREATE POLICY "Users can manage all data"
  ON leads FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can manage all trays"
  ON trays FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can manage all tray_items"
  ON tray_items FOR ALL TO authenticated USING (true);

CREATE POLICY "Users can manage all service_files"
  ON service_files FOR ALL TO authenticated USING (true);

-- ============================================
-- 7. user_pipeline_permissions POLICIES
-- ============================================

CREATE POLICY "Users can view own permissions"
  ON user_pipeline_permissions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Owners can grant permissions"
  ON user_pipeline_permissions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "Owners can revoke permissions"
  ON user_pipeline_permissions FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM app_members WHERE user_id = auth.uid() AND role = 'owner')
  );



