# Documentație Completă - Componente UI

## Cuprins

1. [Introducere](#introducere)
2. [Componente de Bază](#componente-de-bază)
3. [Componente de Formulare](#componente-de-formulare)
4. [Componente de Navigare](#componente-de-navigare)
5. [Componente de Dialog și Overlay](#componente-de-dialog-și-overlay)
6. [Componente de Afișare Date](#componente-de-afișare-date)
7. [Componente de Layout](#componente-de-layout)
8. [Componente Utilitare](#componente-utilitare)
9. [Hooks Personalizate](#hooks-personalizate)

---

## Introducere

Această documentație acoperă toate componentele UI din directorul `components/ui/`. Aceste componente sunt construite folosind:
- **Radix UI**: Bibliotecă de componente accesibile și ne-stilizate
- **Tailwind CSS**: Pentru stilizare
- **class-variance-authority (cva)**: Pentru gestionarea variantelor de stil
- **clsx/tailwind-merge**: Pentru combinarea claselor CSS
- **TypeScript**: Pentru siguranță de tipuri

Toate componentele sunt optimizate pentru accesibilitate, performanță și experiență utilizator.

---

## Componente de Bază

### 1. `button.tsx`

**Locație**: `components/ui/button.tsx`

**Descriere**: Componentă de bază pentru butoane, cu suport pentru multiple variante de stil și dimensiuni.

**Dependențe**:
- `class-variance-authority` (cva)
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `React.ButtonHTMLAttributes`

**Exporturi**:
- `ButtonVariants`: Tip pentru variantele butonului
- `ButtonProps`: Interfață pentru props-urile butonului
- `Button`: Componenta principală

**Variante**:
- `variant`: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link"
- `size`: "default" | "sm" | "lg" | "icon"

**Detalii Implementare**:
Componenta folosește `cva` pentru a defini variantele de stil. Fiecare variantă are clase Tailwind CSS specifice:
- `default`: Fundal primar, text alb
- `destructive`: Fundal roșu pentru acțiuni distructive
- `outline`: Contur, fără fundal
- `secondary`: Fundal secundar
- `ghost`: Transparent, apare la hover
- `link`: Stil de link, subliniat

Dimensiunile controlează padding-ul și font-size-ul. Varianta "icon" este optimizată pentru butoane pătrate cu iconițe.

**Exemplu Utilizare**:
```tsx
<Button variant="default" size="lg">Salvează</Button>
<Button variant="destructive" size="sm">Șterge</Button>
<Button variant="outline" size="icon">
  <Icon />
</Button>
```

---

### 2. `badge.tsx`

**Locație**: `components/ui/badge.tsx`

**Descriere**: Componentă pentru afișarea de badge-uri și etichete, cu variante de culoare.

**Dependențe**:
- `class-variance-authority` (cva)
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `BadgeVariants`: Tip pentru variantele badge-ului
- `BadgeProps`: Interfață pentru props-urile badge-ului
- `Badge`: Componenta principală

**Variante**:
- `variant`: "default" | "secondary" | "destructive" | "outline"

**Detalii Implementare**:
Badge-ul este un element `<div>` cu clase Tailwind pentru padding, border-radius și culori. Fiecare variantă are o paletă de culori diferită:
- `default`: Fundal primar
- `secondary`: Fundal secundar
- `destructive`: Fundal roșu
- `outline`: Contur, fundal transparent

**Exemplu Utilizare**:
```tsx
<Badge variant="default">Nou</Badge>
<Badge variant="destructive">Urgent</Badge>
<Badge variant="outline">Draft</Badge>
```

---

### 3. `avatar.tsx`

**Locație**: `components/ui/avatar.tsx`

**Descriere**: Componentă pentru afișarea avatarelor utilizatorilor, cu suport pentru imagini, inițiale și fallback.

**Dependențe**:
- `@radix-ui/react-avatar`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `AvatarProps`: Interfață pentru props-urile avatarului
- `Avatar`: Componenta root
- `AvatarImage`: Componenta pentru imagine
- `AvatarFallback`: Componenta pentru fallback (inițiale)

**Detalii Implementare**:
Componenta folosește Radix UI Avatar care oferă:
- Gestionare automată a erorilor de încărcare imagine
- Fallback automat la inițiale sau text
- Accesibilitate completă (ARIA)

Structura componentelor:
- `Avatar`: Container principal
- `AvatarImage`: Imaginea avatarului
- `AvatarFallback`: Text/inițiale afișate când imaginea nu se încarcă

**Exemplu Utilizare**:
```tsx
<Avatar>
  <AvatarImage src="/user.jpg" alt="User" />
  <AvatarFallback>JD</AvatarFallback>
</Avatar>
```

---

### 4. `skeleton.tsx`

**Locație**: `components/ui/skeleton.tsx`

**Descriere**: Componentă pentru afișarea unui placeholder animat în timpul încărcării conținutului.

**Dependențe**:
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `SkeletonProps`: Interfață pentru props-urile skeleton-ului
- `Skeleton`: Componenta principală

**Detalii Implementare**:
Skeleton-ul este un `<div>` cu:
- Fundal gri cu animație pulse
- Border-radius pentru rotunjire
- Clase Tailwind pentru animație: `animate-pulse`

Poate fi folosit pentru orice formă de placeholder (text, imagini, carduri).

**Exemplu Utilizare**:
```tsx
<Skeleton className="h-4 w-[250px]" />
<Skeleton className="h-12 w-12 rounded-full" />
```

---

### 5. `separator.tsx`

**Locație**: `components/ui/separator.tsx`

**Descriere**: Componentă pentru separatori vizuali orizontali sau verticali.

**Dependențe**:
- `@radix-ui/react-separator`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `SeparatorProps`: Interfață pentru props-urile separatorului
- `Separator`: Componenta principală

**Variante**:
- `orientation`: "horizontal" | "vertical" (implicit: "horizontal")
- `decorative`: boolean (pentru separatori decorative, fără rol semantic)

**Detalii Implementare**:
Folosește Radix UI Separator care oferă:
- Separare semantică corectă
- Suport pentru orientare orizontală și verticală
- Accesibilitate (role="separator" sau decorative)

**Exemplu Utilizare**:
```tsx
<Separator />
<Separator orientation="vertical" />
<Separator decorative />
```

---

## Componente de Formulare

### 6. `input.tsx`

**Locație**: `components/ui/input.tsx`

**Descriere**: Componentă pentru câmpuri de input text, cu stilizare consistentă.

**Dependențe**:
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `React.InputHTMLAttributes`

**Exporturi**:
- `InputProps`: Interfață pentru props-urile input-ului
- `Input`: Componenta principală

**Detalii Implementare**:
Input-ul este un element `<input>` stilizat cu:
- Border și focus ring
- Padding consistent
- Suport pentru toate atributele HTML standard
- Clase Tailwind pentru focus states

**Exemplu Utilizare**:
```tsx
<Input type="text" placeholder="Introduceți numele" />
<Input type="email" required />
<Input disabled />
```

---

### 7. `textarea.tsx`

**Locație**: `components/ui/textarea.tsx`

**Descriere**: Componentă pentru câmpuri de text multi-linie.

**Dependențe**:
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `React.TextareaHTMLAttributes`

**Exporturi**:
- `TextareaProps`: Interfață pentru props-urile textarea-ului
- `Textarea`: Componenta principală

**Detalii Implementare**:
Textarea-ul este un element `<textarea>` cu:
- Stilizare similară cu Input
- Resize vertical automat
- Min-height pentru consistență vizuală

**Exemplu Utilizare**:
```tsx
<Textarea placeholder="Introduceți mesajul" rows={4} />
<Textarea disabled />
```

---

### 8. `label.tsx`

**Locație**: `components/ui/label.tsx`

**Descriere**: Componentă pentru etichete de formulare, cu suport pentru accesibilitate.

**Dependențe**:
- `@radix-ui/react-label`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `LabelProps`: Interfață pentru props-urile label-ului
- `Label`: Componenta principală

**Detalii Implementare**:
Folosește Radix UI Label care oferă:
- Asociere corectă cu input-uri (via `htmlFor`)
- Accesibilitate completă
- Stilizare consistentă

**Exemplu Utilizare**:
```tsx
<Label htmlFor="email">Email</Label>
<Input id="email" />
```

---

### 9. `checkbox.tsx`

**Locație**: `components/ui/checkbox.tsx`

**Descriere**: Componentă pentru checkbox-uri, cu suport pentru stări intermediare (indeterminate).

**Dependențe**:
- `@radix-ui/react-checkbox`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconița de check)

**Exporturi**:
- `CheckboxProps`: Interfață pentru props-urile checkbox-ului
- `Checkbox`: Componenta principală

**Detalii Implementare**:
Folosește Radix UI Checkbox care oferă:
- Stări: checked, unchecked, indeterminate
- Accesibilitate completă (ARIA)
- Keyboard navigation
- Iconiță de check animată

**Exemplu Utilizare**:
```tsx
<Checkbox id="terms" />
<Label htmlFor="terms">Accept termenii</Label>

<Checkbox checked={indeterminate} onCheckedChange={setIndeterminate} />
```

---

### 10. `radio-group.tsx`

**Locație**: `components/ui/radio-group.tsx`

**Descriere**: Componentă pentru grupuri de radio buttons, cu suport pentru selecție unică.

**Dependențe**:
- `@radix-ui/react-radio-group`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `RadioGroupProps`: Interfață pentru props-urile grupului
- `RadioGroup`: Componenta root
- `RadioGroupItemProps`: Interfață pentru item-uri
- `RadioGroupItem`: Componenta pentru fiecare opțiune

**Detalii Implementare**:
Folosește Radix UI Radio Group care oferă:
- Gestionare automată a selecției unice
- Accesibilitate completă
- Keyboard navigation între opțiuni
- Suport pentru orientare (horizontal/vertical)

**Exemplu Utilizare**:
```tsx
<RadioGroup value={value} onValueChange={setValue}>
  <RadioGroupItem value="option1" id="option1" />
  <Label htmlFor="option1">Opțiunea 1</Label>
  <RadioGroupItem value="option2" id="option2" />
  <Label htmlFor="option2">Opțiunea 2</Label>
</RadioGroup>
```

---

### 11. `switch.tsx`

**Locație**: `components/ui/switch.tsx`

**Descriere**: Componentă pentru switch-uri (toggle switches), cu animații fluide.

**Dependențe**:
- `@radix-ui/react-switch`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `SwitchProps`: Interfață pentru props-urile switch-ului
- `Switch`: Componenta principală

**Detalii Implementare**:
Folosește Radix UI Switch care oferă:
- Animații de tranziție pentru stări on/off
- Accesibilitate completă
- Keyboard support (Space pentru toggle)
- Stilizare cu thumb animat

**Exemplu Utilizare**:
```tsx
<Switch checked={enabled} onCheckedChange={setEnabled} />
<Label>Activează notificările</Label>
```

---

### 12. `slider.tsx`

**Locație**: `components/ui/slider.tsx`

**Descriere**: Componentă pentru slider-uri de selecție a valorilor numerice într-un interval.

**Dependențe**:
- `@radix-ui/react-slider`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `SliderProps`: Interfață pentru props-urile slider-ului
- `Slider`: Componenta principală

**Detalii Implementare**:
Folosește Radix UI Slider care oferă:
- Suport pentru valori simple sau multiple (range)
- Drag și click pentru setare valoare
- Keyboard navigation (arrow keys)
- Accesibilitate completă
- Min, max, step configurabile

**Exemplu Utilizare**:
```tsx
<Slider 
  value={[value]} 
  onValueChange={([val]) => setValue(val)}
  min={0}
  max={100}
  step={1}
/>
```

---

### 13. `select.tsx`

**Locație**: `components/ui/select.tsx`

**Descriere**: Componentă pentru dropdown-uri de selecție, cu suport pentru căutare și grupări.

**Dependențe**:
- `@radix-ui/react-select`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `SelectProps`: Interfață pentru props-urile select-ului
- `Select`: Componenta root
- `SelectGroup`: Grup de opțiuni
- `SelectValue`: Valoarea afișată
- `SelectTrigger`: Trigger-ul dropdown-ului
- `SelectContent`: Conținutul dropdown-ului
- `SelectLabel`: Etichetă pentru grup
- `SelectItem`: Opțiune individuală
- `SelectSeparator`: Separator între grupuri
- `SelectScrollUpButton`: Buton scroll sus
- `SelectScrollDownButton`: Buton scroll jos

**Detalii Implementare**:
Folosește Radix UI Select care oferă:
- Dropdown animat
- Keyboard navigation
- Căutare prin tastare
- Scroll pentru liste lungi
- Accesibilitate completă
- Portal rendering pentru z-index corect

**Exemplu Utilizare**:
```tsx
<Select value={value} onValueChange={setValue}>
  <SelectTrigger>
    <SelectValue placeholder="Selectați o opțiune" />
  </SelectTrigger>
  <SelectContent>
    <SelectItem value="option1">Opțiunea 1</SelectItem>
    <SelectItem value="option2">Opțiunea 2</SelectItem>
  </SelectContent>
</Select>
```

---

### 14. `form.tsx`

**Locație**: `components/ui/form.tsx`

**Descriere**: Componentă wrapper pentru formulare, cu integrare React Hook Form și validare.

**Dependențe**:
- `react-hook-form`
- `@hookform/resolvers` (pentru validare cu zod/yup)
- `@radix-ui/react-label`
- `@radix-ui/react-slot`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `FormProps`: Interfață pentru props-urile form-ului
- `Form`: Componenta root
- `FormItem`: Container pentru item-uri
- `FormLabel`: Etichetă pentru câmpuri
- `FormControl`: Control wrapper
- `FormDescription`: Descriere pentru câmpuri
- `FormMessage`: Mesaj de eroare
- `FormField`: Field wrapper cu React Hook Form

**Detalii Implementare**:
Form-ul integrează React Hook Form cu Radix UI pentru:
- Validare automată
- Gestionare erori
- Accesibilitate
- Type-safe forms cu TypeScript

Folosește Context API pentru a partaja starea form-ului între componente.

**Exemplu Utilizare**:
```tsx
const form = useForm({
  resolver: zodResolver(schema),
})

<Form {...form}>
  <FormField
    control={form.control}
    name="email"
    render={({ field }) => (
      <FormItem>
        <FormLabel>Email</FormLabel>
        <FormControl>
          <Input {...field} />
        </FormControl>
        <FormDescription>Introduceți adresa de email</FormDescription>
        <FormMessage />
      </FormItem>
    )}
  />
</Form>
```

---

### 15. `input-otp.tsx`

**Locație**: `components/ui/input-otp.tsx`

**Descriere**: Componentă pentru introducerea codurilor OTP (One-Time Password), cu suport pentru grupări și validare.

**Dependențe**:
- `input-otp`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `InputOTPProps`: Interfață pentru props-urile input-ului OTP
- `InputOTP`: Componenta root
- `InputOTPGroup`: Grup de input-uri
- `InputOTPSlot`: Slot individual pentru fiecare cifră
- `InputOTPSeparator`: Separator între grupuri

**Detalii Implementare**:
Folosește biblioteca `input-otp` care oferă:
- Auto-focus între câmpuri
- Paste support pentru coduri complete
- Validare automată
- Suport pentru pattern-uri (ex: "XXXX-XXXX")
- Keyboard navigation

**Exemplu Utilizare**:
```tsx
<InputOTP maxLength={6}>
  <InputOTPGroup>
    <InputOTPSlot index={0} />
    <InputOTPSlot index={1} />
    <InputOTPSlot index={2} />
  </InputOTPGroup>
  <InputOTPSeparator />
  <InputOTPGroup>
    <InputOTPSlot index={3} />
    <InputOTPSlot index={4} />
    <InputOTPSlot index={5} />
  </InputOTPGroup>
</InputOTP>
```

---

## Componente de Navigare

### 16. `navigation-menu.tsx`

**Locație**: `components/ui/navigation-menu.tsx`

**Descriere**: Componentă pentru meniuri de navigare complexe, cu suport pentru dropdown-uri și mega-menus.

**Dependențe**:
- `@radix-ui/react-navigation-menu`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `NavigationMenuProps`: Interfață pentru props-urile meniului
- `NavigationMenu`: Componenta root
- `NavigationMenuList`: Lista de item-uri
- `NavigationMenuItem`: Item individual
- `NavigationMenuTrigger`: Trigger pentru submeniuri
- `NavigationMenuContent`: Conținutul submeniului
- `NavigationMenuLink`: Link simplu
- `NavigationMenuIndicator`: Indicator vizual
- `NavigationMenuViewport`: Viewport pentru conținut

**Detalii Implementare**:
Folosește Radix UI Navigation Menu care oferă:
- Dropdown-uri animate
- Keyboard navigation completă
- Focus management
- Accesibilitate completă
- Suport pentru mega-menus

**Exemplu Utilizare**:
```tsx
<NavigationMenu>
  <NavigationMenuList>
    <NavigationMenuItem>
      <NavigationMenuTrigger>Produse</NavigationMenuTrigger>
      <NavigationMenuContent>
        {/* Conținut submeniu */}
      </NavigationMenuContent>
    </NavigationMenuItem>
  </NavigationMenuList>
</NavigationMenu>
```

---

### 17. `menubar.tsx`

**Locație**: `components/ui/menubar.tsx`

**Descriere**: Componentă pentru meniuri de tip menubar (similar cu meniurile desktop), cu suport pentru submeniuri și shortcut-uri.

**Dependențe**:
- `@radix-ui/react-menubar`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `MenubarProps`: Interfață pentru props-urile menubar-ului
- `Menubar`: Componenta root
- `MenubarMenu`: Meniu individual
- `MenubarTrigger`: Trigger pentru meniu
- `MenubarContent`: Conținutul meniului
- `MenubarItem`: Item din meniu
- `MenubarSeparator`: Separator
- `MenubarLabel`: Etichetă
- `MenubarCheckboxItem`: Item cu checkbox
- `MenubarRadioGroup`: Grup de radio buttons
- `MenubarRadioItem`: Item radio
- `MenubarPortal`: Portal pentru rendering
- `MenubarSub`: Submeniu
- `MenubarSubTrigger`: Trigger pentru submeniu
- `MenubarSubContent`: Conținut submeniu
- `MenubarGroup`: Grup de item-uri
- `MenubarGroupLabel`: Etichetă pentru grup
- `MenubarShortcut`: Afișare shortcut keyboard

**Detalii Implementare**:
Folosește Radix UI Menubar care oferă:
- Structură ierarhică de meniuri
- Keyboard shortcuts
- Accesibilitate completă
- Suport pentru checkbox și radio items

**Exemplu Utilizare**:
```tsx
<Menubar>
  <MenubarMenu>
    <MenubarTrigger>Fișier</MenubarTrigger>
    <MenubarContent>
      <MenubarItem>
        Nou <MenubarShortcut>⌘N</MenubarShortcut>
      </MenubarItem>
      <MenubarSeparator />
      <MenubarItem>Deschide</MenubarItem>
    </MenubarContent>
  </MenubarMenu>
</Menubar>
```

---

### 18. `breadcrumb.tsx`

**Locație**: `components/ui/breadcrumb.tsx`

**Descriere**: Componentă pentru breadcrumb navigation, indicând locația curentă în ierarhie.

**Dependențe**:
- `@radix-ui/react-slot`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconița de separator)

**Exporturi**:
- `BreadcrumbProps`: Interfață pentru props-urile breadcrumb-ului
- `Breadcrumb`: Componenta root
- `BreadcrumbList`: Lista de item-uri
- `BreadcrumbItem`: Item individual
- `BreadcrumbLink`: Link către pagină
- `BreadcrumbPage`: Pagina curentă (non-clickable)
- `BreadcrumbSeparator`: Separator între item-uri
- `BreadcrumbEllipsis`: Ellipsis pentru item-uri ascunse

**Detalii Implementare**:
Folosește structură semantică HTML pentru breadcrumbs:
- `<nav>` cu `aria-label="breadcrumb"`
- Listă de link-uri
- Separatori vizuali
- Suport pentru truncare cu ellipsis

**Exemplu Utilizare**:
```tsx
<Breadcrumb>
  <BreadcrumbList>
    <BreadcrumbItem>
      <BreadcrumbLink href="/">Acasă</BreadcrumbLink>
    </BreadcrumbItem>
    <BreadcrumbSeparator />
    <BreadcrumbItem>
      <BreadcrumbPage>Produse</BreadcrumbPage>
    </BreadcrumbItem>
  </BreadcrumbList>
</Breadcrumb>
```

---

### 19. `pagination.tsx`

**Locație**: `components/ui/pagination.tsx`

**Descriere**: Componentă pentru paginare, cu suport pentru navigare între pagini și afișare informații.

**Dependențe**:
- `@radix-ui/react-slot`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `PaginationProps`: Interfață pentru props-urile paginării
- `Pagination`: Componenta root
- `PaginationContent`: Conținutul paginării
- `PaginationEllipsis`: Ellipsis pentru pagini ascunse
- `PaginationItem`: Item individual
- `PaginationLink`: Link către pagină
- `PaginationNext`: Buton "Următoarea"
- `PaginationPrevious`: Buton "Anterioră"

**Detalii Implementare**:
Paginarea oferă:
- Navigare între pagini
- Afișare număr pagină curentă
- Butoane pentru prima/ultima pagină
- Ellipsis pentru pagini ascunse
- Keyboard navigation

**Exemplu Utilizare**:
```tsx
<Pagination>
  <PaginationContent>
    <PaginationItem>
      <PaginationPrevious href="#" />
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#">1</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationLink href="#" isActive>2</PaginationLink>
    </PaginationItem>
    <PaginationItem>
      <PaginationNext href="#" />
    </PaginationItem>
  </PaginationContent>
</Pagination>
```

---

### 20. `tabs.tsx`

**Locație**: `components/ui/tabs.tsx`

**Descriere**: Componentă pentru tab-uri, cu suport pentru conținut multiplu organizat în tab-uri.

**Dependențe**:
- `@radix-ui/react-tabs`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `TabsProps`: Interfață pentru props-urile tab-urilor
- `Tabs`: Componenta root
- `TabsList`: Lista de tab-uri
- `TabsTrigger`: Trigger pentru tab
- `TabsContent`: Conținutul tab-ului

**Detalii Implementare**:
Folosește Radix UI Tabs care oferă:
- Gestionare automată a stării active
- Keyboard navigation (arrow keys)
- Accesibilitate completă (ARIA tabs pattern)
- Animații de tranziție

**Exemplu Utilizare**:
```tsx
<Tabs defaultValue="tab1">
  <TabsList>
    <TabsTrigger value="tab1">Tab 1</TabsTrigger>
    <TabsTrigger value="tab2">Tab 2</TabsTrigger>
  </TabsList>
  <TabsContent value="tab1">Conținut tab 1</TabsContent>
  <TabsContent value="tab2">Conținut tab 2</TabsContent>
</Tabs>
```

---

## Componente de Dialog și Overlay

### 21. `dialog.tsx`

**Locație**: `components/ui/dialog.tsx`

**Descriere**: Componentă pentru dialog-uri modale, cu suport pentru overlay, focus trap și animații.

**Dependențe**:
- `@radix-ui/react-dialog`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconița de închidere)

**Exporturi**:
- `DialogProps`: Interfață pentru props-urile dialog-ului
- `Dialog`: Componenta root
- `DialogTrigger`: Trigger pentru deschidere
- `DialogContent`: Conținutul dialog-ului
- `DialogHeader`: Header-ul dialog-ului
- `DialogFooter`: Footer-ul dialog-ului
- `DialogTitle`: Titlul dialog-ului
- `DialogDescription`: Descrierea dialog-ului
- `DialogClose`: Buton de închidere

**Detalii Implementare**:
Folosește Radix UI Dialog care oferă:
- Modal overlay cu backdrop
- Focus trap (focus rămâne în dialog)
- Escape key pentru închidere
- Click outside pentru închidere (opțional)
- Portal rendering pentru z-index corect
- Accesibilitate completă (ARIA modal pattern)
- Animații de fade și scale

**Exemplu Utilizare**:
```tsx
<Dialog>
  <DialogTrigger>Deschide dialog</DialogTrigger>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Titlu</DialogTitle>
      <DialogDescription>Descriere</DialogDescription>
    </DialogHeader>
    {/* Conținut */}
    <DialogFooter>
      <Button>Salvează</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

---

### 22. `alert-dialog.tsx`

**Locație**: `components/ui/alert-dialog.tsx`

**Descriere**: Componentă pentru dialog-uri de alertă, pentru confirmări și acțiuni critice.

**Dependențe**:
- `@radix-ui/react-alert-dialog`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `AlertDialogProps`: Interfață pentru props-urile alert dialog-ului
- `AlertDialog`: Componenta root
- `AlertDialogTrigger`: Trigger pentru deschidere
- `AlertDialogContent`: Conținutul dialog-ului
- `AlertDialogHeader`: Header-ul dialog-ului
- `AlertDialogFooter`: Footer-ul dialog-ului
- `AlertDialogTitle`: Titlul dialog-ului
- `AlertDialogDescription`: Descrierea dialog-ului
- `AlertDialogAction`: Buton de acțiune (confirmare)
- `AlertDialogCancel`: Buton de anulare

**Detalii Implementare**:
Folosește Radix UI Alert Dialog care oferă:
- Similar cu Dialog, dar optimizat pentru confirmări
- Focus trap obligatoriu
- Escape key pentru închidere (doar cu Cancel)
- Accesibilitate completă
- Butoane pre-stilizate pentru acțiuni comune

**Exemplu Utilizare**:
```tsx
<AlertDialog>
  <AlertDialogTrigger>Șterge</AlertDialogTrigger>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>Ești sigur?</AlertDialogTitle>
      <AlertDialogDescription>
        Această acțiune nu poate fi anulată.
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel>Anulează</AlertDialogCancel>
      <AlertDialogAction>Șterge</AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

---

### 23. `sheet.tsx`

**Locație**: `components/ui/sheet.tsx`

**Descriere**: Componentă pentru panouri laterale (side panels) care glisează din lateral, similar cu drawer-urile mobile.

**Dependențe**:
- `@radix-ui/react-dialog` (folosit ca bază)
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconița de închidere)

**Exporturi**:
- `SheetProps`: Interfață pentru props-urile sheet-ului
- `Sheet`: Componenta root
- `SheetTrigger`: Trigger pentru deschidere
- `SheetContent`: Conținutul sheet-ului
- `SheetHeader`: Header-ul sheet-ului
- `SheetFooter`: Footer-ul sheet-ului
- `SheetTitle`: Titlul sheet-ului
- `SheetDescription`: Descrierea sheet-ului

**Detalii Implementare**:
Folosește Radix UI Dialog ca bază, dar cu stilizare pentru slide-in panels:
- Animație slide din lateral (left/right/top/bottom)
- Overlay cu backdrop
- Focus trap
- Portal rendering
- Suport pentru dimensiuni variabile

**Variante**:
- `side`: "top" | "right" | "bottom" | "left"

**Exemplu Utilizare**:
```tsx
<Sheet>
  <SheetTrigger>Deschide</SheetTrigger>
  <SheetContent side="right">
    <SheetHeader>
      <SheetTitle>Titlu</SheetTitle>
      <SheetDescription>Descriere</SheetDescription>
    </SheetHeader>
    {/* Conținut */}
  </SheetContent>
</Sheet>
```

---

### 24. `drawer.tsx`

**Locație**: `components/ui/drawer.tsx`

**Descriere**: Componentă pentru drawer-uri mobile-first, cu suport pentru swipe gestures.

**Dependențe**:
- `vaul` (bibliotecă pentru drawer-uri)
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `DrawerProps`: Interfață pentru props-urile drawer-ului
- `Drawer`: Componenta root
- `DrawerTrigger`: Trigger pentru deschidere
- `DrawerContent`: Conținutul drawer-ului
- `DrawerHeader`: Header-ul drawer-ului
- `DrawerFooter`: Footer-ul drawer-ului
- `DrawerTitle`: Titlul drawer-ului
- `DrawerDescription`: Descrierea drawer-ului
- `DrawerClose`: Buton de închidere
- `DrawerOverlay`: Overlay-ul drawer-ului

**Detalii Implementare**:
Folosește biblioteca `vaul` care oferă:
- Swipe gestures pentru închidere
- Animații fluide
- Suport pentru handle de drag
- Optimizat pentru mobile
- Portal rendering

**Exemplu Utilizare**:
```tsx
<Drawer>
  <DrawerTrigger>Deschide</DrawerTrigger>
  <DrawerContent>
    <DrawerHeader>
      <DrawerTitle>Titlu</DrawerTitle>
      <DrawerDescription>Descriere</DrawerDescription>
    </DrawerHeader>
    {/* Conținut */}
    <DrawerFooter>
      <Button>Salvează</Button>
    </DrawerFooter>
  </DrawerContent>
</Drawer>
```

---

### 25. `popover.tsx`

**Locație**: `components/ui/popover.tsx`

**Descriere**: Componentă pentru popover-uri non-modale, care apar lângă un trigger element.

**Dependențe**:
- `@radix-ui/react-popover`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `PopoverProps`: Interfață pentru props-urile popover-ului
- `Popover`: Componenta root
- `PopoverTrigger`: Trigger pentru deschidere
- `PopoverContent`: Conținutul popover-ului
- `PopoverAnchor`: Anchor point pentru positioning

**Detalii Implementare**:
Folosește Radix UI Popover care oferă:
- Positioning automat (lângă trigger)
- Click outside pentru închidere
- Escape key pentru închidere
- Portal rendering
- Accesibilitate completă
- Suport pentru positioning custom

**Exemplu Utilizare**:
```tsx
<Popover>
  <PopoverTrigger>Deschide</PopoverTrigger>
  <PopoverContent>
    {/* Conținut popover */}
  </PopoverContent>
</Popover>
```

---

### 26. `hover-card.tsx`

**Locație**: `components/ui/hover-card.tsx`

**Descriere**: Componentă pentru card-uri care apar la hover, pentru informații suplimentare.

**Dependențe**:
- `@radix-ui/react-hover-card`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `HoverCardProps`: Interfață pentru props-urile hover card-ului
- `HoverCard`: Componenta root
- `HoverCardTrigger`: Trigger pentru hover
- `HoverCardContent`: Conținutul card-ului

**Detalii Implementare**:
Folosește Radix UI Hover Card care oferă:
- Apariție la hover
- Delay configurabil pentru open/close
- Positioning automat
- Portal rendering
- Accesibilitate (suport pentru keyboard)

**Exemplu Utilizare**:
```tsx
<HoverCard>
  <HoverCardTrigger>Hover aici</HoverCardTrigger>
  <HoverCardContent>
    {/* Conținut card */}
  </HoverCardContent>
</HoverCard>
```

---

### 27. `tooltip.tsx`

**Locație**: `components/ui/tooltip.tsx`

**Descriere**: Componentă pentru tooltip-uri, pentru informații scurte la hover/focus.

**Dependențe**:
- `@radix-ui/react-tooltip`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `TooltipProps`: Interfață pentru props-urile tooltip-ului
- `Tooltip`: Componenta root
- `TooltipTrigger`: Trigger pentru tooltip
- `TooltipContent`: Conținutul tooltip-ului
- `TooltipProvider`: Provider pentru configurare globală

**Detalii Implementare**:
Folosește Radix UI Tooltip care oferă:
- Apariție la hover sau focus
- Delay configurabil
- Positioning automat
- Portal rendering
- Accesibilitate completă (ARIA tooltip pattern)

**Exemplu Utilizare**:
```tsx
<TooltipProvider>
  <Tooltip>
    <TooltipTrigger>Hover</TooltipTrigger>
    <TooltipContent>
      <p>Informație tooltip</p>
    </TooltipContent>
  </Tooltip>
</TooltipProvider>
```

---

### 28. `context-menu.tsx`

**Locație**: `components/ui/context-menu.tsx`

**Descriere**: Componentă pentru meniuri contextuale (right-click), cu suport pentru submeniuri și acțiuni.

**Dependențe**:
- `@radix-ui/react-context-menu`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `ContextMenuProps`: Interfață pentru props-urile context menu-ului
- `ContextMenu`: Componenta root
- `ContextMenuTrigger`: Trigger pentru meniu (right-click)
- `ContextMenuContent`: Conținutul meniului
- `ContextMenuItem`: Item din meniu
- `ContextMenuCheckboxItem`: Item cu checkbox
- `ContextMenuRadioItem`: Item radio
- `ContextMenuLabel`: Etichetă
- `ContextMenuSeparator`: Separator
- `ContextMenuShortcut`: Shortcut keyboard
- `ContextMenuGroup`: Grup de item-uri
- `ContextMenuPortal`: Portal pentru rendering
- `ContextMenuSub`: Submeniu
- `ContextMenuSubTrigger`: Trigger pentru submeniu
- `ContextMenuSubContent`: Conținut submeniu
- `ContextMenuRadioGroup`: Grup de radio buttons

**Detalii Implementare**:
Folosește Radix UI Context Menu care oferă:
- Apariție la right-click
- Keyboard navigation
- Suport pentru submeniuri
- Accesibilitate completă
- Portal rendering

**Exemplu Utilizare**:
```tsx
<ContextMenu>
  <ContextMenuTrigger>Click dreapta aici</ContextMenuTrigger>
  <ContextMenuContent>
    <ContextMenuItem>Copiază</ContextMenuItem>
    <ContextMenuItem>Lipește</ContextMenuItem>
    <ContextMenuSeparator />
    <ContextMenuItem>Șterge</ContextMenuItem>
  </ContextMenuContent>
</ContextMenu>
```

---

### 29. `dropdown-menu.tsx`

**Locație**: `components/ui/dropdown-menu.tsx`

**Descriere**: Componentă pentru meniuri dropdown, care apar la click pe un trigger.

**Dependențe**:
- `@radix-ui/react-dropdown-menu`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `DropdownMenuProps`: Interfață pentru props-urile dropdown menu-ului
- `DropdownMenu`: Componenta root
- `DropdownMenuTrigger`: Trigger pentru meniu
- `DropdownMenuContent`: Conținutul meniului
- `DropdownMenuItem`: Item din meniu
- `DropdownMenuCheckboxItem`: Item cu checkbox
- `DropdownMenuRadioItem`: Item radio
- `DropdownMenuLabel`: Etichetă
- `DropdownMenuSeparator`: Separator
- `DropdownMenuShortcut`: Shortcut keyboard
- `DropdownMenuGroup`: Grup de item-uri
- `DropdownMenuPortal`: Portal pentru rendering
- `DropdownMenuSub`: Submeniu
- `DropdownMenuSubTrigger`: Trigger pentru submeniu
- `DropdownMenuSubContent`: Conținut submeniu
- `DropdownMenuRadioGroup`: Grup de radio buttons

**Detalii Implementare**:
Folosește Radix UI Dropdown Menu care oferă:
- Apariție la click
- Click outside pentru închidere
- Keyboard navigation
- Suport pentru submeniuri
- Accesibilitate completă
- Portal rendering

**Exemplu Utilizare**:
```tsx
<DropdownMenu>
  <DropdownMenuTrigger>Opțiuni</DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem>Profil</DropdownMenuItem>
    <DropdownMenuItem>Setări</DropdownMenuItem>
    <DropdownMenuSeparator />
    <DropdownMenuItem>Deconectare</DropdownMenuItem>
  </DropdownMenuContent>
</DropdownMenu>
```

---

## Componente de Afișare Date

### 30. `table.tsx`

**Locație**: `components/ui/table.tsx`

**Descriere**: Componentă pentru tabele, cu suport pentru header, body, footer și styling consistent.

**Dependențe**:
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `TableProps`: Interfață pentru props-urile tabelului
- `Table`: Componenta root (element `<table>`)
- `TableHeader`: Header-ul tabelului (`<thead>`)
- `TableBody`: Body-ul tabelului (`<tbody>`)
- `TableFooter`: Footer-ul tabelului (`<tfoot>`)
- `TableRow`: Rând din tabel (`<tr>`)
- `TableHead`: Celulă header (`<th>`)
- `TableCell`: Celulă normală (`<td>`)
- `TableCaption`: Caption pentru tabel (`<caption>`)

**Detalii Implementare**:
Componentele sunt wrapper-e simple peste elementele HTML native de tabel, cu:
- Stilizare Tailwind consistentă
- Border și spacing optimizate
- Suport pentru hover states
- Accesibilitate semantică corectă

**Exemplu Utilizare**:
```tsx
<Table>
  <TableCaption>Lista utilizatorilor</TableCaption>
  <TableHeader>
    <TableRow>
      <TableHead>Nume</TableHead>
      <TableHead>Email</TableHead>
    </TableRow>
  </TableHeader>
  <TableBody>
    <TableRow>
      <TableCell>John Doe</TableCell>
      <TableCell>john@example.com</TableCell>
    </TableRow>
  </TableBody>
</Table>
```

---

### 31. `card.tsx`

**Locație**: `components/ui/card.tsx`

**Descriere**: Componentă pentru card-uri, cu suport pentru header, content, footer și acțiuni.

**Dependențe**:
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `CardProps`: Interfață pentru props-urile card-ului
- `Card`: Componenta root
- `CardHeader`: Header-ul card-ului
- `CardTitle`: Titlul card-ului
- `CardDescription`: Descrierea card-ului
- `CardContent`: Conținutul card-ului
- `CardFooter`: Footer-ul card-ului

**Detalii Implementare**:
Card-ul este un container flexbox cu:
- Border și shadow pentru depth
- Padding consistent pentru secțiuni
- Suport pentru header, content, footer
- Stilizare Tailwind pentru spacing și culori

**Exemplu Utilizare**:
```tsx
<Card>
  <CardHeader>
    <CardTitle>Titlu Card</CardTitle>
    <CardDescription>Descriere card</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Conținut */}
  </CardContent>
  <CardFooter>
    <Button>Acțiune</Button>
  </CardFooter>
</Card>
```

---

### 32. `alert.tsx`

**Locație**: `components/ui/alert.tsx`

**Descriere**: Componentă pentru alerte și notificări, cu variante pentru diferite tipuri de mesaje.

**Dependențe**:
- `class-variance-authority` (cva)
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `AlertProps`: Interfață pentru props-urile alert-ului
- `Alert`: Componenta root
- `AlertTitle`: Titlul alert-ului
- `AlertDescription`: Descrierea alert-ului

**Variante**:
- `variant`: "default" | "destructive"

**Detalii Implementare**:
Alert-ul folosește `cva` pentru variante:
- `default`: Border și background neutru
- `destructive`: Border și background roșu pentru erori

Poate include iconițe pentru claritate vizuală.

**Exemplu Utilizare**:
```tsx
<Alert>
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Heads up!</AlertTitle>
  <AlertDescription>
    Acesta este un mesaj de alertă.
  </AlertDescription>
</Alert>

<Alert variant="destructive">
  <AlertCircle className="h-4 w-4" />
  <AlertTitle>Eroare</AlertTitle>
  <AlertDescription>
    Ceva nu a funcționat corect.
  </AlertDescription>
</Alert>
```

---

### 33. `chart.tsx`

**Locație**: `components/ui/chart.tsx`

**Descriere**: Componentă wrapper pentru grafice, folosind biblioteca Recharts pentru visualizări de date.

**Dependențe**:
- `recharts`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `ChartConfig`: Tip pentru configurarea culorilor
- `ChartContainerProps`: Interfață pentru props-urile container-ului
- `ChartContainer`: Container pentru grafic
- `ChartTooltipProps`: Interfață pentru tooltip
- `ChartTooltip`: Tooltip personalizat pentru grafice
- `ChartTooltipContent`: Conținutul tooltip-ului
- `ChartLegendProps`: Interfață pentru legendă
- `ChartLegend`: Legendă pentru grafic
- `ChartLegendContent`: Conținutul legendei

**Detalii Implementare**:
Componenta integrează Recharts cu:
- Configurare culori din theme
- Tooltip-uri personalizate
- Legende stilizate
- Responsive design
- Suport pentru multiple tipuri de grafice (Line, Bar, Area, Pie, etc.)

**Exemplu Utilizare**:
```tsx
<ChartContainer config={chartConfig}>
  <LineChart data={data}>
    <Line dataKey="value" />
    <ChartTooltip />
    <ChartLegend />
  </LineChart>
</ChartContainer>
```

---

### 34. `carousel.tsx`

**Locație**: `components/ui/carousel.tsx`

**Descriere**: Componentă pentru carousel-uri (slider-uri), cu suport pentru navigare, auto-play și touch gestures.

**Dependențe**:
- `embla-carousel-react`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe de navigare)

**Exporturi**:
- `CarouselApi`: Tip pentru API-ul carousel-ului
- `CarouselProps`: Interfață pentru props-urile carousel-ului
- `Carousel`: Componenta root
- `CarouselContent`: Conținutul carousel-ului
- `CarouselItem`: Item individual din carousel
- `CarouselPrevious`: Buton "Anterior"
- `CarouselNext`: Buton "Următor"
- `useCarousel`: Hook pentru accesarea context-ului carousel-ului

**Detalii Implementare**:
Folosește Embla Carousel care oferă:
- Touch/swipe gestures pentru mobile
- Drag pentru desktop
- Auto-play opțional
- Loop infinit
- Keyboard navigation
- API programatic pentru control

Folosește Context API pentru a partaja starea între componente.

**Exemplu Utilizare**:
```tsx
<Carousel>
  <CarouselContent>
    <CarouselItem>Slide 1</CarouselItem>
    <CarouselItem>Slide 2</CarouselItem>
    <CarouselItem>Slide 3</CarouselItem>
  </CarouselContent>
  <CarouselPrevious />
  <CarouselNext />
</Carousel>
```

---

### 35. `accordion.tsx`

**Locație**: `components/ui/accordion.tsx`

**Descriere**: Componentă pentru accordion-uri (expandabile/collapsabile), cu suport pentru single sau multiple items deschise.

**Dependențe**:
- `@radix-ui/react-accordion`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconița de expandare)

**Exporturi**:
- `AccordionProps`: Interfață pentru props-urile accordion-ului
- `Accordion`: Componenta root
- `AccordionItem`: Item individual
- `AccordionTrigger`: Trigger pentru expandare
- `AccordionContent`: Conținutul item-ului

**Detalii Implementare**:
Folosește Radix UI Accordion care oferă:
- Animații de expandare/colapsare
- Suport pentru single sau multiple items deschise
- Keyboard navigation
- Accesibilitate completă (ARIA accordion pattern)
- Iconiță animată pentru starea expandat/colapsat

**Exemplu Utilizare**:
```tsx
<Accordion type="single" collapsible>
  <AccordionItem value="item-1">
    <AccordionTrigger>Item 1</AccordionTrigger>
    <AccordionContent>
      Conținut item 1
    </AccordionContent>
  </AccordionItem>
  <AccordionItem value="item-2">
    <AccordionTrigger>Item 2</AccordionTrigger>
    <AccordionContent>
      Conținut item 2
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

---

### 36. `collapsible.tsx`

**Locație**: `components/ui/collapsible.tsx`

**Descriere**: Componentă pentru elemente collapsabile simple, fără structura de accordion.

**Dependențe**:
- `@radix-ui/react-collapsible`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `CollapsibleProps`: Interfață pentru props-urile collapsible-ului
- `Collapsible`: Componenta root
- `CollapsibleTrigger`: Trigger pentru expandare/colapsare
- `CollapsibleContent`: Conținutul collapsible-ului

**Detalii Implementare**:
Folosește Radix UI Collapsible care oferă:
- Animații de expandare/colapsare
- Control programatic al stării
- Accesibilitate completă
- Mai simplu decât Accordion (fără grupări)

**Exemplu Utilizare**:
```tsx
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <CollapsibleTrigger>Toggle</CollapsibleTrigger>
  <CollapsibleContent>
    Conținut collapsible
  </CollapsibleContent>
</Collapsible>
```

---

## Componente de Layout

### 37. `sidebar.tsx`

**Locație**: `components/ui/sidebar.tsx`

**Descriere**: Componentă complexă pentru sidebars, cu suport pentru collapse, resize, și multiple variante de layout.

**Dependențe**:
- `@radix-ui/react-dialog` (pentru mobile)
- `@radix-ui/react-separator`
- `class-variance-authority` (cva)
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `SidebarProps`: Interfață pentru props-urile sidebar-ului
- `Sidebar`: Componenta root
- `SidebarProvider`: Provider pentru context
- `SidebarTrigger`: Trigger pentru toggle
- `SidebarInset`: Inset pentru conținut principal
- `SidebarInput`: Input stilizat pentru sidebar
- `SidebarHeader`: Header-ul sidebar-ului
- `SidebarFooter`: Footer-ul sidebar-ului
- `SidebarContent`: Conținutul sidebar-ului
- `SidebarGroup`: Grup de item-uri
- `SidebarGroupLabel`: Etichetă pentru grup
- `SidebarGroupContent`: Conținutul grupului
- `SidebarGroupAction`: Acțiune pentru grup
- `SidebarMenu`: Meniu din sidebar
- `SidebarMenuButton`: Buton din meniu
- `SidebarMenuItem`: Item din meniu
- `SidebarMenuAction`: Acțiune pentru item
- `SidebarMenuBadge`: Badge pentru item
- `SidebarMenuSkeleton`: Skeleton pentru loading
- `SidebarMenuSub`: Submeniu
- `SidebarMenuSubButton`: Buton pentru submeniu
- `SidebarMenuSubItem`: Item din submeniu
- `useSidebar`: Hook pentru accesarea context-ului sidebar-ului

**Detalii Implementare**:
Sidebar-ul este o componentă foarte complexă care oferă:
- Collapse/expand functionality
- Responsive design (transformare în drawer pe mobile)
- Multiple variante de layout (inset, floating, etc.)
- Suport pentru meniuri ierarhice
- Badge-uri și acțiuni pentru item-uri
- Skeleton states pentru loading
- Context API pentru gestionarea stării

**Variante**:
- `variant`: "sidebar" | "floating" | "inset"

**Exemplu Utilizare**:
```tsx
<SidebarProvider>
  <Sidebar>
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton>Acasă</SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>
    <SidebarContent>
      {/* Conținut sidebar */}
    </SidebarContent>
  </Sidebar>
  <SidebarInset>
    {/* Conținut principal */}
  </SidebarInset>
</SidebarProvider>
```

---

### 38. `resizable.tsx`

**Locație**: `components/ui/resizable.tsx`

**Descriere**: Componentă pentru panouri redimensionabile, cu suport pentru drag handles și dimensiuni min/max.

**Dependențe**:
- `react-resizable-panels`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `ResizableProps`: Interfață pentru props-urile resizable-ului
- `ResizablePanelGroup`: Grup de panouri
- `ResizablePanel`: Panou individual
- `ResizableHandle`: Handle pentru redimensionare

**Detalii Implementare**:
Folosește `react-resizable-panels` care oferă:
- Drag handles pentru redimensionare
- Dimensiuni min/max configurabile
- Persistență a dimensiunilor (opțional)
- Suport pentru orientare orizontală/verticală
- Animații fluide

**Exemplu Utilizare**:
```tsx
<ResizablePanelGroup direction="horizontal">
  <ResizablePanel defaultSize={50}>
    Panou 1
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={50}>
    Panou 2
  </ResizablePanel>
</ResizablePanelGroup>
```

---

### 39. `scroll-area.tsx`

**Locație**: `components/ui/scroll-area.tsx`

**Descriere**: Componentă pentru zone cu scroll personalizat, cu scrollbar-uri stilizate.

**Dependențe**:
- `@radix-ui/react-scroll-area`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `ScrollAreaProps`: Interfață pentru props-urile scroll area-ului
- `ScrollArea`: Componenta root
- `ScrollAreaViewport`: Viewport-ul pentru conținut
- `ScrollAreaScrollbar`: Scrollbar-ul
- `ScrollAreaThumb`: Thumb-ul scrollbar-ului
- `ScrollAreaCorner`: Corner-ul pentru scrollbar-uri multiple

**Detalii Implementare**:
Folosește Radix UI Scroll Area care oferă:
- Scrollbar-uri stilizate (în loc de browser default)
- Suport pentru scroll orizontal și vertical
- Accesibilitate completă
- Cross-browser consistency

**Exemplu Utilizare**:
```tsx
<ScrollArea className="h-[300px]">
  <div className="p-4">
    {/* Conținut lung */}
  </div>
</ScrollArea>
```

---

### 40. `aspect-ratio.tsx`

**Locație**: `components/ui/aspect-ratio.tsx`

**Descriere**: Componentă pentru menținerea unui aspect ratio constant pentru conținut.

**Dependențe**:
- `@radix-ui/react-aspect-ratio`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `AspectRatioProps`: Interfață pentru props-urile aspect ratio-ului
- `AspectRatio`: Componenta principală

**Detalii Implementare**:
Folosește Radix UI Aspect Ratio care oferă:
- Menținere automată a raportului de aspect
- Suport pentru ratio-uri comune (16/9, 4/3, 1/1, etc.)
- Util pentru imagini și video

**Exemplu Utilizare**:
```tsx
<AspectRatio ratio={16 / 9}>
  <img src="/image.jpg" alt="Image" />
</AspectRatio>
```

---

## Componente Utilitare

### 41. `progress.tsx`

**Locație**: `components/ui/progress.tsx`

**Descriere**: Componentă pentru bare de progres, cu animații și suport pentru valori 0-100.

**Dependențe**:
- `@radix-ui/react-progress`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `ProgressProps`: Interfață pentru props-urile progress-ului
- `Progress`: Componenta principală

**Detalii Implementare**:
Folosește Radix UI Progress care oferă:
- Bară de progres animată
- Suport pentru valori 0-100
- Accesibilitate completă (ARIA progressbar)
- Animații fluide pentru schimbări de valoare

**Exemplu Utilizare**:
```tsx
<Progress value={33} />
<Progress value={66} className="h-2" />
```

---

### 42. `toggle.tsx`

**Locație**: `components/ui/toggle.tsx`

**Descriere**: Componentă pentru toggle buttons (butoane care rămân apăsate), cu suport pentru stări pressed/unpressed.

**Dependențe**:
- `@radix-ui/react-toggle`
- `class-variance-authority` (cva)
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `ToggleProps`: Interfață pentru props-urile toggle-ului
- `Toggle`: Componenta principală

**Variante**:
- `variant`: "default" | "outline"
- `size`: "default" | "sm" | "lg"

**Detalii Implementare**:
Folosește Radix UI Toggle care oferă:
- Stare pressed/unpressed
- Keyboard support (Space pentru toggle)
- Accesibilitate completă
- Variante de stil similare cu Button

**Exemplu Utilizare**:
```tsx
<Toggle pressed={isPressed} onPressedChange={setIsPressed}>
  Bold
</Toggle>
```

---

### 43. `toggle-group.tsx`

**Locație**: `components/ui/toggle-group.tsx`

**Descriere**: Componentă pentru grupuri de toggle buttons, cu suport pentru selecție unică sau multiplă.

**Dependențe**:
- `@radix-ui/react-toggle-group`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)

**Exporturi**:
- `ToggleGroupProps`: Interfață pentru props-urile grupului
- `ToggleGroup`: Componenta root
- `ToggleGroupItem`: Item individual din grup

**Detalii Implementare**:
Folosește Radix UI Toggle Group care oferă:
- Gestionare automată a stării pentru grup
- Suport pentru single sau multiple selection
- Keyboard navigation
- Accesibilitate completă

**Exemplu Utilizare**:
```tsx
<ToggleGroup type="single" value={value} onValueChange={setValue}>
  <ToggleGroupItem value="bold">B</ToggleGroupItem>
  <ToggleGroupItem value="italic">I</ToggleGroupItem>
  <ToggleGroupItem value="underline">U</ToggleGroupItem>
</ToggleGroup>
```

---

### 44. `command.tsx`

**Locație**: `components/ui/command.tsx`

**Descriere**: Componentă pentru command palette (paletă de comenzi), cu suport pentru căutare și navigare rapidă.

**Dependențe**:
- `cmdk` (Command Menu)
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `CommandProps`: Interfață pentru props-urile command-ului
- `Command`: Componenta root
- `CommandDialog`: Dialog wrapper pentru command palette
- `CommandInput`: Input pentru căutare
- `CommandList`: Lista de rezultate
- `CommandEmpty`: Mesaj când nu sunt rezultate
- `CommandGroup`: Grup de comenzi
- `CommandItem`: Item individual
- `CommandShortcut`: Shortcut keyboard
- `CommandSeparator`: Separator

**Detalii Implementare**:
Folosește biblioteca `cmdk` care oferă:
- Căutare rapidă prin comenzi
- Keyboard navigation completă
- Grupări de comenzi
- Shortcut-uri keyboard
- Dialog modal pentru command palette

**Exemplu Utilizare**:
```tsx
<CommandDialog>
  <CommandInput placeholder="Caută comenzi..." />
  <CommandList>
    <CommandEmpty>Nu s-au găsit rezultate.</CommandEmpty>
    <CommandGroup heading="Sugestii">
      <CommandItem>
        <span>Calendar</span>
        <CommandShortcut>⌘K</CommandShortcut>
      </CommandItem>
    </CommandGroup>
  </CommandList>
</CommandDialog>
```

---

### 45. `calendar.tsx`

**Locație**: `components/ui/calendar.tsx`

**Descriere**: Componentă pentru calendare, cu suport pentru selecție de date, range selection și multiple moduri.

**Dependențe**:
- `react-day-picker`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi**:
- `CalendarProps`: Interfață pentru props-urile calendar-ului
- `Calendar`: Componenta principală

**Detalii Implementare**:
Folosește `react-day-picker` care oferă:
- Selecție de date
- Range selection (interval de date)
- Multiple date selection
- Moduri: single, multiple, range
- Navigare între luni/ani
- Localizare (i18n)
- Disabled dates
- Custom modifiers

**Exemplu Utilizare**:
```tsx
<Calendar
  mode="single"
  selected={date}
  onSelect={setDate}
  className="rounded-md border"
/>
```

---

### 46. `optimized-image.tsx`

**Locație**: `components/ui/optimized-image.tsx`

**Descriere**: Componentă pentru imagini optimizate, cu lazy loading, blur placeholder și error handling.

**Dependențe**:
- `next/image`
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `React.useState`

**Exporturi**:
- `OptimizedImageProps`: Interfață pentru props-urile imaginii
- `OptimizedImage`: Componenta principală

**Detalii Implementare**:
Componenta extinde `next/image` cu:
- Lazy loading automat
- Blur placeholder în timpul încărcării
- Error fallback automat
- Animații de fade-in
- Suport pentru aspect ratio-uri comune
- Loading state cu skeleton

**Props**:
- `src`: URL-ul imaginii
- `alt`: Text alternativ
- `fallback`: URL pentru fallback la eroare (default: '/placeholder.svg')
- `aspectRatio`: "square" | "video" | "auto"
- `className`: Clase CSS suplimentare

**Exemplu Utilizare**:
```tsx
<OptimizedImage
  src="/image.jpg"
  alt="Descriere"
  aspectRatio="video"
  fallback="/placeholder.svg"
/>
```

---

### 47. `toast.tsx` și `toaster.tsx`

**Locație**: `components/ui/toast.tsx` și `components/ui/toaster.tsx`

**Descriere**: Componente pentru toast notifications, cu suport pentru multiple tipuri și poziționare.

**Dependențe**:
- `@radix-ui/react-toast`
- `class-variance-authority` (cva)
- `clsx` și `tailwind-merge` (via `@/lib/utils`)
- `lucide-react` (pentru iconițe)

**Exporturi** (toast.tsx):
- `ToastProps`: Interfață pentru props-urile toast-ului
- `ToastProvider`: Provider pentru context
- `ToastViewport`: Viewport pentru toast-uri
- `Toast`: Componenta root
- `ToastAction`: Acțiune pentru toast
- `ToastClose`: Buton de închidere
- `ToastTitle`: Titlul toast-ului
- `ToastDescription`: Descrierea toast-ului

**Exporturi** (toaster.tsx):
- `Toaster`: Componenta pentru afișarea toast-urilor

**Variante**:
- `variant`: "default" | "destructive"

**Detalii Implementare**:
Folosește Radix UI Toast care oferă:
- Multiple toast-uri simultane
- Auto-dismiss cu timeout configurabil
- Poziționare (top, bottom, left, right)
- Acțiuni și butoane de închidere
- Animații de slide-in/out
- Accesibilitate completă

**Exemplu Utilizare**:
```tsx
import { useToast } from "@/hooks/use-toast"

const { toast } = useToast()

toast({
  title: "Succes",
  description: "Operațiunea a fost finalizată.",
})

toast({
  variant: "destructive",
  title: "Eroare",
  description: "Ceva nu a funcționat.",
})
```

---

### 48. `sonner.tsx`

**Locație**: `components/ui/sonner.tsx`

**Descriere**: Componentă alternativă pentru toast notifications, folosind biblioteca Sonner.

**Dependențe**:
- `sonner`

**Exporturi**:
- `Toaster`: Componenta pentru afișarea toast-urilor

**Detalii Implementare**:
Sonner este o bibliotecă simplă și performantă pentru toast-uri, alternativă la Radix UI Toast. Oferă:
- API simplu
- Animații fluide
- Suport pentru rich content
- Poziționare configurabilă

**Exemplu Utilizare**:
```tsx
import { toast } from "sonner"

toast.success("Succes!")
toast.error("Eroare!")
toast("Mesaj simplu")
```

---

## Hooks Personalizate

### 49. `use-mobile.tsx`

**Locație**: `components/ui/use-mobile.tsx`

**Descriere**: Hook pentru detectarea dispozitivelor mobile, folosind media queries.

**Dependențe**:
- `React.useState` și `React.useEffect`

**Exporturi**:
- `useIsMobile`: Hook care returnează `boolean`

**Detalii Implementare**:
Hook-ul folosește `window.matchMedia` pentru a detecta dacă viewport-ul este mai mic decât 768px (breakpoint-ul Tailwind pentru `md`). Folosește `useEffect` pentru a seta listener-ul și cleanup pentru a elimina listener-ul la unmount.

**Exemplu Utilizare**:
```tsx
const isMobile = useIsMobile()

if (isMobile) {
  return <MobileComponent />
}
return <DesktopComponent />
```

---

### 50. `use-toast.tsx`

**Locație**: `components/ui/use-toast.tsx`

**Descriere**: Hook pentru gestionarea toast notifications, cu suport pentru adăugare, eliminare și actualizare.

**Dependențe**:
- `React.useState`
- `@radix-ui/react-toast`

**Exporturi**:
- `ToastActionElement`: Tip pentru acțiunile toast-ului
- `Toast`: Tip pentru toast-ul individual
- `ToasterToast`: Tip extins pentru toast-uri
- `useToast`: Hook pentru gestionarea toast-urilor

**Detalii Implementare**:
Hook-ul gestionează un array de toast-uri cu:
- Funcție `toast()` pentru adăugare
- Funcție `dismiss()` pentru eliminare
- Funcție `toast.promise()` pentru promise-based toasts
- Gestionare automată a ID-urilor
- State management pentru toate toast-urile active

**Return Value**:
```typescript
{
  toast: (props: Toast) => {
    id: string
    dismiss: () => void
    update: (props: Toast) => void
  }
  dismiss: (toastId?: string) => void
  toasts: ToasterToast[]
}
```

**Exemplu Utilizare**:
```tsx
const { toast } = useToast()

toast({
  title: "Succes",
  description: "Operațiunea a fost finalizată.",
})

// Cu promise
toast.promise(
  fetchData(),
  {
    loading: "Se încarcă...",
    success: "Succes!",
    error: "Eroare!",
  }
)
```

---

## Concluzie

Această documentație acoperă toate cele 50 de componente și hooks din directorul `components/ui/`. Fiecare componentă este construită cu atenție la:

1. **Accesibilitate**: Toate componentele folosesc Radix UI sau implementări proprii accesibile, respectând standardele ARIA.

2. **Performanță**: Componentele sunt optimizate pentru performanță, cu lazy loading, code splitting și optimizări specifice (ex: OptimizedImage folosește next/image).

3. **Type Safety**: Toate componentele sunt fully typed cu TypeScript, oferind autocomplete și verificare de tipuri la compile-time.

4. **Consistență**: Stilizarea este consistentă prin utilizarea Tailwind CSS și a utilităților `cn` și `cva`.

5. **Flexibilitate**: Componentele sunt foarte configurabile, cu multiple variante, dimensiuni și opțiuni de personalizare.

6. **Developer Experience**: API-urile sunt intuitive, cu exemple clare și suport pentru toate cazurile de utilizare comune.

Aceste componente formează fundamentul UI-ului aplicației și pot fi folosite pentru a construi interfețe complexe, accesibile și performante.


