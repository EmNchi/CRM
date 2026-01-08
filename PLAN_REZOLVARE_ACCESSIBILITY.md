# Plan Rezolvare Probleme Accesibilitate

## 🎯 Probleme Identificate (Lighthouse Score: 88)

### 1. Buttons do not have an accessible name
**Impact:** 🔴 Critic pentru screen readers
**Locații probabile:**
- Butoane cu doar iconițe (fără text sau aria-label)
- Butoane de sortare/reordonare
- Butoane de acțiune în tabele

### 2. Background and foreground colors do not have a sufficient contrast ratio
**Impact:** 🟠 Major pentru utilizatori cu deficiențe de vedere
**Locații probabile:**
- Text pe fundaluri deschise
- Badge-uri și label-uri
- Butoane cu contrast insuficient

### 3. Heading elements are not in a sequentially-descending order
**Impact:** 🟡 Mediu pentru navigare cu tastatura
**Locații probabile:**
- Sări de la h1 la h3 fără h2
- Utilizare incorectă a nivelurilor de heading

---

## 📋 Plan de Acțiune

### Faza 1: Rezolvare Butoane Fără Nume Accesibil

#### 1.1 Identificare Butoane Problem
- [ ] Căutare butoane cu doar iconițe
- [ ] Verificare butoane în tabele
- [ ] Verificare butoane de acțiune

#### 1.2 Adăugare aria-label
- [ ] Adăugare `aria-label` pentru butoane cu iconițe
- [ ] Adăugare `aria-labelledby` pentru butoane în contexte
- [ ] Verificare că toate butoanele au nume accesibil

### Faza 2: Rezolvare Probleme Contrast

#### 2.1 Identificare Elemente cu Contrast Insuficient
- [ ] Verificare text pe fundaluri deschise
- [ ] Verificare badge-uri și label-uri
- [ ] Verificare butoane cu contrast insuficient

#### 2.2 Corectare Contrast
- [ ] Ajustare culori pentru contrast minim 4.5:1 (text normal)
- [ ] Ajustare culori pentru contrast minim 3:1 (text mare)
- [ ] Testare cu tool-uri de verificare contrast

### Faza 3: Rezolvare Ordine Heading-uri

#### 3.1 Identificare Heading-uri Problem
- [ ] Căutare sări în ordinea heading-urilor
- [ ] Verificare utilizare corectă h1-h6

#### 3.2 Corectare Ordine Heading-uri
- [ ] Reorganizare heading-uri în ordine secvențială
- [ ] Utilizare div/span pentru stilizare în loc de heading-uri incorecte
- [ ] Verificare că nu există sări (ex: h1 → h3 fără h2)

---

## 🔍 Fișiere de Verificat

### Butoane:
- `components/preturi/views/VanzariView.tsx`
- `components/preturi/views/ReceptieView.tsx`
- `components/preturi/forms/AddServiceForm.tsx`
- `components/preturi/forms/AddInstrumentForm.tsx`
- `app/(crm)/leads/[pipeline]/page.tsx`

### Heading-uri:
- `components/preturi/core/PreturiOrchestrator.tsx`
- `components/preturi/views/VanzariView.tsx`
- `components/preturi/views/ReceptieView.tsx`
- `components/lead-details/header/LeadDetailsHeader.tsx`

---

## ✅ Checklist Final

- [ ] Toate butoanele au nume accesibil (text sau aria-label)
- [ ] Toate elementele au contrast suficient (minim 4.5:1)
- [ ] Heading-urile sunt în ordine secvențială
- [ ] Testare cu Lighthouse (target: 95+)
- [ ] Testare cu screen reader
- [ ] Testare navigare cu tastatura

---

**Status:** 🟡 În Așteptare
**Prioritate:** Medie-Altă



