# Kraft – Krafttracker für Fußballer (PWA)

Offline-fähige Web-App für Gym A (Montag) und Gym B (Freitag). Alles läuft lokal im Browser:
kein Backend, kein Login, keine API-Keys, keine KI-Aufrufe, keine Kosten.
Es gehen keine Daten ins Internet (Ausnahme: YouTube-Links, die du selbst antippst).

## Funktionen

- Heute-Dashboard mit Wochenübersicht, Zykluswoche, Block und Wochentyp (Normal / Ohne Spiel / Englische Woche), Schalter „90 min gespielt / Beine schwer“
- Satz-Logging mit Gewicht, Wiederholungen, RIR; Vorschläge vorausgefüllt und mit Begründung („Letztes Mal 4x5 @ RIR 2 → +5 kg“)
- Pausentimer nach jedem Satz mit Ton (und Vibration, wo das Gerät es erlaubt)
- Aufwärm-Checkliste, Beschwerden (0–10), Notizen pro Einheit
- Verlauf pro Übung: Gewicht, geschätztes 1RM (Epley), Volumen; letzte Leistung bei jeder Übung
- Körpergewicht mit Wochenschnitt, Ziel 80 kg und „+200 kcal“-Hinweis nach 2 Wochen ohne Zunahme
- 12-Wochen-Periodisierung (Basis, Kraft, Power mit Kontrast-Hinweis, Deload)
- Übungsbibliothek mit 887 Übungen (offline), Suche und Filter, Demo-Loops, YouTube-Suche, eigene Videos
- Plan-Editor mit Tauschvorschlägen, Freitags-Warnungen, Versionen und Vorlagen
- Zyklus-Auswertung mit regelbasierten Planvorschlägen (Vorher/Nachher, einzeln oder komplett übernehmbar) und „Zusammenfassung kopieren“
- Backup: Export und Import aller Daten als JSON

## Logik im Detail

**Progression (Double Progression mit RIR)** – `src/logic/progression.ts`
Ausgewertet wird die letzte reguläre Einheit der Übung (Ziel-RIR = Untergrenze des Blocks, z. B. 2 in der Basis):

| Bedingung | Vorschlag |
|---|---|
| alle Sätze an der Obergrenze **und** RIR ≥ Ziel+2 | doppeltes Inkrement |
| alle Sätze an der Obergrenze **und** RIR ≥ Ziel | + Inkrement, Wiederholungen auf Untergrenze |
| ein Satz unter der Untergrenze **oder** Ø-RIR mehr als 1 unter Ziel | −5 % (auf Inkrement gerundet, mindestens ein Inkrement) |
| sonst | gleiches Gewicht, Ziel +1 Wiederholung (bis Obergrenze) |

- Blockwechsel: Wiederholungsbereich wird angepasst, Gewicht aus dem e1RM neu berechnet (`e1RM / (1 + (Wdh + Ziel-RIR) / 30)`).
- Explosive Übungen: keine Gewichtsprogression, nur Bestwert und Trend. Trap-Bar-Sprünge starten bei 25 % des Trap-Bar-e1RM.
- Bewusst reduzierte Einheiten (englische Woche, „90 min gespielt“, Deload) werden markiert. Die nächste Empfehlung basiert auf der letzten **regulären** Einheit, es gibt also nie einen Gewichtsabzug wegen einer reduzierten Einheit.
- Nordics: 4 Stufen, Aufstieg bei sauber geschafften Sätzen, bei Hamstring-Schmerz ≥ 3 eine Stufe zurück plus Physio-Hinweis.
- Isometrie / Copenhagen: +5 s pro Woche bis zur Obergrenze, dann nächste Variante (kurzer → langer Hebel).

**Wochentypen** – `src/logic/session.ts`
Ohne Spiel: Montag +1 Satz Beine (Nordics ausgenommen), Freitag zusätzlich Rumänisches Kreuzheben 3x6 @ RPE 7.
Englische Woche: Montag Beine 2 Sätze @ RPE 6 (Gewicht −10 %), Nordics 2x3; Freitag nur Oberkörper, Prävention und 2x3 CMJ.
Das Rumänische Kreuzheben ist eine bewusste Ausnahme von der Regel „Freitag ohne exzentrisch schwere Beinübung“, weil du es so festgelegt hast. Es steht nicht im Plan, sondern kommt nur in Wochen ohne Spiel dazu.

**Zyklus-Auswertung** – `src/logic/review.ts`: Stagnation (3+ reguläre Einheiten ohne Bestwert), Vorschläge nach deinen Regeln, feste Regeln werden nach jeder Übernahme erzwungen (Gym nur Mo/Fr, Freitag ohne exzentrisch schwere oder hoch belastende Beinübungen, Nordics und Copenhagen bleiben im Plan).

## Übungsdatenbank und Lizenz

Quelle: [free-exercise-db](https://github.com/yuhonas/free-exercise-db), lizenziert unter **The Unlicense** (gemeinfrei). Die Lizenz wurde vor dem Einbau über die GitHub-API geprüft (`spdx_id: Unlicense`). Daten und Bilder liegen lokal im Build (`src/data/exdb.json`, `public/exdb/img`), die Bilder sind auf 240 px verkleinert.

Eigene Ergänzungen: Nordic Hamstring Curl, Copenhagen Plank, Trap-Bar-Sprünge, isometrische Single-Leg-Bridge, CMJ, Med-Ball-Rotationswurf, Bulgarian Split Squat, isometrischer Hamstring-Hold, Hüfte 90/90, Sprunggelenk an der Wand, Adduktoren-Heben (kein Demo-Bild).

Ehrliche Einschränkungen:
- Die DB ist englisch. Deutsche Namen, Ausführungshinweise und typische Fehler gibt es von Hand für die Planübungen und die Ergänzungen. Die übrigen Übungen zeigen die englische Originalbeschreibung. Muskeln, Equipment, Kategorie und Schwierigkeit sind komplett auf Deutsch.
- Die Fußball-Felder (Belastung Beine, exzentrisch schwer, 2 Tage vor Spiel, Präventionsfokus) sind für die Planübungen von Hand gesetzt, für alle anderen **Schätzungen** aus Muskel, Equipment und Name. Du kannst sie in der Übungsansicht ändern.
- Box-Übungen (Box Jump, Depth Jump, …) sind gekennzeichnet, mit Alternativen ohne Box.

## Entwickeln

```bash
npm install
npm run dev        # Entwicklung
npm test           # Unit-Tests (Vitest)
npm run build      # Produktions-Build nach dist/
npm run preview    # Build lokal testen (inkl. Service Worker)
```

Tests: `src/logic/logic.test.ts` (52 Tests für Progression, Nordics, Isometrie, Periodisierung, Wochentypen, Körpergewicht, Zyklus-Auswertung, Regeln, Bibliothek).

## Kostenlos deployen (GitHub Pages)

1. Auf github.com ein neues **öffentliches** Repository anlegen (z. B. `kraft-app`).
2. Diesen Ordner `kraft-app` hochladen. Per Terminal:
   ```bash
   cd kraft-app
   git init && git add . && git commit -m "Kraft-App"
   git branch -M main
   git remote add origin https://github.com/DEIN-NAME/kraft-app.git
   git push -u origin main
   ```
3. Im Repository: **Settings → Pages → Build and deployment → Source: „GitHub Actions“**.
4. Der Workflow `.github/workflows/deploy.yml` startet automatisch (Reiter **Actions**) und führt erst die Tests, dann den Build aus. Nach ca. 1–2 Minuten steht die App unter `https://DEIN-NAME.github.io/kraft-app/`.

Alternative Vercel (Free): Repository bei vercel.com importieren, Framework „Vite“ wählen, Deploy. Die App nutzt relative Pfade und Hash-Routing und läuft deshalb auch in Unterverzeichnissen.

## Auf dem iPhone installieren

1. Die URL **in Safari** öffnen (nicht in Chrome oder in einer In-App-Ansicht).
2. Teilen-Symbol (Quadrat mit Pfeil) → **„Zum Home-Bildschirm“** → Hinzufügen.
3. Einmal **mit Internet** über das Home-Symbol öffnen und kurz warten (der Service Worker lädt ca. 16 MB, inklusive Übungsbilder). Danach funktioniert alles auch im Flugmodus.
4. Optional: Unter **Mehr → Backup** regelmäßig exportieren. Die Daten liegen nur auf dem Gerät. iOS kann Website-Daten löschen, wenn eine nicht installierte Web-App lange nicht genutzt wird. Als Homescreen-App ist das deutlich seltener.

Hinweise zu iOS:
- **Vibration** unterstützt Safari auf dem iPhone nicht. Die Pause wird deshalb mit Ton und Anzeige gemeldet. Der Ton kommt erst, nachdem du einmal einen Satz abgehakt hast (iOS verlangt eine Berührung) und nicht, wenn der Stumm-Schalter aktiv ist.
- Der Timer rechnet mit Zeitstempeln. Wenn du die App kurz verlässt, stimmt die Zeit beim Zurückkommen trotzdem. Die Meldung am Ende kommt aber nur, solange die App offen ist.
- Der Bildschirm wird während der Einheit wach gehalten (iOS 16.4+).

## Datenschutz

Keine Cookies, keine Analytics, keine Anfragen an Server außer dem Laden der App selbst. Videos (aufgenommen oder hochgeladen) bleiben lokal in IndexedDB.
