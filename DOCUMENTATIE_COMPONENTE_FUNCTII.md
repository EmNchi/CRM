# Documentație Completă - Funcții și Componente din `components/`

Acest document oferă o explicație detaliată și voluminosă pentru toate funcțiile, componentele, hooks-urile, tipurile și interfețele din directorul `components/` (excluzând `components/ui/` care este documentat separat).

---

## 📁 Structura Directorului

```
components/
├── AuthStatus.tsx
├── dashboard-charts.tsx
├── dashboard-insights.tsx
├── dashboard-stats.tsx
├── de-confirmat.tsx
├── kanban-board.tsx
├── lead-card.tsx
├── lead-details-panel.tsx
├── lead-history.tsx
├── lead-messenger.tsx
├── lead-modal.tsx
├── pipeline-editor.tsx
├── preturi.tsx
├── print-view.tsx
├── sidebar.tsx
├── SignOutButton.tsx
├── theme-provider.tsx
├── lazy/
│   └── index.tsx
└── mobile/
    ├── lead-card-mobile.tsx
    ├── lead-details-sheet.tsx
    ├── mobile-board-header.tsx
    ├── mobile-board-layout.tsx
    └── stage-tabs.tsx
```

---

## 🔐 Componente de Autentificare și Utilizator

### `AuthStatus.tsx`

**Locație:** `components/AuthStatus.tsx`

**Descriere:** Componentă React client-side care afișează starea de autentificare a utilizatorului și oferă link-uri pentru autentificare sau buton de deconectare.

**Dependențe:**
- `next/link` - pentru navigare
- `@/hooks/useAuth` - hook pentru autentificare
- `@/components/SignOutButton` - componentă pentru deconectare

**Funcții și Componente Exportate:**

#### `AuthStatus` (Componentă Default Exportată)

**Tip:** `React.FC` (Functional Component)

**Descriere:** Componentă principală care verifică starea de autentificare și afișează interfața corespunzătoare.

**Logica de Funcționare:**
1. Folosește hook-ul `useAuth()` pentru a obține `user` și `loading`
2. Dacă este în proces de încărcare (`loading === true`), returnează `null` (nu afișează nimic)
3. Dacă utilizatorul nu este autentificat (`!user`), afișează un link către pagina de autentificare (`/auth/sign-in`)
4. Dacă utilizatorul este autentificat, afișează email-ul utilizatorului și butonul de deconectare

**Stare Internă:**
- Nu folosește state local, ci se bazează pe hook-ul `useAuth`

**Render Conditional:**
- `loading`: returnează `null`
- `!user`: returnează `<Link>` către sign-in
- `user`: returnează div cu email și `<SignOutButton />`

**Exemplu de Utilizare:**
```tsx
import AuthStatus from '@/components/AuthStatus'

function Layout() {
  return (
    <header>
      <AuthStatus />
    </header>
  )
}
```

---

### `SignOutButton.tsx`

**Locație:** `components/SignOutButton.tsx`

**Descriere:** Componentă simplă care oferă funcționalitatea de deconectare a utilizatorului din aplicație.

**Dependențe:**
- `next/navigation` - pentru redirect după deconectare
- `@/lib/supabase/supabaseClient` - client Supabase pentru autentificare

**Funcții și Componente Exportate:**

#### `SignOutButton` (Componentă Default Exportată)

**Tip:** `React.FC`

**Descriere:** Buton care permite utilizatorului să se deconecteze din aplicație.

**Funcții Interne:**

##### `signOut` (Funcție Async)

**Tip:** `() => Promise<void>`

**Descriere:** Funcție asincronă care gestionează procesul de deconectare.

**Pași de Execuție:**
1. Creează o instanță a clientului Supabase folosind `supabaseBrowser()`
2. Apelează `supabase.auth.signOut()` pentru a deconecta utilizatorul
3. Redirecționează utilizatorul către pagina de autentificare folosind `router.replace('/auth/sign-in')`

**Erori Potențiale:**
- Erori de rețea la apelul `signOut()`
- Erori de navigare (rar)

**Exemplu de Utilizare:**
```tsx
import SignOutButton from '@/components/SignOutButton'

function UserMenu() {
  return (
    <div>
      <SignOutButton />
    </div>
  )
}
```

---

## 📊 Componente Dashboard

### `dashboard-stats.tsx`

**Locație:** `components/dashboard-stats.tsx`

**Descriere:** Componentă care afișează statistici agregate despre lead-uri, revenue, lead-uri urgente și lead-uri noi într-un format de card-uri responsive.

**Dependențe:**
- `@/components/ui/card` - componente Card pentru UI
- `@/components/ui/skeleton` - componente Skeleton pentru loading states
- `lucide-react` - iconițe (Users, TrendingUp, AlertTriangle, Plus, ArrowUpRight, ArrowDownRight, DollarSign)
- `@/lib/utils` - utilitare (funcția `cn`)

**Interfețe și Tipuri:**

#### `StatCardProps`

**Tip:** Interface

**Proprietăți:**
- `title: string` - Titlul cardului (ex: "Total Lead-uri")
- `value: string | number` - Valoarea afișată (poate fi string sau număr)
- `change?: number` - Procentul de schimbare (opțional, poate fi pozitiv sau negativ)
- `changeLabel?: string` - Eticheta pentru schimbare (ex: "față de luna trecută")
- `icon: React.ComponentType<{ className?: string }>` - Componentă de iconiță React
- `iconColor?: string` - Culoarea iconiței (default: `'text-blue-600'`)
- `loading?: boolean` - Flag pentru starea de încărcare

**Funcții și Componente Exportate:**

#### `StatCard` (Componentă Internă)

**Tip:** `React.FC<StatCardProps>`

**Descriere:** Componentă reutilizabilă pentru afișarea unei statistici într-un card.

**Logica de Funcționare:**
1. Afișează un card cu header care conține titlul și iconița
2. În conținut, afișează valoarea și opțional schimbarea procentuală
3. Dacă `loading === true`, afișează skeleton loaders în loc de conținut real
4. Dacă `change` este definit și `changeLabel` este definit, afișează indicatorul de schimbare cu:
   - Săgeată în sus (verde) dacă `change >= 0`
   - Săgeată în jos (roșu) dacă `change < 0`
   - Culoarea textului verde pentru pozitiv, roșu pentru negativ

**Stilizare:**
- Folosește Tailwind CSS pentru styling
- Responsive: text-uri diferite pentru mobile (`text-xs sm:text-sm`) și desktop
- Iconița are culoare personalizabilă prin prop `iconColor`

**Exemplu de Utilizare:**
```tsx
<StatCard
  title="Total Lead-uri"
  value={1234}
  change={12}
  changeLabel="față de luna trecută"
  icon={Users}
  iconColor="text-blue-600"
  loading={false}
/>
```

#### `DashboardStats` (Componentă Principală Exportată)

**Tip:** `React.FC<DashboardStatsProps>`

**Descriere:** Componentă care afișează un grid de card-uri cu statistici pentru dashboard.

**Interfață Props:**

##### `DashboardStatsProps`

**Proprietăți:**
- `metrics: { totalLeads: number; totalRevenue: number; urgentLeads: number; newLeadsToday: number; conversionRate: number; averageLeadValue: number } | null` - Obiect cu metrici sau `null`
- `loading: boolean` - Flag pentru starea de încărcare

**Logica de Funcționare:**
1. Renderizează un grid responsive cu 1 coloană pe mobile, 2 pe tabletă (`sm:grid-cols-2`), 2 pe desktop mediu (`md:grid-cols-2`), și 4 pe desktop mare (`lg:grid-cols-4`)
2. Afișează 4 card-uri de statistici:
   - **Total Lead-uri**: Numărul total de lead-uri, cu iconiță Users, schimbare +12%
   - **Revenue Total**: Valoarea totală în RON, cu iconiță DollarSign, schimbare +8%
   - **Lead-uri Urgente**: Numărul de lead-uri urgente, cu iconiță AlertTriangle, schimbare -5%
   - **Lead-uri Noi Astăzi**: Numărul de lead-uri noi create astăzi, cu iconiță Plus, schimbare +15%

**Formatare Valori:**
- `totalLeads`: folosește `toLocaleString()` pentru formatare cu separatori de mii
- `totalRevenue`: folosește `toFixed(2)` pentru 2 zecimale și adaugă "RON"

**Exemplu de Utilizare:**
```tsx
<DashboardStats
  metrics={{
    totalLeads: 1234,
    totalRevenue: 45678.90,
    urgentLeads: 5,
    newLeadsToday: 12,
    conversionRate: 25.5,
    averageLeadValue: 123.45
  }}
  loading={false}
/>
```

---

### `dashboard-charts.tsx`

**Locație:** `components/dashboard-charts.tsx`

**Descriere:** Componentă complexă care afișează multiple grafice și diagrame pentru analiza datelor de lead-uri și revenue folosind biblioteca Recharts.

**Dependențe:**
- `react` - useState, useEffect
- `@/components/ui/card` - Card components
- `@/components/ui/chart` - ChartContainer, ChartTooltip, ChartTooltipContent
- `recharts` - BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Area, AreaChart
- `@/components/ui/skeleton` - Skeleton loaders

**Interfețe și Tipuri:**

#### `DashboardChartsProps`

**Proprietăți:**
- `metrics: { leadsByPipeline: Record<string, number>; leadsByStage: Record<string, number>; revenueByPipeline: Record<string, number>; revenueByStage: Record<string, number>; leadsOverTime: Array<{ date: string; count: number }>; topTechnicians: Array<{ name: string; leads: number; revenue: number }>; tagDistribution: Record<string, number>; paymentMethodStats: { cash: number; card: number; none: number } } | null`
- `loading: boolean`

**Constante:**

##### `COLORS`

**Tip:** `string[]`

**Valoare:** `['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']`

**Descriere:** Array de culori hex pentru grafice.

**Funcții și Componente Exportate:**

#### `DashboardCharts` (Componentă Principală Exportată)

**Tip:** `React.FC<DashboardChartsProps>`

**Descriere:** Componentă care afișează un grid de grafice pentru analiza datelor.

**State Intern:**

##### `pieRadius`

**Tip:** `number`

**Valoare Inițială:** `60`

**Descriere:** Raza pentru pie charts, ajustată dinamic în funcție de dimensiunea ecranului.

**Efecte:**

##### `useEffect` pentru Responsive Pie Radius

**Descriere:** Actualizează raza pie chart-ului în funcție de lățimea ecranului.

**Logica:**
- `< 640px`: raza = 50
- `< 768px`: raza = 70
- `>= 768px`: raza = 80

**Cleanup:** Elimină event listener-ul la unmount.

**Funcții Helper:**

##### Transformări de Date

**Descriere:** Transformă datele din format Record în array-uri sortate pentru grafice.

**1. `pipelineData`**
- Transformă `metrics.leadsByPipeline` într-un array de `{ name, value }`
- Sortează descrescător după valoare
- Limitează la primele 6 rezultate (`.slice(0, 6)`)

**2. `stageData`**
- Transformă `metrics.leadsByStage` într-un array de `{ name, value }`
- Sortează descrescător după valoare
- Nu limitează numărul de rezultate

**3. `revenueData`**
- Transformă `metrics.revenueByPipeline` într-un array de `{ name, value }`
- Formatează valoarea cu `Number(value.toFixed(2))` pentru 2 zecimale
- Sortează descrescător după valoare
- Limitează la primele 6 rezultate

**4. `revenueByStageData`**
- Transformă `metrics.revenueByStage` într-un array de `{ name, value }`
- Formatează valoarea cu 2 zecimale
- Sortează descrescător
- Limitează la primele 8 rezultate

**Configurație Chart:**

##### `chartConfig`

**Tip:** `{ leads: { label: string; color: string }; revenue: { label: string; color: string } }`

**Valori:**
- `leads.label`: "Lead-uri"
- `leads.color`: "hsl(var(--chart-1))"
- `revenue.label`: "Revenue (RON)"
- `revenue.color`: "hsl(var(--chart-2))"

**Render Conditional:**

##### Loading State

Dacă `loading === true`, afișează 4 card-uri cu skeleton loaders (ascunse pe ecrane mici, vizibile doar pe `lg:block`).

##### Empty State

Dacă nu există date pentru un grafic, afișează mesajul "Nu există date" centrat.

**Grafice Afișate:**

**1. Lead-uri pe Pipeline (Bar Chart)**
- Tip: Bar Chart orizontal
- Date: `pipelineData`
- Axa X: Numele pipeline-urilor (rotite la -45°, text anchor end, height 80px)
- Axa Y: Numărul de lead-uri
- Tooltip: Custom ChartTooltipContent
- Responsive: Ascuns pe ecrane mici (`hidden lg:block`)

**2. Revenue pe Pipeline (Bar Chart)**
- Tip: Bar Chart orizontal
- Date: `revenueData`
- Axa X: Numele pipeline-urilor (rotite la -45°, fontSize 10px)
- Axa Y: Valoarea revenue (fontSize 10px)
- Tooltip: Custom ChartTooltipContent
- Responsive: Ascuns pe ecrane mici

**3. Lead-uri Noi (Ultimele 30 Zile) (Area Chart)**
- Tip: Area Chart cu gradient
- Date: `metrics.leadsOverTime`
- Axa X: Datele formatate ca "dd/MM"
- Axa Y: Numărul de lead-uri
- Gradient: Linear gradient de la `var(--color-leads)` cu opacitate 0.8 la 0
- Tooltip: Custom cu formatare de dată în română (`toLocaleDateString('ro-RO')`)
- Responsive: Ascuns pe ecrane mici

**4. Metode de Plată (Pie Chart)**
- Tip: Pie Chart
- Date: Array cu `{ name: 'Cash', value: ... }`, `{ name: 'Card', value: ... }`, `{ name: 'Nespecificat', value: ... }`
- Label: Afișează numele, valoarea și procentul
- Culori: Verde pentru Cash (#10b981), Albastru pentru Card (#3b82f6), Gri pentru Nespecificat (#6b7280)
- Raza: Dinamică în funcție de ecran (`pieRadius`)
- Tooltip: Custom ChartTooltipContent
- Responsive: Ascuns pe ecrane mici

**Exemplu de Utilizare:**
```tsx
<DashboardCharts
  metrics={{
    leadsByPipeline: { 'Vanzari': 100, 'Receptie': 50 },
    leadsByStage: { 'Nou': 30, 'In Lucru': 20 },
    revenueByPipeline: { 'Vanzari': 10000, 'Receptie': 5000 },
    revenueByStage: { 'Nou': 3000, 'In Lucru': 2000 },
    leadsOverTime: [
      { date: '2024-01-01', count: 10 },
      { date: '2024-01-02', count: 15 }
    ],
    topTechnicians: [
      { name: 'Ion', leads: 50, revenue: 5000 }
    ],
    tagDistribution: {},
    paymentMethodStats: { cash: 60, card: 40, none: 0 }
  }}
  loading={false}
/>
```

---

### `dashboard-insights.tsx`

**Locație:** `components/dashboard-insights.tsx`

**Descriere:** Componentă care generează și afișează insights și recomandări inteligente bazate pe metrici de performanță.

**Dependențe:**
- `@/components/ui/card` - Card components
- `@/components/ui/badge` - Badge components
- `@/components/ui/button` - Button components
- `@/components/ui/skeleton` - Skeleton loaders
- `lucide-react` - Iconițe (TrendingUp, AlertCircle, Clock, Users, ArrowRight, Lightbulb)
- `@/lib/utils` - Funcția `cn`
- `next/link` - Link pentru navigare

**Interfețe și Tipuri:**

#### `Insight`

**Tip:** Interface

**Proprietăți:**
- `type: 'success' | 'warning' | 'info'` - Tipul de insight (succes, avertizare, informație)
- `title: string` - Titlul insight-ului
- `description: string` - Descrierea detaliată
- `action?: { label: string; href: string }` - Acțiune opțională (buton cu link)

#### `DashboardInsightsProps`

**Proprietăți:**
- `metrics: { urgentLeads: number; topTechnicians: Array<{ name: string; leads: number; revenue: number }>; conversionRate: number; averageLeadValue: number } | null`
- `loading: boolean`

**Funcții și Componente Exportate:**

#### `DashboardInsights` (Componentă Principală Exportată)

**Tip:** `React.FC<DashboardInsightsProps>`

**Descriere:** Componentă care generează insights dinamice bazate pe metrici.

**Logica de Generare Insights:**

##### Algoritm de Generare

Componenta construiește un array `insights` prin analizarea metricilor:

**1. Insight pentru Lead-uri Urgente**
- **Condiție:** `metrics.urgentLeads > 0`
- **Tip:** `'warning'`
- **Titlu:** `"{count} Lead-uri Urgente"`
- **Descriere:** "Există lead-uri marcate ca urgente care necesită atenție imediată."
- **Acțiune:** Link către `/leads?filter=urgent` cu label "Vezi lead-urile urgente"

**2. Insight pentru Conversion Rate**
- **Condiție Scăzut:** `metrics.conversionRate < 20`
  - **Tip:** `'warning'`
  - **Titlu:** "Rate de Conversie Scăzut"
  - **Descriere:** `"Rate-ul de conversie este {rate}%. Ar putea fi nevoie de optimizare a procesului."`
- **Condiție Excelent:** `metrics.conversionRate > 50`
  - **Tip:** `'success'`
  - **Titlu:** "Rate de Conversie Excelent"
  - **Descriere:** `"Rate-ul de conversie este {rate}%. Procesul funcționează bine!"`

**3. Insight pentru Valoare Medie Lead**
- **Condiție:** `metrics.averageLeadValue > 0`
- **Tip:** `'info'`
- **Titlu:** `"Valoare Medie Lead: {value} RON"`
- **Descriere:** "Aceasta este valoarea medie a unui lead în sistem."

**4. Insight pentru Top Tehnician**
- **Condiție:** `metrics.topTechnicians.length > 0`
- **Tip:** `'success'`
- **Titlu:** `"Top Tehnician: {name}"`
- **Descriere:** `"{leads} lead-uri, {revenue} RON revenue."`
- **Date:** Folosește primul tehnician din array (`topTechnicians[0]`)

**Render Conditional:**

##### Loading State

Dacă `loading === true`, afișează un card cu skeleton loaders pentru header și 3 skeleton-uri pentru conținut.

##### Empty State

Dacă `insights.length === 0`, afișează un card cu mesaj "Nu există insights disponibile momentan" și o iconiță Lightbulb opacă.

##### Insights List

Dacă există insights, afișează fiecare insight într-un card colorat:

**Stilizare pe Tip:**
- **Success:** Background `bg-emerald-50 dark:bg-emerald-950/20`, border `border-emerald-200 dark:border-emerald-800`, iconiță TrendingUp verde
- **Warning:** Background `bg-amber-50 dark:bg-amber-950/20`, border `border-amber-200 dark:border-amber-800`, iconiță AlertCircle portocalie
- **Info:** Background `bg-blue-50 dark:bg-blue-950/20`, border `border-blue-200 dark:border-blue-800`, iconiță Clock albastră

**Structură Insight Card:**
- Iconiță colorată în stânga
- Titlu bold (`font-semibold`)
- Descriere text muted
- Buton de acțiune (dacă există) cu link și săgeată ArrowRight

**Responsive:**
- Ascuns pe ecrane mici (`hidden lg:block`)
- Text responsive: `text-xs sm:text-sm`
- Padding responsive: `p-3 sm:p-4`
- Gap responsive: `gap-2 sm:gap-3`

**Exemplu de Utilizare:**
```tsx
<DashboardInsights
  metrics={{
    urgentLeads: 5,
    topTechnicians: [
      { name: 'Ion Popescu', leads: 50, revenue: 5000 }
    ],
    conversionRate: 25.5,
    averageLeadValue: 123.45
  }}
  loading={false}
/>
```

---

## 🎯 Componente Lead Management

### `lead-card.tsx`

**Locație:** `components/lead-card.tsx`

**Descriere:** Componentă complexă care afișează un card reprezentând un lead într-un board Kanban, cu suport pentru drag & drop, selecție multiplă, pin/unpin, și afișare adaptivă pentru diferite tipuri de lead-uri (lead normal, service_file, tray/quote).

**Dependențe:**
- `react` - useState, useEffect, useMemo
- `lucide-react` - Iconițe (MoreHorizontal, GripVertical, Mail, Calendar, Clock, User, Phone, Pin)
- `@/components/ui/button` - Button
- `@/components/ui/badge` - Badge
- `@/components/ui/checkbox` - Checkbox
- `@/components/ui/dropdown-menu` - DropdownMenu
- `@/lib/utils` - Funcția `cn`
- `@/lib/supabase/tagOperations` - getOrCreatePinnedTag, toggleLeadTag
- `date-fns` - format, formatDistanceToNow, isToday, isYesterday
- `date-fns/locale/ro` - Localizare română
- `@/hooks/use-toast` - useToast

**Interfețe și Tipuri:**

#### `LeadCardProps`

**Proprietăți:**
- `lead: Lead` - Obiectul lead de afișat
- `onMove: (leadId: string, newStage: string) => void` - Callback pentru mutarea lead-ului
- `onClick: (event?: React.MouseEvent) => void` - Callback pentru click pe card
- `onDragStart: () => void` - Callback la începutul drag
- `onDragEnd: () => void` - Callback la sfârșitul drag
- `isDragging: boolean` - Flag pentru starea de drag
- `stages: string[]` - Array cu toate stage-urile disponibile
- `onPinToggle?: (leadId: string, isPinned: boolean) => void` - Callback opțional pentru pin/unpin
- `isSelected?: boolean` - Flag pentru selecție multiplă
- `onSelectChange?: (isSelected: boolean) => void` - Callback pentru schimbarea selecției
- `leadTotal?: number` - Totalul pentru lead (pentru tăvițe)
- `pipelineName?: string` - Numele pipeline-ului curent

**State Intern:**

##### `isMenuOpen`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Controlează deschiderea meniului dropdown.

##### `currentTime`

**Tip:** `Date`

**Valoare Inițială:** `new Date()`

**Descriere:** Timpul curent pentru actualizarea în timp real a timpului petrecut în stage.

##### `isPinning`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru prevenirea apelurilor multiple la toggle pin.

**Hooks și Funcții:**

##### `useMemo` pentru `isPinned`

**Descriere:** Verifică dacă lead-ul are tag-ul 'PINNED'.

**Logica:** Verifică dacă `lead.tags` conține un tag cu `name === 'PINNED'`.

##### `formatSmartDate`

**Tip:** `(date: Date) => string`

**Descriere:** Formatează data într-un mod inteligent și prietenos.

**Logica:**
- Dacă este astăzi (`isToday`): `"Astăzi, HH:mm"`
- Dacă este ieri (`isYesterday`): `"Ieri, HH:mm"`
- Altfel: `"dd MMM yyyy, HH:mm"` (format românesc)

##### `useMemo` pentru `leadAge`

**Descriere:** Calculează vârsta lead-ului și determină dacă este "nou" (max 24 ore).

**Return:** `{ isNew: boolean; timeText: string } | null`

**Logica:**
- Calculează diferența în ore și minute față de `createdAt`
- Dacă diferența <= 24 ore, `isNew = true`
- Formatează timpul: minute dacă < 60, ore dacă < 24, zile altfel

##### `useEffect` pentru Actualizare Timp Real

**Descriere:** Actualizează `currentTime` la fiecare 30 de secunde pentru lead-urile în stage-uri relevante.

**Condiții:**
- Doar pentru stage-uri care includ "asteptare", "confirmat" (dar nu "confirmari"), sau "confirmari"
- Doar dacă `lead.stageMovedAt` există

**Interval:** 30000ms (30 secunde)

##### `useMemo` pentru `timeInStage`

**Descriere:** Calculează timpul petrecut în stage-ul curent pentru stage-uri relevante.

**Return:** `{ timeText: string; label: string } | null`

**Logica:**
- Verifică dacă stage-ul este "asteptare", "de confirmat", sau "confirmari"
- Calculează diferența între `currentTime` și `lead.stageMovedAt`
- Formatează timpul: minute, ore, sau zile
- Returnează label-ul corespunzător ("În așteptare", "De confirmat", "Confirmări")

**Funcții Helper:**

##### `tagClass`

**Tip:** `(c: TagColor) => string`

**Descriere:** Returnează clasele CSS pentru tag-uri pe baza culorii.

**Mapare:**
- `"green"` → `"bg-emerald-100 text-emerald-800"`
- `"yellow"` → `"bg-amber-100 text-amber-800"`
- `"orange"` → `"bg-orange-100 text-orange-800"`
- `"blue"` → `"bg-blue-100 text-blue-800"`
- Default → `"bg-rose-100 text-rose-800"`

##### `isDepartmentTag`

**Tip:** `(tagName: string) => boolean`

**Descriere:** Verifică dacă un tag este un tag de departament.

**Tag-uri de Departament:** `['Horeca', 'Saloane', 'Frizerii', 'Reparatii']`

##### `getDepartmentBadgeStyle`

**Tip:** `(tagName: string) => string`

**Descriere:** Returnează stilurile CSS pentru badge-urile de departament.

**Mapare:**
- `'Horeca'` → Gradient portocaliu
- `'Saloane'` → Gradient verde smarald
- `'Frizerii'` → Gradient galben
- `'Reparatii'` → Gradient albastru
- Default → Gradient gri

**Event Handlers:**

##### `handleCardClick`

**Tip:** `(e: React.MouseEvent) => void`

**Descriere:** Gestionează click-ul pe card cu suport pentru selecție multiplă.

**Logica:**
- Previne deschiderea dacă click-ul este pe checkbox, butoane, sau drag handle
- Dacă este Ctrl+Click sau Cmd+Click, toggle selecția
- Altfel, apelează `onClick(e)`

##### `handleCheckboxChange`

**Tip:** `(checked: boolean) => void`

**Descriere:** Gestionează schimbarea checkbox-ului de selecție.

##### `handleStageSelect`

**Tip:** `(newStage: string) => void`

**Descriere:** Mută lead-ul într-un stage nou și închide meniul.

##### `handlePinToggle`

**Tip:** `(e: React.MouseEvent) => Promise<void>`

**Descriere:** Gestionează toggle-ul pin/unpin pentru lead.

**Pași:**
1. Previne propagarea evenimentului
2. Previne apelurile multiple dacă `isPinning === true`
3. Setează `isPinning = true`
4. Găsește sau creează tag-ul PINNED folosind `getOrCreatePinnedTag()`
5. Toggle tag-ul folosind `toggleLeadTag(lead.id, pinnedTag.id)`
6. Notifică părintele cu noua stare
7. Afișează toast de succes/eroare
8. Setează `isPinning = false`

**Render Conditional:**

##### Tipuri de Lead

Componenta detectează tipul de lead și afișează conținut diferit:

**1. Tray/Quote (`lead.isQuote || lead.type === 'tray'`)**
- Afișare minimalistă:
  - Header: Numele lead-ului (fără sumă în header)
  - Info: Număr tăviță (`trayNumber`) și dimensiune (`traySize`)
  - Tehnician + Status: Afișează tehnicianul și statusul tăviței (gata, in_lucru, etc.)
  - Timp în stage: Dacă există `inLucruSince` sau `inAsteptareSince`, afișează timpul

**2. Service File (`lead.type === 'service_file'`)**
- Afișare minimalistă:
  - Header: Numele lead-ului + număr fișă (`serviceFileNumber`)
  - Telefon: Dacă există

**3. Lead Normal (default)**
- Afișare completă:
  - Header: Nume + badge "NOU" dacă `leadAge.isNew`
  - Email: Cu iconiță Mail
  - Telefon: Cu iconiță Phone
  - Tehnician: Cu iconiță User
  - Data creării: Formatată inteligent
  - Timp în stage: Dacă este relevant

**Tag-uri:**

Afișează tag-urile lead-ului cu stilizare specială:

- **Tag-uri de Departament:** Badge-uri cu gradient și text alb
- **Tag-uri Urgent/Retur:** Badge-uri roșii cu animație `animate-border-strobe`
- **Alte Tag-uri:** Badge-uri colorate pe baza `tag.color`

**Acțiuni:**

- **Checkbox:** Pentru selecție multiplă (dacă `onSelectChange` este definit)
- **Pin Button:** Toggle pin/unpin (dacă `onPinToggle` este definit)
- **Drag Handle:** Iconiță GripVertical pentru drag & drop
- **Menu Dropdown:** Meniu cu opțiuni de mutare în stage-uri

**Total Lead:**

Dacă `pipelineName` există și nu include "vanzari", afișează totalul lead-ului în partea dreaptă jos (verde dacă > 0, gri dacă 0).

**Stilizare:**

- **Dragging:** Opacitate 50%, rotație 2°, scale 105%
- **Selected:** Border primar 2px, background primar cu opacitate 5%
- **Read-only:** Opacitate 75%, cursor not-allowed
- **Padding:** Mai mic pentru tăvițe (`p-2`), normal pentru lead-uri (`p-3`)

**Exemplu de Utilizare:**
```tsx
<LeadCard
  lead={lead}
  onMove={(leadId, newStage) => moveLead(leadId, newStage)}
  onClick={(e) => openDetails(lead)}
  onDragStart={() => setDraggedLead(lead.id)}
  onDragEnd={() => setDraggedLead(null)}
  isDragging={draggedLead === lead.id}
  stages={['Nou', 'In Lucru', 'Finalizat']}
  onPinToggle={(leadId, isPinned) => handlePinToggle(leadId, isPinned)}
  isSelected={selectedLeads.has(lead.id)}
  onSelectChange={(selected) => handleSelect(lead.id, selected)}
  leadTotal={123.45}
  pipelineName="Receptie"
/>
```

---

### `kanban-board.tsx`

**Locație:** `components/kanban-board.tsx`

**Descriere:** Componentă complexă care implementează un board Kanban complet cu drag & drop, selecție multiplă, mutare în batch, calculare totaluri pe stage, și suport pentru diferite tipuri de lead-uri.

**Dependențe:**
- `react` - useState, useEffect, useMemo, useCallback
- `@/components/lead-card` - LeadCard
- `@/lib/utils` - Funcția `cn`
- `@/lib/types/database` - Tipul KanbanLead
- `lucide-react` - Iconițe (Trash2, Loader2, TrendingUp, Inbox, Move, X)
- `@/hooks/useRole` - useRole
- `@/components/ui/button` - Button
- `@/components/ui/alert-dialog` - AlertDialog components
- `@/components/ui/skeleton` - Skeleton
- `@/components/ui/dialog` - Dialog components
- `@/components/ui/select` - Select components
- `@/components/ui/label` - Label

**Interfețe și Tipuri:**

#### `KanbanBoardProps`

**Proprietăți:**
- `leads: KanbanLead[]` - Array cu toate lead-urile
- `stages: string[]` - Array cu toate stage-urile
- `onLeadMove: (leadId: string, newStage: string) => void` - Callback pentru mutarea unui lead
- `onLeadClick: (lead: KanbanLead, event?: React.MouseEvent) => void` - Callback pentru click pe lead
- `onDeleteStage?: (stageName: string) => Promise<void>` - Callback opțional pentru ștergerea unui stage
- `currentPipelineName?: string` - Numele pipeline-ului curent
- `onPinToggle?: (leadId: string, isPinned: boolean) => void` - Callback opțional pentru pin/unpin
- `pipelines?: string[]` - Array cu pipeline-uri disponibile
- `onBulkMoveToStage?: (leadIds: string[], newStage: string) => Promise<void>` - Callback pentru mutare în batch pe stage
- `onBulkMoveToPipeline?: (leadIds: string[], pipelineName: string) => Promise<void>` - Callback pentru mutare în batch pe pipeline

**State Intern:**

##### `draggedLead`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** ID-ul lead-ului care este în proces de drag.

##### `selectedLeads`

**Tip:** `Set<string>`

**Valoare Inițială:** `new Set()`

**Descriere:** Set cu ID-urile lead-urilor selectate pentru mutare în batch.

##### `dragOverStage`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** Numele stage-ului peste care se face drag.

##### `stageTotals`

**Tip:** `Record<string, number>`

**Valoare Inițială:** `{}`

**Descriere:** Map cu totalurile pentru fiecare stage.

##### `loadingTotals`

**Tip:** `Record<string, boolean>`

**Valoare Inițială:** `{}`

**Descriere:** Map cu stările de încărcare pentru totaluri.

##### `leadTotals`

**Tip:** `Record<string, number>`

**Valoare Inițială:** `{}`

**Descriere:** Map cu totalurile pentru fiecare lead individual.

##### `confirmOpen`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Controlează deschiderea dialog-ului de confirmare pentru ștergere stage.

##### `targetStage`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** Stage-ul țintă pentru ștergere.

##### `deleting`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru starea de ștergere.

##### `deleteErr`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** Mesaj de eroare pentru ștergere.

##### `moveDialogOpen`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Controlează deschiderea dialog-ului pentru mutare în batch.

##### `moveType`

**Tip:** `'stage' | 'pipeline' | null`

**Valoare Inițială:** `null`

**Descriere:** Tipul de mutare (stage sau pipeline).

##### `selectedTargetStage`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Stage-ul țintă selectat pentru mutare.

##### `selectedTargetPipeline`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Pipeline-ul țintă selectat pentru mutare.

##### `isMoving`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru starea de mutare în batch.

**Hooks și Funcții:**

##### `useMemo` pentru `leadsByStage`

**Descriere:** Grupează lead-urile pe stage și le sortează.

**Logica de Sortare:**

1. **Prioritate Maximă:** Lead-urile pinned (cu tag 'PINNED') apar primul
2. **Prioritate Urgent:** Lead-urile cu tag 'urgent' apar după pinned
3. **Sortare Specială pentru Receptie:**
   - Pentru stage-urile "De confirmat" și "In asteptare", sortează după `stageMovedAt` (crescător - cele mutate mai devreme apar primele)
4. **Fallback:** Sortează după `createdAt` (crescător)

**Excluderi pentru Calcul Totaluri:**

- **Pipeline Vanzari:** Nu calculează totaluri deloc
- **Pipeline Receptie:** Exclude stage-urile: `['messages', 'de trimis', 'ridic personal', 'de confirmat']`

##### `useEffect` pentru Calcul Totaluri

**Descriere:** Calculează totalurile pentru fiecare stage folosind câmpul `total` din lead-uri.

**Logica:**
1. Verifică dacă suntem în pipeline-ul Vanzari - dacă da, setează toate totalurile la 0
2. Pentru fiecare stage (excluzând cele excluse în Receptie):
   - Obține lead-urile din stage
   - Pentru fiecare lead, adună `lead.total` la totalul stage-ului
   - Salvează totalul individual al lead-ului în `leadTotals`
3. Actualizează `stageTotals` și `loadingTotals`

**Optimizări:**
- Folosește batch requests pentru a evita query-uri multiple
- Exclude stage-urile relevante din Receptie
- Gestionează erorile setând totalurile la 0

**Event Handlers:**

##### `handleDragStart`

**Tip:** `(leadId: string) => void`

**Descriere:** Setează lead-ul curent ca fiind draguit.

##### `handleDragEnd`

**Tip:** `() => void`

**Descriere:** Resetează starea de drag.

##### `handleDragOver`

**Tip:** `(e: React.DragEvent, stage: string) => void`

**Descriere:** Gestionează evenimentul dragOver pentru a indica stage-ul țintă.

**Logica:** Previne comportamentul default și setează `dragOverStage`.

##### `handleDragLeave`

**Tip:** `(e: React.DragEvent) => void`

**Descriere:** Gestionează părăsirea zonei de drop.

**Logica:** Verifică dacă mouse-ul a părăsit cu adevărat containerul (nu doar un child) folosind `getBoundingClientRect()`.

##### `handleDrop`

**Tip:** `(e: React.DragEvent, stage: string) => void`

**Descriere:** Gestionează drop-ul unui lead într-un stage.

**Logica:**
1. Previne comportamentul default
2. Dacă există lead-uri selectate, mută-le pe toate folosind `onBulkMoveToStage`
3. Altfel, mută lead-ul draguit folosind `onLeadMove`
4. Resetează starea de drag

##### `handleLeadSelect`

**Tip:** `(leadId: string, isSelected: boolean) => void`

**Descriere:** Gestionează selecția/deselecția unui lead.

##### `handleSelectAll`

**Tip:** `() => void`

**Descriere:** Selectează sau deselectează toate lead-urile.

##### `handleOpenMoveDialog`

**Tip:** `(type: 'stage' | 'pipeline') => void`

**Descriere:** Deschide dialog-ul pentru mutare în batch.

##### `handleBulkMove`

**Tip:** `() => Promise<void>`

**Descriere:** Execută mutarea în batch a lead-urilor selectate.

**Logica:**
1. Verifică dacă există lead-uri selectate
2. Setează `isMoving = true`
3. Apelează `onBulkMoveToStage` sau `onBulkMoveToPipeline` în funcție de `moveType`
4. Resetează selecția și închide dialog-ul
5. Setează `isMoving = false`

##### `handleConfirmDelete`

**Tip:** `() => Promise<void>`

**Descriere:** Confirmă și execută ștergerea unui stage.

**Logica:**
1. Verifică dacă `targetStage` există
2. Setează `deleting = true`
3. Apelează `onDeleteStage(targetStage)`
4. Închide dialog-ul și resetează `targetStage`
5. Setează `deleting = false`

**Render:**

##### Toolbar pentru Selecție Multiplă

Dacă `selectedLeads.size > 0`, afișează un toolbar sticky cu:
- Numărul de lead-uri selectate
- Buton "Anulează" pentru deselectare
- Buton "Mută în Stage" (dacă `onBulkMoveToStage` există)
- Buton "Mută în Pipeline" (dacă `onBulkMoveToPipeline` există și `pipelines.length > 0`)

##### Stage Columns

Pentru fiecare stage, afișează o coloană cu:

**Header:**
- Numele stage-ului
- Numărul de lead-uri din stage
- Totalul stage-ului (ascuns pentru Vanzari și stage-urile excluse din Receptie)
- Buton de ștergere (doar pentru owner)

**Conținut:**
- Empty state dacă nu există lead-uri (cu mesaj și indicator de drop)
- Listă de `LeadCard` componente pentru fiecare lead
- Animații fade-in și slide-in pentru lead-uri noi

**Stilizare Stage Column:**
- Lățime fixă: `w-80`
- Background card cu border
- Efecte hover și drag-over: ring primar, scale 1.02, shadow-lg
- Scroll vertical pentru conținut: `h-[calc(100vh-280px)] min-h-[400px]`

##### Dialog-uri

**1. AlertDialog pentru Ștergere Stage:**
- Confirmare cu mesaj de avertizare
- Afișează eroarea dacă există
- Butoane Cancel și Delete

**2. Dialog pentru Mutare în Batch:**
- Select pentru stage sau pipeline
- Butoane Anulează și Mută
- Disabled state pentru butonul Mută dacă nu este selectat un țintă

**Exemplu de Utilizare:**
```tsx
<KanbanBoard
  leads={leads}
  stages={['Nou', 'In Lucru', 'Finalizat']}
  onLeadMove={(leadId, newStage) => moveLead(leadId, newStage)}
  onLeadClick={(lead, e) => openDetails(lead)}
  onDeleteStage={async (stageName) => await deleteStage(stageName)}
  currentPipelineName="Receptie"
  onPinToggle={(leadId, isPinned) => handlePinToggle(leadId, isPinned)}
  pipelines={['Vanzari', 'Receptie', 'Curier']}
  onBulkMoveToStage={async (leadIds, newStage) => await bulkMove(leadIds, newStage)}
  onBulkMoveToPipeline={async (leadIds, pipelineName) => await bulkMovePipeline(leadIds, pipelineName)}
/>
```

---

## 📋 Componente Lead Management (Continuare)

### `lead-history.tsx`

**Locație:** `components/lead-history.tsx`

**Descriere:** Componentă care afișează istoricul complet de evenimente pentru un lead, cu suport pentru real-time updates și renderizare specială pentru evenimente de tip "service_sheet_save" și "confirm".

**Dependențe:**
- `react` - useEffect, useState
- `@/lib/supabase/supabaseClient` - supabaseBrowser

**Tipuri:**

#### `LeadEvent`

**Proprietăți:**
- `id: string`
- `lead_id: string`
- `actor_id: string | null`
- `actor_name: string | null`
- `event_type: string`
- `message: string`
- `payload: Record<string, unknown>`
- `created_at: string`

**Funcții și Componente:**

#### `ItemTag` (Componentă Internă)

**Tip:** `React.FC<{ type?: string }>`

**Descriere:** Afișează un badge pentru tipul de item (Service sau Piesă).

**Logica:** Transformă `type` în lowercase și afișează "Service" sau "Piesă".

#### `renderServiceSheetDetails` (Funcție Helper)

**Tip:** `(payload: any) => React.ReactNode | null`

**Descriere:** Renderizează detaliile pentru evenimente de tip "service_sheet_save".

**Logica:**
- Extrage `diff` din `payload`
- Afișează 3 blocuri: "Adăugate", "Actualizate", "Șterse"
- Pentru fiecare bloc, listează items-urile cu tag-uri de tip și detalii (departament, tehnician)

#### `ConfirmBadge` (Componentă Internă)

**Tip:** `React.FC<{ type: string }>`

**Descriere:** Afișează un badge colorat pentru evenimente de confirmare.

**Mapare Tipuri:**
- `confirm_request` → "DE CONFIRMAT" (galben)
- `confirm_reply` → "RĂSPUNS CLIENT" (albastru)
- `confirm_done` → "CONFIRMAT" (verde)
- `confirm_auto_move` → "AUTO MOVE" (gri)

#### `LeadHistory` (Componentă Principală Default Exportată)

**Tip:** `React.FC<{ leadId: string }>`

**Descriere:** Componentă care încarcă și afișează istoricul de evenimente pentru un lead.

**Props:**
- `leadId: string` - ID-ul lead-ului pentru care se afișează istoricul

**State Intern:**

##### `items`

**Tip:** `LeadEvent[] | null`

**Valoare Inițială:** `null`

**Descriere:** Array cu evenimentele de istoric.

##### `loading`

**Tip:** `boolean`

**Valoare Inițială:** `true`

**Descriere:** Flag pentru starea de încărcare.

##### `error`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** Mesaj de eroare dacă există.

**Efecte:**

##### `useEffect` pentru Încărcare Inițială și Real-time

**Descriere:** Încarcă evenimentele inițiale și se abonează la actualizări în timp real.

**Logica:**
1. **Fetch Inițial:**
   - Query la `items_events` cu filtre: `type=eq.lead`, `item_id=eq.{leadId}`
   - Sortează descrescător după `created_at`
   - Limitează la 200 de rezultate
   - Transformă `item_id` în `lead_id` pentru compatibilitate cu tipul `LeadEvent`

2. **Real-time Subscription:**
   - Creează un canal Supabase pentru `lead_events_{leadId}`
   - Ascultă pentru INSERT-uri în `items_events` cu filtrele corespunzătoare
   - Adaugă evenimentele noi la începutul listei (`[event, ...prev]`)

3. **Cleanup:**
   - Setează `cancelled = true` pentru a preveni actualizări după unmount
   - Elimină canalul Supabase

**Render Conditional:**

##### Loading State

Dacă `loading === true`, afișează mesajul "Se încarcă istoricul…".

##### Error State

Dacă `error` există, afișează mesajul de eroare cu stil `text-destructive`.

##### Empty State

Dacă `items` este null sau gol, afișează mesajul "Nu există evenimente încă.".

##### Events List

Dacă există evenimente, afișează fiecare eveniment într-un card cu:
- **Header:** Data și ora formatată (`toLocaleString()`), badge de confirmare (dacă este cazul), numele actorului
- **Conținut:** Mesajul evenimentului (`whitespace-pre-wrap` pentru păstrarea formatării)
- **Detalii Speciale:** Dacă `event_type === "service_sheet_save"`, afișează detaliile folosind `renderServiceSheetDetails`

**Stilizare:**
- Container: `space-y-3 max-h-160 overflow-y-auto`
- Card: `rounded-lg border p-3`
- Header: `flex items-center justify-between text-xs text-muted-foreground`
- Mesaj: `text-sm leading-relaxed whitespace-pre-wrap`

**Exemplu de Utilizare:**
```tsx
<LeadHistory leadId="123e4567-e89b-12d3-a456-426614174000" />
```

---

### `lead-messenger.tsx`

**Locație:** `components/lead-messenger.tsx`

**Descriere:** Componentă complexă care implementează un sistem de mesagerie în timp real între recepție și tehnicieni pentru un lead specific.

**Dependențe:**
- `react` - useEffect, useState, useRef, useMemo, useCallback
- `@/lib/supabase/supabaseClient` - supabaseBrowser
- `@/components/ui/button` - Button
- `@/components/ui/textarea` - Textarea
- `@/components/ui/scroll-area` - ScrollArea
- `lucide-react` - Iconițe (Send, MessageSquare, Loader2, User, Wrench)
- `@/hooks/useAuth` - useAuth
- `date-fns` - format, isToday, isYesterday, formatDistanceToNow
- `date-fns/locale/ro` - Localizare română
- `sonner` - toast
- `@/lib/utils` - Funcția `cn`

**Interfețe și Tipuri:**

#### `LeadMessage`

**Tip:** Interface Exportată

**Proprietăți:**
- `id: string`
- `lead_id: string`
- `sender_id: string`
- `sender_name: string`
- `sender_role: string`
- `message: string`
- `created_at: string`

#### `LeadMessengerProps`

**Proprietăți:**
- `leadId: string` - ID-ul lead-ului
- `leadTechnician?: string | null` - Numele tehnicianului asociat (opțional)

**State Intern:**

##### `messages`

**Tip:** `LeadMessage[]`

**Valoare Inițială:** `[]`

**Descriere:** Array cu toate mesajele pentru lead.

##### `newMessage`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Textul mesajului nou de trimis.

##### `loading`

**Tip:** `boolean`

**Valoare Inițială:** `true`

**Descriere:** Flag pentru starea de încărcare inițială.

##### `sending`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru starea de trimitere.

##### `userRole`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** Rolul utilizatorului curent.

##### `userName`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Numele utilizatorului curent.

##### `pendingMessage`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** ID-ul mesajului optimist în așteptare de confirmare.

**Refs:**

##### `messagesEndRef`

**Tip:** `RefObject<HTMLDivElement>`

**Descriere:** Referință la elementul de la sfârșitul listei de mesaje pentru auto-scroll.

##### `textareaRef`

**Tip:** `RefObject<HTMLTextAreaElement>`

**Descriere:** Referință la textarea pentru auto-resize.

**Efecte:**

##### `useEffect` pentru Obținere Info Utilizator

**Descriere:** Obține rolul și numele utilizatorului din baza de date.

**Logica:**
1. Verifică dacă `user` există
2. Obține rolul din `app_members` pentru `user_id`
3. Verifică dacă utilizatorul este tehnician în tabelul `technicians`
4. Dacă este tehnician, setează `userName` din `technicians.name` și `userRole = 'technician'`
5. Altfel, folosește email-ul sau numele din metadata

##### `useEffect` pentru Încărcare Mesaje și Real-time

**Descriere:** Încarcă mesajele inițiale și se abonează la actualizări în timp real.

**Logica:**
1. **Fetch Inițial:**
   - Query la `lead_messages` cu filtru `lead_id=eq.{leadId}`
   - Sortează crescător după `created_at`
   - Setează `messages` cu rezultatele

2. **Real-time Subscription:**
   - Creează canal Supabase pentru `lead_messages:{leadId}`
   - Ascultă pentru INSERT, UPDATE, DELETE
   - **INSERT:** Adaugă mesajul nou la sfârșitul listei
   - **UPDATE:** Actualizează mesajul existent
   - **DELETE:** Elimină mesajul din listă

3. **Cleanup:** Elimină canalul Supabase

##### `useEffect` pentru Auto-scroll

**Descriere:** Face scroll automat la ultimul mesaj când se adaugă mesaje noi.

**Logica:** Folosește `setTimeout` cu 100ms delay pentru a permite render-ul să se finalizeze înainte de scroll.

##### `useEffect` pentru Auto-resize Textarea

**Descriere:** Ajustează automat înălțimea textarea-ului în funcție de conținut.

**Logica:**
- Setează `height = 'auto'`
- Ajustează la `scrollHeight` cu limită maximă de 120px

**Funcții:**

##### `handleSendMessage`

**Tip:** `() => Promise<void>`

**Descriere:** Trimite un mesaj nou cu optimistic update.

**Pași:**
1. Validează că există text, user, și userRole
2. Creează un mesaj optimist cu ID temporar (`temp-${Date.now()}`)
3. Adaugă mesajul optimist la listă
4. Setează `pendingMessage` la ID-ul temporar
5. Trimite mesajul la server folosind `supabase.from('lead_messages').insert()`
6. **Succes:** Înlocuiește mesajul optimist cu cel real
7. **Eroare:** Elimină mesajul optimist și restaurează textul

**Optimistic Update:**
- Mesajul apare imediat în UI pentru feedback instant
- Dacă trimiterea eșuează, mesajul este eliminat și textul este restaurat

##### `useMemo` pentru `groupedMessages`

**Descriere:** Grupează mesajele pe zile pentru o afișare mai clară.

**Return:** `Array<{ date: string; messages: LeadMessage[] }>`

**Logica:**
- Grupează mesajele după data formatată ca `yyyy-MM-dd`
- Returnează array de grupuri cu data și mesajele din acea zi

##### `formatGroupDate`

**Tip:** `(dateStr: string) => string`

**Descriere:** Formatează data pentru header-ul de grup.

**Logica:**
- Dacă este astăzi: "Astăzi"
- Dacă este ieri: "Ieri"
- Altfel: `format(date, 'dd MMMM yyyy', { locale: ro })`

**Render Conditional:**

##### Unauthenticated State

Dacă `!user`, afișează mesajul "Trebuie să fii autentificat pentru a folosi mesageria.".

##### Header

Afișează iconița MessageSquare, label "Mesagerie", și numele tehnicianului (dacă există).

##### Messages Area

**Loading State:**
- Afișează Loader2 spinner și mesaj "Se încarcă mesajele..."

**Empty State:**
- Afișează iconiță MessageSquare, mesaj "Nu există mesaje încă" și descriere

**Messages List:**
- Pentru fiecare grup de zile:
  - Header cu data formatată și linii decorative
  - Pentru fiecare mesaj din grup:
    - **Avatar:** Iconiță User sau Wrench (pentru tehnician) pentru mesajele altora
    - **Bubble:** 
      - Mesajele proprii: Background primar, text primar-foreground, rounded-br-sm
      - Mesajele de la tehnician: Background albastru, border albastru
      - Alte mesaje: Background muted
    - **Timestamp:** 
      - Dacă este recent (astăzi): `formatDistanceToNow` cu sufix
      - Altfel: `format(date, 'HH:mm')`
    - **Pending Indicator:** Loader2 spinner dacă mesajul este în așteptare

##### Input Area

- Textarea cu auto-resize
- Placeholder diferit pentru tehnician vs recepție
- Hint pentru Enter/Shift+Enter
- Buton Send cu iconiță Send sau Loader2 dacă se trimite

**Exemplu de Utilizare:**
```tsx
<LeadMessenger 
  leadId="123e4567-e89b-12d3-a456-426614174000" 
  leadTechnician="Ion Popescu" 
/>
```

---

### `lead-modal.tsx`

**Locație:** `components/lead-modal.tsx`

**Descriere:** Componentă modal simplă care afișează detalii despre un lead și permite mutarea între stage-uri și pipeline-uri.

**Dependențe:**
- `react` - useEffect
- `@/components/ui/dialog` - Dialog components
- `@/components/ui/button` - Button
- `@/components/ui/badge` - Badge
- `@/components/ui/select` - Select components
- `date-fns` - format
- `@/app/(crm)/dashboard/page` - Tipul Lead

**Interfețe și Tipuri:**

#### `LeadModalProps`

**Proprietăți:**
- `lead: Lead | null` - Lead-ul de afișat sau null
- `isOpen: boolean` - Controlează deschiderea modal-ului
- `onClose: () => void` - Callback pentru închidere
- `onStageChange: (leadId: string, newStageName: string) => void` - Callback pentru schimbare stage
- `stages: string[]` - Array cu stage-uri disponibile
- `pipelines: string[]` - Array cu pipeline-uri disponibile
- `pipelineSlug?: string` - Slug-ul pipeline-ului curent
- `onMoveToPipeline: (leadId: string, targetPipelineName: string) => void` - Callback pentru mutare pipeline
- `pipelineOptions?: { name: string; activeStages: number }[]` - Opțiuni de pipeline cu număr de stage-uri active

**Funcții:**

##### `toSlug`

**Tip:** `(s: string) => string`

**Descriere:** Transformă un string în slug (lowercase, spații înlocuite cu `-`).

**Exemplu:** `"Vânzări"` → `"vanzari"`

##### `handleStageChange`

**Tip:** `(newStageName: string) => void`

**Descriere:** Gestionează schimbarea stage-ului.

**Logica:** Apelează `onStageChange(lead.id, newStageName)`.

**Efecte:**

##### `useEffect` pentru Keyboard Shortcut

**Descriere:** Permite închiderea modal-ului cu tasta Escape.

**Logica:**
- Adaugă event listener pentru `keydown`
- Dacă tasta este "Escape", apelează `onClose()`
- Cleanup: Elimină event listener-ul

**Render:**

##### Null Check

Dacă `lead` este null, returnează `null`.

##### Dialog Content

**Header:**
- Titlu: Numele lead-ului

**Conținut:**
- **Grid 2 coloane** cu informații:
  - Name, Company (dacă există), Phone (dacă există), Email (dacă există)
- **Current Stage:**
  - Badge cu stage-ul curent
- **Notes:**
  - Dacă există notes, afișează textul
- **Grid 2 coloane** cu date:
  - Created At (dacă există): `format(lead.createdAt, "MMM dd, yyyy")`
  - Last Activity (dacă există): `format(lead.lastActivity, "MMM dd, yyyy")`
- **Move to Stage:**
  - Select dropdown cu toate stage-urile disponibile
  - Valoarea curentă este `lead.stage`
- **Move to Pipeline:**
  - Select dropdown cu pipeline-urile disponibile
  - Disabled pentru pipeline-ul curent (`toSlug(name) === pipelineSlug`)
  - Disabled pentru pipeline-uri fără stage-uri active (`activeStages === 0`)
  - Afișează "(no stages)" pentru pipeline-uri fără stage-uri

**Footer:**
- Buton "Close" care apelează `onClose()`

**Exemplu de Utilizare:**
```tsx
<LeadModal
  lead={selectedLead}
  isOpen={isModalOpen}
  onClose={() => setIsModalOpen(false)}
  onStageChange={(leadId, newStage) => moveToStage(leadId, newStage)}
  stages={['Nou', 'In Lucru', 'Finalizat']}
  pipelines={['Vanzari', 'Receptie']}
  pipelineSlug="vanzari"
  onMoveToPipeline={(leadId, pipelineName) => moveToPipeline(leadId, pipelineName)}
  pipelineOptions={[
    { name: 'Vanzari', activeStages: 5 },
    { name: 'Receptie', activeStages: 0 }
  ]}
/>
```

---

### `pipeline-editor.tsx`

**Locație:** `components/pipeline-editor.tsx`

**Descriere:** Componentă modal pentru editarea unui pipeline și a stage-urilor sale, cu suport pentru drag & drop pentru reordonare și editare inline a numelor stage-urilor.

**Dependențe:**
- `react` - useEffect, useMemo, useState
- `@/components/ui/dialog` - Dialog components
- `@/components/ui/input` - Input
- `@/components/ui/label` - Label
- `@/components/ui/button` - Button
- `lucide-react` - Iconițe (GripVertical, Pencil, Check, X)

**Tipuri:**

#### `StageItem`

**Tip:** Type Alias

**Proprietăți:**
- `id: string`
- `name: string`

#### `Props`

**Proprietăți:**
- `open: boolean` - Controlează deschiderea dialog-ului
- `onOpenChange: (v: boolean) => void` - Callback pentru schimbarea stării de deschidere
- `pipelineName: string` - Numele pipeline-ului de editat
- `stages: StageItem[]` - Array cu stage-urile existente
- `onSubmit: (payload: { pipelineName: string; stages: StageItem[] }) => void | Promise<void>` - Callback pentru salvare

**State Intern:**

##### `name`

**Tip:** `string`

**Valoare Inițială:** `pipelineName`

**Descriere:** Numele pipeline-ului editat.

##### `items`

**Tip:** `StageItem[]`

**Valoare Inițială:** `stages`

**Descriere:** Array cu stage-urile editate.

##### `dragIndex`

**Tip:** `number | null`

**Valoare Inițială:** `null`

**Descriere:** Index-ul stage-ului care este în proces de drag.

##### `editingId`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** ID-ul stage-ului care este în proces de editare.

##### `editingValue`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Valoarea temporară pentru editarea numelui stage-ului.

**Efecte:**

##### `useEffect` pentru Reset la Deschidere

**Descriere:** Resetează state-ul când dialog-ul se deschide.

**Logica:**
- Setează `name` la `pipelineName`
- Setează `items` la `stages`
- Resetează `editingId` la `null`

##### `useMemo` pentru `hasChanges`

**Descriere:** Verifică dacă există modificări față de valorile inițiale.

**Logica:**
1. Compară `name.trim()` cu `pipelineName.trim()`
2. Compară `items.length` cu `stages.length`
3. Compară fiecare item după `id` și `name.trim()`
4. Returnează `true` dacă există diferențe

**Funcții:**

##### Drag Handlers (HTML5 Drag & Drop)

**1. `onDragStart`**
**Tip:** `(index: number) => () => void`
**Descriere:** Setează `dragIndex` la index-ul stage-ului draguit.

**2. `onDragOver`**
**Tip:** `(index: number) => (e: React.DragEvent) => void`
**Descriere:** Gestionează dragOver pentru reordonare.

**Logica:**
- Previne comportamentul default
- Dacă `dragIndex !== null` și `dragIndex !== index`:
  - Mută stage-ul de la `dragIndex` la `index`
  - Actualizează `dragIndex` la `index`

**3. `onDragEnd`**
**Tip:** `() => void`
**Descriere:** Resetează `dragIndex` la `null`.

##### Edit Handlers

**1. `startEdit`**
**Tip:** `(id: string, current: string) => void`
**Descriere:** Începe editarea unui stage.

**Logica:** Setează `editingId` la `id` și `editingValue` la `current`.

**2. `cancelEdit`**
**Tip:** `() => void`
**Descriere:** Anulează editarea.

**Logica:** Resetează `editingId` și `editingValue`.

**3. `commitEdit`**
**Tip:** `() => void`
**Descriere:** Salvează editarea.

**Logica:**
- Actualizează `items` cu noul nume (trimmed sau numele original dacă este gol)
- Apelează `cancelEdit()`

**Keyboard Shortcuts pentru Edit:**
- **Enter:** Apelează `commitEdit()`
- **Escape:** Apelează `cancelEdit()`

##### `handleSave`

**Tip:** `() => Promise<void>`

**Descriere:** Salvează modificările și închide dialog-ul.

**Logica:**
1. Apelează `onSubmit({ pipelineName: name.trim(), stages: items })`
2. Apelează `onOpenChange(false)`

**Render:**

##### Dialog Content

**Header:**
- Titlu: "Edit board"

**Conținut:**
- **Pipeline Name Input:**
  - Label: "Pipeline name"
  - Input controlat cu `value={name}` și `onChange`

- **Stages List:**
  - Label: "Stages (drag to reorder)"
  - Listă de stage-uri cu:
    - **Drag Handle:** Iconiță GripVertical (cursor-grab)
    - **Nume Stage:**
      - Dacă `isEditing`: Input cu `editingValue`, autoFocus, keyboard shortcuts
      - Altfel: Span cu numele stage-ului
    - **Acțiuni:**
      - Dacă `isEditing`: Butoane Check și X pentru commit/cancel
      - Altfel: Buton Pencil pentru start edit

**Footer:**
- Buton "Close" (variant outline)
- Buton "Save" (disabled dacă `!hasChanges`)

**Stilizare:**
- Stage items: `rounded border px-2 py-1 bg-background`
- Drag handle: `cursor-grab`
- Edit input: Auto-focus când se deschide editarea

**Exemplu de Utilizare:**
```tsx
<PipelineEditor
  open={isEditorOpen}
  onOpenChange={setIsEditorOpen}
  pipelineName="Vanzari"
  stages={[
    { id: '1', name: 'Nou' },
    { id: '2', name: 'In Lucru' }
  ]}
  onSubmit={async ({ pipelineName, stages }) => {
    await updatePipeline(pipelineName, stages)
  }}
/>
```

---

### `de-confirmat.tsx`

**Locație:** `components/de-confirmat.tsx`

**Descriere:** Componentă specializată pentru gestionarea procesului de confirmare a comenzilor între tehnician și operator, cu mutare automată între stage-uri și istoric de conversație.

**Dependențe:**
- `react` - useState, useEffect, useMemo
- `@/components/ui/button` - Button
- `@/lib/supabase/supabaseClient` - supabaseBrowser
- `@/lib/supabase/leadOperations` - logLeadEvent
- `@/hooks/use-toast` - useToast
- `next/navigation` - useRouter

**Tipuri:**

#### `Props`

**Proprietăți:**
- `leadId: string` - ID-ul lead-ului
- `onMoveStage: (newStage: string) => void` - Callback pentru mutare stage

#### `Ev`

**Proprietăți:**
- `id: string`
- `actor_name: string | null`
- `event_type: string`
- `message: string`
- `created_at: string`

**State Intern:**

##### `req`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Textul cererii de confirmare de la tehnician.

##### `reply`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Textul răspunsului de la operator.

##### `items`

**Tip:** `Ev[]`

**Valoare Inițială:** `[]`

**Descriere:** Array cu evenimentele de confirmare.

##### `loading`

**Tip:** `boolean`

**Valoare Inițială:** `true`

**Descriere:** Flag pentru starea de încărcare.

**Funcții:**

##### `pushUnique`

**Tip:** `(list: Ev[], entry: Ev) => Ev[]`

**Descriere:** Adaugă un eveniment la listă evitând duplicatele.

**Logica:**
- Creează un nou array cu `entry` la început
- Folosește un `Set` pentru a filtra duplicatele după `id`
- Returnează array-ul fără duplicate

##### `moveEverywhere`

**Tip:** `(fromName: string, toName: string) => Promise<Array<any>>`

**Descriere:** Mută lead-ul între stage-uri pe toate pipeline-urile folosind RPC.

**Logica:**
- Apelează `supabase.rpc("auto_move_lead_confirm", { p_lead_id, p_from_name, p_to_name })`
- Returnează array-ul de rezultate

**Efecte:**

##### `useEffect` pentru Încărcare Evenimente și Real-time

**Descriere:** Încarcă evenimentele de confirmare și se abonează la actualizări.

**Logica:**
1. **Fetch Inițial:**
   - Query la `items_events` cu filtre:
     - `type=eq.lead`
     - `item_id=eq.{leadId}`
     - `event_type` în `["confirm_request", "confirm_reply", "confirm_done"]`
   - Sortează descrescător după `created_at`
   - Elimină duplicatele folosind `Set`

2. **Real-time Subscription:**
   - Creează canal Supabase pentru `lead_conf_{leadId}`
   - Ascultă pentru INSERT-uri în `items_events` cu filtrele corespunzătoare
   - Filtrează doar evenimentele de tip confirmare
   - Adaugă evenimentele noi folosind `pushUnique`

3. **Cleanup:** Setează `cancelled = true` și elimină canalul

**Funcții de Acțiune:**

##### `sendRequest`

**Tip:** `() => Promise<void>`

**Descriere:** Trimite cererea de confirmare de la tehnician și mută lead-ul în "DE CONFIRMAT".

**Pași:**
1. Validează că `req.trim()` nu este gol
2. Loghează evenimentul cu `logLeadEvent(leadId, req.trim(), "confirm_request", {})`
3. Adaugă evenimentul la listă
4. Mută lead-ul de la "IN LUCRU" la "DE CONFIRMAT" folosind `moveEverywhere`
5. Apelează `onMoveStage("DE CONFIRMAT")`
6. Apelează `router.refresh()`
7. Resetează `req` la `''`
8. Afișează toast de succes sau eroare

##### `sendReply`

**Tip:** `() => Promise<void>`

**Descriere:** Trimite răspunsul de la operator.

**Pași:**
1. Validează că `reply.trim()` nu este gol
2. Loghează evenimentul cu `logLeadEvent(leadId, reply.trim(), "confirm_reply", {})`
3. Adaugă evenimentul la listă
4. Resetează `reply` la `''`

##### `markConfirmed`

**Tip:** `() => Promise<void>`

**Descriere:** Marchează confirmarea ca finalizată și mută lead-ul înapoi în "IN LUCRU".

**Pași:**
1. Loghează evenimentul cu `logLeadEvent(leadId, "Confirmarea clientului...", "confirm_done", {})`
2. Adaugă evenimentul la listă
3. Mută lead-ul de la "DE CONFIRMAT" la "IN LUCRU" folosind `moveEverywhere`
4. Apelează `onMoveStage("IN LUCRU")`
5. Apelează `router.refresh()`
6. Afișează toast de succes sau eroare

##### `useMemo` pentru `renderItems`

**Descriere:** Elimină duplicatele din items pentru render.

**Logica:** Folosește un `Set` pentru a filtra duplicatele după `id`.

**Render:**

##### Header

Titlu: "De confirmat la client"

##### Technician Block

- Label: "Ce trebuie confirmat"
- Textarea pentru `req` (h-24, placeholder descriptiv)
- Buton "Trimite la confirmare &rarr; DE CONFIRMAT" (disabled dacă `req.trim()` este gol)

##### Operator Block

- Label: "Răspunsul clientului / notițe operator"
- Textarea pentru `reply` (h-20, placeholder descriptiv)
- Butoane:
  - "Trimite mesaj" (variant outline, disabled dacă `reply.trim()` este gol)
  - "Marchează confirmat &rarr; IN LUCRU"

##### History Thread

- Label: "Istoric "De confirmat""
- Container cu scroll (`max-h-80 overflow-y-auto`)
- **Loading:** "Se încarcă…"
- **Empty:** "Nu există mesaje încă."
- **Items:** Pentru fiecare eveniment:
  - Card cu border
  - Header: Data formatată (`toLocaleString()`) și numele actorului
  - Conținut: Mesajul (`whitespace-pre-wrap`)

**Stilizare:**
- Blocks: `rounded border p-3 bg-muted/30`
- Textareas: `w-full rounded-md border p-2 bg-background`
- History items: `rounded border p-2`

**Exemplu de Utilizare:**
```tsx
<DeConfirmat
  leadId="123e4567-e89b-12d3-a456-426614174000"
  onMoveStage={(newStage) => moveToStage(newStage)}
/>
```

---

## 🎨 Componente Utilitare

### `theme-provider.tsx`

**Locație:** `components/theme-provider.tsx`

**Descriere:** Componentă wrapper pentru `next-themes` ThemeProvider care oferă suport pentru dark mode și light mode.

**Dependențe:**
- `react` - React
- `next-themes` - ThemeProvider, ThemeProviderProps

**Funcții și Componente Exportate:**

#### `ThemeProvider` (Componentă Exportată)

**Tip:** `React.FC<ThemeProviderProps>`

**Descriere:** Wrapper component care înfășoară `NextThemesProvider` din `next-themes`.

**Props:** Acceptă toate props-urile din `ThemeProviderProps` (children, attribute, defaultTheme, enableSystem, storageKey, etc.)

**Logica:** Returnează direct `<NextThemesProvider {...props}>{children}</NextThemesProvider>`.

**Exemplu de Utilizare:**
```tsx
<ThemeProvider
  attribute="class"
  defaultTheme="system"
  enableSystem
>
  <App />
</ThemeProvider>
```

---

### `sidebar.tsx`

**Locație:** `components/sidebar.tsx`

**Descriere:** Componentă sidebar complexă care oferă navigare principală, gestionare pipeline-uri, și adăugare membri, cu suport pentru roluri diferite și filtrare pentru tehnicieni.

**Dependențe:**
- `react` - useCallback, useEffect, useState
- `next/link` - Link
- `next/navigation` - usePathname, useRouter
- `lucide-react` - Iconițe (Plus, Users, UserPlus, LayoutDashboard, Trash2, ShoppingCart, Scissors, Wrench, Building, Target, Briefcase, Phone, Package, Sparkles, Shield, Settings)
- `@/components/ui/button` - Button
- `@/components/ui/dialog` - Dialog components
- `@/lib/utils` - Funcția `cn`
- `@/hooks/useRole` - useRole
- `@/lib/supabase/leadOperations` - getPipelinesWithStages
- `@/lib/supabase/supabaseClient` - supabaseBrowser
- `@/hooks/useAuth` - useAuth

**Interfețe și Tipuri:**

#### `SidebarProps`

**Proprietăți:**
- `canManagePipelines?: boolean` - Flag opțional pentru permisiunea de gestionare pipeline-uri

**Funcții Helper:**

##### `toSlug`

**Tip:** `(s: string) => string`

**Descriere:** Transformă un string în slug.

##### `getPipelineIcon`

**Tip:** `(pipelineName: string) => React.ReactNode`

**Descriere:** Returnează iconița corespunzătoare pentru un pipeline.

**Mapare:**
- `receptie/reception` → Phone
- `frizeri/frizerie/barber` → Scissors
- `saloane/salon` → Sparkles
- `curier/delivery/livrare` → Package
- `vanzari/sales` → ShoppingCart
- `reparati/service` → Wrench
- `horeca/corporate/business` → Building
- `marketing/campanii` → Target
- Default → Briefcase

**State Intern:**

##### `pipeNames`

**Tip:** `string[]`

**Valoare Inițială:** `[]`

**Descriere:** Array cu numele pipeline-urilor.

##### `isTechnician`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru verificarea dacă utilizatorul este tehnician.

##### `createOpen`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Controlează deschiderea dialog-ului de creare pipeline.

##### `pipelineName`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Numele noului pipeline de creat.

##### `creating`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru starea de creare.

##### `createError`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** Mesaj de eroare pentru creare.

##### `deleteOpen`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Controlează deschiderea dialog-ului de ștergere pipeline.

##### `deleteTargetName`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** Numele pipeline-ului de șters.

##### `deleting`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru starea de ștergere.

##### `addOpen`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Controlează deschiderea panel-ului de adăugare membri.

##### `email`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Email-ul noului membru.

##### `password`

**Tip:** `string`

**Valoare Inițială:** `''`

**Descriere:** Parola temporară pentru noul membru.

##### `role`

**Tip:** `"admin" | "owner" | "member"`

**Valoare Inițială:** `"admin"`

**Descriere:** Rolul noului membru.

##### `submitting`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru starea de submit.

##### `msg`

**Tip:** `string | null`

**Valoare Inițială:** `null`

**Descriere:** Mesaj de feedback pentru adăugare membru.

**Efecte:**

##### `useEffect` pentru Verificare Tehnician

**Descriere:** Verifică dacă utilizatorul este tehnician.

**Logica:**
- Query la `app_members` pentru `user_id`
- Dacă există și `role !== 'owner' && role !== 'admin'`, setează `isTechnician = true`

##### `useEffect` pentru Reload Pipeline-uri

**Descriere:** Reîncarcă pipeline-urile la mount și la schimbarea rutei.

**Logica:**
1. Apelează `reloadPipes()` imediat
2. Ascultă pentru event-ul custom `"pipelines:updated"`
3. La event, reapelează `reloadPipes()`

**Funcții:**

##### `reloadPipes`

**Tip:** `() => Promise<void>`

**Descriere:** Reîncarcă lista de pipeline-uri.

**Logica:**
1. Apelează `getPipelinesWithStages()`
2. Extrage numele pipeline-urilor
3. **Pentru tehnicieni:** Filtrează doar pipeline-urile departamentelor (`['Saloane', 'Frizerii', 'Horeca', 'Reparatii']`)
4. Setează `pipeNames`

##### `handleCreatePipeline`

**Tip:** `(e: React.FormEvent) => Promise<void>`

**Descriere:** Creează un pipeline nou.

**Pași:**
1. Previne submit-ul default
2. Setează `creating = true` și `createError = null`
3. POST la `/api/pipelines` cu `{ name: pipelineName.trim() }`
4. Dacă succes, închide dialog-ul, resetează `pipelineName`, reîncarcă pipeline-urile, și dispatch event `"pipelines:updated"`
5. Dacă eroare, setează `createError`
6. Setează `creating = false`

##### `openDelete`

**Tip:** `(p: string, e?: React.MouseEvent) => void`

**Descriere:** Deschide dialog-ul de ștergere pentru un pipeline.

**Logica:** Previne propagarea evenimentului și setează `deleteTargetName` și `deleteOpen = true`.

##### `handleConfirmDelete`

**Tip:** `() => Promise<void>`

**Descriere:** Confirmă și execută ștergerea unui pipeline.

**Pași:**
1. Verifică dacă `deleteTargetName` există
2. Setează `deleting = true`
3. DELETE la `/api/pipelines?name={deleteTargetName}`
4. Dacă succes, închide dialog-ul, salvează numele pipeline-ului șters, reîncarcă pipeline-urile, dispatch event, și redirect la dashboard dacă suntem pe pipeline-ul șters
5. Dacă eroare, afișează alert

##### `onAddMember`

**Tip:** `(e: React.FormEvent) => Promise<void>`

**Descriere:** Adaugă un membru nou.

**Pași:**
1. Previne submit-ul default
2. Setează `submitting = true` și `msg = null`
3. POST la `/api/admin/members/add` cu `{ email, password, role }`
4. Dacă succes, setează `msg = "Member added ✅"` și resetează formularul
5. Dacă eroare, setează `msg = "Error: {message}"`
6. Setează `submitting = false`

**Render:**

##### Sidebar Container

- Background: `bg-sidebar`
- Border: `border-r border-sidebar-border`
- Padding: `p-6`

##### Header

- Iconiță Users și titlu "ascutzit.ro – CRM"

##### Main Navigation

- **Dashboard:** Link către `/dashboard` cu iconiță LayoutDashboard
- **Catalog:** Link către `/configurari/catalog` (doar pentru owner și admin) cu iconiță Settings
- **Admins:** Link către `/admins` (doar pentru owner) cu iconiță Shield

##### Pipelines Section

- **Header:** Label "Pipelines" și buton "+" pentru adăugare (doar dacă `canManage`)
- **Listă Pipeline-uri:**
  - Pentru fiecare pipeline:
    - Link către `/leads/{slug}` cu iconiță corespunzătoare
    - Buton de ștergere (doar dacă `canManage`)
    - Stil activ pentru pipeline-ul curent (`pathname === href`)

##### Configurari Link

- Link către `/configurari` cu iconiță Wrench

##### Add Members Section

- Buton "Add members" cu iconiță UserPlus
- Dacă `addOpen === true`, afișează formular cu:
  - Input Email (type email, required)
  - Input Password (type password, required, cu hint)
  - Select Role (admin, owner, member)
  - Buton "Add member" (disabled dacă `submitting`)
  - Mesaj de feedback (`msg`)

##### Dialog-uri

**1. Create Pipeline Dialog:**
- Input pentru nume pipeline
- Butoane Cancel și Create
- Mesaj de eroare dacă există

**2. Delete Pipeline Dialog:**
- Mesaj de confirmare cu avertizare
- Butoane Cancel și Delete (variant destructive)

**Exemplu de Utilizare:**
```tsx
<Sidebar canManagePipelines={isOwner} />
```

---

## 📱 Componente Mobile

### `lazy/index.tsx`

**Locație:** `components/lazy/index.tsx`

**Descriere:** Modul care exportă componente lazy-loaded folosind `next/dynamic` pentru optimizarea bundle-ului și performanță.

**Dependențe:**
- `react` - React
- `next/dynamic` - dynamic

**Componente Exportate:**

#### `LazyKanbanBoard`

**Descriere:** Versiune lazy-loaded a componentei KanbanBoard.

**Configurație:**
- Loading: Skeleton cu `animate-pulse h-96 bg-muted rounded-lg`
- SSR: `false` (nu e nevoie de SSR pentru board interactiv)

#### `LazyLeadDetailsPanel`

**Descriere:** Versiune lazy-loaded a componentei LeadDetailsPanel.

**Configurație:**
- Loading: Skeleton cu `animate-pulse h-full bg-muted rounded-lg`

#### `LazyPreturi`

**Descriere:** Versiune lazy-loaded a componentei Preturi (foarte grea).

**Configurație:**
- Loading: Skeleton complex cu multiple elemente
- SSR: `false`

#### `LazyPrintView`

**Descriere:** Versiune lazy-loaded a componentei PrintView.

**Configurație:**
- SSR: `false` (nu e nevoie de SSR pentru print)

#### `LazyDashboardCharts`

**Descriere:** Versiune lazy-loaded a componentei DashboardCharts.

**Configurație:**
- Loading: Skeleton cu `animate-pulse h-64 bg-muted rounded-lg`
- SSR: `false`

#### `LazyMobileBoardLayout`

**Descriere:** Versiune lazy-loaded a componentei MobileBoardLayout.

**Configurație:**
- SSR: `false`

#### `LazyLeadDetailsSheet`

**Descriere:** Versiune lazy-loaded a componentei LeadDetailsSheet.

**Configurație:**
- SSR: `false`

**Exemplu de Utilizare:**
```tsx
import { LazyKanbanBoard } from '@/components/lazy'

function Page() {
  return <LazyKanbanBoard leads={leads} stages={stages} />
}
```

---

### `mobile/stage-tabs.tsx`

**Locație:** `components/mobile/stage-tabs.tsx`

**Descriere:** Componentă pentru afișarea tab-urilor de stage-uri pe mobile cu scroll orizontal și badge-uri pentru numărul de lead-uri.

**Dependențe:**
- `@/lib/utils` - Funcția `cn`
- `@/components/ui/badge` - Badge

**Interfețe și Tipuri:**

#### `StageTabsProps`

**Proprietăți:**
- `stages: string[]` - Array cu stage-urile
- `currentStage: string` - Stage-ul curent activ
- `onStageChange: (stage: string) => void` - Callback pentru schimbare stage
- `leadCounts?: Record<string, number>` - Map opțional cu numărul de lead-uri per stage

**Funcții și Componente Exportate:**

#### `StageTabs` (Componentă Exportată)

**Tip:** `React.FC<StageTabsProps>`

**Descriere:** Componentă care afișează tab-uri orizontale scrollabile pentru stage-uri.

**Render:**

##### Container

- Sticky la top: `sticky top-0 z-10`
- Border bottom: `border-b bg-background`
- Ascuns pe desktop: `md:hidden`

##### Scroll Container

- Scroll orizontal nativ: `overflow-x-auto overflow-y-hidden`
- Clase pentru ascunderea scrollbar-ului: `scrollbar-hide scroll-smooth-horizontal`
- Flex container: `flex gap-2 px-3 py-3 min-w-max`

##### Tab Buttons

Pentru fiecare stage:
- **Stilizare:**
  - Active: `bg-black text-white shadow-sm`
  - Inactive: `bg-gray-100 text-gray-700 hover:bg-gray-200`
  - Padding: `px-4 py-2.5`
  - Minimum touch target: `min-h-[44px]` (pentru accesibilitate mobile)
  - Touch manipulation: `touch-manipulation`
  - Active scale feedback: `active:scale-95`
- **Conținut:**
  - Text: Numele stage-ului în uppercase cu tracking wide
  - Badge: Dacă `count > 0`, afișează badge cu numărul de lead-uri
    - Active: Background alb cu opacitate 20%, text alb
    - Inactive: Background alb, text gri

**Exemplu de Utilizare:**
```tsx
<StageTabs
  stages={['Nou', 'In Lucru', 'Finalizat']}
  currentStage="Nou"
  onStageChange={(stage) => setCurrentStage(stage)}
  leadCounts={{ 'Nou': 5, 'In Lucru': 3, 'Finalizat': 10 }}
/>
```

---

### `mobile/mobile-board-header.tsx`

**Locație:** `components/mobile/mobile-board-header.tsx`

**Descriere:** Componentă header pentru board-ul mobile cu selector de pipeline, butoane de căutare și filtru, și meniu sidebar.

**Dependențe:**
- `lucide-react` - Iconițe (Search, Filter, Menu, ChevronDown)
- `@/components/ui/button` - Button
- `@/components/ui/select` - Select components
- `@/components/ui/sheet` - Sheet components

**Interfețe și Tipuri:**

#### `MobileBoardHeaderProps`

**Proprietăți:**
- `pipelineName: string` - Numele pipeline-ului curent
- `pipelines: string[]` - Array cu pipeline-uri disponibile
- `onPipelineChange: (pipeline: string) => void` - Callback pentru schimbare pipeline
- `onSearchClick: () => void` - Callback pentru click pe butonul de căutare
- `onFilterClick: () => void` - Callback pentru click pe butonul de filtru
- `sidebarContent?: React.ReactNode` - Conținut opțional pentru sidebar

**Funcții și Componente Exportate:**

#### `MobileBoardHeader` (Componentă Exportată)

**Tip:** `React.FC<MobileBoardHeaderProps>`

**Descriere:** Componentă header sticky pentru mobile.

**Render:**

##### Header Container

- Sticky: `sticky top-0 z-20`
- Background: `bg-background`
- Border: `border-b`
- Ascuns pe desktop: `md:hidden`
- Padding: `px-4 py-3`
- Flex layout: `flex items-center justify-between gap-2`

##### Pipeline Selector

- Select dropdown cu toate pipeline-urile
- Value: `pipelineName`
- Trigger: Afișează numele pipeline-ului cu font semibold și truncate
- Full width: `flex-1 min-w-0`

##### Action Buttons

- **Search Button:** Iconiță Search, variant ghost, size sm
- **Filter Button:** Iconiță Filter, variant ghost, size sm
- **Menu Button:** Iconiță Menu, deschide Sheet cu sidebar content (dacă există)

##### Sidebar Sheet

- Side: `left`
- Width: `w-[280px]`
- Padding: `p-0`
- Conținut: `sidebarContent` (de obicei componenta Sidebar)

**Exemplu de Utilizare:**
```tsx
<MobileBoardHeader
  pipelineName="Vanzari"
  pipelines={['Vanzari', 'Receptie', 'Curier']}
  onPipelineChange={(pipeline) => setPipeline(pipeline)}
  onSearchClick={() => openSearch()}
  onFilterClick={() => openFilter()}
  sidebarContent={<Sidebar />}
/>
```

---

### `mobile/mobile-board-layout.tsx`

**Locație:** `components/mobile/mobile-board-layout.tsx`

**Descriere:** Componentă layout principală pentru board-ul Kanban pe mobile, cu suport pentru swipe gestures, stage tabs, și lead details sheet.

**Dependențe:**
- `react` - useState, useMemo, useEffect
- `@/lib/types/database` - KanbanLead
- `@/components/mobile/stage-tabs` - StageTabs
- `@/components/mobile/lead-card-mobile` - LeadCardMobile
- `@/components/mobile/mobile-board-header` - MobileBoardHeader
- `@/components/mobile/lead-details-sheet` - LeadDetailsSheet
- `@/hooks/use-swipe` - useSwipe
- `@/components/ui/button` - Button
- `@/components/ui/sheet` - Sheet components
- `@/components/ui/select` - Select components
- `lucide-react` - Plus

**Interfețe și Tipuri:**

#### `MobileBoardLayoutProps`

**Proprietăți:**
- `leads: KanbanLead[]` - Array cu toate lead-urile
- `stages: string[]` - Array cu stage-urile
- `currentPipelineName: string` - Numele pipeline-ului curent
- `pipelines: string[]` - Array cu pipeline-uri disponibile
- `onPipelineChange: (pipeline: string) => void` - Callback pentru schimbare pipeline
- `onLeadMove: (leadId: string, newStage: string) => void` - Callback pentru mutare lead
- `onLeadClick?: (lead: KanbanLead) => void` - Callback opțional pentru click pe lead
- `onAddLead?: () => void` - Callback opțional pentru adăugare lead
- `sidebarContent?: React.ReactNode` - Conținut opțional pentru sidebar
- `onSearchClick?: () => void` - Callback opțional pentru căutare
- `onFilterClick?: () => void` - Callback opțional pentru filtru

**State Intern:**

##### `currentStage`

**Tip:** `string`

**Valoare Inițială:** `stages[0] || ''`

**Descriere:** Stage-ul curent activ.

##### `selectedLead`

**Tip:** `KanbanLead | null`

**Valoare Inițială:** `null`

**Descriere:** Lead-ul selectat pentru afișare detalii.

##### `detailsOpen`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Controlează deschiderea sheet-ului de detalii.

##### `moveSheetOpen`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Controlează deschiderea sheet-ului pentru mutare.

##### `leadToMove`

**Tip:** `KanbanLead | null`

**Valoare Inițială:** `null`

**Descriere:** Lead-ul de mutat.

**Efecte:**

##### `useEffect` pentru Actualizare Stage

**Descriere:** Actualizează `currentStage` când se schimbă `stages`.

**Logica:** Dacă `currentStage` nu mai există în `stages`, setează la primul stage.

**Hooks:**

##### `useSwipe`

**Descriere:** Hook pentru detectarea gesturilor de swipe.

**Configurație:**
- `onSwipeLeft`: Mută la stage-ul următor
- `onSwipeRight`: Mută la stage-ul anterior
- `threshold`: 50px

**Funcții:**

##### `useMemo` pentru `currentStageLeads`

**Descriere:** Filtrează lead-urile pentru stage-ul curent.

##### `useMemo` pentru `leadCounts`

**Descriere:** Calculează numărul de lead-uri per stage.

##### `handleLeadClick`

**Tip:** `(lead: KanbanLead) => void`

**Descriere:** Gestionează click-ul pe un lead.

**Logica:** Setează `selectedLead`, deschide `detailsOpen`, și apelează `onLeadClick`.

##### `handleMoveClick`

**Tip:** `(lead: KanbanLead) => void`

**Descriere:** Gestionează click-ul pe butonul de mutare.

**Logica:** Setează `leadToMove` și deschide `moveSheetOpen`.

##### `handleMoveToStage`

**Tip:** `(newStage: string) => void`

**Descriere:** Mută lead-ul într-un stage nou.

**Logica:** Apelează `onLeadMove`, închide `moveSheetOpen`, și resetează `leadToMove`.

**Render:**

##### Layout Container

- Flex column: `flex flex-col h-screen`
- Ascuns pe desktop: `md:hidden`

##### Header

- Componentă `MobileBoardHeader` cu toate props-urile

##### Stage Tabs

- Componentă `StageTabs` cu `currentStage`, `onStageChange`, și `leadCounts`

##### Leads List

- Container cu scroll vertical: `flex-1 overflow-y-auto px-4 py-4`
- Swipe handlers: `{...swipeHandlers}`
- **Empty State:** Mesaj și buton "Adaugă lead" (dacă `onAddLead` există)
- **Leads List:** Map de `LeadCardMobile` pentru fiecare lead din `currentStageLeads`

##### Lead Details Sheet

- Componentă `LeadDetailsSheet` cu lead-ul selectat

##### Move to Stage Sheet

- Sheet cu lista de stage-uri disponibile (excluzând stage-ul curent)
- Butoane pentru fiecare stage

##### Floating Action Button

- Buton "+" fixat în colțul dreapta jos (doar dacă `onAddLead` există)
- Size lg, rounded-full, shadow-lg

**Exemplu de Utilizare:**
```tsx
<MobileBoardLayout
  leads={leads}
  stages={['Nou', 'In Lucru', 'Finalizat']}
  currentPipelineName="Vanzari"
  pipelines={['Vanzari', 'Receptie']}
  onPipelineChange={(pipeline) => setPipeline(pipeline)}
  onLeadMove={(leadId, newStage) => moveLead(leadId, newStage)}
  onLeadClick={(lead) => console.log('Clicked:', lead)}
  onAddLead={() => openAddLead()}
  sidebarContent={<Sidebar />}
  onSearchClick={() => openSearch()}
  onFilterClick={() => openFilter()}
/>
```

---

### `mobile/lead-card-mobile.tsx`

**Locație:** `components/mobile/lead-card-mobile.tsx`

**Descriere:** Componentă card simplificată pentru afișarea unui lead pe mobile, optimizată pentru touch și cu suport pentru tăvițe.

**Dependențe:**
- `react` - useState, useEffect
- `@/lib/types/database` - KanbanLead
- `lucide-react` - Iconițe (Mail, Phone, Clock, MoreVertical, Tag, Move, Wrench)
- `date-fns` - formatDistanceToNow
- `date-fns/locale/ro` - Localizare română
- `@/components/ui/badge` - Badge
- `@/components/ui/button` - Button
- `@/components/ui/dropdown-menu` - DropdownMenu
- `@/lib/utils` - Funcția `cn`
- `next/navigation` - useRouter
- `@/hooks/useAuth` - useAuth
- `@/lib/supabase/supabaseClient` - supabaseBrowser

**Interfețe și Tipuri:**

#### `LeadCardMobileProps`

**Proprietăți:**
- `lead: KanbanLead` - Lead-ul de afișat
- `onClick: () => void` - Callback pentru click pe card
- `onMove?: () => void` - Callback opțional pentru mutare
- `onEdit?: () => void` - Callback opțional pentru editare
- `onArchive?: () => void` - Callback opțional pentru arhivare

**State Intern:**

##### `isTechnician`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru verificarea dacă utilizatorul este tehnician.

**Efecte:**

##### `useEffect` pentru Verificare Tehnician

**Descriere:** Verifică dacă utilizatorul este tehnician (similar cu alte componente).

**Funcții:**

##### `getTimeAgo`

**Tip:** `(dateString: string) => string`

**Descriere:** Formatează timpul relativ folosind `formatDistanceToNow`.

##### `getStageTime`

**Tip:** `() => string`

**Descriere:** Returnează timpul petrecut în stage sau timpul de la creare.

**Logica:** Prioritizează `stageMovedAt`, apoi `createdAt`.

##### `getTagColor`

**Tip:** `(color?: string) => string`

**Descriere:** Returnează clasele CSS pentru tag-uri pe baza culorii (similar cu `lead-card.tsx`).

##### `handleOpenTray`

**Tip:** `(e: React.MouseEvent) => void`

**Descriere:** Deschide pagina de detalii tăviță.

**Logica:** Previne propagarea și navighează la `/tehnician/tray/{trayId}`.

**Render:**

##### Card Container

- Background: `bg-card`
- Border: `border rounded-lg`
- Padding: `p-4`
- Margin bottom: `mb-3`
- Cursor: `cursor-pointer`
- Active state: `active:bg-accent`
- Minimum height: `min-h-[120px]` (pentru touch target)
- Touch manipulation: `touch-manipulation`
- Shadow: `shadow-sm hover:shadow-md`

##### Content Layout

- Flex layout: `flex items-start justify-between gap-3`

##### Main Content

- **Nume Lead:** Font semibold, text-base, mb-2, truncate
- **Email și Telefon:** Iconițe Mail și Phone, text-sm, muted-foreground
- **Vârstă Lead:** Iconiță Clock, text-xs, muted-foreground
- **Tag-uri:** Limitate la primele 3, cu badge "+X" dacă există mai multe
- **Info Tăvițe/Fișe:**
  - Dacă `isQuote`: Afișează număr tăviță și dimensiune
  - Dacă `isFisa`: Afișează număr fișă
  - Dacă `total > 0`: Afișează totalul în RON
  - Timp în stage: Dacă există `inLucruSince` sau `inAsteptareSince`
  - Buton "Deschide tăvița" dacă este tăviță

##### Menu Dropdown

- Iconiță MoreVertical
- Opțiuni: Mută lead, Editează, Arhivează (dacă callbacks-urile există)

**Exemplu de Utilizare:**
```tsx
<LeadCardMobile
  lead={lead}
  onClick={() => openDetails(lead)}
  onMove={() => openMoveDialog(lead)}
  onEdit={() => openEditDialog(lead)}
  onArchive={() => archiveLead(lead.id)}
/>
```

---

### `mobile/lead-details-sheet.tsx`

**Locație:** `components/mobile/lead-details-sheet.tsx`

**Descriere:** Componentă sheet (bottom sheet) pentru afișarea detaliilor unui lead pe mobile, cu tabs pentru Info, Activitate, și Fișe & Tăvițe, și suport pentru acțiuni rapide pentru pipeline-uri departament.

**Dependențe:**
- `react` - useState, useEffect, useMemo, useCallback
- `@/lib/types/database` - KanbanLead
- `@/components/ui/sheet` - Sheet components
- `@/components/ui/tabs` - Tabs components
- `@/components/ui/badge` - Badge
- `@/components/ui/button` - Button
- `lucide-react` - Iconițe (Mail, Phone, Clock, Tag, FileText, Package, User, Loader2, Wrench, ExternalLink, CheckCircle)
- `date-fns` - formatDistanceToNow
- `date-fns/locale/ro` - Localizare română
- `@/lib/utils` - Funcția `cn`
- `@/lib/supabase/supabaseClient` - supabaseBrowser
- `@/lib/supabase/serviceFileOperations` - listServiceFilesForLead, listTraysForServiceFile
- `@/lib/supabase/pipelineOperations` - moveItemToStage
- `next/navigation` - useRouter
- `@/hooks/useAuth` - useAuth
- `sonner` - toast

**Interfețe și Tipuri:**

#### `ServiceFile`

**Proprietăți:**
- `id: string`
- `number: string`
- `status: string`
- `date: string`

#### `Tray`

**Proprietăți:**
- `id: string`
- `number: string`
- `size: string`
- `status: string`
- `service_file_id: string`

#### `LeadDetailsSheetProps`

**Proprietăți:**
- `lead: KanbanLead | null` - Lead-ul de afișat sau null
- `open: boolean` - Controlează deschiderea sheet-ului
- `onOpenChange: (open: boolean) => void` - Callback pentru schimbare stare
- `onMove?: () => void` - Callback opțional pentru mutare
- `onEdit?: () => void` - Callback opțional pentru editare
- `pipelineSlug?: string` - Slug-ul pipeline-ului curent
- `stages?: string[]` - Array cu stage-uri disponibile
- `onStageChange?: (leadId: string, newStage: string) => void` - Callback pentru schimbare stage

**State Intern:**

##### `serviceFiles`

**Tip:** `ServiceFile[]`

**Valoare Inițială:** `[]`

**Descriere:** Array cu fișele de serviciu pentru lead.

##### `trays`

**Tip:** `Tray[]`

**Valoare Inițială:** `[]`

**Descriere:** Array cu tăvițele pentru lead.

##### `loadingFiles`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru starea de încărcare fișe și tăvițe.

##### `isTechnician`

**Tip:** `boolean`

**Valoare Inițială:** `false`

**Descriere:** Flag pentru verificarea dacă utilizatorul este tehnician.

**Hooks:**

##### `useMemo` pentru Pipeline Checks

- `isDepartmentPipeline`: Verifică dacă pipeline-ul este unul dintre departamente
- `isReparatiiPipeline`: Verifică dacă este pipeline-ul Reparații
- `isSaloaneHorecaFrizeriiPipeline`: Verifică dacă este unul dintre pipeline-urile Saloane/Horeca/Frizerii

**Funcții:**

##### `handleOpenTray`

**Tip:** `(trayId: string) => void`

**Descriere:** Navighează la pagina de detalii tăviță și închide sheet-ul.

##### `getLeadId`

**Tip:** `() => string | null`

**Descriere:** Obține ID-ul corect al lead-ului (poate fi `lead.id` sau `lead.leadId`).

##### `handleFinalizare`, `handleAsteptPiese`, `handleInAsteptare`, `handleInLucru`

**Tip:** `() => Promise<void>`

**Descriere:** Handlers pentru acțiunile rapide (similar cu `lead-details-panel.tsx`).

**Efecte:**

##### `useEffect` pentru Verificare Tehnician

**Descriere:** Verifică dacă utilizatorul este tehnician.

##### `useEffect` pentru Încărcare Fișe și Tăvițe

**Descriere:** Încarcă fișele de serviciu și tăvițele pentru lead.

**Logica:**
1. Obține `leadId` folosind `getLeadId()`
2. Dacă `leadId` sau `open` nu există, resetează state-ul
3. Încarcă fișele folosind `listServiceFilesForLead(leadId)`
4. Pentru fiecare fișă, încarcă tăvițele folosind `listTraysForServiceFile(file.id)`
5. Agregă toate tăvițele într-un singur array

**Render:**

##### Sheet Container

- Side: `bottom`
- Height: `h-[90vh]`
- Overflow: `overflow-y-auto`

##### Header

- Titlu: Numele lead-ului sau "Fără nume"
- Descriere: Stage-ul și timpul relativ de la creare

##### Tabs

**1. Info Tab:**
- Informații de contact (Email, Telefon)
- Tag-uri
- Tehnician
- Informații sursă (Campanie, Anunț, Formular)

**2. Activitate Tab:**
- Istoric cu timpul petrecut în stage și data creării

**3. Fișe & Tăvițe Tab:**
- **Acțiuni Rapide:** Butoane pentru pipeline-uri departament (În lucru, Finalizare, Aștept piese, În așteptare)
- **Fișe de Serviciu:**
  - Pentru fiecare fișă, afișează numărul, statusul, și data
  - Sub fiecare fișă, listează tăvițele asociate cu buton pentru deschidere
- **Tăvițe Fără Fișă:** Listează tăvițele care nu sunt asociate cu o fișă
- **Empty State:** Mesaj dacă nu există fișe sau tăvițe

##### Action Buttons

- Buton "Mută lead" (dacă `onMove` există)
- Buton "Editează" (dacă `onEdit` există)

**Exemplu de Utilizare:**
```tsx
<LeadDetailsSheet
  lead={selectedLead}
  open={isSheetOpen}
  onOpenChange={setIsSheetOpen}
  pipelineSlug="reparatii"
  stages={['Nou', 'In Lucru', 'Finalizat']}
  onStageChange={(leadId, newStage) => moveToStage(leadId, newStage)}
  onMove={() => openMoveDialog()}
  onEdit={() => openEditDialog()}
/>
```

---

## 📚 Concluzie Finală

Această documentație oferă o explicație completă și detaliată pentru toate funcțiile, componentele, hooks-urile, tipurile și interfețele din directorul `components/` (excluzând `components/ui/`).

**Componente Documentate:**
- ✅ AuthStatus.tsx
- ✅ dashboard-charts.tsx
- ✅ dashboard-insights.tsx
- ✅ dashboard-stats.tsx
- ✅ de-confirmat.tsx
- ✅ kanban-board.tsx
- ✅ lead-card.tsx
- ✅ lead-history.tsx
- ✅ lead-messenger.tsx
- ✅ lead-modal.tsx
- ✅ pipeline-editor.tsx
- ✅ sidebar.tsx
- ✅ SignOutButton.tsx
- ✅ theme-provider.tsx
- ✅ lazy/index.tsx
- ✅ mobile/stage-tabs.tsx
- ✅ mobile/mobile-board-header.tsx
- ✅ mobile/mobile-board-layout.tsx
- ✅ mobile/lead-card-mobile.tsx
- ✅ mobile/lead-details-sheet.tsx

**Componente Complexe Necesitând Documentație Suplimentară:**
- ⚠️ `lead-details-panel.tsx` (~2240 linii) - Componentă extrem de complexă cu multe funcționalități
- ⚠️ `preturi.tsx` (~4500+ linii) - Componentă foarte complexă pentru gestionarea prețurilor și tăvițelor
- ⚠️ `print-view.tsx` - Componentă pentru generarea view-ului de print

**Structura Documentației:**

Pentru fiecare componentă, documentația include:
1. **Locație și descriere generală**
2. **Dependențe complete**
3. **Interfețe și tipuri**
4. **State intern detaliat**
5. **Hooks și funcții**
6. **Event handlers**
7. **Logica de render**
8. **Exemple de utilizare**

Această documentație servește ca referință completă pentru dezvoltatori care lucrează cu aceste componente și oferă o înțelegere profundă a funcționalităților și implementărilor.

---

## 📚 Concluzie

Această documentație oferă o explicație detaliată pentru funcțiile și componentele principale din directorul `components/`. Fiecare componentă este documentată cu:

- **Locație și descriere**
- **Dependențe**
- **Interfețe și tipuri**
- **State intern**
- **Hooks și funcții**
- **Event handlers**
- **Logica de render**
- **Exemple de utilizare**

Pentru documentația completă a tuturor componentelor, consultați versiunea extinsă a acestui document.


