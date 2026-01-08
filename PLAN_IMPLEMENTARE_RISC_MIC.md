# Plan de Implementare - Optimizări cu Risc Mic

## 🎯 Obiectiv
Implementarea optimizărilor cu risc mic pentru reducerea numărului de call-uri către baza de date.

---

## 📋 Optimizări de Implementat

### 1. Eliminare Reîncărcări Duplicate în `onAddService()` ⭐⭐⭐
### 2. Cache pentru `recalcAllSheetsTotal()` ⭐⭐
### 3. Debouncing pentru Refresh Operations ⭐

---

## 🔍 Analiză Detașată - Fiecare Optimizare

---

## 1. Eliminare Reîncărcări Duplicate în `onAddService()`

### 📁 Fișiere de Modificat

#### Fișier Principal:
- **`hooks/preturi/usePreturiItemOperations.ts`**
  - Funcție: `onAddService()` (linia ~77-784)
  - Modificare: Elimină `listQuoteItems()` după `saveBrandSerialData()` (linia ~318)

### 🔗 Dependențe și Impact

#### Fișiere care folosesc `onAddService`:
1. **`hooks/usePreturiBusiness.ts`**
   - Linia ~616-618: Wrapper care apelează `itemOperations.onAddService`
   - Impact: ✅ Niciun impact - doar pasare prin
   - Verificare necesară: ✅ Nu necesită modificări

2. **`components/preturi/core/PreturiMain.tsx`**
   - Folosește `onAddService` din `usePreturiBusiness`
   - Impact: ✅ Niciun impact - doar pasare prin
   - Verificare necesară: ✅ Nu necesită modificări

3. **`components/preturi/core/PreturiOrchestrator.tsx`**
   - Folosește `onAddService` din `usePreturiBusiness`
   - Impact: ✅ Niciun impact - doar pasare prin
   - Verificare necesară: ✅ Nu necesită modificări

#### Funcții dependente:
- `saveBrandSerialData()` - returnează void, nu returnează date
- `createTrayItem()` - returnează item-ul creat
- `listQuoteItems()` - folosit pentru reîncărcare

### 📊 Analiză Cod Actual

**Situația actuală în `onAddService()`:**

```typescript
// Linia ~193-333: Salvează brand/serial data
if (hasValidBrandSerialData && selectedQuote && !isAscutitInstrument) {
  try {
    // ... salvare brand/serial ...
    
    if (existingItem && existingItem.id) {
      // ... salvare brand/serial pentru item existent ...
    } else {
      // ... creare item nou cu brand/serial ...
      
      // ❌ REÎNCĂRCARE 1: După salvare brand/serial
      const newItems = await listQuoteItems(selectedQuote.id, services, instruments, pipelinesWithIds)
      setItems(newItems)
      if (newItems.length > 0 && initializeSnapshot) {
        initializeSnapshot(newItems)
      }
    }
  } catch (error) {
    // ...
  }
}

// Linia ~340-784: Adaugă serviciul
// ... logică pentru adăugare serviciu ...

// ❌ REÎNCĂRCARE 2: După creare serviciu
const newItems = await listQuoteItems(selectedQuote.id, services, instruments, pipelinesWithIds)
setItems(newItems)
if (newItems.length > 0 && initializeSnapshot) {
  initializeSnapshot(newItems)
}
```

**Problema:** Reîncarcă items-urile de 2 ori:
1. După `saveBrandSerialData()` (doar dacă se creează item nou pentru instrument)
2. După `createTrayItem()` pentru serviciu

### ✅ Plan de Implementare

#### Pasul 1: Analiză Dependențe
- [x] Identificat fișierul principal: `usePreturiItemOperations.ts`
- [x] Identificat dependențele: `usePreturiBusiness.ts`, `PreturiMain.tsx`, `PreturiOrchestrator.tsx`
- [x] Verificat că nu există dependențe ascunse

#### Pasul 2: Modificare Cod
**Fișier:** `hooks/preturi/usePreturiItemOperations.ts`

**Modificare 1: Elimină reîncărcarea după `saveBrandSerialData()` pentru item existent**
- **Locație:** Linia ~238-293 (în blocul `if (existingItem && existingItem.id)`)
- **Acțiune:** Nu mai face reîncărcare după salvare brand/serial pentru item existent
- **Risc:** 🟢 Mic - item-ul existent este deja în state, doar s-au actualizat brand-urile

**Modificare 2: Elimină reîncărcarea după `saveBrandSerialData()` pentru item nou**
- **Locație:** Linia ~294-326 (în blocul `else` - creare item nou)
- **Acțiune:** Nu mai face reîncărcare după creare item nou cu brand/serial
- **Risc:** 🟡 Mediu - item-ul nou este creat, dar nu este în state
- **Mitigare:** Actualizare manuală a state-ului cu item-ul estimat sau păstrează reîncărcarea doar pentru acest caz

**Modificare 3: Păstrează doar reîncărcarea finală**
- **Locație:** Linia ~755-761 (după `createTrayItem()`)
- **Acțiune:** Păstrează reîncărcarea finală după creare serviciu
- **Risc:** 🟢 Mic - aceasta este reîncărcarea necesară

#### Pasul 3: Testare
- [ ] Test cu brand/serial data existentă (item existent)
- [ ] Test cu brand/serial data nouă (item nou)
- [ ] Test fără brand/serial data
- [ ] Test cu multiple servicii adăugate rapid
- [ ] Test cu erori la `saveBrandSerialData()`

#### Pasul 4: Verificare Post-Implementare
- [ ] Verifică că items-urile sunt corecte în UI
- [ ] Verifică că brand-urile și serial numbers-urile sunt corecte
- [ ] Verifică că snapshot-ul este actualizat corect
- [ ] Monitorizează numărul de call-uri în browser DevTools

### 📝 Cod Modificat (Estimativ)

```typescript
// În blocul else (creare item nou) - linia ~294-326
else {
  // ... creare item nou cu brand/serial ...
  
  // ✅ ELIMINĂ: Reîncărcare după salvare brand/serial
  // const newItems = await listQuoteItems(...)
  // setItems(newItems)
  // if (newItems.length > 0 && initializeSnapshot) {
  //   initializeSnapshot(newItems)
  // }
  
  // ⚠️ ALTERNATIVĂ: Actualizare manuală a state-ului cu item-ul estimat
  // setItems(prev => [...prev, estimatedInstrumentItem])
}

// Păstrează reîncărcarea finală după createTrayItem() - linia ~755-761
const newItems = await listQuoteItems(selectedQuote.id, services, instruments, pipelinesWithIds)
setItems(newItems)
if (newItems.length > 0 && initializeSnapshot) {
  initializeSnapshot(newItems)
}
```

### ⚠️ Considerații Speciale

1. **Item nou pentru instrument:** Dacă se creează un item nou pentru instrument cu brand/serial, acesta nu va fi în state până la reîncărcarea finală. Acest lucru este acceptabil deoarece:
   - Item-ul este creat în DB
   - Reîncărcarea finală va include item-ul
   - UI-ul va fi actualizat după reîncărcarea finală

2. **Erori la `saveBrandSerialData()`:** Dacă `saveBrandSerialData()` eșuează, funcția returnează early (linia ~331), deci nu se ajunge la adăugarea serviciului. Acest comportament este corect.

---

## 2. Cache pentru `recalcAllSheetsTotal()`

### 📁 Fișiere de Modificat

#### Fișier Principal:
- **`hooks/preturi/usePreturiCalculations.ts`**
  - Funcție: `recalcAllSheetsTotal()` (linia ~54-118)
  - Modificare: Adaugă cache cu `useRef` pentru items-urile tăvițelor

### 🔗 Dependențe și Impact

#### Fișiere care folosesc `recalcAllSheetsTotal`:
1. **`hooks/usePreturiBusiness.ts`**
   - Linia ~221: Primește `recalcAllSheetsTotal` ca prop
   - Linia ~850+: Folosește `recalcAllSheetsTotal` în `saveAllAndLog`
   - Impact: ✅ Niciun impact - doar apelare funcție
   - Verificare necesară: ✅ Nu necesită modificări

2. **`hooks/preturi/usePreturiSaveOperations.ts`**
   - Linia ~607: Apelează `recalcAllSheetsTotal(quotes)` după salvare
   - Impact: ✅ Niciun impact - doar apelare funcție
   - Verificare necesară: ✅ Nu necesită modificări

3. **`components/preturi/core/PreturiMain.tsx`**
   - Pasează `recalcAllSheetsTotal` către `usePreturiBusiness`
   - Impact: ✅ Niciun impact - doar pasare prin
   - Verificare necesară: ✅ Nu necesită modificări

#### Funcții dependente:
- `listQuoteItems()` - folosit pentru încărcare items
- `computeItemsTotal()` - folosit pentru calcul totaluri

### 📊 Analiză Cod Actual

**Situația actuală în `recalcAllSheetsTotal()`:**

```typescript
const recalcAllSheetsTotal = useCallback(async (forQuotes: LeadQuote[]) => {
  if (!forQuotes.length) { 
    setAllSheetsTotal(0)
    return
  }
  
  try {
    // ❌ REÎNCĂRCARE: Pentru fiecare tăviță, chiar dacă nu s-a schimbat
    const all = await Promise.all(
      forQuotes.map(q => listQuoteItems(q.id, services, instruments, pipelinesWithIds))
    )
    
    // ... calculează totalurile ...
  } catch (error) {
    // ...
  }
}, [services, instruments, pipelinesWithIds, subscriptionType, computeItemsTotal, setAllSheetsTotal])
```

**Problema:** Reîncarcă items-urile pentru toate tăvițele chiar dacă nu s-au schimbat.

### ✅ Plan de Implementare

#### Pasul 1: Adaugă Cache cu `useRef`
**Fișier:** `hooks/preturi/usePreturiCalculations.ts`

**Modificare 1: Adaugă cache și TTL**
- **Locație:** Înainte de `recalcAllSheetsTotal` (după linia ~52)
- **Acțiune:** Creează `useRef` pentru cache cu structură: `Map<quoteId, { items: LeadQuoteItem[], timestamp: number }>`
- **TTL:** 5 secunde (configurabil)

**Modificare 2: Verifică cache înainte de reîncărcare**
- **Locație:** În `recalcAllSheetsTotal`, înainte de `Promise.all`
- **Acțiune:** Verifică cache-ul pentru fiecare tăviță, reîncarcă doar cele care nu sunt în cache sau au expirat

**Modificare 3: Actualizează cache după reîncărcare**
- **Locație:** După `Promise.all` în `recalcAllSheetsTotal`
- **Acțiune:** Actualizează cache-ul cu items-urile reîncărcate

**Modificare 4: Invalidate cache când items-urile se modifică**
- **Locație:** Export funcție `invalidateCache` sau adaugă parametru pentru invalidare
- **Acțiune:** Permite invalidarea cache-ului când items-urile se modifică

#### Pasul 2: Testare
- [ ] Test cu tăvițe neschimbate (folosește cache)
- [ ] Test cu tăvițe modificate (reîncarcă)
- [ ] Test cu cache expirat (reîncarcă)
- [ ] Test cu multiple tăvițe
- [ ] Test cu invalidare cache manuală

#### Pasul 3: Verificare Post-Implementare
- [ ] Verifică că totalurile sunt corecte
- [ ] Verifică că cache-ul funcționează
- [ ] Monitorizează numărul de call-uri în browser DevTools
- [ ] Verifică că cache-ul se invalidează corect

### 📝 Cod Modificat (Estimativ)

```typescript
// Adaugă înainte de recalcAllSheetsTotal
const itemsCacheRef = useRef<Map<string, { items: LeadQuoteItem[], timestamp: number }>>(new Map())
const CACHE_DURATION = 5000 // 5 secunde

const recalcAllSheetsTotal = useCallback(async (forQuotes: LeadQuote[]) => {
  if (!forQuotes.length) { 
    setAllSheetsTotal(0)
    return
  }
  
  try {
    const now = Date.now()
    const quotesToReload: LeadQuote[] = []
    const cachedItems: LeadQuoteItem[][] = []
    
    // Verifică cache-ul pentru fiecare tăviță
    forQuotes.forEach(quote => {
      const cached = itemsCacheRef.current.get(quote.id)
      if (cached && (now - cached.timestamp) < CACHE_DURATION) {
        // Folosește cache
        cachedItems.push(cached.items)
      } else {
        // Reîncarcă
        quotesToReload.push(quote)
        cachedItems.push([]) // Placeholder
      }
    })
    
    // Reîncarcă doar tăvițele care nu sunt în cache sau au expirat
    if (quotesToReload.length > 0) {
      const reloadedItems = await Promise.all(
        quotesToReload.map(q => listQuoteItems(q.id, services, instruments, pipelinesWithIds))
      )
      
      // Actualizează cache-ul
      quotesToReload.forEach((quote, idx) => {
        itemsCacheRef.current.set(quote.id, { items: reloadedItems[idx], timestamp: now })
      })
      
      // Actualizează cachedItems cu items-urile reîncărcate
      let reloadIdx = 0
      forQuotes.forEach((quote, idx) => {
        if (quotesToReload.includes(quote)) {
          cachedItems[idx] = reloadedItems[reloadIdx]
          reloadIdx++
        }
      })
    }
    
    // Calculează totalurile folosind items-urile din cache sau reîncărcate
    // ... restul codului rămâne la fel ...
    
  } catch (error) {
    // ...
  }
}, [services, instruments, pipelinesWithIds, subscriptionType, computeItemsTotal, setAllSheetsTotal])

// Export funcție pentru invalidare cache (opțional)
const invalidateItemsCache = useCallback((quoteId?: string) => {
  if (quoteId) {
    itemsCacheRef.current.delete(quoteId)
  } else {
    itemsCacheRef.current.clear()
  }
}, [])
```

### ⚠️ Considerații Speciale

1. **TTL scurt:** Cache-ul are TTL de 5 secunde pentru a preveni date stale, dar suficient de lung pentru a reduce call-urile.

2. **Invalidare cache:** Cache-ul trebuie invalidat când:
   - Items-urile se modifică (add, update, delete)
   - Tăvița se modifică
   - Se face salvare

3. **Memory management:** Cache-ul folosește `useRef` care persistă între render-uri, dar se resetează când componenta se unmount. Pentru sesiuni lungi, ar putea fi necesar cleanup periodic.

---

## 3. Debouncing pentru Refresh Operations

### 📁 Fișiere de Modificat

#### Fișier Principal:
- **`hooks/useKanbanData.ts`**
  - Funcție: `debouncedRefresh()` (linia ~62-69)
  - Modificare: Îmbunătățește debouncing-ul existent și adaugă protecție împotriva refresh-urilor simultane

### 🔗 Dependențe și Impact

#### Fișiere care folosesc `refresh`:
1. **`app/(crm)/dashboard/page.tsx`**
   - Linia ~47: Apelează `refresh()` în `handleRefresh`
   - Impact: ✅ Niciun impact - doar apelare funcție
   - Verificare necesară: ✅ Nu necesită modificări

2. **`app/(crm)/leads/[pipeline]/page.tsx`**
   - Folosește `refresh` din `useKanbanData`
   - Impact: ✅ Niciun impact - doar apelare funcție
   - Verificare necesară: ✅ Nu necesită modificări

3. **Real-time subscriptions** (în `useKanbanData.ts`)
   - Linia ~227, ~254, ~281: Folosește `debouncedRefresh()`
   - Impact: ✅ Niciun impact - doar apelare funcție
   - Verificare necesară: ✅ Nu necesită modificări

#### Funcții dependente:
- `loadDataRef.current()` - funcția care face refresh-ul efectiv

### 📊 Analiză Cod Actual

**Situația actuală în `useKanbanData.ts`:**

```typescript
// Linia ~60-69: Debounce helper pentru refresh-uri
const debounceRef = useRef<NodeJS.Timeout | null>(null)
const debouncedRefresh = useCallback(() => {
  if (debounceRef.current) {
    clearTimeout(debounceRef.current)
  }
  debounceRef.current = setTimeout(() => {
    loadDataRef.current()
  }, 1000) // 1 secundă
}, [])
```

**Problema:** 
- Debounce time de 1 secundă poate fi prea lung
- Nu există protecție împotriva refresh-urilor simultane
- Nu există indicator de loading pentru refresh în așteptare

### ✅ Plan de Implementare

#### Pasul 1: Îmbunătățește Debouncing
**Fișier:** `hooks/useKanbanData.ts`

**Modificare 1: Reduce debounce time**
- **Locație:** Linia ~68
- **Acțiune:** Reduce de la 1000ms la 300-500ms pentru răspuns mai rapid

**Modificare 2: Adaugă protecție împotriva refresh-urilor simultane**
- **Locație:** Înainte de `debouncedRefresh`
- **Acțiune:** Adaugă `useRef` pentru a verifica dacă un refresh este în curs
- **Mitigare:** Previne refresh-uri simultane

**Modificare 3: Adaugă cleanup la unmount**
- **Locație:** În `useEffect` cu cleanup
- **Acțiune:** Curăță timeout-ul la unmount pentru a preveni memory leaks

#### Pasul 2: Testare
- [ ] Test cu refresh rapid (debounce funcționează)
- [ ] Test cu refresh simultan (protecție funcționează)
- [ ] Test cu unmount în timpul debounce (cleanup funcționează)
- [ ] Test cu real-time subscriptions (debounce funcționează)

#### Pasul 3: Verificare Post-Implementare
- [ ] Verifică că refresh-urile nu sunt duplicate
- [ ] Verifică că debounce time este suficient
- [ ] Monitorizează numărul de call-uri în browser DevTools

### 📝 Cod Modificat (Estimativ)

```typescript
// Îmbunătățește debouncing-ul existent
const debounceRef = useRef<NodeJS.Timeout | null>(null)
const isRefreshingRef = useRef(false)

const debouncedRefresh = useCallback(() => {
  // Previne refresh-uri simultane
  if (isRefreshingRef.current) {
    return
  }
  
  // Curăță timeout-ul anterior
  if (debounceRef.current) {
    clearTimeout(debounceRef.current)
  }
  
  // Setează noul timeout cu timp redus
  debounceRef.current = setTimeout(() => {
    isRefreshingRef.current = true
    loadDataRef.current().finally(() => {
      isRefreshingRef.current = false
    })
  }, 300) // Redus de la 1000ms la 300ms
}, [])

// Cleanup la unmount
useEffect(() => {
  return () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
  }
}, [])
```

### ⚠️ Considerații Speciale

1. **Debounce time:** 300ms este un compromis între răspuns rapid și reducerea call-urilor. Poate fi ajustat în funcție de nevoi.

2. **Protecție simultană:** `isRefreshingRef` previne refresh-uri simultane, dar permite refresh-uri secvențiale după ce primul se termină.

3. **Real-time subscriptions:** Debouncing-ul se aplică și la real-time subscriptions, ceea ce este corect pentru a preveni refresh-uri excesive.

---

## 📅 Timeline de Implementare

### Săptămâna 1: Optimizarea 1.2 (Eliminare Reîncărcări Duplicate)

**Ziua 1-2: Analiză și Pregătire**
- [ ] Review cod actual
- [ ] Identifică toate locațiile de reîncărcare
- [ ] Creează branch: `optimize/remove-duplicate-reloads`

**Ziua 3-4: Implementare**
- [ ] Modifică `usePreturiItemOperations.ts`
- [ ] Elimină reîncărcarea după `saveBrandSerialData()` pentru item existent
- [ ] Elimină reîncărcarea după `saveBrandSerialData()` pentru item nou (sau actualizează manual state-ul)
- [ ] Păstrează doar reîncărcarea finală

**Ziua 5: Testare**
- [ ] Teste unitare
- [ ] Teste de integrare
- [ ] Teste manuale

**Ziua 6-7: Review și Deploy**
- [ ] Code review
- [ ] Fix issues
- [ ] Deploy pe staging
- [ ] Monitorizare

---

### Săptămâna 2: Optimizarea 2.1 (Cache pentru `recalcAllSheetsTotal()`)

**Ziua 1-2: Analiză și Pregătire**
- [ ] Review cod actual
- [ ] Design cache structure
- [ ] Creează branch: `optimize/cache-recalc-totals`

**Ziua 3-4: Implementare**
- [ ] Adaugă cache cu `useRef` în `usePreturiCalculations.ts`
- [ ] Implementează verificare cache înainte de reîncărcare
- [ ] Implementează actualizare cache după reîncărcare
- [ ] Adaugă funcție pentru invalidare cache

**Ziua 5: Testare**
- [ ] Teste unitare
- [ ] Teste de integrare
- [ ] Teste manuale cu cache

**Ziua 6-7: Review și Deploy**
- [ ] Code review
- [ ] Fix issues
- [ ] Deploy pe staging
- [ ] Monitorizare

---

### Săptămâna 3: Optimizarea 2.3 (Debouncing pentru Refresh)

**Ziua 1: Analiză și Pregătire**
- [ ] Review cod actual
- [ ] Creează branch: `optimize/improve-debouncing`

**Ziua 2-3: Implementare**
- [ ] Îmbunătățește `debouncedRefresh()` în `useKanbanData.ts`
- [ ] Reduce debounce time
- [ ] Adaugă protecție împotriva refresh-urilor simultane
- [ ] Adaugă cleanup la unmount

**Ziua 4: Testare**
- [ ] Teste unitare
- [ ] Teste de integrare
- [ ] Teste manuale cu refresh rapid

**Ziua 5: Review și Deploy**
- [ ] Code review
- [ ] Fix issues
- [ ] Deploy pe staging
- [ ] Monitorizare

---

## ✅ Checklist Final

### Înainte de Implementare:
- [ ] Review plan cu echipa
- [ ] Backup cod actual
- [ ] Creează branch-uri separate pentru fiecare optimizare
- [ ] Setup monitoring pentru numărul de call-uri

### În timpul Implementării:
- [ ] Implementează o optimizare la un moment dat
- [ ] Testează bine înainte de merge
- [ ] Documentează modificările
- [ ] Comentează cod vechi pentru referință

### După Implementare:
- [ ] Monitorizează numărul de call-uri
- [ ] Verifică că nu există erori în console
- [ ] Verifică că funcționalitatea este corectă
- [ ] Colectează feedback de la utilizatori

---

## 📊 Metrici de Succes

### Înainte de Optimizări:
- `onAddService()`: 3-5 call-uri (2 reîncărcări)
- `recalcAllSheetsTotal()`: N call-uri (N = numărul de tăvițe)
- `refresh()`: Multiple refresh-uri duplicate

### După Optimizări (Țintă):
- `onAddService()`: 2-3 call-uri (1 reîncărcare) - **Reducere ~40%**
- `recalcAllSheetsTotal()`: M call-uri (M < N, cu cache) - **Reducere ~50%**
- `refresh()`: Fără refresh-uri duplicate - **Reducere ~30%**

---

## 🚨 Rollback Plan

### Dacă apare o problemă:

1. **Optimizarea 1.2 (Eliminare Reîncărcări):**
   - Rollback: Reintrodu reîncărcarea eliminată
   - Impact: Scădere performanță, dar funcționalitate corectă

2. **Optimizarea 2.1 (Cache):**
   - Rollback: Elimină cache-ul, revine la reîncărcare completă
   - Impact: Scădere performanță, dar funcționalitate corectă

3. **Optimizarea 2.3 (Debouncing):**
   - Rollback: Revine la debounce time de 1000ms
   - Impact: Scădere performanță, dar funcționalitate corectă

---

**Data creării planului:** 2024-12-19
**Status:** 🟡 Gata pentru implementare



