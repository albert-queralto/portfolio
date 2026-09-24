---
title: "Experiments de NLP amb Transformers"
description: "Experiments de fine-tuning per a classificació multilingüe de sentiment i traducció seqüència-a-seqüència amb models Transformer."
lang: ca
translationKey: transformer-nlp
order: 7
featured: false
draft: false
status: "Completed"
category: "Machine Learning"
focus: "NLP · Transfer learning"
image: "/transformers_sentiment_text.png"
source: "https://github.com/albert-queralto/transformers_sentiment_classification_translation"
technologies:
  - Python
  - Transformers
  - BERT
  - PyTorch
  - NLP
metrics:
  - label: "Tasques"
    value: "Classificació + traducció"
  - label: "Mètode"
    value: "Fine-tuning de Transformers"
  - label: "Framework"
    value: "PyTorch"
---

## Problema

Entrenar models de llenguatge moderns des de zero requereix quantitats importants de dades i recursos de càlcul. El transfer learning permet adaptar models Transformer preentrenats a tasques pràctiques amb conjunts de dades específics molt més petits.

Aquest projecte explora dos problemes diferents de processament del llenguatge natural: classificació de sentiment i traducció seqüència-a-seqüència. L'objectiu és entendre el flux complet de fine-tuning i les diferències entre tasques de classificació i de generació.

## Restriccions

Les dades textuals requereixen una tokenització, truncament, padding i preparació d'etiquetes acurats. La longitud màxima de seqüència afecta tant la qualitat del model com l'ús de memòria, mentre que el desequilibri de classes pot fer que l'accuracy global sigui enganyosa.

La traducció afegeix decodificació autoregressiva, paràmetres de generació i avaluació a nivell de seqüència. Els recursos de càlcul disponibles limiten la mida del batch, la durada de l'entrenament i el nombre d'experiments d'hiperparàmetres.

Els checkpoints preentrenats també hereten limitacions i biaixos de les dades amb què es van entrenar originalment.

## Enfocament

El projecte utilitza checkpoints de Transformers mitjançant l'ecosistema de Hugging Face i PyTorch. Per a classificació de sentiment, s'adapta un encoder preentrenat amb un capçal de classificació i es fa fine-tuning amb exemples etiquetats.

Per a traducció, es prepara un Transformer seqüència-a-seqüència amb tokenització d'origen i destí i s'entrena per generar seqüències en l'idioma objectiu.

El flux cobreix preparació del dataset, tokenització, batching, entrenament del model, inferència i comparació de les prediccions amb les sortides esperades.

## Validació

L'avaluació de classificació considera prediccions sobre dades retingudes, comportament per classe i una matriu de confusió en lloc de dependre només de l'accuracy agregada.

La qualitat de la traducció s'inspecciona amb exemples generats i es pot resumir amb mètriques a nivell de seqüència. La revisió manual continua sent important perquè les mètriques automàtiques no capturen completament el significat, la fluïdesa ni les traduccions alternatives acceptables.

Es monitoritzen les pèrdues d'entrenament i validació per detectar underfitting o overfitting durant el fine-tuning.

## Decisions d'enginyeria

L'ús de models preentrenats redueix el cost d'entrenament i fa que els experiments siguin reproduïbles a partir de checkpoints identificables. La tokenització i la configuració del model es mantenen alineades amb cada checkpoint per evitar entrades incompatibles.

PyTorch exposa el comportament de l'entrenament, mentre que la llibreria Transformers proporciona implementacions fiables de models i tokenitzadors. El projecte manté conceptualment separats els fluxos de classificació i traducció perquè els seus objectius i patrons d'inferència són diferents.

Els artefactes de model desats permeten executar inferència sense haver de tornar a entrenar des del principi.

## Compromisos

El projecte prioritza l'aprenentatge i la comparació per sobre d'un benchmark exhaustiu. No executa una cerca gran d'hiperparàmetres ni compara totes les arquitectures multilingües rellevants.

L'avaluació automàtica està limitada per la mida del dataset i l'elecció de mètriques. Aspectes de desplegament en producció com batching de peticions, quantització, objectius de latència, moderació de contingut i monitoratge continu queden fora de l'abast inicial.

## Següents passos

Experiments futurs podrien comparar checkpoints multilingües, fine-tuning eficient en paràmetres, funcions objectiu ponderades per classe, calibratge de probabilitats de sentiment i mètriques de traducció més robustes.

Una extensió orientada a desplegament podria exposar els models mitjançant FastAPI, afegir inferència per lots, containeritzar el servei, registrar metadades d'experiments i monitorar la distribució d'idioma d'entrada i de confiança.
