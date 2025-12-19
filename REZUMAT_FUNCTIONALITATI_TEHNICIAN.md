# Rezumat Funcționalități Tehnician

## 📋 Cuprins
1. [Vizualizare și Acces](#vizualizare-și-acces)
2. [Pipeline-uri Departament](#pipeline-uri-departament)
3. [Gestionare Tăvițe](#gestionare-tăvițe)
4. [Operațiuni pe Items](#operațiuni-pe-items)
5. [Imagini Tăvițe](#imagini-tăvițe)
6. [Comunicare](#comunicare)
7. [Istoric și Tracking](#istoric-și-tracking)
8. [Restricții și Limitări](#restricții-și-limitări)

---

## 1. Vizualizare și Acces

### 1.1. Pipeline-uri Disponibile
Tehnicienii pot accesa și lucra în următoarele pipeline-uri departament:
- **Saloane** - pentru instrumente din departamentul Saloane
- **Frizerii** - pentru instrumente din departamentul Frizerii
- **Horeca** - pentru instrumente din departamentul Horeca
- **Reparatii** - pentru instrumente din departamentul Reparatii sau pentru piese

### 1.2. Filtrare Automată
- **Vizualizare restricționată**: Tehnicienii văd doar tăvițele atribuite lor sau tăvițele neatribuite (fără `technician_id`)
- **Admin/Owner bypass**: Utilizatorii cu rol `admin` sau `owner` pot vedea toate tăvițele, indiferent de atribuire
- **Filtrare în timp real**: Lista de tăvițe se actualizează automat bazat pe atribuirea tehnicianului curent

### 1.3. Pagină Dedicată Tehnician
- **Rută specială**: `/tehnician/tray/[trayId]` - pagină dedicată pentru lucrul cu o tăviță specifică
- **Acces direct**: Click pe o tăviță din Kanban board deschide pagina dedicată tehnicianului
- **Interfață optimizată**: UI adaptat pentru operațiunile specifice tehnicienilor

---

## 2. Pipeline-uri Departament

### 2.1. Stage-uri Disponibile
Tehnicienii pot muta tăvițele între următoarele stage-uri:
1. **Noua** - Tăvița primită, în așteptare
2. **In Lucru** - Tăvița este procesată activ
3. **In Asteptare** - Așteaptă acțiune (piese, confirmare, etc.)
4. **De confirmat** - Așteaptă confirmare de la client
5. **Finalizare** - Proces finalizat

### 2.2. Mutare între Stage-uri
- **Drag & Drop**: Mutare tăvițe între stage-uri prin drag & drop în Kanban board
- **Buton Finalizare**: Buton dedicat pentru finalizarea tăviței (mută în stage-ul "Finalizare")
- **Tracking automat**: Toate mutările sunt înregistrate în istoric cu timestamp

---

## 3. Gestionare Tăvițe

### 3.1. Vizualizare Detalii Tăviță
- **Informații de bază**: Număr tăviță, dimensiune, status
- **Detalii client**: Nume, email, telefon (din lead asociat)
- **Detalii comandă**: Comentarii și instrucțiuni de la client (read-only pentru tehnician)
- **Status tăviță**: Vizualizare și actualizare status (in_receptie, in_lucru, gata)

### 3.2. Actualizare Status Tăviță
- **Switch status**: Toggle pentru a marca tăvița ca "Gata" sau "In Lucru"
- **Salvare automată**: Statusul se salvează automat în baza de date
- **Feedback vizual**: Indicatori vizuali pentru statusul curent

### 3.3. Informații Tăviță (Read-Only)
- **Detalii comandă**: Vizualizare comentarii și instrucțiuni de la client
- **Read-only**: Tehnicienii pot doar citi detaliile, nu le pot modifica
- **Sincronizare**: Detaliile se actualizează automat când vânzătorul le modifică

---

## 4. Operațiuni pe Items

### 4.1. Vizualizare Items
Tehnicienii pot vedea toate items-urile dintr-o tăviță:
- **Servicii**: Nume serviciu, instrument asociat, cantitate, preț, discount, urgent
- **Piese**: Nume piesă, cantitate, preț (doar în pipeline-ul Reparatii)
- **Instrumente**: Instrumente adăugate direct în tăviță
- **Brand/Serial**: Brand și numere de serie pentru instrumente din Reparatii
- **Garantie**: Indicator pentru items cu garanție

### 4.2. Editare Items Existente
- **Cantitate**: Modificare cantitate pentru servicii și piese
- **Discount**: Modificare discount procentual (doar în pipeline-uri comerciale, NU în departamente)
- **Preț**: Modificare preț pentru piese (doar în pipeline-uri comerciale)
- **Editare inline**: Editare directă în tabel pentru cantitate și discount
- **Dialog editare**: Dialog dedicat pentru editare detaliată a unui serviciu

### 4.3. Adăugare Servicii
- **Selectare instrument**: Dropdown cu toate instrumentele disponibile
- **Selectare serviciu**: Căutare și selectare servicii disponibile pentru instrumentul ales
- **Setare cantitate**: Setare cantitate pentru serviciu
- **Setare discount**: Setare discount procentual (doar în pipeline-uri comerciale)
- **Atribuire tehnician**: Automat la tehnicianul curent (în pipeline-uri departament)
- **Salvare**: Adăugare serviciu în tăviță cu salvare automată

### 4.4. Adăugare Piese (doar în Reparatii)
- **Căutare piesă**: Căutare piesă în lista de piese disponibile
- **Selectare piesă**: Selectare piesă din dropdown sau căutare
- **Setare cantitate**: Setare cantitate pentru piesă
- **Serial Number**: Selectare serial number asociat cu instrumentul (opțional)
- **Preț**: Setare preț personalizat pentru piesă (doar în pipeline-uri comerciale)
- **Atribuire automată**: Piesa se atribuie automat pipeline-ului "Reparatii"

### 4.5. Ștergere Items
- **Buton ștergere**: Buton de ștergere pentru fiecare item din tabel
- **Confirmare**: Ștergerea este permanentă și se salvează în istoric

### 4.6. Restricții pentru Tehnicieni în Departamente
- **NU pot adăuga instrumente**: Secțiunea "Adaugă Instrument" este ascunsă pentru tehnicieni în pipeline-uri departament
- **NU pot modifica Urgent/Abonament**: Checkbox-urile pentru "Urgent" și "Abonament" nu sunt disponibile
- **NU pot modifica discount**: Discount-ul nu poate fi modificat în pipeline-uri departament
- **NU pot edita tăvița**: Butonul "Editează tăviță" este ascuns în pipeline-uri departament

---

## 5. Imagini Tăvițe

### 5.1. Upload Imagini
- **Adăugare imagini**: Upload imagini pentru tăviță (doar în pipeline-uri departament: Saloane, Frizerii, Horeca, Reparatii)
- **Format acceptat**: Doar imagini (nu fișiere)
- **Validare**: Verificare automată că fișierul este o imagine
- **Feedback**: Mesaje de eroare dacă upload-ul eșuează

### 5.2. Vizualizare Imagini
- **Galerie imagini**: Vizualizare toate imaginile încărcate pentru tăviță
- **Layout responsive**: Grid adaptiv pentru imagini (2 coloane pe mobile, 3-4 pe desktop)
- **Expandare/colapsare**: Secțiunea de imagini poate fi expandată sau colapsată
- **Preview**: Preview imagini în galerie

### 5.3. Ștergere Imagini
- **Buton ștergere**: Buton de ștergere pentru fiecare imagine
- **Confirmare**: Ștergerea este permanentă

### 5.4. Download Imagini
- **Download individual**: Download pentru fiecare imagine
- **Format original**: Download în formatul original al imaginii

---

## 6. Comunicare

### 6.1. Mesagerie cu Vânzători
- **Chat integrat**: Secțiune de mesagerie în panoul de detalii lead
- **Mesaje bidirecționale**: Trimite și primește mesaje de la vânzători
- **Identificare rol**: Mesajele sunt marcate cu rolul expeditorului (tehnician/vânzător)
- **Istoric mesaje**: Vizualizare istoric complet al conversației
- **Notificări**: Notificări pentru mesaje noi

### 6.2. Trimite pentru Confirmare
- **Buton "De confirmat"**: Mută tăvița în stage-ul "De confirmat"
- **Logging automat**: Evenimentul este înregistrat în istoric
- **Notificare vânzător**: Vânzătorul este notificat că tăvița necesită confirmare

---

## 7. Istoric și Tracking

### 7.1. Vizualizare Istoric
- **Tab Istoric**: Tab dedicat pentru vizualizarea istoricului complet al lead-ului
- **Evenimente**: Toate evenimentele sunt înregistrate cu timestamp și detalii
- **Filtrare**: Filtrare evenimente după tip și dată

### 7.2. Tipuri de Evenimente Înregistrate
- **Mutare stage**: Mutări între stage-uri
- **Adăugare items**: Adăugare servicii, piese, instrumente
- **Modificare items**: Modificări la cantitate, preț, discount
- **Ștergere items**: Ștergere items din tăviță
- **Atribuire tehnician**: Atribuire sau schimbare tehnician
- **Upload imagini**: Upload imagini pentru tăviță
- **Modificare status**: Schimbări de status pentru tăviță
- **Mesaje**: Mesaje trimise în chat

### 7.3. Tracking Tehnician
- **Atribuire automată**: Tehnicianul curent este atribuit automat la items-urile adăugate
- **Istoric atribuiri**: Toate atribuirile sunt înregistrate în istoric
- **Transfer tăviță**: Posibilitate de a transfera tăvița către alt tehnician (cu logging)

---

## 8. Restricții și Limitări

### 8.1. Operațiuni Interzise în Pipeline-uri Departament
- ❌ **NU pot adăuga instrumente**: Secțiunea "Adaugă Instrument" este complet ascunsă
- ❌ **NU pot modifica Urgent**: Checkbox-ul "Urgent" nu este disponibil
- ❌ **NU pot modifica Abonament**: Dropdown-ul "Abonament" nu este disponibil
- ❌ **NU pot modifica discount**: Câmpul "Disc%" nu este editabil
- ❌ **NU pot edita tăvița**: Butonul "Editează tăviță" este ascuns
- ❌ **NU pot modifica detalii tăviță**: Detaliile comenzii sunt read-only

### 8.2. Operațiuni Permise în Pipeline-uri Departament
- ✅ **Pot adăuga servicii**: Adăugare servicii pentru instrumentele existente
- ✅ **Pot adăuga piese**: Adăugare piese (doar în pipeline-ul Reparatii)
- ✅ **Pot modifica cantitate**: Modificare cantitate pentru items existente
- ✅ **Pot șterge items**: Ștergere items din tăviță
- ✅ **Pot muta între stage-uri**: Mutare tăvițe între stage-uri prin drag & drop
- ✅ **Pot actualiza status**: Actualizare status tăviță (in_lucru, gata)
- ✅ **Pot upload imagini**: Upload imagini pentru tăviță
- ✅ **Pot comunica**: Trimite mesaje către vânzători

### 8.3. Limitări Vizualizare
- **Doar tăvițele atribuite**: Tehnicienii văd doar tăvițele atribuite lor sau neatribuite
- **Fără acces comercial**: Nu au acces la pipeline-urile comerciale (Vânzări, Recepție, Curier) pentru editare
- **Read-only detalii**: Detaliile comenzii sunt read-only, nu pot fi modificate

### 8.4. Permisiuni Speciale
- **Admin/Owner bypass**: Utilizatorii cu rol `admin` sau `owner` pot vedea toate tăvițele, indiferent de atribuire
- **Vizualizare completă**: Admin/Owner pot vedea toate items-urile și pot modifica toate câmpurile

---

## 9. Flux de Lucru Tipic

### 9.1. Preluare Tăviță
1. Tehnicianul accesează pipeline-ul departamentului (ex: Saloane)
2. Vede tăvițele atribuite lui sau neatribuite în stage-ul "Noua"
3. Click pe tăviță pentru a deschide pagina dedicată

### 9.2. Procesare Tăviță
1. **Mutare în "In Lucru"**: Drag & drop sau click pentru a muta tăvița în "In Lucru"
2. **Citire detalii**: Citește detaliile comenzii de la client (read-only)
3. **Adăugare servicii**: Adaugă servicii necesare pentru instrumentele din tăviță
4. **Adăugare piese** (dacă e Reparatii): Adaugă piese necesare pentru reparații
5. **Upload imagini**: Încarcă imagini cu progresul lucrării (opțional)

### 9.3. Finalizare
1. **Actualizare status**: Marchează tăvița ca "Gata" când lucrarea este finalizată
2. **Mutare în "Finalizare"**: Mută tăvița în stage-ul "Finalizare"
3. **Comunicare**: Trimite mesaje către vânzător dacă sunt necesare clarificări

### 9.4. Necesitate Confirmare
1. **Mutare în "De confirmat"**: Dacă este nevoie de confirmare de la client
2. **Așteptare**: Așteaptă confirmarea de la vânzător/client
3. **Revenire în "In Lucru"**: După confirmare, revine în "In Lucru" pentru finalizare

---

## 10. Funcționalități Tehnice

### 10.1. Sincronizare Real-time
- **Actualizări live**: Modificările altor utilizatori se reflectă automat
- **Subscripții Supabase**: Subscripții real-time pentru tăvițe și items
- **Prevenire conflicte**: Sistem de prevenire a conflictelor la editări simultane

### 10.2. Salvare Automată
- **Auto-save**: Modificările se salvează automat la închiderea panoului
- **Feedback vizual**: Indicatori pentru starea de salvare (dirty/clean)
- **Istoric automat**: Toate modificările sunt înregistrate automat în istoric

### 10.3. Responsive Design
- **Mobile-friendly**: Interfață optimizată pentru dispozitive mobile
- **Tablet support**: Suport pentru tablete
- **Desktop optimized**: Interfață optimizată pentru desktop

---

## 11. Pagină Profil Tehnician

### 11.1. Statistici Personale
- **Tăvițe procesate**: Număr de tăvițe finalizate
- **Tăvițe în lucru**: Număr de tăvițe în procesare
- **Performanță**: Statistici despre performanță (dacă este implementat)

### 11.2. Istoric Personal
- **Activitate recentă**: Istoricul activităților recente
- **Tăvițe finalizate**: Lista tăvițelor finalizate de tehnician

---

## 12. Notificări și Alerte

### 12.1. Notificări Mesaje
- **Mesaje noi**: Notificări pentru mesaje noi de la vânzători
- **Confirmări**: Notificări când o tăviță necesită confirmare

### 12.2. Feedback Vizual
- **Toast notifications**: Notificări toast pentru acțiuni (succes/eroare)
- **Loading states**: Indicatori de încărcare pentru operațiuni asincrone
- **Error handling**: Mesaje de eroare clare pentru operațiuni eșuate

---

## Concluzie

Tehnicienii au acces la un set complet de funcționalități pentru gestionarea tăvițelor în pipeline-urile departamentelor, cu restricții clare pentru a menține integritatea datelor și a separa responsabilitățile între vânzători și tehnicieni. Sistemul oferă tracking complet, comunicare bidirecțională și sincronizare real-time pentru o experiență optimă de lucru.
