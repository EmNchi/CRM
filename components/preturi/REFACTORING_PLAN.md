# Plan de Refactorizare - Componenta Preturi

## Progres Actual

### ✅ Componente Create (20 componente)
1. **Formulare:**
   - `AddInstrumentForm.tsx`
   - `AddServiceForm.tsx`
   - `AddPartForm.tsx`

2. **Afișare:**
   - `ItemsTable.tsx`
   - `TotalsSection.tsx`
   - `TrayDetailsSection.tsx`
   - `TrayImagesSection.tsx`

3. **View-uri Pipeline:**
   - `VanzariView.tsx`
   - `ReceptieView.tsx`
   - `DepartmentView.tsx`
   - `CurierView.tsx`

4. **Dialog-uri:**
   - `CreateTrayDialog.tsx`
   - `EditTrayDialog.tsx`
   - `MoveInstrumentDialog.tsx`

5. **Restricții:**
   - `PipelineRestrictions.tsx`
   - `PreturiProvider.tsx`

### ✅ Hook-uri Create (4 hook-uri)
1. `usePreturiState.ts` - Gestionare state
2. `usePreturiPipeline.ts` - Logică pipeline
3. `usePreturiEffects.ts` - Side effects
4. `usePreturiBusiness.ts` - Business logic

### ✅ Utilitare Create (2 fișiere)
1. `lib/types/preturi.ts` - Tipuri TypeScript
2. `lib/utils/preturi-helpers.ts` - Funcții helper

## Plan de Integrare

### Faza 1: Înlocuire Incrementală (Recomandat)

#### Pasul 1: Înlocuire Dialog-uri ✅
- [x] Înlocuiește dialog-ul de creare tăviță cu `<CreateTrayDialog />`
- [x] Înlocuiește dialog-ul de editare tăviță cu `<EditTrayDialog />`
- [x] Înlocuiește dialog-ul de mutare instrument cu `<MoveInstrumentDialog />`

#### Pasul 2: Înlocuire Secțiuni UI ✅
- [x] Înlocuiește secțiunea de totaluri cu `<TotalsSection />`
- [x] Înlocuiește secțiunea de detalii tăviță cu `<TrayDetailsSection />`
- [x] Înlocuiește secțiunea de imagini cu `<TrayImagesSection />`
- [x] Înlocuiește tabelul de items cu `<ItemsTable />`

#### Pasul 3: Înlocuire Formulare (Parțial ✅)
- [x] Înlocuiește formularul de instrument pentru modul vânzător cu `<AddInstrumentForm />`
- [x] Înlocuiește formularul de serviciu pentru modul vânzător cu `<AddServiceForm />`
- [x] Înlocuiește formularul de piesă pentru modul normal cu `<AddPartForm />`
- [ ] **EXTENDERE NECESARĂ**: Extinde `<AddInstrumentForm />` cu suport pentru `brandSerialGroups` (pentru Reparații)
- [ ] **EXTENDERE NECESARĂ**: Extinde `<AddServiceForm />` cu selecție brand pentru Vânzări

#### Pasul 4: Înlocuire View-uri Complete ✅
- [x] Pentru pipeline Vanzari: înlocuiește întreaga secțiune cu `<VanzariView />`
- [x] Pentru pipeline Receptie: înlocuiește întreaga secțiune cu `<ReceptieView />`
- [x] Pentru pipeline-uri departament: înlocuiește cu `<DepartmentView />`
- [x] Pentru pipeline Curier: înlocuiește cu `<CurierView />`

#### Pasul 5: Integrare Componente Restricții
- [ ] Integrează `<PreturiProvider />` sau `<PipelineRestrictions />` în `preturi.tsx`
- [ ] Înlocuiește verificările inline de restricții cu componentele modulare

#### Pasul 5: Integrare Hook-uri
- [ ] Înlocuiește state management cu `usePreturiState`
- [ ] Înlocuiește logica pipeline cu `usePreturiPipeline`
- [ ] Înlocuiește useEffect-urile cu `usePreturiEffects`
- [ ] Înlocuiește funcțiile de business cu `usePreturiBusiness`

### Faza 2: Testare
- [ ] Testează fiecare componentă individual
- [ ] Testează integrarea între componente
- [ ] Testează toate pipeline-urile
- [ ] Verifică funcționalitatea completă

### Faza 3: Cleanup
- [ ] Șterge codul vechi comentat
- [ ] Optimizează imports
- [ ] Verifică performanța
- [ ] Documentează modificările

## Note Importante

1. **Compatibilitate:** Toate componentele sunt create pentru a fi compatibile cu API-ul existent
2. **Props:** Componentele primesc props și callback-uri, nu acces direct la state
3. **Incremental:** Refactorizarea poate fi făcută incremental, testând fiecare pas
4. **Rollback:** Păstrează codul vechi comentat până când totul funcționează corect

## Exemple de Integrare

### Exemplu 1: Înlocuire Dialog
```tsx
// ÎNAINTE
<Dialog open={showCreateTrayDialog} onOpenChange={setShowCreateTrayDialog}>
  {/* ... cod vechi ... */}
</Dialog>

// DUPĂ
<CreateTrayDialog
  open={showCreateTrayDialog}
  onOpenChange={setShowCreateTrayDialog}
  newTrayNumber={newTrayNumber}
  newTraySize={newTraySize}
  creatingTray={creatingTray}
  onNumberChange={setNewTrayNumber}
  onSizeChange={setNewTraySize}
  onCreate={handleCreateTray}
  onCancel={() => {
    setShowCreateTrayDialog(false)
    setNewTrayNumber('')
    setNewTraySize('m')
  }}
/>
```

### Exemplu 2: Înlocuire View Pipeline
```tsx
// ÎNAINTE
{isVanzariPipeline && (
  <div>
    {/* ... cod vechi ... */}
  </div>
)}

// DUPĂ
{isVanzariPipeline && (
  <VanzariView
    instrumentForm={instrumentForm}
    svc={svc}
    // ... toate props-urile necesare
  />
)}
```

## Status Actualizat

- ✅ **Fazele 1-7 completate**: Toate componentele, hook-urile și utilitarele sunt create
- ✅ **Integrare completă**: 
  - Dialog-uri (CreateTrayDialog, EditTrayDialog, MoveInstrumentDialog)
  - Secțiuni UI (ItemsTable, TotalsSection, TrayDetailsSection, TrayImagesSection)
  - View-uri pipeline (VanzariView, ReceptieView, DepartmentView, CurierView)
  - Formulare vânzător (AddInstrumentForm, AddServiceForm)
  - Formulare modul normal extinse (AddInstrumentForm cu brandSerialGroups, AddServiceForm cu selecție brand)
  - Verificări pipeline centralizate cu `usePreturiPipeline`
- ✅ **Componente restricții create**: PipelineRestrictions.tsx și PreturiProvider.tsx (disponibile pentru utilizare viitoare)
- ✅ **Cleanup minim**: Cod comentat/debug eliminat
- 📝 **Următorii pași opționali**: 
  1. Integrare `PreturiProvider` ca wrapper (opțional, verificările funcționează și fără)
  2. Aliniere tipuri și eliminare `as any` temporare (în cleanup final)
  3. Optimizări și refactorizări minore

