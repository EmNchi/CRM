# Plan de Acțiuni pentru Reducerea Call-urilor

## 🎯 Obiectiv
Reducerea numărului de call-uri către baza de date prin optimizări, batch operations, caching și refactorizări.

---

## 📊 Prioritizare

### 🔴 PRIORITATE ÎNALTĂ (Impact mare, efort mediu)
1. **`saveAllAndLog()`** - 13+ call-uri secvențiale
2. **`saveBrandSerialData()`** - 5-20+ call-uri
3. **`onAddService()`** - Reîncărcări duplicate

### 🟡 PRIORITATE MEDIE (Impact mediu, efort mic)
4. **`recalcAllSheetsTotal()`** - N call-uri paralele
5. **`loadTraysDetails()`** - N call-uri paralele
6. **`getKanbanItems()`** - 5-20+ call-uri variabile

### 🟢 PRIORITATE SCĂZUTĂ (Impact mic, efort mic)
7. **`usePreturiDataLoader.loadAllData()`** - Deja optimizat cu Promise.all
8. **`calculateDashboardMetrics()`** - Deja optimizat cu Promise.all

---

## 📋 Plan de Acțiuni Detaliat

### Faza 1: Optimizări Critice (Săptămâna 1-2)

#### 1.1. Optimizare `saveBrandSerialData()` - Batch Operations
**Fișier:** `hooks/preturi/usePreturiSaveOperations.ts`
**Problema:** Face DELETE și INSERT individual pentru fiecare brand și serial number.

**Soluție:**
- Grupează toate DELETE-urile într-un singur call (folosind `.in()` pentru multiple IDs)
- Grupează toate INSERT-urile pentru brands într-un singur call
- Grupează toate INSERT-urile pentru serial numbers într-un singur call

**Pași:**
1. Modifică `saveBrandSerialData()` pentru a colecta toate operațiile
2. Face un singur DELETE pentru toate brand-urile vechi
3. Face un singur INSERT pentru toate brand-urile noi
4. Face un singur INSERT pentru toate serial numbers-urile

**Impact:** Reducere de la 5-20+ call-uri la 3-5 call-uri
**Dificultate:** ⭐⭐ (Medie)

**Cod estimat:**
```typescript
// În loc de:
for (const group of filteredGroups) {
  await supabase.from('tray_item_brands').delete().eq('tray_item_id', existingItem.id)
  await supabase.from('tray_item_brands').insert([...])
  await supabase.from('tray_item_brand_serials').insert([...])
}

// Facem:
// 1. DELETE toate brand-urile vechi dintr-un singur call
await supabase.from('tray_item_brands').delete().eq('tray_item_id', existingItem.id)

// 2. INSERT toate brand-urile noi dintr-un singur call
const brandsToInsert = filteredGroups.map(group => ({
  tray_item_id: existingItem.id,
  brand: group.brand,
  garantie: group.garantie
}))
await supabase.from('tray_item_brands').insert(brandsToInsert).select()

// 3. INSERT toate serial numbers-urile dintr-un singur call
const serialsToInsert = filteredGroups.flatMap((group, idx) => 
  group.serialNumbers.map(sn => ({
    brand_id: brandsToInsert[idx].id,
    serial_number: sn
  }))
)
await supabase.from('tray_item_brand_serials').insert(serialsToInsert)
```

---

#### 1.2. Eliminare Reîncărcări Duplicate în `onAddService()`
**Fișier:** `hooks/preturi/usePreturiItemOperations.ts`
**Problema:** Reîncarcă items-urile de 2 ori: după `saveBrandSerialData()` și după `createTrayItem()`.

**Soluție:**
- Elimină prima reîncărcare (după `saveBrandSerialData()`)
- Folosește doar reîncărcarea finală (după `createTrayItem()`)
- Sau folosește datele returnate de `createTrayItem()` pentru a actualiza state-ul

**Pași:**
1. Elimină `listQuoteItems()` după `saveBrandSerialData()`
2. Folosește doar reîncărcarea finală după `createTrayItem()`
3. Sau actualizează state-ul cu item-ul returnat de `createTrayItem()`

**Impact:** Reducere de la 3-5 call-uri la 2-3 call-uri
**Dificultate:** ⭐ (Ușor)

**Cod estimat:**
```typescript
// În loc de:
await saveBrandSerialData(...)
const newItems = await listQuoteItems(...) // ❌ ELIMINĂ
setItems(newItems)

// Apoi:
await createTrayItem(...)
const newItems2 = await listQuoteItems(...) // ✅ PĂSTREAZĂ DOAR ACESTA
setItems(newItems2)

// Facem:
await saveBrandSerialData(...)
// Nu mai reîncărcăm aici

await createTrayItem(...)
const newItems = await listQuoteItems(...) // Reîncărcare o singură dată
setItems(newItems)
```

---

#### 1.3. Optimizare `saveAllAndLog()` - Reducere Call-uri Secvențiale
**Fișier:** `hooks/preturi/usePreturiSaveOperations.ts`
**Problema:** Face 13+ call-uri secvențiale care ar putea fi grupate.

**Soluție:**
- Grupează call-urile care nu depind unele de altele
- Folosește `Promise.all()` pentru call-uri independente
- Redu numărul de reîncărcări

**Pași:**
1. Grupează `saveServiceFileDetails()` și `saveDeliveryCheckboxes()` în paralel (dacă nu depind unul de altul)
2. Elimină reîncărcarea dublă de items (după `saveBrandSerialData` și după `persistAndLogServiceSheet`)
3. Folosește doar reîncărcarea finală

**Impact:** Reducere de la 13+ call-uri la 8-10 call-uri
**Dificultate:** ⭐⭐⭐ (Mediu-Avansat)

**Cod estimat:**
```typescript
// În loc de:
await saveServiceFileDetails()
await saveDeliveryCheckboxes()
await ensureTrayExists()
// ...

// Facem:
// Grupează call-urile independente
await Promise.all([
  saveServiceFileDetails(),
  saveDeliveryCheckboxes()
])
const quoteToUse = await ensureTrayExists()
// ...
```

---

### Faza 2: Optimizări Medii (Săptămâna 3-4)

#### 2.1. Cache pentru `recalcAllSheetsTotal()`
**Fișier:** `hooks/preturi/usePreturiCalculations.ts`
**Problema:** Reîncarcă items-urile pentru fiecare tăviță chiar dacă nu s-au schimbat.

**Soluție:**
- Implementează cache pentru items-urile tăvițelor
- Reîncarcă doar tăvițele care s-au modificat
- Folosește `useMemo` sau `useRef` pentru cache

**Pași:**
1. Creează un cache pentru items-urile tăvițelor
2. Verifică dacă tăvița s-a modificat înainte de reîncărcare
3. Reîncarcă doar tăvițele modificate

**Impact:** Reducere de la N call-uri la M call-uri (M < N, unde M = tăvițe modificate)
**Dificultate:** ⭐⭐ (Medie)

**Cod estimat:**
```typescript
const itemsCache = useRef<Map<string, { items: LeadQuoteItem[], timestamp: number }>>(new Map())
const CACHE_DURATION = 5000 // 5 secunde

const recalcAllSheetsTotal = useCallback(async (quotes: LeadQuote[]) => {
  const now = Date.now()
  const quotesToReload = quotes.filter(quote => {
    const cached = itemsCache.current.get(quote.id)
    return !cached || (now - cached.timestamp) > CACHE_DURATION
  })
  
  // Reîncarcă doar tăvițele care nu sunt în cache sau au expirat
  const itemsPromises = quotesToReload.map(q => listQuoteItems(q.id, ...))
  const newItemsArrays = await Promise.all(itemsPromises)
  
  // Actualizează cache-ul
  quotesToReload.forEach((q, idx) => {
    itemsCache.current.set(q.id, { items: newItemsArrays[idx], timestamp: now })
  })
  
  // Folosește items-urile din cache sau cele noi
  const allItems = quotes.map(q => {
    const cached = itemsCache.current.get(q.id)
    return cached ? cached.items : []
  })
  
  // Calculează totalurile...
}, [])
```

---

#### 2.2. Cache pentru `loadTraysDetails()`
**Fișier:** `hooks/leadDetails/useLeadDetailsDataLoader.ts`
**Problema:** Reîncarcă items-urile pentru fiecare tăviță chiar dacă nu s-au schimbat.

**Soluție:**
- Similar cu `recalcAllSheetsTotal()`, implementează cache
- Reîncarcă doar tăvițele modificate

**Pași:**
1. Creează un cache pentru items-urile tăvițelor
2. Verifică dacă tăvița s-a modificat
3. Reîncarcă doar tăvițele modificate

**Impact:** Reducere de la N call-uri la M call-uri (M < N)
**Dificultate:** ⭐⭐ (Medie)

---

#### 2.3. Debouncing pentru Refresh Operations
**Fișier:** `hooks/useKanbanData.ts`, `app/(crm)/dashboard/page.tsx`
**Problema:** Refresh-urile se pot declanșa de multiple ori rapid.

**Soluție:**
- Implementează debouncing pentru funcțiile de refresh
- Previne multiple refresh-uri în același timp

**Pași:**
1. Adaugă debouncing la `refresh()` din `useKanbanData`
2. Adaugă debouncing la `handleRefresh()` din Dashboard
3. Folosește `useRef` pentru a preveni refresh-uri simultane

**Impact:** Reducere a numărului de refresh-uri duplicate
**Dificultate:** ⭐ (Ușor)

**Cod estimat:**
```typescript
const refreshDebounced = useMemo(
  () => debounce(async () => {
    await refresh()
  }, 500),
  [refresh]
)

const isRefreshingRef = useRef(false)
const handleRefresh = async () => {
  if (isRefreshingRef.current) return
  isRefreshingRef.current = true
  try {
    await refreshDebounced()
  } finally {
    isRefreshingRef.current = false
  }
}
```

---

### Faza 3: Optimizări Avansate (Săptămâna 5-6)

#### 3.1. Optimistic Updates pentru `onAddService()` și `onAddPart()`
**Fișier:** `hooks/preturi/usePreturiItemOperations.ts`
**Problema:** Așteaptă răspunsul de la server înainte de a actualiza UI-ul.

**Soluție:**
- Actualizează UI-ul imediat cu datele estimate
- Sincronizează cu serverul în background
- Revert în caz de eroare

**Pași:**
1. Actualizează state-ul cu item-ul estimat imediat
2. Trimite request-ul către server în background
3. Actualizează cu datele reale când vine răspunsul
4. Revert dacă apare eroare

**Impact:** UI-ul răspunde mai rapid, dar numărul de call-uri rămâne același
**Dificultate:** ⭐⭐⭐⭐ (Avansat)

---

#### 3.2. Batch Loading pentru Kanban Items
**Fișier:** `lib/supabase/kanban/index.ts`
**Problema:** `getKanbanItems()` face multe call-uri în funcție de strategie.

**Soluție:**
- Optimizează strategiile pentru a face mai puține call-uri
- Folosește batch queries unde este posibil
- Cache pentru date statice (pipelines, stages, technicians)

**Pași:**
1. Analizează fiecare strategie și identifică call-urile redundante
2. Grupează call-urile similare în batch queries
3. Folosește cache pentru date statice

**Impact:** Reducere de la 5-20+ call-uri la 3-10 call-uri
**Dificultate:** ⭐⭐⭐⭐ (Avansat)

---

#### 3.3. Lazy Loading pentru Date Statice
**Fișier:** `hooks/usePreturiDataLoader.ts`
**Problema:** Încarcă toate datele statice la mount, chiar dacă nu sunt toate necesare imediat.

**Soluție:**
- Încarcă doar datele necesare la mount
- Încarcă restul la cerere (lazy loading)

**Pași:**
1. Identifică ce date sunt necesare imediat
2. Încarcă restul doar când sunt necesare
3. Folosește cache pentru datele deja încărcate

**Impact:** Reducere a timpului de încărcare inițial
**Dificultate:** ⭐⭐⭐ (Mediu-Avansat)

---

## 📈 Metrici de Succes

### Înainte de optimizări:
- `saveAllAndLog()`: 13+ call-uri
- `saveBrandSerialData()`: 5-20+ call-uri
- `onAddService()`: 3-5 call-uri
- `recalcAllSheetsTotal()`: N call-uri (N = numărul de tăvițe)

### După optimizări (țintă):
- `saveAllAndLog()`: 8-10 call-uri (reducere ~30%)
- `saveBrandSerialData()`: 3-5 call-uri (reducere ~70%)
- `onAddService()`: 2-3 call-uri (reducere ~40%)
- `recalcAllSheetsTotal()`: M call-uri (M < N, reducere ~50% cu cache)

---

## 🗓️ Timeline

### Săptămâna 1-2: Optimizări Critice
- [ ] 1.1. Optimizare `saveBrandSerialData()` - Batch Operations
- [ ] 1.2. Eliminare Reîncărcări Duplicate în `onAddService()`
- [ ] 1.3. Optimizare `saveAllAndLog()` - Reducere Call-uri Secvențiale

### Săptămâna 3-4: Optimizări Medii
- [ ] 2.1. Cache pentru `recalcAllSheetsTotal()`
- [ ] 2.2. Cache pentru `loadTraysDetails()`
- [ ] 2.3. Debouncing pentru Refresh Operations

### Săptămâna 5-6: Optimizări Avansate
- [ ] 3.1. Optimistic Updates pentru `onAddService()` și `onAddPart()`
- [ ] 3.2. Batch Loading pentru Kanban Items
- [ ] 3.3. Lazy Loading pentru Date Statice

---

## ⚠️ Considerații

### Testare
- Testează fiecare optimizare individual
- Verifică că datele sunt corecte după optimizări
- Monitorizează performanța înainte și după

### Rollback Plan
- Păstrează versiunea veche comentată pentru fiecare optimizare
- Permite rollback rapid dacă apare o problemă

### Monitoring
- Adaugă logging pentru a monitoriza numărul de call-uri
- Măsoară timpul de execuție înainte și după optimizări

---

## 📝 Note

- Prioritizează optimizările cu impact mare și efort mic
- Testează bine înainte de deploy
- Documentează toate modificările
- Comunică schimbările echipei

---

**Data creării planului:** 2024-12-19
**Status:** 🟡 În așteptare de implementare



