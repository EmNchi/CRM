-- ============================================
-- SQL Queries pentru verificarea funcționalității
-- mutării fișelor în pipeline-urile Curier/Receptie
-- ============================================

-- 1. Verifică pipeline-urile Curier și Receptie
SELECT 
  id,
  name,
  is_active,
  position
FROM pipelines
WHERE name ILIKE '%curier%' OR name ILIKE '%receptie%'
ORDER BY name;

-- 2. Verifică stage-urile din pipeline-ul Curier
SELECT 
  s.id,
  s.name,
  s.pipeline_id,
  p.name as pipeline_name,
  s.is_active,
  s.position
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
WHERE p.name ILIKE '%curier%'
ORDER BY s.position;

-- 3. Verifică stage-urile din pipeline-ul Receptie
SELECT 
  s.id,
  s.name,
  s.pipeline_id,
  p.name as pipeline_name,
  s.is_active,
  s.position
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
WHERE p.name ILIKE '%receptie%'
ORDER BY s.position;

-- 4. Verifică fișele de serviciu cu checkbox-urile bifate
SELECT 
  sf.id,
  sf.number,
  sf.office_direct,
  sf.curier_trimis,
  sf.created_at,
  l.full_name as client_name,
  l.phone_number
FROM service_files sf
LEFT JOIN leads l ON sf.lead_id = l.id
WHERE sf.office_direct = true OR sf.curier_trimis = true
ORDER BY sf.created_at DESC
LIMIT 20;

-- 5. Verifică unde sunt fișele de serviciu în pipeline-uri
SELECT 
  pi.id as pipeline_item_id,
  pi.type,
  pi.item_id as service_file_id,
  sf.number as service_file_number,
  p.name as pipeline_name,
  s.name as stage_name,
  pi.created_at,
  pi.updated_at
FROM pipeline_items pi
JOIN service_files sf ON pi.item_id = sf.id
JOIN pipelines p ON pi.pipeline_id = p.id
LEFT JOIN stages s ON pi.stage_id = s.id
WHERE pi.type = 'service_file'
  AND (p.name ILIKE '%curier%' OR p.name ILIKE '%receptie%')
ORDER BY pi.updated_at DESC
LIMIT 20;

-- 6. Verifică o fișă specifică și unde se află în pipeline-uri
-- (înlocuiește 'FISA_ID_AICI' cu ID-ul real al fișei)
SELECT 
  sf.id,
  sf.number,
  sf.office_direct,
  sf.curier_trimis,
  pi.id as pipeline_item_id,
  p.name as pipeline_name,
  s.name as stage_name,
  pi.updated_at as moved_at
FROM service_files sf
LEFT JOIN pipeline_items pi ON pi.item_id = sf.id AND pi.type = 'service_file'
LEFT JOIN pipelines p ON pi.pipeline_id = p.id
LEFT JOIN stages s ON pi.stage_id = s.id
WHERE sf.id = 'FISA_ID_AICI'; -- Înlocuiește cu ID-ul real

-- 7. Verifică toate fișele de serviciu și statusul lor în pipeline-uri
SELECT 
  sf.id,
  sf.number,
  sf.office_direct,
  sf.curier_trimis,
  CASE 
    WHEN pi.id IS NULL THEN 'Nu este în niciun pipeline'
    ELSE CONCAT(p.name, ' - ', s.name)
  END as current_location,
  pi.updated_at as last_moved_at
FROM service_files sf
LEFT JOIN pipeline_items pi ON pi.item_id = sf.id AND pi.type = 'service_file'
LEFT JOIN pipelines p ON pi.pipeline_id = p.id
LEFT JOIN stages s ON pi.stage_id = s.id
ORDER BY sf.created_at DESC
LIMIT 50;

-- 8. Verifică dacă există stage-ul "CURIER TRIMIS" în pipeline-ul Curier
SELECT 
  s.id,
  s.name,
  p.name as pipeline_name,
  s.is_active
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
WHERE p.name ILIKE '%curier%'
  AND s.name ILIKE '%curier%trimis%'
ORDER BY s.name;

-- 9. Verifică dacă există stage-ul "OFFICE DIRECT" în pipeline-ul Receptie
SELECT 
  s.id,
  s.name,
  p.name as pipeline_name,
  s.is_active
FROM stages s
JOIN pipelines p ON s.pipeline_id = p.id
WHERE p.name ILIKE '%receptie%'
  AND s.name ILIKE '%office%direct%'
ORDER BY s.name;

-- 10. Verifică toate stage-urile active din pipeline-urile Curier și Receptie
SELECT 
  p.name as pipeline_name,
  s.name as stage_name,
  s.id as stage_id,
  s.is_active,
  COUNT(pi.id) as items_count
FROM pipelines p
JOIN stages s ON s.pipeline_id = p.id
LEFT JOIN pipeline_items pi ON pi.stage_id = s.id AND pi.pipeline_id = p.id
WHERE (p.name ILIKE '%curier%' OR p.name ILIKE '%receptie%')
  AND s.is_active = true
GROUP BY p.name, s.name, s.id, s.is_active
ORDER BY p.name, s.position;

-- 11. Verifică EXACT denumirile stage-urilor pentru a vedea dacă corespund cu căutarea
SELECT 
  p.name as pipeline_name,
  s.name as stage_name,
  s.name ILIKE '%office%direct%' as matches_office_direct,
  s.name ILIKE '%curier%trimis%' as matches_curier_trimis,
  LOWER(s.name) as stage_name_lowercase
FROM pipelines p
JOIN stages s ON s.pipeline_id = p.id
WHERE (p.name ILIKE '%curier%' OR p.name ILIKE '%receptie%')
  AND s.is_active = true
ORDER BY p.name, s.name;

-- 12. Verifică o fișă specifică și în ce stage se află efectiv
-- (înlocuiește 'FISA_ID_AICI' cu ID-ul real al fișei)
SELECT 
  sf.id as service_file_id,
  sf.number,
  sf.office_direct,
  sf.curier_trimis,
  pi.stage_id,
  s.name as current_stage_name,
  p.name as current_pipeline_name,
  pi.updated_at as last_moved_at
FROM service_files sf
LEFT JOIN pipeline_items pi ON pi.item_id = sf.id AND pi.type = 'service_file'
LEFT JOIN stages s ON pi.stage_id = s.id
LEFT JOIN pipelines p ON pi.pipeline_id = p.id
WHERE sf.id = 'FISA_ID_AICI'  -- Înlocuiește cu ID-ul real
ORDER BY pi.updated_at DESC;

