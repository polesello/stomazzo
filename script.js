let wakeLockObj = null
let voiceEnabled = false
let nfcEnabled = false
let cameraEnabled = false

function noStandby() {
    if ("wakeLock" in navigator && wakeLockObj === null) {
        navigator.wakeLock.request("screen").then(function(wakeLock) {
            wakeLockObj = wakeLock
            document.getElementById('lockEnabled').style.display = 'block'
        }).catch(function(err) {
        })
    }
}

// Evita clic destro
document.addEventListener('contextmenu', function(event) {
    event.preventDefault()
})

/*
 * Gestione della torcia
 * Basato su:
 * https://stackoverflow.com/questions/37848494/is-it-possible-to-control-the-camera-light-on-a-phone-via-a-website
 */

class flashlightHandler {

    static track; //the video track which is used to turn on/off the flashlight

    static accessFlashlight() {
        //Test browser support
        if (!('mediaDevices' in window.navigator)) {
            alert("Accesso alla fotocamera non disponibile");
            return;
        };

        //Get the environment camera (usually the second one)
        window.navigator.mediaDevices.enumerateDevices().then((devices) => {

            const cameras = devices.filter((device) => device.kind === 'videoinput');
            if (cameras.length === 0) {
                alert("Nessuna fotocamera disponibile");
                return;
            };
            
            const camera = cameras[cameras.length - 1];
            
            window.navigator.mediaDevices.getUserMedia({
                video: {
                    deviceId: camera.deviceId
                }
            }).then((stream) => {
                this.track = stream.getVideoTracks()[0]
                
                if (!(this.track.getCapabilities().torch)) {
                    alert("Torcia non disponibile")
                    document.querySelector('[data-mode="flash"]').style.display = 'none'
                    document.getElementById('frase-foto').value = 'Torcia non disponibile'
                    document.getElementById('frase-foto').disabled = true
                } else {
                    document.getElementById('flashEnabled').style.display = 'block'
                    flashEnabled = true
                }
            });
        });
    }

    static setFlashlightStatus(status) {
        try {
            this.track.applyConstraints({
                advanced: [{
                    torch: status
                }]
            });
        } catch (error) {
            throw (error)
            console.info("Torch not available");
        }

    }

    static async getVideoStream() {
        return await window.navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: 'environment'
            }
        })
    }
}




const video = document.getElementById('video')
const canvas = document.getElementById('canvas')

const cards = document.querySelectorAll('.card')
const cartaScelta = document.querySelector('#scelta .flip-card .card')
const mazzo = document.getElementById('mazzo')
let mode = 'picche'
let isFaceDown = false

// iWillChange è un timeout che fa partire la funzione magica dopo 10 secondi
// magicFunction è la funzione magica da eseguire
let iWillChange = null
let magicFunction = null

// legge il parametro card dalla query string
const urlParams = new URLSearchParams(window.location.search)
const cardIdNFC = urlParams.get('card')
const widthOtherPhone = urlParams.get('width') // larghezza dello schermo dell'altro telefono, quello del mago

// faccio accedere al menu delle impostazioni facendo scorrere il dito sopra le carte con il numero 7, da destra a sinistra, cioè partendo dal sette di picche per finire al sette di cuori
// cioè touchstart sul sette di picche e touchend sul sette di cuori
let gotoHomeStarted = false
mazzo.addEventListener('touchstart', function(event) {
    if (event.target.src?.includes('7S')) {
        gotoHomeStarted = true
    } else {
        gotoHomeStarted = false
    }
})

// https://stackoverflow.com/questions/12596121/get-the-element-under-a-touchend
mazzo.addEventListener('touchend', function(event) {
    const element = document.elementFromPoint(event.changedTouches[0].pageX, event.changedTouches[0].pageY)
    if (element.src?.includes('7H') && gotoHomeStarted) {
        gotoHomeStarted = false
        // Mostra il menu delle impostazioni
        document.getElementById('homepage').classList.add('active')
        document.getElementById('mazzo').classList.remove('active')
    } else {
        gotoHomeStarted = false
    }
})


if (!cardIdNFC) {
    cards.forEach(function(card) {
        card.addEventListener('click', function() {
            cartaScelta.src = card.src
            cartaScelta.alt = card.alt
            cartaScelta.dataset.cardid = card.dataset.cardid
            document.getElementById('mazzo').classList.remove('active')
            document.getElementById('scelta').classList.add('active')

            switch (mode) {
                case 'picche':
                    // Mette il due di picche 10 secondi dopo che il telefono è a faccia in giù
                    magicFunction = changeCard

                    break;
                case 'vibrate':
                    magicFunction = vibrateCard

                    break;
                case 'flash':
                    magicFunction = flashCard
                    break;
                case 'voice':
                    magicFunction = sayCard
                    break;
                case 'nfc':
                    magicFunction = writeNFCCard
                    break;
                default:
                    break;
            }


        })
    })
} else {
    document.querySelectorAll('.group').forEach(function(group) {
        group.addEventListener('touchmove', function(event) {
            document.querySelector('.card.missing')?.classList.remove('missing')

            // Ascolta il click per mostrare l'effetto finale
            mazzo.addEventListener('touchstart', titoliDiCoda)
        })
    })
}

document.getElementById('annulla-scelta').addEventListener('click', function() {
    scelta.classList.remove('active')
    mazzo.classList.add('active')
})






async function flashCard() {
    // take a still picture from the camera
    // and flash the flashlight

    const frase = localStorage['frase-foto']
    const msg = new SpeechSynthesisUtterance(frase)
    window.speechSynthesis.speak(msg)

    // 7 secondi di pausa per dare il tempo di leggere la frase
    await sleep(7000)

    await flashlightHandler.accessFlashlight()

    // Ridimensiona la photo grande come la carta scelta

    document.querySelector('.back-card').setAttribute('hidden', 'hidden')
    document.querySelector('.photo').removeAttribute('hidden')
    const photo = document.querySelector('#scelta .photo')


    const stream = await flashlightHandler.getVideoStream()
    
    video.srcObject = stream

    // attendi che il video sia pronto
    await new Promise(resolve => video.onloadedmetadata = resolve)

    setTimeout(() => {
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        canvas.getContext('2d').drawImage(video, 0, 0)
        photo.src = canvas.toDataURL('image/png')
    }, 2000)

  
    // Gira la carta in modo che il giocatore possa vedere la foto
    document.querySelector('.flip-card-inner').classList.add('backside')

    // esegui il pattern Morse con il flash
    const cardId = document.querySelector('#scelta .card').dataset.cardid
    const pattern = getMorsePattern(cardId)

    for (const [index, value] of pattern.entries()) {
        flashlightHandler.setFlashlightStatus(index % 2 == 0)
        await sleep(value)
    }
    flashlightHandler.setFlashlightStatus(false)

    // spegni la telecamera (non va)
    stream.getVideoTracks().forEach(function(track) {
        track.stop();
    });

}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function sayCard() {
    // faccio dire non il nome della carta scelta, ma una carta diversa
    // tolgo 7 al numero della carta
    // e vado di un seme indietro, secondo l'ordine degli semi Cuori Quadri Fiori Picche
    // Il mago dovrà quindi calcolare la carta scelta veramente dal giocatore
    // aggiungendo 7 e andando di un seme avanti
    const cardId = document.querySelector('#scelta .card').dataset.cardid

    const SUITS = ['H', 'D', 'C', 'S']
    const number = parseInt(cardId)
    const suit = cardId.slice(-1)
    const newNumber = number > 7 ? number - 7 : number + 6
    const newSuit = SUITS[(SUITS.indexOf(suit) + 3) % 4]
    const newCard = document.querySelector('img[src="cards/' + newNumber + newSuit + '.svg"]')

    const frase = localStorage['frase-scelta']
    const msg = new SpeechSynthesisUtterance(frase + ' ' + newCard.getAttribute('alt'))
    window.speechSynthesis.speak(msg)
}


function vibrateCard() {
    const cardId = document.querySelector('#scelta .card').dataset.cardid
    const pattern = getMorsePattern(cardId)
    navigator.vibrate(pattern)
}

function changeCard() {
    // Cambia la carta scelta con il 2 di picche
    document.querySelector('#scelta .card').setAttribute('src', 'cards/2S.svg')
}




async function writeNFCCard() {
    
    try {
        const ndef = new NDEFReader()
        const cardId = document.querySelector('#scelta .card').dataset.cardid
        const url = location.origin + location.pathname + '?card=' + cardId + '&width=' + window.innerWidth
        await ndef.write(
            {records: [{ recordType: "url", data: url }]
        })
    } catch (error) {
        alert("Error: " + error)
    }
}

document.querySelector('.flip-card-inner').addEventListener('click', function() {
    this.classList.toggle('backside')
})

/*
 * Scelta della modalità di gioco
 */

document.querySelectorAll('div[data-mode]').forEach(function(element) {
    element.addEventListener('click', function(event) {
        document.querySelector('div[data-mode].active').classList.remove('active')
        element.classList.add('active')
        mode = element.dataset.mode

        // attivo ora il weblock per evitare che lo schermo si spenga
        // messo qui perché in iOS non funziona se non è attivato da un evento utente
        noStandby()


        // iOS richiede un clic esplicito anche per far partire la voce
        // quindi saluto con una voce a volume 0
        if (!voiceEnabled) {
            const hello = new SpeechSynthesisUtterance('Ciao')
            hello.volume = 0
            window.speechSynthesis.speak(hello)
            voiceEnabled = true
            document.getElementById('voiceEnabled').style.display = 'block'
        }

        if (mode == 'nfc') {
            if (!nfcEnabled) {
                checkNfcPermission()
            }
            localStorage.setItem('nfc-mode', 'true')
        } else {
            localStorage.removeItem('nfc-mode')
        }


        if (mode == 'flash') {
            if (!cameraEnabled) {
                checkCameraPermission()
            }
        }

  

        // Chiede il permesso per i sensori di orientamento in iOS
        if (needPermission && !permissionGranted) {
            getPermission()
        }

        // Salva tutte le frasi in localStorage
        localStorage['frase-scelta'] = document.getElementById('frase-scelta').value || document.getElementById('frase-scelta').placeholder
        localStorage['frase-foto'] = document.getElementById('frase-foto').value || document.getElementById('frase-foto').placeholder
        localStorage['frase-joker'] = document.getElementById('frase-joker').value || document.getElementById('frase-joker').placeholder

        document.getElementById('homepage').classList.remove('active')
        document.getElementById('mazzo').classList.add('active')
    })
})

/*
 * Inizializzazione
 */


if (cardIdNFC) {
    const card = document.querySelector('.card[data-cardid="' + cardIdNFC + '"]')
    if (card) {

        // Sono nel telefono che ha fatto partire il gioco
        if (localStorage.getItem('nfc-mode')) {
            document.getElementById('mazzo').classList.add('active')
            card.classList.add('missing')
            
            const frase = localStorage['frase-joker']

            const msg = new SpeechSynthesisUtterance(frase)
            window.speechSynthesis.speak(msg)

            
        } else {
            // sono nel telefono del giocatore che ha letto il tag NFC
            cartaScelta.src = card.src
            document.getElementById('scelta').classList.add('active', 'standalone')

            // fa' in modo che la carta si possa draggare con il dito
            // e lanciare fuori dallo schermo
            let x0 = 0
            let y0 = 0
            let x1 = 0
            let y1 = 0
            cartaScelta.addEventListener('touchstart', function(event) {
                x0 = event.touches[0].clientX
                y0 = event.touches[0].clientY
            })
            cartaScelta.addEventListener('touchmove', function(event) {
                x1 = event.touches[0].clientX
                y1 = event.touches[0].clientY
                
                cartaScelta.style.transform = 'translate(' + (x1 - x0) + 'px, ' + (y1 - y0) + 'px)'

            })

            cartaScelta.addEventListener('touchend', function(event) {
                // sposta la carta con top e left anziché con translate
                // per evitare che se facio più di un drag la carta si sposti
                cartaScelta.style.top = cartaScelta.offsetTop + (y1 - y0) + 'px'
                cartaScelta.style.left = cartaScelta.offsetLeft + (x1 - x0) + 'px'
                cartaScelta.style.transform = 'none'

                // Se la carta è stata trascinata verso destra di almeno 100px
                // faccio partire la transizione che la fa uscire verso destra
                if (x1 - x0 > 100) {
                    cartaScelta.classList.add('rientra')

                    // Al clic in qualunque punto dello schermo faccio partire l'effetto finale
                    // che fa comparire tutte le carte e impostando come telefono di sinistra
                    document.getElementById('scelta').addEventListener('touchstart', titoliDiCoda)
                    mazzo.classList.add('left')
                }
             })

        }

    }
} else {
    // Riempio i campi con le frasi salvate nel localStorage
    document.getElementById('frase-scelta').value = localStorage['frase-scelta'] || document.getElementById('frase-scelta').placeholder
    document.getElementById('frase-foto').value = localStorage['frase-foto'] || document.getElementById('frase-foto').placeholder
    document.getElementById('frase-joker').value = localStorage['frase-joker'] || document.getElementById('frase-joker').placeholder

    // Nascondi modalità non supportate
    if (!('NDEFReader' in window)) {
        document.querySelector('div[data-mode="nfc"]').style.display = 'none'
        document.getElementById('frase-joker').value = 'NFC non supportato'
        document.getElementById('frase-joker').disabled = true
    }

    // Evita di mostrare la modalità vibrazione se non è supportata
    // o anche se è supportata ma non è uno smartphone (verifico la larghezza dello schermo)

    if (!('vibrate' in navigator) || screen.width > 700) {
        document.querySelector('div[data-mode="vibrate"]').style.display = 'none'
    }

    // Prima del 2 aprile 2024, lascia solo la modalità 2 di picche
    if (new Date() < new Date('2024-04-02')) {
        document.querySelector('div[data-mode="voice"]').style.display = 'none'
        document.querySelector('div[data-mode="vibrate"]').style.display = 'none'
        document.querySelector('div[data-mode="flash"]').style.display = 'none'
        document.querySelector('div[data-mode="nfc"]').style.display = 'none'
        document.querySelector('.settings').style.display = 'none'
        document.getElementById('istruzioni').style.display = 'none'
    }
    document.getElementById('homepage').classList.add('active')
}

// Gestione faceDown
// in iOS va richiesto il permesso
let permissionGranted = false

function getPermission () {
    if (!permissionGranted) {
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response == "granted") {
                    permissionGranted = true
                    document.getElementById('orientationEnabled').style.display = 'block'
                    window.addEventListener('deviceorientation', checkUpsideDown)
                }
        })
    }
}

let needPermission = false
if (typeof(DeviceOrientationEvent) !== "undefined" && typeof(DeviceOrientationEvent.requestPermission) === "function") {
    // iPhone
    needPermission = true
} else {
    // Android
    window.addEventListener('deviceorientation', checkUpsideDown)
    document.getElementById('orientationEnabled').style.display = 'block'
}


function checkUpsideDown(event) {
    // Il telefono viene messo a faccia in giù
    // dopo 10 secondi la carta cambia

    if (magicFunction) {
        // facedown è un booleano che indica se il telefono è a faccia in giù
        // calcolato in base alle proprietà beta e gamma dell'evento deviceorientation
        // iWillChange è un timeout che fa partire la funzione magica dopo 10 secondi
        const enteringFaceDown = Math.abs(event.beta) > 150 && Math.abs(event.gamma) < 30
        const exitingFaceDown = Math.abs(event.beta) < 130 && Math.abs(event.gamma) > 50
        if (!isFaceDown && enteringFaceDown) {
            isFaceDown = true
            iWillChange = setTimeout(magicFunction, 10000)
        } 
        if (isFaceDown && exitingFaceDown) {
            isFaceDown = false
            clearTimeout(iWillChange)
        }
    }
}


function getMorsePattern(cardId) {
    // Calcola il pattern in stile alfabeto Morse da usare nella versione
    // flash e vibrazione
    // cardId è il codice della carta, es "3H" o "13D"
    // il pattern è una lista in cui i termini dispari sono le durate in ms
    // dell'attivazione e i termini pari le durate del silenzio
    // Valori: Linea conta come 5 punti, punto come 1
    // Esempio: 8 -...   2 ..     Q --..
    // H (Cuori): "", D (Quadri) ".", C (Fiori) ". .", S (Picche) "—"
    // Esempio: 3D  "...    ."     6S "-.    -"    10H "--"
    // Punto: 100 ms
    // Linea: 500 ms
    // Distanza: 400 ms
    // Distanza tra numero e seme: 2000 ms

    const POINT_DURATION = 100
    const LINE_DURATION = 500
    const LETTER_DISTANCE = 400
    const WORD_DISTANCE = 2000

    const number = parseInt(cardId)
    const suit = cardId.slice(-1)
    const linee = Math.floor(number / 5)
    const punti = number % 5

    let pattern = []
    for (let i = 0; i < linee; i++) {
        pattern.push(LINE_DURATION)
        pattern.push(LETTER_DISTANCE)
    }
    for (let i = 0; i < punti; i++) {
        pattern.push(POINT_DURATION)
        pattern.push(LETTER_DISTANCE)
    }
    // Toglie l'ultimo spazio
    pattern = pattern.slice(0, -1)
    pattern.push(WORD_DISTANCE)
    switch (suit) {
        case 'D':
            pattern.push(POINT_DURATION)
            break
        case 'C':
            pattern.push(POINT_DURATION, LETTER_DISTANCE, POINT_DURATION)
            break
        case 'S':
            pattern.push(LINE_DURATION)
            break
    }
    return pattern
}


function titoliDiCoda() {
    document.getElementById('scelta').classList.remove('active')
    mazzo.classList.add('active', 'finale')

    // Nel telefono del concorrente, che ha letto il tag NFC
    // reimposto il livello di zoom in modo che i bordi combacino
    if (widthOtherPhone) {
        const adaptedScale = window.innerWidth / widthOtherPhone * 2
        mazzo.style.transform = 'scale(' + adaptedScale + ')'
        mazzo.style.webkitTransform = 'scale(' + adaptedScale + ',' + adaptedScale + ')'
    }


    // Larghezza dello schermo del mago, leggo il parametro width se presente
    // Se non c'è significa che il mago sono io
    const widthFirstPhone = widthOtherPhone || window.innerWidth
    document.querySelectorAll('.card').forEach(function(card, index) {
        // calcola di quanto si sovrappongono le carte, che sono 13 e larghe 50px ciascuna
        card.style.marginLeft = (widthFirstPhone - 40 - 13 * 50) / 13 + 'px'

        // Faccio comparire le carte una alla volta ogni 200ms
        setTimeout(function() {
            card.classList.add('visible')
        }, index * 200)
    })
}

// https://developer.chrome.com/docs/capabilities/nfc?hl=it


async function checkNfcPermission() {
    const nfcPermissionStatus = await navigator.permissions.query({name: "nfc"})
    if (nfcPermissionStatus.state == 'granted') {
        nfcEnabled = true
        document.getElementById('nfcEnabled').style.display = 'block'
    } else {
        const ndef = new NDEFReader()
        ndef.scan().then(() => {
            ndef.onreading = event => {
                location.reload()
            }
        })
        setTimeout(function() {
            location.reload()
        }, 5000)
    }   
}

async function checkCameraPermission() {
    const cameraPermissionStatus = await navigator.permissions.query({name: "camera"})
    if (cameraPermissionStatus.state == 'granted') {
        cameraEnabled = true
        document.getElementById('cameraEnabled').style.display = 'block'
    } else {
        flashlightHandler.accessFlashlight()
    }   
}

