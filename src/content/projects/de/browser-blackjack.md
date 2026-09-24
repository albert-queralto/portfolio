---
title: "Blackjack im Browser"
description: "Eine responsive Blackjack-Implementierung im Browser mit Spielzustandsverwaltung und kompakter interaktiver Oberfläche."
lang: de
translationKey: browser-blackjack
order: 9
featured: false
draft: false
status: "Deployed"
category: "Web"
focus: "Frontend-Anwendung"
image: "/blackjack.png"
source: "https://github.com/albert-queralto/js_blackjack"
preview: "https://js-blackjack.vercel.app/"
technologies:
  - JavaScript
  - HTML
  - CSS
  - Vercel
metrics:
  - label: "Anwendungstyp"
    value: "Browserspiel"
  - label: "Kernherausforderung"
    value: "Spielzustandsverwaltung"
  - label: "Deployment"
    value: "Vercel"
---

## Problem

Blackjack hat ein kompaktes Regelwerk, aber genügend Zustandsübergänge, um ein nützliches Frontend-Engineering-Projekt zu sein. Eine Browserimplementierung muss Kartenstapel, Spieler- und Dealerhände, Punktestände, Zugreihenfolge, Endzustände und Benutzersteuerung verwalten, ohne widersprüchliche Aktionen zuzulassen.

Das Projekt wurde als fokussierte interaktive Anwendung entwickelt, die JavaScript-Zustandsverwaltung und responsives Interface-Design ohne großes Framework demonstriert.

## Einschränkungen

Der Wert eines Asses kann sich abhängig von den übrigen Karten einer Hand ändern. Die Punkteberechnung kann daher nicht jede Karte als festen Wert behandeln. Das Verhalten des Dealers muss deterministischen Regeln folgen, während Spieleraktionen an den richtigen Stellen einer Runde deaktiviert werden müssen.

Die Oberfläche muss auch auf kleineren Bildschirmen verständlich bleiben und sofort Rückmeldung geben, wenn eine Runde endet. Die gesamte Logik läuft im Browser, daher wird der Anwendungszustand beim Neuladen der Seite zurückgesetzt.

Das Spiel ist eine vereinfachte Demonstration und umfasst weder Echtgeldwetten noch Online-Mehrspielerfunktionen.

## Ansatz

Die Anwendung modelliert Kartenstapel, Mischen, Austeilen, Handbewertung, Spieleraktionen, Dealeraktionen und Rundenergebnisse in JavaScript.

UI-Steuerelemente lösen explizite Zustandsübergänge aus, etwa das Starten einer Runde, das Ziehen einer weiteren Karte oder das Stehenbleiben. Angezeigte Karten und Punktestände werden aus dem aktuellen Zustand aktualisiert, statt als unabhängige visuelle Werte gepflegt zu werden.

HTML liefert die semantische Struktur, CSS die responsive Darstellung und das Spiellayout.

## Validierung

Das Spiel lässt sich mit repräsentativen Händen prüfen, darunter natürlicher Blackjack, Busts, Dealer-Züge, Unentschieden sowie Hände mit einem oder mehreren Assen.

Manuelle Interaktionstests prüfen, dass nicht verfügbare Aktionen deaktiviert sind, Punktestände nach jedem Ziehen aktualisiert werden, der Dealer gemäß der gewählten Regel stoppt und eine neue Runde den erforderlichen Zustand vollständig zurücksetzt.

Die bereitgestellte Vercel-Version dient als Integrationstest für Produktions-Asset-Pfade und unterschiedliche Browserumgebungen.

## Engineering-Entscheidungen

Das Projekt verwendet reines JavaScript, damit Zustandsübergänge und DOM-Aktualisierungen sichtbar bleiben. Dadurch entfällt Framework-Overhead und die Anwendung eignet sich gut, um grundlegende Browser-APIs zu demonstrieren.

Spiellogik und Oberflächenaktualisierungen sollten möglichst getrennt bleiben, damit die Punkteberechnung unabhängig vom Darstellungscode getestet werden kann.

Statisches Hosting auf Vercel reicht aus, da das Spiel weder einen Server noch eine persistente Datenbank benötigt.

## Abwägungen

Die Anwendung bevorzugt ein kompaktes Einzelspieler-Erlebnis gegenüber einer vollständigen Casino-Simulation. Konten, gespeicherte Statistiken, mehrere Spieler, konfigurierbare Hausregeln und ein Backend sind nicht enthalten.

Manuelle DOM-Verwaltung ist in dieser Größenordnung angemessen. Ein größeres Spiel mit mehreren Ansichten und persistentem Zustand könnte jedoch von einem Komponenten-Framework und einer formalen Zustandsmaschine profitieren.

## Nächste Schritte

Mögliche Verbesserungen sind automatisierte Unit-Tests für Handbewertung und Dealerlogik, Tastatursteuerung, bessere Accessibility-Ankündigungen, Animationen, persistente Spielerstatistiken und konfigurierbare Regeln.

Eine ambitioniertere Version könnte eine endliche Zustandsmaschine für explizite Übergänge einsetzen, einen Erklärmodus für Computerstrategie ergänzen und ein Mehrspieler-Backend mit WebSockets bereitstellen.
