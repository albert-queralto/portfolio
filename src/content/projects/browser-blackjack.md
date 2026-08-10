---
title: "Browser Blackjack"
description: "A responsive browser implementation of Blackjack with game-state management and a compact interactive interface."
order: 9
featured: false
draft: false
status: "Deployed"
category: "Web"
focus: "Frontend application"
image: "/blackjack.png"
source: "https://github.com/albert-queralto/js_blackjack"
preview: "https://js-blackjack.vercel.app/"
technologies:
  - JavaScript
  - HTML
  - CSS
  - Vercel
metrics:
  - label: "Application type"
    value: "Browser game"
  - label: "Core challenge"
    value: "Game-state management"
  - label: "Deployment"
    value: "Vercel"
---

## Problem

Blackjack has a compact rule set but enough state transitions to make it a useful frontend-engineering exercise. A browser implementation needs to manage the deck, player and dealer hands, scores, turn order, terminal states, and user controls without allowing contradictory actions.

The project was built as a focused interactive application that demonstrates JavaScript state management and responsive interface design without relying on a large framework.

## Constraints

Ace values can change depending on the rest of a hand, so score calculation cannot treat every card as having a fixed value. Dealer behavior must follow deterministic rules, while player actions must be disabled at the correct points in the round.

The interface needs to remain understandable on smaller screens and give immediate feedback when a round ends. All logic runs in the browser, so application state resets when the page is refreshed.

The game is a simplified demonstration and does not include betting with real money or online multiplayer behavior.

## Approach

The application models a deck of cards, shuffling, dealing, hand scoring, player actions, dealer actions, and round outcomes in JavaScript.

UI controls trigger explicit state transitions such as starting a round, requesting another card, or standing. The rendered card and score displays are updated from the current state rather than maintained as unrelated visual values.

HTML provides the semantic structure and CSS creates the responsive presentation and game layout.

## Validation

The game can be checked with representative hands including natural Blackjack, busts, dealer draws, ties, and hands containing one or more aces.

Manual interaction testing verifies that unavailable actions are disabled, scores update after every draw, the dealer stops according to the selected rule, and a new round resets all necessary state.

The deployed Vercel version provides an integration check across production asset paths and browser environments.

## Engineering decisions

The project uses plain JavaScript to keep the state transitions and DOM updates visible. This avoids framework overhead and makes the application suitable for demonstrating core browser APIs.

Game logic and interface updates should remain separated where possible so scoring behavior can be tested independently from presentation code.

Static hosting on Vercel is sufficient because the game does not need a server or persistent database.

## Tradeoffs

The application favors a compact single-player experience over a complete casino simulation. It does not include accounts, saved statistics, multiple players, configurable house rules, or a backend.

Manual DOM management is appropriate at this size, but a larger game with multiple screens and persistent state might benefit from a component framework and formal state machine.

## Next steps

Potential improvements include automated unit tests for hand scoring and dealer logic, keyboard controls, richer accessibility announcements, animations, persistent player statistics, and configurable rules.

A more ambitious version could use a finite-state machine to make transitions explicit, add a computer-strategy explanation mode, and provide a multiplayer backend using WebSockets.
