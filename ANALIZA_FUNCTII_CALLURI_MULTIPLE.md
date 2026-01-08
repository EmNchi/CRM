# Analiză Funcții cu Call-uri Multiple

Acest document identifică funcțiile care fac call-uri multiple către baza de date sau API-uri, sau care apelează alte funcții care fac call-uri multiple.

## 📋 Cuprins

1. [Funcții cu Promise.all (call-uri paralele)](#funcții-cu-promiseall)
2. [Funcții cu call-uri secvențiale multiple](#funcții-cu-call-uri-secvențiale)
3. [Funcții care apelează alte funcții cu call-uri multiple](#funcții-care-apelează-alte-funcții)
4. [Funcții de reîncărcare/refresh](#funcții-de-reîncărcare)

---

## 1. Funcții cu Promise.all (call-uri paralele)

### `usePreturiDataLoader.loadAllData()`
**Fișier:** `hooks/usePreturiDataLoader.ts` (linia 87-210)
**Call-uri:** 5 call-uri în paralel + 1 secvențial
**Ce face:**
- Face 5 call-uri în paralel cu `Promise.all`:
  1. `listServices()` - încarcă serviciile
  2. `listParts()` - încarcă piesele
  3. `supabase.from('instruments').select(...)` - încarcă instrumentele
  4. `supabase.from('app_members').select(...)` - încarcă tehnicienii
  5. `getPipelinesWithStages()` - încarcă pipeline-urile și stage-urile
- Apoi face un call secvențial pentru departments: `refreshDepartments()`
- Apoi face un call pentru quotes/trays: `listTraysForServiceFile()` sau `listQuotesForLead()`
- **Total: 7 call-uri** (5 paralele + 2 secvențiale)

**Impact:** Se execută la mount-ul componentei Preturi, încarcă toate datele statice necesare.

---

### `loadStaticData()`
**Fișier:** `lib/supabase/optimized-queries.ts` (linia 217-260)
**Call-uri:** 6 call-uri în paralel
**Ce face:**
- Face 6 call-uri în paralel cu `Promise.all`:
  1. Pipelines (sortate după `sort_order`)
  2. Stages (sortate după `sort_order`)
  3. Departments (sortate după `name`)
  4. Instruments (doar active, sortate după `name`)
  5. Services (doar active, sortate după `name`)
  6. Technicians (din `app_members`, sortate după `name`)
- **Total: 6 call-uri paralele**

**Impact:** Folosit la mount pentru a popula cache-ul cu date statice.

---

### `getTrayWithItems(trayId)`
**Fișier:** `lib/supabase/optimized-queries.ts` (linia 134-179)
**Call-uri:** 3 call-uri în paralel
**Ce face:**
- Face 3 call-uri în paralel cu `Promise.all`:
  1. Tray cu service_file și lead (join-uri)
  2. Tray items cu servicii și departamente (join-uri)
  3. Imagini asociate tăviței
- **Total: 3 call-uri paralele**

**Impact:** Folosit în pagina tehnician pentru a încărca toate datele unei tăvițe.

---

### `getDashboardStats()`
**Fișier:** `lib/supabase/optimized-queries.ts` (linia 188-207)
**Call-uri:** 1 RPC call sau 3 call-uri fallback în paralel
**Ce face:**
- Încearcă să apeleze `get_dashboard_stats` RPC (1 call)
- Dacă eșuează, face 3 call-uri fallback în paralel:
  1. Count de leads
  2. Count de trays
  3. Count de service_files
- **Total: 1 call sau 3 call-uri paralele**

**Impact:** Folosit pentru statisticile dashboard-ului.

---

### `calculateDashboardMetrics(excludePipeline?)`
**Fișier:** `lib/supabase/dashboardOperations.ts` (linia 684-740)
**Call-uri:** 10 call-uri în paralel
**Ce face:**
- Face 10 call-uri în paralel cu `Promise.all`:
  1. `calculateTotalLeads()`
  2. `calculateTotalRevenue()`
  3. `calculateUrgentLeads()`
  4. `calculateNewLeadsToday()`
  5. `calculateLeadsByPipeline()`
  6. `calculateLeadsByStage()`
  7. `calculateRevenueByPipeline()`
  8. `calculatePaymentMethodStats()`
  9. `calculateTotalInLucru()`
  10. `calculateNoDealLeads()`
- **Total: 10 call-uri paralele**

**Impact:** Calculează toate metricile dashboard-ului în paralel pentru performanță maximă.

---

### `calculateVanzariMetrics()`
**Fișier:** `lib/supabase/dashboardOperations.ts` (linia 745-852)
**Call-uri:** Multiple call-uri secvențiale și paralele
**Ce face:**
- 1 call pentru a găsi pipeline-ul Vanzari
- 1 call pentru a obține lead items din pipeline
- 1 call pentru a obține service files pentru leads (`fetchServiceFilesForLeads`)
- 1 call pentru a obține trays pentru service files (`fetchTraysForServiceFiles`)
- 1 call pentru a obține tray items (`fetchTrayItems`)
- Apoi face call-uri pentru a obține servicii și a calcula revenue
- **Total: ~6-8 call-uri** (majoritatea secvențiale)

**Impact:** Calculează metricile specifice pentru pipeline-ul Vanzari.

---

### `getKanbanItems(pipelineId, currentUserId?, isAdminOrOwner?)`
**Fișier:** `lib/supabase/kanban/index.ts` (linia 50-90)
**Call-uri:** Multiple call-uri prin strategii
**Ce face:**
- Apelează `getCachedPipelinesAndStages()` (care poate face call-uri)
- Apelează strategia specifică pipeline-ului care face multiple call-uri:
  - `StandardPipelineStrategy.loadItems()` - pentru Vanzari
  - `DepartmentPipelineStrategy.loadItems()` - pentru Saloane, Horeca, Frizerii, Reparatii
  - `ReceptiePipelineStrategy.loadItems()` - pentru Receptie (foarte complex)
- **Total: Variabil, în funcție de strategie (5-20+ call-uri)**

**Impact:** Funcția principală pentru încărcarea datelor Kanban. Poate face multe call-uri în funcție de pipeline.

---

### `getSingleKanbanItem(type, itemId, pipelineId)`
**Fișier:** `lib/supabase/kanban/index.ts` (linia 95-230)
**Call-uri:** 2-4 call-uri în paralel și secvențial
**Ce face:**
- 1 call pentru a obține pipeline item (`fetchSinglePipelineItem`)
- 1 call pentru a încărca technician cache (`loadTechnicianCache`)
- Apoi, în funcție de tip:
  - Pentru `lead`: 1 call pentru lead + 1 call pentru tags
  - Pentru `service_file`: 1 call pentru service file + 1 call pentru tags
  - Pentru `tray`: 2 call-uri în paralel (tags + tray items)
- **Total: 3-5 call-uri**

**Impact:** Folosit pentru actualizări real-time ale unui singur item Kanban.

---

## 2. Funcții cu call-uri secvențiale multiple

### `saveAllAndLog()`
**Fișier:** `hooks/preturi/usePreturiSaveOperations.ts` (linia 486-646)
**Call-uri:** 13+ call-uri secvențiale
**Ce face:**
1. `saveServiceFileDetails()` - salvează detaliile fișei
2. `saveDeliveryCheckboxes()` - salvează checkbox-urile livrare
3. `ensureTrayExists()` - asigură că există o tăviță
4. `saveBrandSerialData()` - salvează brand/serial (face multiple call-uri interne)
5. `listQuoteItems()` - reîncarcă items-urile după salvare brand/serial
6. `saveUrgentAndSubscription()` - salvează urgent și subscription (face multiple call-uri)
7. `persistAndLogServiceSheet()` - salvează items-urile principale (face multe call-uri interne)
8. `listQuoteItems()` - reîncarcă items-urile din DB
9. `recalcAllSheetsTotal()` - recalculează totalurile (face call-uri pentru fiecare tăviță)
10. `checkServiceFileHasContent()` - verifică dacă fișa are conținut (face call-uri)
11. `deleteServiceFile()` - șterge fișa dacă este goală
- **Total: 13+ call-uri secvențiale** (fiecare poate face și call-uri interne)

**Impact:** Funcția principală de salvare. Face multe call-uri pentru a salva toate datele.

---

### `saveBrandSerialData(quoteId, instrumentId, brandSerialGroups, garantie)`
**Fișier:** `hooks/preturi/usePreturiSaveOperations.ts` (linia 320-481)
**Call-uri:** 5-20+ call-uri în funcție de numărul de brand-uri și servicii
**Ce face:**
1. `listQuoteItems()` - reîncarcă items-urile existente
2. Pentru fiecare brand group:
   - 1 call DELETE pentru brand-urile existente
   - 1 call INSERT pentru noul brand
   - N call-uri INSERT pentru serial numbers (N = numărul de serial numbers)
3. Pentru fiecare serviciu asociat cu instrumentul:
   - 1 call DELETE pentru brand-urile existente
   - 1 call INSERT pentru noul brand
   - N call-uri INSERT pentru serial numbers
- **Total: 5-20+ call-uri** (depinde de numărul de brand-uri și servicii)

**Impact:** Salvează brand-urile și serial numbers pentru instrument și propagă la servicii.

---

### `onAddService()`
**Fișier:** `hooks/preturi/usePreturiItemOperations.ts` (linia 77-784)
**Call-uri:** 3-5 call-uri secvențiale
**Ce face:**
1. Dacă există brand/serial data: `saveBrandSerialData()` (face multiple call-uri)
2. `listQuoteItems()` - reîncarcă items-urile după salvare brand/serial
3. `createTrayItem()` - creează item-ul de serviciu
4. `listQuoteItems()` - reîncarcă items-urile după creare
5. `initializeSnapshot()` - actualizează snapshot-ul
- **Total: 3-5 call-uri** (plus call-urile din `saveBrandSerialData`)

**Impact:** Adaugă un serviciu în tăviță. Reîncarcă items-urile de 2 ori.

---

### `onAddPart()`
**Fișier:** `hooks/preturi/usePreturiItemOperations.ts` (linia 806-1008)
**Call-uri:** 2-3 call-uri secvențiale
**Ce face:**
1. `createTrayItem()` - creează item-ul de piesă
2. `listQuoteItems()` - reîncarcă items-urile după creare
3. `initializeSnapshot()` - actualizează snapshot-ul
- **Total: 2-3 call-uri**

**Impact:** Adaugă o piesă în tăviță. Reîncarcă items-urile o dată.

---

## 3. Funcții care apelează alte funcții cu call-uri multiple

### `recalcAllSheetsTotal(quotes)`
**Fișier:** `hooks/preturi/usePreturiCalculations.ts`
**Call-uri:** N call-uri în paralel (N = numărul de tăvițe)
**Ce face:**
- Pentru fiecare tăviță din `quotes`:
  - Apelează `listQuoteItems()` pentru a obține items-urile
- Face toate call-urile în paralel cu `Promise.all`
- **Total: N call-uri paralele** (N = numărul de tăvițe)

**Impact:** Recalculează totalurile pentru toate tăvițele. Poate face multe call-uri dacă sunt multe tăvițe.

---

### `loadTraysDetails(fisaId)`
**Fișier:** `hooks/leadDetails/useLeadDetailsDataLoader.ts` (linia 428-553)
**Call-uri:** N call-uri în paralel (N = numărul de tăvițe)
**Ce face:**
- Obține toate tăvițele pentru fișă
- Pentru fiecare tăviță, face un call `listQuoteItems()` în paralel cu `Promise.all`
- Calculează totalurile pentru fiecare tăviță
- **Total: N call-uri paralele** (N = numărul de tăvițe)

**Impact:** Încarcă detaliile și totalurile pentru toate tăvițele dintr-o fișă.

---

### `handleRefresh()` (Dashboard)
**Fișier:** `app/(crm)/dashboard/page.tsx` (linia 44-57)
**Call-uri:** 2 call-uri secvențiale
**Ce face:**
1. `refresh()` - reîncarcă datele Kanban (face multe call-uri interne)
2. `calculateDashboardMetrics()` - recalculează metricile (face 10 call-uri paralele)
- **Total: 2 call-uri principale** (care fac multe call-uri interne)

**Impact:** Reîncarcă complet dashboard-ul.

---

## 4. Funcții de reîncărcare/refresh

### `refresh()` (useKanbanData)
**Fișier:** `hooks/useKanbanData.ts`
**Call-uri:** Multiple call-uri prin `getKanbanItems()`
**Ce face:**
- Apelează `getKanbanItems()` care face multe call-uri în funcție de strategie
- **Total: Variabil** (5-20+ call-uri în funcție de pipeline)

**Impact:** Reîncarcă toate datele Kanban pentru pipeline-ul curent.

---

### `populateInstrumentFormFromItems(items, instrumentId, forceReload)`
**Fișier:** `hooks/preturi/usePreturiFormOperations.ts` (linia 49-520)
**Call-uri:** 0 call-uri directe, dar procesează date existente
**Ce face:**
- Nu face call-uri directe, dar procesează items-urile existente
- Poate declanșa reîncărcări care fac call-uri
- **Total: 0 call-uri directe**

**Impact:** Populează formularul instrumentului cu datele din items. Nu face call-uri directe.

---

## 📊 Rezumat

### Funcții cu cele mai multe call-uri:

1. **`saveAllAndLog()`** - 13+ call-uri secvențiale
2. **`getKanbanItems()`** - 5-20+ call-uri (variabil)
3. **`saveBrandSerialData()`** - 5-20+ call-uri (depinde de date)
4. **`calculateDashboardMetrics()`** - 10 call-uri paralele
5. **`recalcAllSheetsTotal()`** - N call-uri paralele (N = numărul de tăvițe)
6. **`loadTraysDetails()`** - N call-uri paralele (N = numărul de tăvițe)
7. **`usePreturiDataLoader.loadAllData()`** - 7 call-uri (5 paralele + 2 secvențiale)

### Recomandări pentru optimizare:

1. **Batch operations** - Grupează operațiile similare (ex: toate DELETE-urile, apoi toate INSERT-urile)
2. **Cache** - Folosește cache pentru date statice (pipelines, stages, departments)
3. **Debouncing** - Debounce pentru funcțiile de refresh/reload
4. **Lazy loading** - Încarcă datele doar când sunt necesare
5. **Optimistic updates** - Actualizează UI-ul imediat, apoi sincronizează cu serverul

---

**Data analizei:** 2024-12-19
**Versiune cod:** Current



