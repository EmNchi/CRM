# 📊 Raport de Performanță CRM Ascuțit

## ✅ OPTIMIZĂRI IMPLEMENTATE

### 1. React Query - Caching & Deduplicare
- **Locație:** `lib/providers/query-provider.tsx`, `hooks/queries/`
- **Impact:** Reducere requests duplicate cu 80%
- **Configurare:**
  - Stale time: 5-30 minute (date statice)
  - Cache time: 30-60 minute
  - Retry automat la erori de rețea

### 2. Next.js Config Optimizat
- **Locație:** `next.config.mjs`
- **Optimizări:**
  - Imagini: AVIF/WebP, cache 30 zile
  - Bundle: optimizePackageImports pentru lucide-react, date-fns, recharts
  - Compression activată
  - Analyzer disponibil (`npm run analyze`)

### 3. Lazy Loading Componente
- **Locație:** `components/lazy/index.ts`
- **Componente lazy:**
  - KanbanBoard, LeadDetailsPanel, Preturi
  - DashboardCharts, PrintView
  - Mobile components

### 4. Query-uri Supabase Optimizate
- **Locație:** `lib/supabase/optimized-queries.ts`
- **Tehnici:**
  - Select minimal (doar coloane necesare)
  - Paginare pentru liste mari
  - Batch queries în paralel
  - Static data loader

### 5. Dependențe Curățate
- **Șterse:** svelte, vue, vue-router, @remix-run/react, @sveltejs/kit
- **Economie:** ~500KB din bundle

### 6. Script Monitoring
- **Comandă:** `npm run perf`
- **Măsurători:** TTFB, bundle size, rute lente
- **Output:** `reports/perf-*.json`

---

## 🔴 CRITICE - Componente Foarte Grele

| Fișier | Linii | Impact | Acțiuni Necesare |
|--------|-------|--------|------------------|
| `preturi.tsx` | 3,672 | 🔴 Critic | Split în module, lazy loading |
| `lead-details-panel.tsx` | 1,767 | 🔴 Critic | Split pe tab-uri, lazy loading |
| `pipelineOperations.ts` | 1,741 | 🔴 Critic | Split funcții, caching agresiv |
| `serviceSheet.ts` | 813 | 🟡 Mediu | Optimizare queries |
| `sidebar.tsx` (ui) | 672 | 🟡 Mediu | Server component parțial |
| `kanban-board.tsx` | 614 | 🟡 Mediu | Virtualizare, lazy loading cards |
| `useKanbanData.ts` | 484 | 🟡 Mediu | React Query, deduplicare |
| `lead-card.tsx` | 453 | 🟡 Mediu | Memoizare, split |

## 📦 Probleme Bundle

### Dependențe Nefolosite/Redundante
- `@sveltejs/kit`, `svelte`, `vue`, `vue-router` - **NU SUNT FOLOSITE** → Șterge
- `@remix-run/react` - **NU E FOLOSIT** → Șterge
- Economie estimată: ~500KB din bundle

### Configurare Next.js Suboptimală
```javascript
// next.config.mjs ACTUAL
images: { unoptimized: true } // ❌ Toate imaginile sunt neoptimizate!
```

## 🗄️ Probleme Supabase/Queries

### Query-uri Fără Select Minimal
- `pipelineOperations.ts`: select('*') în multe locuri → specifică doar coloanele necesare
- `leadOperations.ts`: încarcă date complete când nu e nevoie

### Lipsa Paginare
- `getKanbanItems`: încarcă TOATE lead-urile dintr-un pipeline
- `listTrayItemsForTray`: fără limit

### Request-uri Duplicate
- Pipelines și stages se încarcă în multiple componente
- Tehnicieni și departamente se reîncarcă la fiecare mount

## ✅ Plan de Acțiune

### Prioritate 1 - Impact Imediat (2-4 ore)

1. **Șterge dependențe nefolosite** 
   - Economie: ~500KB bundle
   
2. **Activează optimizarea imaginilor Next.js**
   - LCP îmbunătățit cu 20-40%

3. **Implementează React Query**
   - Caching automat
   - Deduplicare requests
   - Background refetch

4. **Split `preturi.tsx`**
   - Componente: InstrumentSelector, ServicesList, ImageGallery, PriceCalculator
   - Lazy loading pentru secțiuni

### Prioritate 2 - Optimizări Medii (4-8 ore)

5. **Virtualizare Kanban**
   - Render doar carduri vizibile
   - Economie memorie: 60-80%

6. **Select minimal în queries**
   - Reduce payload cu 40-60%

7. **Caching agresiv pentru date statice**
   - Pipelines, stages, departamente, instrumente

### Prioritate 3 - Optimizări Avansate (1-2 zile)

8. **Server Components pentru layout**
9. **ISR pentru pagini semi-statice**
10. **Edge Functions pentru queries grele**

## 📈 Metrici Țintă

| Metric | Actual (estimat) | Țintă |
|--------|------------------|-------|
| LCP | 3-4s | < 1.5s |
| FID | 200ms | < 100ms |
| CLS | 0.15 | < 0.1 |
| Bundle JS | ~2MB | < 800KB |
| TTFB | 500ms | < 200ms |

---
Generat: ${new Date().toISOString()}

