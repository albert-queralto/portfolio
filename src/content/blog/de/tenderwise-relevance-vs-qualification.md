---
title: "Warum TenderWise Relevanz und Qualifikation trennt"
description: "Warum TenderWise strategische Relevanz und verpflichtende Qualifikation getrennt bewertet, statt Vergabeentscheidungen in einem einzigen undurchsichtigen Tender-Match-Score zusammenzufassen."
date: 2026-11-24
publishAt: 2026-11-24T08:00:00+02:00
lang: de
translationKey: tenderwise-relevance-vs-qualification
tags:
  [
    "Decision Systems",
    "Procurement",
    "SaaS",
    "Explainability",
    "Product Engineering",
  ]
draft: false
cover: "/og/tenderwise-relevance-vs-qualification.png"
featured: false
project: "tenderwise"
---

Ein Tender kann eine hervorragende kommerzielle Opportunity sein und für ein Unternehmen trotzdem unmöglich zu bieten sein.

Auch das Gegenteil ist möglich.

Ein Unternehmen kann jede formale Anforderung eines Tenders erfüllen, für den es strategisch keinen Grund zur Teilnahme gibt.

Das klingt offensichtlich.

Es bedeutet aber auch, dass ein einzelner „Tender-Match-Score“ konzeptionell falsch ist.

Deshalb hält **TenderWise** **Relevanz** und **Qualifikation** als getrennte Entscheidungsachsen.

## Vergabe enthält mehrere unterschiedliche Fragen

Wenn ein Vergabeteam einen Tender öffnet, kann es fragen:

```text
Liegt er in einem unserer Zielmärkte?
Passt der CPV-Umfang zu unseren Leistungen?
Ist der Vertrag groß genug, um den Aufwand zu rechtfertigen?
Erfüllen wir die Umsatzanforderungen?
Haben wir die erforderlichen Zertifizierungen?
Haben wir genügend vergleichbare Erfahrung?
```

Einige dieser Fragen beschreiben Attraktivität.

Andere beschreiben Eignung.

Sie zu früh zusammenzufassen zerstört nützliche Information.

TenderWise trennt deshalb vier Stufen:

```text
Discovery
    |
    v
Relevanz
    |
    v
Qualifikation
    |
    v
Bid-Ausführung
```

Jede hat eine andere Aufgabe.

## Discovery entscheidet, ob die Opportunity in den Feed gehört

Vor dem Scoring kann ein Unternehmensprofil harte Filter definieren wie:

- Zielländer,
- ausgeschlossene Länder,
- Ziel-CPV-Familien,
- ausgeschlossene CPVs,
- bevorzugte Vertragswerte,
- und bevorzugte Währung.

Die Matching-Semantik ist bewusst explizit.

Innerhalb einer Dimension können Alternativen matchen.

Über Dimensionen hinweg müssen konfigurierte Anforderungen bestehen bleiben.

Ausschlüsse haben Vorrang vor Einschlüssen.

Das Ziel ist noch nicht, einen nuancierten Score zu vergeben.

Es geht um die Frage:

> Soll diese Opportunity in den Entscheidungsprozess gelangen?

## Relevanz fragt, ob die Opportunity strategisch attraktiv ist

Sobald eine Opportunity die Discovery übersteht, berechnet TenderWise einen Relevanzscore.

Dimensionen können umfassen:

- CPV-Ausrichtung,
- Geografie,
- Vertragswert,
- Service-Ausrichtung,
- und Branchen-Ausrichtung.

Typische Gewichte im aktuellen Design sind:

```text
CPV               35
Geografie         20
Vertragswert      15
Services          20
Branchen          10
```

Nur konfigurierte Dimensionen nehmen teil.

Das ist wichtig.

Wenn ein Unternehmen nie Zielbranchen konfiguriert hat, sollte deren Fehlen nicht den Relevanzscore jedes Tenders künstlich reduzieren.

Konzeptionell:

$$
Relevance =
\frac{\sum w_i s_i}{\sum w_i}
$$

wobei der Nenner nur aktive Dimensionen enthält.

Die Ausgabe behält außerdem:

- Stärken,
- Warnungen,
- Blocker,
- Score-Aufschlüsselung,
- und Evidenzabdeckung.

Eine Zahl ohne diesen Kontext reicht nicht aus.

## Qualifikation stellt eine andere Frage

Qualifikation beginnt bei verpflichtenden Tender-Anforderungen.

Beispiele sind:

- Mindestjahresumsatz,
- Zertifizierungen,
- Mindestteamgröße,
- und Erfahrung mit vergleichbaren Verträgen.

Jede Anforderung kann einen Zustand wie diesen erzeugen:

```text
PASS
FAIL
UNKNOWN
NOT_APPLICABLE
```

Der wichtigste Zustand ist oft `UNKNOWN`.

Angenommen, ein Tender verlangt ISO 9001.

Das Unternehmensprofil listet ISO 9001 nicht auf.

Das könnte bedeuten:

```text
das Unternehmen hat sie nicht
```

oder:

```text
das Profil ist unvollständig
```

Das ist nicht dasselbe.

TenderWise weigert sich deshalb, fehlende Evidenz stillschweigend in einen Fehler umzuwandeln.

## Warum UNKNOWN wichtig ist

Für verpflichtende Anforderungen sieht eine vereinfachte Scoring-Abbildung so aus:

```text
PASS       -> 100
UNKNOWN    -> 50
FAIL       -> 0
```

Der genaue numerische Beitrag ist weniger wichtig als die semantische Unterscheidung.

Ein unbekanntes Pflichtkriterium bedeutet häufig:

```text
REVIEW
```

und nicht:

```text
NO_BID
```

Dadurch behauptet die Software keine Sicherheit, die durch die Evidenz nicht gedeckt ist.

## Vier Tender als Beispiel

In einer Matrix wird die Trennung klarer.

### Tender A

```text
Relevanz:       92
Qualifikation:  95
```

Die Opportunity passt zum Markt des Unternehmens und die bekannten Pflichtkriterien sind erfüllt.

Eine `BID`-Empfehlung ist plausibel.

### Tender B

```text
Relevanz:       91
Qualifikation:  20
```

Kommerziell hervorragend.

Aber eine verpflichtende Anforderung schlägt fehl.

Das sollte nicht allein wegen hoher Relevanz zu einem hohen kombinierten Score werden.

Die wahrscheinliche Antwort ist `NO_BID`.

### Tender C

```text
Relevanz:       45
Qualifikation:  98
```

Das Unternehmen kann die Arbeit ausführen.

Sie ist nur strategisch nicht besonders attraktiv.

Das ist ein anderer Grund, nicht zu bieten.

### Tender D

```text
Relevanz:       82
Qualifikation:  65
Pflichtevidenz: UNKNOWN
```

Genau hier ist `REVIEW` wertvoll.

Das System hat genug Evidenz, um zu sagen, dass der Tender vielversprechend aussieht, aber nicht genug, um die Entscheidung automatisch zu treffen.

## Die Empfehlung bleibt deterministisch

TenderWise kombiniert beide Achsen schließlich zu einer Empfehlung.

Eine vereinfachte Version enthält Regeln wie:

```text
Deadline geschlossen             -> NO_BID
harter Relevanz-Blocker          -> NO_BID
Pflicht-Qualifikation fehlgeschlagen -> NO_BID
sehr geringe Relevanz            -> NO_BID
sehr geringe Qualifikation       -> NO_BID
unbekannte Pflichtevidenz        -> REVIEW
hohe Relevanz + Bereitschaft     -> BID
sonst                            -> REVIEW
```

Das ist bewusst verständlich.

Vergabeentscheidungen können Tage teurer menschlicher Arbeit verbrauchen.

Ein falsches automatisches `BID` verschwendet Ressourcen.

Ein falsches automatisches `NO_BID` kann Umsatzchancen verbergen.

Wenn wesentliche Unsicherheit bleibt, ist Review eine Funktion und kein Fehler.

## Warum ich die Entscheidung nicht der KI überlasse

TenderWise kann optional einen KI-Tender-Brief erzeugen.

Der Brief kann erklären:

- Zusammenfassung,
- Schlüsselpunkte,
- Risiken,
- Unbekanntes,
- nächste Schritte,
- und Qualifikationsanforderungen.

Er darf jedoch Folgendes nicht verändern:

```text
relevance
qualification
requirement status
BID / REVIEW / NO_BID
```

Die KI-Schicht erhält das deterministische Ergebnis als Kontext.

Sie erklärt die Entscheidungsumgebung.

Sie wird nicht zur Entscheidungsinstanz.

Diese Grenze ist in der Vergabe besonders wichtig, weil Quellbelege nachvollziehbar bleiben müssen.

## Trennung verbessert das Debugging

Angenommen, ein Benutzer sagt:

> Dieser Tender hätte höher gerankt werden sollen.

Mit einem einzigen undurchsichtigen Score müsste ich rekonstruieren, was passiert ist.

Mit getrennten Schichten kann ich fragen:

```text
Wurde er während Discovery gefiltert?
War die CPV-Relevanz niedrig?
War der Vertragswert unbekannt?
Ist eine Pflichtanforderung fehlgeschlagen?
Fehlte Evidenz?
```

Jede Schicht hat eine interpretierbare Verantwortung.

Das erleichtert die Fehlersuche und die Diskussion von Empfehlungen mit Benutzern.

## Trennung verbessert auch die Produktiteration

Stellen wir uns vor, Benutzer sagen mir, Geografie solle weniger und Service-Ausrichtung mehr zählen.

Das verändert die Relevanz.

Es verändert nicht, wie Anforderungen an den Jahresumsatz bewertet werden sollten.

Ebenso sollte besseres Parsing von Zertifizierungen die Qualifikation beeinflussen, ohne strategische Marktpräferenzen zu verändern.

Unabhängige Konzepte können unabhängig weiterentwickelt werden.

Das ist eine starke Eigenschaft in einem Produkt, das noch von echten Benutzern lernt.

## Das allgemeinere Designprinzip

Die Trennung von Relevanz und Qualifikation ist nicht TenderWise-spezifisch.

Sie steht für eine allgemeine Regel von Entscheidungssystemen:

> Trenne „Will ich das?“ von „Kann ich das?“

Recruiting-Systeme könnten Kandidateninteresse und Eignung trennen.

Kreditsysteme könnten Kundenwert und Underwriting-Beschränkungen trennen.

Projektselektion könnte strategischen Wert und Ausführbarkeit trennen.

Unterschiedliche Fragen verdienen unterschiedliche Zustände.

TenderWise ist gerade deshalb leichter zu erklären, weil es nicht alles in eine einzige magische Zahl zwingt.

Die endgültige Empfehlung ist nützlich, weil die darunterliegende Begründung sichtbar bleibt.
