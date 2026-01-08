# Bug Fix: Cursor "not-allowed" pe checkbox-uri Office Direct și Curier Trimis

## 🐛 Problema Raportată

Când utilizatorul dă hover pe checkbox-urile "Office direct" și "Curier trimis", cursorul se transformă într-un cursor de "acțiune blocată" (not-allowed), chiar și când checkbox-urile ar trebui să fie funcționale.

## 🔍 Analiza Problemei

### Cauză Identificată:

1. **Componenta Checkbox UI**: Componenta `Checkbox` din `components/ui/checkbox.tsx` are stilul `disabled:cursor-not-allowed` care schimbă cursorul când checkbox-ul este disabled.

2. **Propagare cursor**: Când checkbox-ul este disabled, cursorul "not-allowed" se propagă și la label-ul care conține checkbox-ul, chiar dacă label-ul are `cursor-pointer` fix.

3. **Condiții de disabled**: Checkbox-urile sunt disabled când:
   - `!canSelectDelivery` (lipsește `fisaId`, `selectedQuoteId` sau `items.length === 0`)
   - Celălalt checkbox este bifat (`curierTrimis` pentru Office Direct, `officeDirect` pentru Curier Trimis)
   - `loading` sau `saving` sunt true

## ✅ Soluții Implementate

### 1. Corectare în `VanzariView.tsx`

**Înainte:**
```typescript
<label 
  className="flex items-center gap-2 cursor-pointer group select-none"
  onMouseDown={(e) => e.preventDefault()}
>
```

**După:**
```typescript
<label 
  className={`flex items-center gap-2 group select-none ${
    !canSelectDelivery || curierTrimis || loading || saving 
      ? 'cursor-not-allowed' 
      : 'cursor-pointer'
  }`}
  onMouseDown={(e) => {
    if (!canSelectDelivery || curierTrimis || loading || saving) {
      e.preventDefault()
    }
  }}
>
```

### 2. Corectare în `TrayActions.tsx`

**Înainte:**
```typescript
<label 
  className="flex items-center gap-2 cursor-pointer group select-none"
  onMouseDown={(e) => {
    e.preventDefault()
    if (!canSelectDelivery || curierTrimis || loading || saving) {
      return
    }
    // ...
  }}
>
```

**După:**
```typescript
<label 
  className={`flex items-center gap-2 group select-none ${
    !canSelectDelivery || curierTrimis || loading || saving 
      ? 'cursor-not-allowed' 
      : 'cursor-pointer'
  }`}
  onMouseDown={(e) => {
    if (!canSelectDelivery || curierTrimis || loading || saving) {
      e.preventDefault()
      return
    }
    // ...
  }}
>
```

## 📋 Fișiere Modificate

1. ✅ `components/preturi/views/VanzariView.tsx`
   - Adăugat cursor dinamic pe label bazat pe condițiile de disabled
   - Modificat `onMouseDown` să prevină doar când checkbox-ul este disabled

2. ✅ `components/preturi/sections/TrayActions.tsx`
   - Adăugat cursor dinamic pe label bazat pe condițiile de disabled
   - Modificat `onMouseDown` să prevină doar când checkbox-ul este disabled

## 🎯 Comportament Nou

### Când checkbox-ul este activ:
- ✅ Cursor: `pointer` (mână)
- ✅ Checkbox-ul poate fi bifat/debifat
- ✅ Label-ul este clickable

### Când checkbox-ul este disabled:
- ✅ Cursor: `not-allowed` (blocat)
- ✅ Checkbox-ul nu poate fi bifat/debifat
- ✅ Label-ul nu este clickable (prevenit în `onMouseDown`)

## 🧪 Testare

### Scenarii de Test:

1. **Test 1: Checkbox-uri active**
   - [ ] Verifică că cursorul este `pointer` când checkbox-urile sunt active
   - [ ] Verifică că checkbox-urile pot fi bifate/debifate

2. **Test 2: Checkbox-uri disabled (celălalt bifat)**
   - [ ] Verifică că cursorul este `not-allowed` când unul dintre checkbox-uri este bifat
   - [ ] Verifică că checkbox-ul disabled nu poate fi bifat

3. **Test 3: Checkbox-uri disabled (fără items)**
   - [ ] Verifică că cursorul este `not-allowed` când nu există items în tăviță
   - [ ] Verifică că checkbox-urile nu pot fi bifate

4. **Test 4: Checkbox-uri disabled (loading/saving)**
   - [ ] Verifică că cursorul este `not-allowed` când se încarcă sau se salvează
   - [ ] Verifică că checkbox-urile nu pot fi bifate

## 📝 Note

- Cursorul este acum consistent cu starea checkbox-ului
- Utilizatorul primește feedback vizual clar despre disponibilitatea checkbox-urilor
- Comportamentul este intuitiv și respectă standardele UX

---

**Status:** ✅ Corecții Implementate
**Data:** 2024-12-19



