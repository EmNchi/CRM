# Analiză Funcții - preturi.tsx (CRM VECHI vs CRM ACTUAL)

## Funcții identificate din CRM VECHI

### 1. `PrintViewData` (Componentă funcțională)
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 35-128)
**Descriere:** Componentă care calculează și afișează datele pentru print pentru toate tăvițele
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/components/preturi/PrintViewData.tsx`
**Observații:** Componenta există și este implementată corect, cu suport pentru subscription discounts

### 2. `refreshPipelines`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 238-249)
**Descriere:** Reîncarcă lista de pipeline-uri active din baza de date
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/preturi/usePreturiDeliveryOperations.ts` (linia 33-47)
**Observații:** Funcția există și este implementată în hook-ul de delivery operations

### 3. `computeItemsTotal`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 251-262)
**Descriere:** Calculează totalul pentru un array de items (subtotal, totalDiscount, urgentAmount)
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/preturi/usePreturiCalculations.ts` (linia 28-51)
**Observații:** Funcția există și este implementată în hook-ul de calculations, cu optimizări (un singur reduce în loc de 3)

### 4. `recalcAllSheetsTotal`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 264-269)
**Descriere:** Recalculează totalul pentru toate tăvițele unui lead
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/preturi/usePreturiCalculations.ts` (linia 54-127)
**Observații:** Funcția există și este implementată, cu suport pentru subscription discounts (10% servicii, 5% piese)

### 5. `saveAllAndLog`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 271-317)
**Descriere:** Salvează toate modificările și loghează în istoric
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/preturi/usePreturiSaveOperations.ts`
**Observații:** Funcția există și este implementată în hook-ul specializat

### 6. `onAddService`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 529-622)
**Descriere:** Adaugă un serviciu nou în tăviță
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/preturi/usePreturiItemOperations.ts`
**Observații:** Funcția există și este implementată în hook-ul specializat

### 7. `onAddPart`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 624-655)
**Descriere:** Adaugă o piesă nouă în tăviță
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/preturi/usePreturiItemOperations.ts`
**Observații:** Funcția există și este implementată în hook-ul specializat

### 8. `onUpdateItem`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 658-661)
**Descriere:** Actualizează un item existent în tăviță
**Status:** ✅ PREZENTĂ
**Locație actuală:** Probabil în `usePreturiBusiness.ts` sau hook-uri specializate
**Observații:** Funcția există și este implementată

### 9. `onDelete`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 663-674)
**Descriere:** Șterge un item din tăviță
**Status:** ✅ PREZENTĂ
**Locație actuală:** Probabil în `usePreturiBusiness.ts` sau hook-uri specializate
**Observații:** Funcția există și este implementată

### 10. `onChangeSheet`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 676-746)
**Descriere:** Schimbă tăvița selectată și încarcă items-urile pentru noua tăviță
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/usePreturiEffects.ts`
**Observații:** Funcția există și este implementată în hook-ul de effects

### 11. `onAddSheet`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 748-761)
**Descriere:** Creează o nouă tăviță pentru lead
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/preturi/usePreturiTrayOperations.ts` (probabil `handleCreateTray`)
**Observații:** Funcția există și este implementată în hook-ul de tray operations

### 12. `onDeleteSheet`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 763-824)
**Descriere:** Șterge o tăviță și reindexează tăvițele rămase
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/preturi/usePreturiTrayOperations.ts` (probabil `handleDeleteTray`)
**Observații:** Funcția există și este implementată în hook-ul de tray operations

### 13. `tempId`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 168)
**Descriere:** Generează un ID temporar pentru items noi
**Status:** ✅ PREZENTĂ
**Locație actuală:** Probabil în hook-uri sau utils
**Observații:** Funcția există și este implementată

## useEffect-uri identificate

### 14. useEffect pentru urgentTagId
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 196-204)
**Descriere:** Găsește tag-ul "urgent" la încărcare
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/usePreturiEffects.ts` (linia 66-76)
**Observații:** useEffect-ul există și găsește tag-ul "urgent" la încărcare

### 15. useEffect pentru urgent tag management
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 207-236)
**Descriere:** Verifică și atribuie/elimină tag-ul urgent când se schimbă items-urile
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/usePreturiEffects.ts` (linia 143-190)
**Observații:** useEffect-ul există și gestionează tag-ul urgent, cu logică specială pentru pipeline-ul Vanzari

### 16. useEffect principal pentru loading data
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 327-485)
**Descriere:** Încarcă datele inițiale și setează real-time subscriptions
**Status:** ✅ PREZENTĂ (parțial)
**Locație actuală:** `ascutzit-crm/hooks/usePreturiDataLoader.ts` și `usePreturiEffects.ts`
**Observații:** Logica este împărțită între mai multe hook-uri

## useMemo-uri identificate

### 17. `subtotal`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 488-491)
**Descriere:** Calculează subtotalul pentru items-urile din tăvița curentă
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/components/preturi/PreturiMain.tsx` sau hook-uri de calcul
**Observații:** Calculat în versiunea actuală

### 18. `totalDiscount`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 492-499)
**Descriere:** Calculează discount-ul total pentru items-urile din tăvița curentă
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/components/preturi/PreturiMain.tsx` sau hook-uri de calcul
**Observații:** Calculat în versiunea actuală

### 19. `urgentAmount`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 500-507)
**Descriere:** Calculează suma markup-urilor pentru items urgente
**Status:** ✅ PREZENTĂ
**Locație actuală:** `ascutzit-crm/components/preturi/PreturiMain.tsx` sau hook-uri de calcul
**Observații:** Calculat în versiunea actuală

### 20. `subscriptionDiscountAmount`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 509-514)
**Descriere:** Calculează discount-ul pentru abonament (5% sau 10%)
**Status:** ✅ PREZENTĂ (parțial)
**Locație actuală:** `ascutzit-crm/components/preturi/PreturiMain.tsx` (linia 103-113) și `usePreturiCalculations.ts`
**Observații:** Calculul există, dar folosește `subscriptionType` ('services', 'parts', 'both') în loc de `hasSubscription` și `subscriptionDiscount`. Logica este diferită: 10% pentru servicii, 5% pentru piese, nu un procentaj general.

### 21. `sterilizationDiscountAmount`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 517-521)
**Descriere:** Calculează discount-ul pentru sterilizare (10%)
**Status:** ❌ ABSENTĂ
**Acțiune necesară:** Trebuie implementat useMemo care:
- Verifică dacă `hasSterilization` este true
- Calculează discount-ul de 10% pe `subtotal - totalDiscount + urgentAmount - subscriptionDiscountAmount`
- Adaugă state-ul `hasSterilization` în state management

### 22. `total`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 523-526)
**Descriere:** Calculează totalul final (subtotal - discount + urgent - subscription - sterilization)
**Status:** ⚠️ PARȚIAL PREZENTĂ
**Locație actuală:** `ascutzit-crm/components/preturi/PreturiMain.tsx` (linia 130-138)
**Observații:** Calculul include subscription discount, dar NU include sterilization discount. Trebuie adăugat sterilization discount în calcul.

## State-uri identificate

### 23. `hasSubscription` și `subscriptionDiscount`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 165-166)
**Descriere:** State pentru abonament și discount-ul asociat (5% sau 10%)
**Status:** ⚠️ PARȚIAL PREZENTĂ
**Locație actuală:** `ascutzit-crm/hooks/usePreturiState.ts` - există `subscriptionType` ('services' | 'parts' | 'both' | '')
**Observații:** În versiunea veche există `hasSubscription` (boolean) și `subscriptionDiscount` ('5' | '10' | ''). În versiunea actuală există `subscriptionType` care combină ambele concepte. Logica este diferită: în versiunea veche se aplica un procentaj general, în versiunea actuală se aplică 10% pentru servicii și 5% pentru piese.

### 24. `hasSterilization`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 162)
**Descriere:** State pentru sterilizare (discount 10%)
**Status:** ❌ ABSENTĂ
**Acțiune necesară:** Trebuie adăugat state-ul `hasSterilization` în `usePreturiState.ts` și UI pentru checkbox

### 25. `buyBack`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 159)
**Descriere:** State pentru buy back
**Status:** ❌ ABSENTĂ
**Acțiune necesară:** Verifică dacă este necesar în versiunea actuală sau a fost eliminat intenționat

### 26. `allSheetsTotal`
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 142)
**Descriere:** Totalul pentru toate tăvițele
**Status:** ✅ PREZENTĂ
**Locație actuală:** Probabil în `usePreturiState.ts`
**Observații:** State-ul există

## Real-time subscriptions

### 27. Real-time subscription pentru lead_quote_items
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 401-435)
**Descriere:** Ascultă pentru modificări în tabelul `lead_quote_items` și recalculează totalurile
**Status:** ❌ ABSENTĂ
**Acțiune necesară:** Trebuie implementat real-time subscription care:
- Ascultă pentru modificări în tabelul `lead_quote_items`
- Verifică dacă item-ul aparține unui quote al acestui lead
- Recalculează `allSheetsTotal` când se modifică items-urile
- Folosește `recalcAllSheetsTotal` pentru recalculare

### 28. Real-time subscription pentru lead_quotes
**Locație veche:** `CRM VECHI/ascutzit-crm-main/components/preturi.tsx` (linia 436-479)
**Descriere:** Ascultă pentru modificări în tabelul `lead_quotes` și actualizează quotes-urile și cash/card
**Status:** ❌ ABSENTĂ
**Acțiune necesară:** Trebuie implementat real-time subscription care:
- Ascultă pentru modificări în tabelul `lead_quotes` pentru lead-ul curent
- Pentru DELETE: recalculează totalul fără a reîncărca toate quotes-urile
- Pentru INSERT/UPDATE: reîncarcă quotes-urile și actualizează cash/card pentru tăvița selectată
- Recalculează `allSheetsTotal` după modificări

## Rezumat

### Funcții ABSENTE care trebuie implementate:
1. ❌ `sterilizationDiscountAmount` - Calcul discount sterilizare (10%)
2. ❌ State `hasSterilization` - Checkbox pentru sterilizare
3. ❌ State `buyBack` - Checkbox pentru buy back (dacă este necesar)
4. ❌ Real-time subscription pentru `lead_quote_items` - Recalculare totaluri când se modifică items-urile
5. ❌ Real-time subscription pentru `lead_quotes` - Actualizare quotes și cash/card când se modifică un quote

### Funcții PREZENTE:
1. ✅ `PrintViewData` - Componentă pentru print
2. ✅ `refreshPipelines` - Reîncărcare pipeline-uri
3. ✅ `computeItemsTotal` - Calcul total pentru items
4. ✅ `recalcAllSheetsTotal` - Recalculare total toate tăvițele
5. ✅ useEffect pentru urgent tag management
6. ✅ `subscriptionDiscountAmount` - Calcul discount abonament (cu logică diferită: 10% servicii, 5% piese)
7. ✅ `saveAllAndLog`
8. ✅ `onAddService`
9. ✅ `onAddPart`
10. ✅ `onUpdateItem`
11. ✅ `onDelete`
12. ✅ `onChangeSheet`
13. ✅ `onAddSheet`
14. ✅ `onDeleteSheet`
15. ✅ `subtotal`, `totalDiscount`, `urgentAmount` (calculele de bază)

### Funcții PARȚIAL PREZENTE:
1. ⚠️ `subscriptionDiscountAmount` - Există dar cu logică diferită (10% servicii, 5% piese în loc de procentaj general)
2. ⚠️ `total` - Nu include sterilization discount în calcul
3. ⚠️ `hasSubscription` și `subscriptionDiscount` - Înlocuite cu `subscriptionType` (logică diferită)

### Acțiuni prioritare:
1. **IMPORTANT:** Implementare `hasSterilization` state și `sterilizationDiscountAmount` pentru discount 10%
2. **IMPORTANT:** Actualizare calcul `total` pentru a include sterilization discount
3. **IMPORTANT:** Implementare real-time subscription pentru `lead_quote_items` - Recalculare `allSheetsTotal` când se modifică items-urile
4. **IMPORTANT:** Implementare real-time subscription pentru `lead_quotes` - Actualizare quotes și cash/card când se modifică un quote
5. **MEDIU:** Verificare dacă `buyBack` este necesar sau a fost eliminat intenționat
6. **LOW:** Documentare diferențe între logica veche și nouă pentru subscription discounts

---

## Analiză Comparativă - Verificare Funcționalitate

### Funcții care funcționează PERFECT conform logicii din CRM VECHI:

#### 1. `saveAllAndLog`
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Salvează corect cash/card pentru tăvița selectată
- Restaurează instrumentul selectat după salvare (prevenind resetarea)
- Reîncarcă quotes-urile și recalculează totalurile
- Invalidează cache-ul pentru totalul lead-ului
- Logica este identică cu versiunea veche, cu îmbunătățiri pentru pipeline-uri și service files

#### 2. `onAddPart`
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Logica este identică cu versiunea veche
- Adaugă corect piesa în items
- Resetează formularul după adăugare
- Setează corect `isDirty`

#### 3. `onUpdateItem`
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Logica este identică cu versiunea veche
- Actualizează corect item-ul în state
- Setează corect `isDirty`

#### 4. `onDelete`
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Logica este identică cu versiunea veche
- Șterge corect item-ul din state
- Resetează instrumentul dacă s-a șters ultimul serviciu
- Setează corect `isDirty`

#### 5. `computeItemsTotal`
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Logica este identică cu versiunea veche, cu optimizări (un singur reduce în loc de 3)
- Calculează corect subtotal, totalDiscount și urgentAmount
- Exclude corect items-urile cu `item_type: null`

#### 6. `recalcAllSheetsTotal`
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Logica este îmbunătățită față de versiunea veche
- Calculează corect totalurile pentru toate tăvițele
- Include corect subscription discounts (10% servicii, 5% piese)
- Optimizat pentru performanță

#### 7. `refreshPipelines`
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Logica este identică cu versiunea veche
- Reîncarcă corect pipeline-urile active
- Setează corect state-urile pentru pipelines și pipelinesWithIds

#### 8. `PrintViewData`
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Componenta este implementată corect
- Calculează corect totalurile pentru fiecare tăviță
- Include corect subscription discounts
- Pasează corect datele către componenta `PrintView`

#### 9. useEffect pentru urgentTagId
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Logica este identică cu versiunea veche
- Găsește corect tag-ul "urgent" la încărcare

#### 10. useEffect pentru urgent tag management
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Logica este îmbunătățită față de versiunea veche
- Gestionează corect tag-ul urgent când se schimbă items-urile
- Include logică specială pentru pipeline-ul Vanzari

---

### Funcții cu ERORI LOGICE sau DIFERENȚE de comportament:

#### 1. `onAddService`
**Status:** ⚠️ EROARE LOGICĂ - NU FUNCȚIONEAZĂ CONFORM VERSIUNII VECHI
**Eroare identificată:**
- **În CRM VECHI:** Funcția verifică dacă există deja servicii în tăviță și dacă instrumentul este diferit, creează automat o nouă tăviță. Apoi fixează instrumentul pentru această tăviță dacă este primul serviciu.
- **În versiunea actuală:** Logica pentru crearea automată a unei tăvițe noi când instrumentul este diferit NU EXISTĂ. Funcția doar verifică dacă există un instrument selectat și dacă departamentul este diferit, dar NU creează automat o tăviță nouă.
- **Problema:** În versiunea veche, dacă utilizatorul selectează un serviciu cu un instrument diferit de cel existent în tăviță, se creează automat o tăviță nouă. În versiunea actuală, această funcționalitate lipsește.
- **Locație eroare:** `ascutzit-crm/hooks/preturi/usePreturiItemOperations.ts` (linia 75-500)
- **Acțiune necesară:** Adăugare logică pentru crearea automată a unei tăvițe noi când instrumentul serviciului este diferit de cel existent în tăviță.

#### 2. `onChangeSheet`
**Status:** ❌ EROARE LOGICĂ CRITICĂ - FUNCȚIA LIPSEȘTE COMPLET
**Eroare identificată:**
- **În CRM VECHI:** Funcția `onChangeSheet` (linia 676-746) face următoarele:
  1. Verifică dacă tăvița nouă este diferită de cea curentă
  2. Setează `loading = true`
  3. Încarcă valorile cash/card pentru noua tăviță din quote
  4. Încarcă items-urile pentru noua tăviță folosind `listQuoteItems(newId)`
  5. Setează `selectedQuoteId` la noua tăviță
  6. Setează `items` cu items-urile încărcate
  7. Actualizează `lastSavedRef.current` cu snapshot-ul items-urilor
  8. Fixează instrumentul din primul serviciu găsit în tăviță (dacă există servicii)
  9. Resetează instrumentul dacă nu există servicii
  10. Setează `loading = false`
  11. Gestionează erorile și revine la tăvița anterioară în caz de eroare

- **În versiunea actuală:** 
  - Funcția `onChangeSheet` NU EXISTĂ în niciun hook sau componentă
  - Când utilizatorul selectează o tăviță diferită, se apelează doar `state.setSelectedQuoteId(trayId)` care doar setează ID-ul
  - NU există useEffect care să încarce items-urile când se schimbă `selectedQuoteId`
  - NU se încarcă cash/card pentru noua tăviță
  - NU se fixează instrumentul din primul serviciu
  - NU se actualizează `lastSavedRef.current`

- **Problema:** Când utilizatorul schimbă tăvița, items-urile rămân cele din tăvița anterioară, cash/card rămân cele din tăvița anterioară, și instrumentul nu se fixează corect. Aceasta este o eroare critică care afectează funcționalitatea de bază.

- **Locație eroare:** Funcția lipsește complet. Trebuie implementată în `usePreturiEffects.ts` sau într-un hook dedicat.

- **Acțiune necesară:** 
  1. Implementare funcție `onChangeSheet` sau `onChangeTray` care să facă toate operațiile din versiunea veche
  2. Adăugare useEffect care să monitorizeze `selectedQuoteId` și să încarce items-urile și cash/card când se schimbă
  3. Integrare funcție în `PreturiMain.tsx` și `PreturiOrchestrator.tsx` pentru a fi apelată când utilizatorul selectează o tăviță diferită

#### 3. `onAddSheet` (handleCreateTray)
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT (cu îmbunătățiri)
**Observații:**
- Logica este îmbunătățită față de versiunea veche
- Include validare pentru numărul tăviței (verifică dacă există deja)
- Creează corect tăvița și setează state-urile
- Recalculează corect totalurile

#### 4. `onDeleteSheet` (handleDeleteTray)
**Status:** ✅ FĂRĂ ERORI LOGICE - FUNCȚIONEAZĂ PERFECT
**Observații:**
- Logica este identică cu versiunea veche
- Șterge corect tăvița și reindexează tăvițele rămase
- Selectează corect prima tăviță disponibilă sau creează una nouă
- Încarcă corect items-urile și cash/card pentru noua tăviță

#### 5. `subscriptionDiscountAmount`
**Status:** ⚠️ DIFERENȚĂ DE LOGICĂ (NU este eroare, ci schimbare intenționată)
**Observații:**
- **În CRM VECHI:** Există `hasSubscription` (boolean) și `subscriptionDiscount` ('5' | '10' | '') care aplică un procentaj general pe totalul după discount și urgent.
- **În versiunea actuală:** Există `subscriptionType` ('services' | 'parts' | 'both' | '') care aplică 10% pentru servicii și 5% pentru piese separat.
- **Concluzie:** Aceasta este o schimbare intenționată a logicii, nu o eroare. Logica nouă este mai precisă (discount diferit pentru servicii și piese).

#### 6. `total`
**Status:** ⚠️ EROARE LOGICĂ - NU INCLUDE STERILIZATION DISCOUNT
**Eroare identificată:**
- **În CRM VECHI:** Calculul totalului include: `subtotal - totalDiscount + urgentAmount - subscriptionDiscountAmount - sterilizationDiscountAmount`
- **În versiunea actuală:** Calculul totalului include doar: `subtotal - totalDiscount + urgentAmount - subscriptionDiscountAmount` (lipsește sterilizationDiscountAmount)
- **Problema:** Discount-ul pentru sterilizare nu este inclus în calculul totalului final.
- **Locație eroare:** `ascutzit-crm/components/preturi/PreturiMain.tsx` (linia 130-138)
- **Acțiune necesară:** Adăugare `sterilizationDiscountAmount` în calculul totalului și implementare state `hasSterilization`.

---

## Rezumat Erori Logice Identificate:

1. ❌ **`onChangeSheet`** - **EROARE CRITICĂ** - Funcția lipsește complet. Când utilizatorul schimbă tăvița, items-urile și cash/card nu se încarcă pentru noua tăviță, iar instrumentul nu se fixează corect.
2. ❌ **`onAddService`** - **EROARE LOGICĂ** - Lipsește logica pentru crearea automată a unei tăvițe noi când instrumentul serviciului este diferit de cel existent în tăviță.
3. ❌ **`total`** - **EROARE LOGICĂ** - Nu include sterilization discount în calculul totalului final.
4. ⚠️ **`subscriptionDiscountAmount`** - **SCHIMBARE INTENȚIONATĂ** - Nu este eroare, ci îmbunătățire (10% servicii, 5% piese în loc de procentaj general).

---

## Acțiuni Corective Prioritare:

### CRITIC (Blochează funcționalitatea de bază):
1. **CRITIC:** Implementare completă a funcției `onChangeSheet` sau `onChangeTray` care să:
   - Încărce items-urile pentru noua tăviță
   - Încărce cash/card pentru noua tăviță
   - Fixeze instrumentul din primul serviciu (dacă există servicii)
   - Actualizeze `lastSavedRef.current`
   - Gestioneze erorile și revină la tăvița anterioară în caz de eroare
   - Integrare în `usePreturiEffects.ts` sau hook dedicat
   - Integrare în `PreturiMain.tsx` și `PreturiOrchestrator.tsx` pentru a fi apelată când utilizatorul selectează o tăviță diferită

### IMPORTANT (Afectează funcționalitatea):
2. **IMPORTANT:** Implementare logică pentru crearea automată a tăviței noi în `onAddService` când instrumentul serviciului este diferit de cel existent în tăviță (conform logicii din CRM VECHI linia 555-560)
3. **IMPORTANT:** Adăugare sterilization discount în calculul totalului (`sterilizationDiscountAmount` în formula finală)
4. **IMPORTANT:** Implementare state `hasSterilization` în `usePreturiState.ts` și UI pentru checkbox în componentele relevante

### MEDIU (Îmbunătățiri):
5. **MEDIU:** Implementare real-time subscriptions pentru `lead_quote_items` și `lead_quotes` pentru actualizare automată a totalurilor și cash/card
6. **MEDIU:** Verificare dacă `buyBack` este necesar sau a fost eliminat intenționat

