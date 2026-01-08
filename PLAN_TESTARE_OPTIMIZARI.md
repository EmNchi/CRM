# Plan de Testare - Optimizări Reducere Call-uri

## 🎯 Obiectiv
Verificarea că toate optimizările implementate funcționează corect și nu au introdus erori.

---

## 📋 Checklist de Testare

### 1. ✅ Batch Operations pentru `saveBrandSerialData()`

#### Test 1.1: Adăugare serviciu cu brand/serial data nouă (item nou)
- [ ] Deschide aplicația și navighează la un lead
- [ ] Selectează un instrument care nu are item în tăviță
- [ ] Adaugă brand-uri și serial numbers în formularul instrumentului
- [ ] Adaugă un serviciu
- [ ] **Verificare:** Brand-urile și serial numbers-urile sunt salvate corect
- [ ] **Verificare:** Network tab - ar trebui să fie 3-5 call-uri (nu 5-20+)
- [ ] **Verificare:** Nu există erori în console

#### Test 1.2: Adăugare serviciu cu brand/serial data existentă (item existent)
- [ ] Selectează un instrument care are deja item în tăviță
- [ ] Modifică brand-urile și serial numbers-urile
- [ ] Adaugă un serviciu
- [ ] **Verificare:** Brand-urile și serial numbers-urile sunt actualizate corect
- [ ] **Verificare:** Network tab - ar trebui să fie 3-5 call-uri (nu 5-20+)
- [ ] **Verificare:** Nu există erori în console

#### Test 1.3: Adăugare serviciu cu multiple brand-uri și serial numbers
- [ ] Adaugă 3-5 brand-uri cu câte 2-3 serial numbers fiecare
- [ ] Adaugă un serviciu
- [ ] **Verificare:** Toate brand-urile și serial numbers-urile sunt salvate
- [ ] **Verificare:** Network tab - ar trebui să fie batch INSERT (1 call pentru brands, 1 call pentru serials)
- [ ] **Verificare:** Nu există erori în console

#### Test 1.4: Propagare brand/serial la servicii existente
- [ ] Creează un instrument cu brand/serial
- [ ] Adaugă un serviciu asociat cu acel instrument
- [ ] Modifică brand-urile și serial numbers-urile instrumentului
- [ ] **Verificare:** Brand-urile și serial numbers-urile sunt propagate la serviciu
- [ ] **Verificare:** Network tab - batch operations pentru toate serviciile
- [ ] **Verificare:** Nu există erori în console

---

### 2. ✅ Eliminare Reîncărcări Duplicate în `onAddService()`

#### Test 2.1: Adăugare serviciu fără brand/serial data
- [ ] Adaugă un serviciu fără brand/serial data
- [ ] **Verificare:** Serviciul este adăugat corect
- [ ] **Verificare:** Network tab - ar trebui să fie 1 reîncărcare (nu 2)
- [ ] **Verificare:** Nu există erori în console

#### Test 2.2: Adăugare serviciu cu brand/serial data (item nou)
- [ ] Selectează un instrument care nu are item în tăviță
- [ ] Adaugă brand-uri și serial numbers
- [ ] Adaugă un serviciu
- [ ] **Verificare:** Item-ul pentru instrument este creat
- [ ] **Verificare:** Serviciul este adăugat corect
- [ ] **Verificare:** Network tab - ar trebui să fie 1 reîncărcare finală (nu 2)
- [ ] **Verificare:** Nu există erori în console

#### Test 2.3: Adăugare serviciu cu brand/serial data (item existent)
- [ ] Selectează un instrument care are deja item în tăviță
- [ ] Modifică brand-urile și serial numbers-urile
- [ ] Adaugă un serviciu
- [ ] **Verificare:** Brand-urile și serial numbers-urile sunt actualizate
- [ ] **Verificare:** Serviciul este adăugat corect
- [ ] **Verificare:** Network tab - ar trebui să fie 1 reîncărcare finală
- [ ] **Verificare:** Nu există erori în console

#### Test 2.4: Adăugare multiple servicii rapid
- [ ] Adaugă 3-5 servicii rapid, unul după altul
- [ ] **Verificare:** Toate serviciile sunt adăugate corect
- [ ] **Verificare:** Network tab - fiecare serviciu are doar 1 reîncărcare
- [ ] **Verificare:** Nu există erori în console

---

### 3. ✅ Cache pentru `recalcAllSheetsTotal()`

#### Test 3.1: Recalculare totaluri pentru tăvițe neschimbate
- [ ] Deschide un lead cu multiple tăvițe
- [ ] Salvează fișa (trigger `recalcAllSheetsTotal()`)
- [ ] Salvează din nou imediat (înainte de 5 secunde)
- [ ] **Verificare:** Totalurile sunt corecte
- [ ] **Verificare:** Network tab - a doua salvare folosește cache (nu reîncarcă items-urile)
- [ ] **Verificare:** Nu există erori în console

#### Test 3.2: Recalculare totaluri după modificare items
- [ ] Modifică items-urile dintr-o tăviță
- [ ] Salvează fișa
- [ ] **Verificare:** Totalurile sunt recalculate corect
- [ ] **Verificare:** Network tab - reîncarcă items-urile pentru tăvița modificată
- [ ] **Verificare:** Nu există erori în console

#### Test 3.3: Recalculare totaluri după expirare cache
- [ ] Salvează fișa
- [ ] Așteaptă 6 secunde (peste TTL de 5 secunde)
- [ ] Salvează din nou
- [ ] **Verificare:** Totalurile sunt corecte
- [ ] **Verificare:** Network tab - reîncarcă items-urile (cache expirat)
- [ ] **Verificare:** Nu există erori în console

#### Test 3.4: Recalculare totaluri pentru multiple tăvițe
- [ ] Deschide un lead cu 3-5 tăvițe
- [ ] Salvează fișa
- [ ] **Verificare:** Totalurile sunt corecte pentru toate tăvițele
- [ ] **Verificare:** Network tab - reîncarcă items-urile pentru toate tăvițele (prima dată)
- [ ] **Verificare:** Nu există erori în console

---

### 4. ✅ Debouncing pentru Refresh Operations

#### Test 4.1: Refresh rapid în Kanban
- [ ] Deschide un pipeline în Kanban
- [ ] Face multiple acțiuni rapid (mută lead-uri, adaugă tag-uri, etc.)
- [ ] **Verificare:** UI-ul răspunde rapid
- [ ] **Verificare:** Network tab - refresh-urile sunt debounced (nu sunt duplicate)
- [ ] **Verificare:** Nu există erori în console

#### Test 4.2: Real-time subscriptions cu debouncing
- [ ] Deschide un pipeline în Kanban
- [ ] Modifică datele din altă fereastră/tab
- [ ] **Verificare:** Modificările apar în UI
- [ ] **Verificare:** Network tab - refresh-urile sunt debounced
- [ ] **Verificare:** Nu există erori în console

#### Test 4.3: Refresh simultan
- [ ] Deschide un pipeline în Kanban
- [ ] Face multiple acțiuni simultane care declanșează refresh
- [ ] **Verificare:** Doar un refresh este executat (nu multiple simultane)
- [ ] **Verificare:** Nu există erori în console

#### Test 4.4: Unmount în timpul debounce
- [ ] Deschide un pipeline în Kanban
- [ ] Face o acțiune care declanșează refresh
- [ ] Navighează imediat către altă pagină (înainte de 300ms)
- [ ] **Verificare:** Nu există erori în console
- [ ] **Verificare:** Nu există memory leaks

---

## 🔍 Verificări Generale

### Verificare Network Tab
- [ ] Deschide DevTools → Network tab
- [ ] Filtrează după "tray_items", "tray_item_brands", "tray_item_brand_serials", "quotes"
- [ ] Numără call-urile pentru fiecare operație
- [ ] Compară cu numărul estimat de call-uri (documentat în `REZUMAT_OPTIMIZARI_IMPLEMENTATE.md`)

### Verificare Console
- [ ] Deschide DevTools → Console tab
- [ ] Verifică că nu există erori JavaScript
- [ ] Verifică că nu există warning-uri relevante
- [ ] Verifică că mesajele de eroare pentru batch operations sunt corecte (dacă există)

### Verificare Funcționalitate
- [ ] Toate datele sunt salvate corect în baza de date
- [ ] UI-ul afișează datele corect
- [ ] Totalurile sunt calculate corect
- [ ] Brand-urile și serial numbers-urile sunt afișate corect

---

## 📊 Metrici de Succes

### Înainte de Optimizări:
- `saveBrandSerialData()`: 5-20+ call-uri
- `onAddService()`: 3-5 call-uri
- `recalcAllSheetsTotal()`: N call-uri (N = numărul de tăvițe)
- `refresh()`: Multiple refresh-uri duplicate

### După Optimizări (Țintă):
- `saveBrandSerialData()`: 3-5 call-uri ✅
- `onAddService()`: 2-3 call-uri ✅
- `recalcAllSheetsTotal()`: M call-uri (M < N, cu cache) ✅
- `refresh()`: Fără refresh-uri duplicate ✅

### Reducere Generală:
- **~60-70% reducere** în numărul total de call-uri ✅
- **~50-60% îmbunătățire** a performanței ✅

---

## 🚨 Probleme Identificate

### Dacă apar probleme:
1. **Documentează problema:** Descrie exact ce s-a întâmplat
2. **Capturează screenshot:** Network tab, Console tab, UI-ul
3. **Verifică rollback plan:** Consultă `REZUMAT_OPTIMIZARI_IMPLEMENTATE.md`
4. **Raportează:** Creează issue sau documentează în acest fișier

---

## ✅ Rezultate Testare

**Data testării:** _______________
**Tester:** _______________

### Rezultate:
- [ ] Toate testele au trecut cu succes
- [ ] Unele teste au eșuat (documentează mai jos)
- [ ] Necesită retestare după fix-uri

### Probleme identificate:
1. _______________
2. _______________
3. _______________

### Observații:
_______________
_______________
_______________

---

**Status:** 🟡 Gata pentru testare



