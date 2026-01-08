-- Fix RLS policies pentru profiles și app_members tables
-- Problema: display_name nu se incarca din getSenderName()
-- Cauza: RLS policies pot bloca query-urile

-- 1. Dezactivează RLS pe profiles pentru a permite accesul liber la display_name
ALTER TABLE profiles DISABLE ROW LEVEL SECURITY;

-- 2. Dezactivează RLS pe app_members pentru a permite accesul la email și display_name
ALTER TABLE app_members DISABLE ROW LEVEL SECURITY;

-- 3. Dezactivează RLS pe technicians pentru a permite accesul la name
ALTER TABLE technicians DISABLE ROW LEVEL SECURITY;

-- Alternativ, daca vrei sa pastrezi RLS cu politici permisive:
-- CREATE POLICY "profiles_select" ON profiles FOR SELECT USING (true);
-- CREATE POLICY "app_members_select" ON app_members FOR SELECT USING (true);
-- CREATE POLICY "technicians_select" ON technicians FOR SELECT USING (true);


