# Routing Audio Trainer

Webapp statica per allenare tecnici audio a distinguere correttamente ingressi e uscite nel routing base.

## Cosa fa

- genera setup casuali con:
  - da 1 a 4 microfoni
  - 1 mixer fisso con 4 ingressi e 2 uscite
  - da 1 a 4 speaker
- permette di creare cavi cliccando `OUT -> IN`
- valida il cablaggio corretto
- colora i cavi in verde quando tutto il routing e corretto
- propone un nuovo setup casuale a fine esercizio

## Regole del trainer

- ogni microfono deve entrare in un ingresso distinto del mixer
- il mixer alimenta gli speaker dalle sue 2 uscite
- se gli speaker sono piu di 2, si usa la catena `speaker OUT -> speaker IN`

## Avvio rapido

Puoi aprire direttamente [index.html](/Users/giovannimazzanti/Desktop/Giova/Routing_app/index.html) nel browser.

Se preferisci un server locale:

```bash
python3 -m http.server 8000
```

Poi apri `http://localhost:8000`.
