# Project AI Rules

## Lingua e Stile
- Scrivi tutto il codice in inglese (variabili, funzioni, commenti inline)
- Usa nomi descrittivi, mai abbreviazioni oscure (es. `user_session_token` non `ust`)
- Preferisci la leggibilità all'ottimizzazione prematura

## Struttura del Codice
- Separa sempre la logica interna (cartella `_internal/` o `core/`) dall'API pubblica
- Ogni modulo deve avere una responsabilità singola (Single Responsibility Principle)
- Evita funzioni più lunghe di 30 righe; se superi, suggerisci di spezzarla
- Mai usare variabili globali mutabili
- Usa type hints su ogni firma di funzione (Python) o TypeScript strict mode

## Docstring e Documentazione
- Ogni funzione pubblica deve avere docstring con: descrizione, parametri, return, esempio
- Formato docstring: Google style (Python) o JSDoc (JS/TS)
- I commenti inline spiegano il "perché", non il "cosa"

## Testing
- Per ogni funzione nuova, genera SEMPRE il relativo unit test
- Testa i casi negativi (input invalidi, eccezioni, edge cases) PRIMA dei casi positivi
- I test devono essere indipendenti, non dipendere dall'ordine di esecuzione
- Usa pytest (Python) / Jest (JS) / il framework già presente nel progetto
- Se modifichi una funzione esistente, aggiorna il test corrispondente

## Sicurezza
- Non includere MAI segreti, API key, password nel codice — usa sempre variabili d'ambiente
- Valida e sanitizza sempre l'input dell'utente prima di usarlo
- Usa query parametrizzate per qualsiasi interazione con database
- Segnala esplicitamente se una soluzione proposta ha implicazioni di sicurezza

## Gestione degli Errori
- Ogni funzione che può fallire deve gestire l'errore esplicitamente (try/except o Result type)
- Mai usare `except Exception: pass` — logga sempre l'errore con messaggio descrittivo
- Le eccezioni custom devono avere un nome descrittivo del problema

## Git e Commit
- Suggerisci messaggi di commit in formato Conventional Commits:
  `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `security:`, `chore:`
- Un commit = una modifica logica atomica

## Cosa NON fare
- Non usare dipendenze esterne se la stdlib risolve il problema
- Non generare codice che bypassa la pipeline CI (es. `--no-verify`)
- Non proporre soluzioni che richiedono privilegi root/admin senza avvisare
- Non generare mock di test che non testano nulla di reale
