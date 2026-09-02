**Click [here](README-en.md) to view the english version of this README.**

# Baureihe J/JK FGI-Simulator

Eine originalgetreue Nachbildung des Fahrgastinformationssystems der Baureihen J und JK der U-Bahn Berlin.

Zum herunterladen dieses Projektes befinden sich geeignete Versionen unter den [Releases](https://github.com/myron0117/BVG-J-JK-FGI-Sim/releases) dieser Repository.



## Abschnitte:

- [Verwendung](#verwendung)\
-> [Steuerung](#steuerung)\
-> [Konfiguration & Erscheinungsbild](#konfiguration--erscheinungsbild)\
-> [Verfügbare Linien](#verfügbare-linien)\
-> [Fernsteuerung](#fernsteuerung)

- [Sonstiges](#sonstiges)\
-> [Weitere Informationen](#weitere-informationen)\
-> [Nutzungsbedingungen](#nutzungsbedingungen)\
-> [Haftungsausschluss](#haftungsausschluss)\
-> [Rechtliches](#rechtliches)\
-> [Kontakt](#kontakt)



## Verwendung

> [!IMPORTANT]
> Der Simulator ist über die im Kernverzeichnis beigelegte Batch-Datei `Baureihe J&JK FGI-Simulator.bat` zu starten.
>
> Hierfür wird sowohl Python als auch Node.js benötigt. Zusätzliche Abhängigkeiten werden automatisch installiert und überprüft.

> [!NOTE]
> Der Simulator wurde für 16:9-FHD-Bildschirme gestaltet. Zur besten Sichtbarkeit aller Elemente ist der Browser, in dem der Simulator geöffnet ist, im Vollbild zu nutzen.

Die Benutzeroberfläche ist übersichtlich und einfach verwendbar gestaltet. Die Nutzung der Dateneingabe ist selbsterklärend, die Stationskürzel können über die Schaltfläche **'Stationskürzel-Listen'** eingesehen werden.

Zudem lassen sich beide Anzeigen mit der aktuell eingestellten Konfiguration in einem neuen Tab öffnen.

Schaltflächen zur Steuerung sowie zur Konfiguration des Simulators sind folgend erläutert.



### Steuerung

| Schaltfäche | Funktion |
| ------------- | ------------- |
| ↓  | Schaltet eine Station weiter. Nach 5s ertönt ein Gong und die Richtungsanzeige wird aktualisiert. Mit **Shift + Klick** kann man ohne weitere Ausführung weiterschalten. |
| ↑ | Schaltet eine Station zurück. |
| kurz vor Halt | Simuliert den Zeitpunkt, an dem das Fahrzeug in die nächste Station einfährt. Die Ausgangsübersicht erscheint und die Richtungsanzeige wird mit einem Ausstiegspfeil ergänzt. |
| Türfreigabe | Simuliert die wirkende Türfreigabe bei Stillstand. Die Ausgangsübersicht und ggf. auch die Echtzeitanschlussübersicht verschwindet nach 10s. |
| Abfertigung | Simuliert die Rücknahme der Türfreigabe. Eine Weiterschaltung ist nun möglich. |



### Konfiguration & Erscheinungsbild

| Konfigurationselement | Funktion |
| ------------- | ------------- |
| Display-Seite | Bestimmt die simulierte Seite, an die die jeweilige Anzeige hängt. Hat Auswirkungen auf die Richtung, in die der Linienverlauf verläuft, sowie ob die Ausgangsübersicht bei Ankunft erscheint. |
| Display-Position | Bestimmt die simulierte Position im Fahrzeug. Hat Auswirkung auf die angezeigten Ausgänge und Anschlussmöglichkeiten, welche je nach Position an einer anderen Stelle erscheinen. |
| Erscheinungsbild | Selbsterklärend. Hat eine globale Auswirkung auf alle Bildschirme. |
| Ausgangsübersicht immer zeigen? | Bestimmt, ob die Ausgangsübersicht auch auf der Seite angezeigt werden soll, welche nicht gleich der Ausstiegseite ist. |
| Live-Anschlüsse zeigen? | Selbsterklärend; erscheint 15s nach Weiterschaltung. Hat eine globale Auswirkung auf alle Bildschirme. |
| Kombi-Linien-Design | Bestimmt die farbliche Gestaltung von mehrfarbigen Linien, wie z.B. der U12. Hat eine globale Auswirkung auf alle Bildschirme. |
| Rückfallebene | Selbsterklärend. |

Die Spracheinstellung in der oberen rechten Ecke ist Bestandteil der Konfiguration und kann wie alle anderen Einstellungen über die Schaltfläche **'Konfiguration speichern'** gespeichert werden.



### Verfügbare Linien

In folgender Tabelle sind alle verwendbaren Linien sowie eine kurze Beschreibung angegeben.

| Gezeigte Linienbez. | Einzugebene Linienbez. | Beschreibung |
| ------------- | ------------- | ------------- |
| **U1 - U9** | `U1` `U2` `U3` `U4` `U5` `U6` `U7` `U8` `U9` | Standardlinien. |
| **U2** | `U2+` | Fiktive Verlängerung nach Rathaus Spandau. |
| **U3** | `U3+` | Fiktive Verlängerung zum Mexikoplatz. |
| **U5** | `U5+` | Fiktive Verlängerung nach Urban Tech Republic, basiert auf fiktive U55 von U-Bahn Sim Berlin's Trainz Simulator 2009 Add-On. |
| **U6** | `U6+` | Erhalt der geschlossenen Station Französische Straße. |
| **U12** | `U12` | Umfahrungslinie für Bauarbeiten bestehend aus U1 und U2. |
| **U15** | `U15` | Alternative Linienbezeichnung für die U1. |
| **U2** | `U23` | Linienführung für damalige U2-Einsetzer aus Fehrbelliner Platz kommend. |
| **U23** | `U23+` | Fiktive Kombi-Linie bestehend aus U2 und U3. |
| **U55** | `U55` | Ehemalige Kanzlerlinie. |
| **U55** | `U55+` | Fiktive U55 von U-Bahn Sim Berlin's Trainz Simulator 2009 Add-On. |
| **U67** | `U67` | Fiktive Kombi-Linie bestehend aus U6 und U7. |



### Fernsteuerung

Die Fernsteuerung erfordert das Akzeptieren der Benutzerkontensteuerung-Anfrage die durch den Simulator ausgelöst wird. Dadurch können die nötigen Tastendrucke Systemweit erkannt und verarbeitet werden, solange das Programm aktiv ist.

Die Tastenbelegung für die Fernsteuerung basiert auf die Fahrzeugsteuerung in SubwaySim 2. Sollte die Steuerung vom Spiel abweichen, kann die Belegung unter `content/data/control_input/mapping.json` bearbeitet werden.



## Sonstiges

### Weitere Informationen

> [!NOTE]
> - Zum grundlegenden Aufbau der Webseiten sowie ihrer Funktionalität wurde künstliche Intelligenz als Unterstützung eingesetzt.
>
> - Die Bildschirme wurden mit höchster Präzision und nahezu pixelperfekter Platzierung nach ihrem Vorbild gestaltet.
>
> - Die Echtzeitanschlüsse werden durch eine im Projekt mitgelieferte Version von [v6.bvg.transport.rest](https://v6.bvg.transport.rest/) ermöglicht.
>
> - Danke an Dorian für den Anreiz, dieses Projekt zu beginnen!



### Nutzungsbedingungen

> [!IMPORTANT]
> Die folgenden Nutzungsbedingungen entsprechen meinen persönlichen Erwartungen an die Nutzer auf moralischer Ebene und sind lediglich als Bitten anzusehen, unabhängig von ihrer Formulierung.
>
> Die folgenden Nutzungsbedingungen stehen nicht im Konflikt mit der geltenden MIT-Lizenz.
>
> - Das Projekt ist nicht an andere Nutzer zu verkaufen. Die Verbreitung des Projektes hat kostenfrei zu erfolgen und geschieht entweder mit direktem Teilen des Projektes als Archivdatei oder mit Verlinken der GitHub-Repository.
>
> - Bei Verwendung verschiedener Inhalte des Projektes für eigene Projekte, für welche die Fahrgastinfo der Neubaureihen geeignet ist, ist nach Möglichkeit auf die GitHub-Repository dieses Projektes zu verweisen.
>
> - Das Projekt ist nicht für schädliche oder irreführende Zwecke einzusetzen. Darunter fällt beispielsweise die absichtliche Verwirrung von Fahrgästen im ÖPNV.



### Haftungsausschluss

Für Schäden und Folgen, die aus missbräuchlicher Verwendung des Simulators resultieren, übernehme ich keine Haftung.



### Rechtliches

Die Berliner Verkehrsbetriebe ("BVG") sind rechtmäßige Inhaber der erwähnten bzw. verwendeten Namen, Begriffe, Schriftarten, Logos, Zeichen
und sonstiger Inhalte, welche klar identifizierbar zu dem Unternehmen gehören.

Die Deutsche Bahn AG ("DB AG") sowie der Verkehrsbund Berlin-Brandenburg ("VBB") sind jeweils rechtmäßige Inhaber
der verwendeten Logos und Zeichen für verschiedene Elemente des Simulators.

Alle genannten Marken und deren Bestandteile bleiben Eigentum der jeweiligen Inhaber und sind nicht Bestandteil der MIT-Lizenz dieses Projektes.



### Kontakt

Bei jeglichen Anliegen bin ich unter folgenden Kontaktmöglichkeiten zu erreichen:

Mailadresse: `0117myron@gmail.com`\
Discord: `@myron_0117`