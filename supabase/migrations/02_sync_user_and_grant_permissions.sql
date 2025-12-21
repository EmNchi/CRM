/**
 * ============================================
 * SINCRONIZARE: User ID și Permisiuni
 * ============================================
 * 
 * Găsește user_id corect din auth.users și acordă permisiuni
 * Rulează după 01_setup_permissions.sql
 */

-- 1. Găsește user_id din auth.users pentru ghiorghe@tehnic.com
DO $$
DECLARE
  auth_user_id UUID;
  auth_email TEXT;
BEGIN
  -- Găsește user_id-ul din auth.users
  SELECT id, email INTO auth_user_id, auth_email
  FROM auth.users
  WHERE email = 'ghiorghe@tehnic.com'
  LIMIT 1;
  
  IF auth_user_id IS NULL THEN
    RAISE EXCEPTION '❌ Utilizatorul cu email ghiorghe@tehnic.com nu există în auth.users!';
  END IF;
  
  RAISE NOTICE 'User_id găsit în auth.users: %', auth_user_id;
  
  -- Șterge intrarea veche din app_members (dacă există cu alt user_id)
  DELETE FROM app_members
  WHERE email = 'ghiorghe@tehnic.com' 
  AND user_id != auth_user_id;
  
  -- Creează sau actualizează intrarea corectă
  INSERT INTO app_members (user_id, name, email, role)
  VALUES (
    auth_user_id,
    'Ghiorghe Cepoi',
    auth_email,
    'member'
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    name = EXCLUDED.name,
    email = EXCLUDED.email,
    role = EXCLUDED.role;
  
  RAISE NOTICE '✅ app_members actualizat cu user_id corect';
  
  -- Acordă permisiuni pentru pipeline-uri
  INSERT INTO user_pipeline_permissions (user_id, pipeline_id)
  SELECT 
    auth_user_id,
    p.id
  FROM pipelines p
  WHERE LOWER(TRIM(p.name)) IN ('saloane', 'frizerii', 'horeca', 'reparatii')
  ON CONFLICT (user_id, pipeline_id) DO NOTHING;
  
  RAISE NOTICE '✅ Permisiuni acordate pentru: Saloane, Frizerii, Horeca, Reparatii';
END $$;

-- 2. Verifică rezultatul
SELECT 
  am.user_id,
  am.name,
  am.email,
  am.role,
  p.name as pipeline_name,
  '✅' as status
FROM app_members am
LEFT JOIN user_pipeline_permissions upp ON upp.user_id = am.user_id
LEFT JOIN pipelines p ON p.id = upp.pipeline_id
WHERE am.email = 'ghiorghe@tehnic.com'
ORDER BY p.name;



