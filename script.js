// --- CONFIGURAÇÃO DAS DIFICULDADES (Tempos em segundos) ---
const configuracaoTempos = {
    facil: [3, 8, 16, 30], // 4 tentativas
    normal: [2, 6, 15],    // 3 tentativas
    dificil: [1, 4],       // 2 tentativas
    maisDificil: [0.4]     // 1 tentativa
};

// --- VARIÁVEIS DE ESTADO DO JOGO ---
let ultimaMusicaTocada = null;
let pontuacaoAtual = 0;
let limitesDeTempo = configuracaoTempos.normal;
let tentativaAtual = 0;
let isPlaying = false;
let playInterval;

let todasAsMusicas = [];
let listaDeMusicas = [];
let musicaDoDia = null;
let numeroDoJogo = 1;

// Histórico de emojis das tentativas
let historicoEmojis = [];

const audio = new Audio();

// --- SELEÇÃO DE ELEMENTOS DO DOM ---
const playBtn = document.getElementById('play-btn');
const progressBar = document.getElementById('progress-bar');
const skipBtn = document.getElementById('skip-btn');
const submitBtn = document.getElementById('submit-btn');
const searchInput = document.getElementById('search-input');
const autocompleteResults = document.getElementById('autocomplete-results');
const searchContainer = document.getElementById('search-container');
const resultCard = document.getElementById('result-card');
const difficultySelect = document.getElementById('difficulty');

// --- EVENTO DE MUDANÇA DE DIFICULDADE ---
difficultySelect.addEventListener('change', (e) => {
    const nivelSelecionado = e.target.value;
    limitesDeTempo = configuracaoTempos[nivelSelecionado];
    
    reiniciarJogo(); 
    mostrarToast(`Dificuldade alterada para: ${e.target.options[e.target.selectedIndex].text}`);
});

// --- 1. RENDERIZAÇÃO DINÂMICA DAS CAIXAS ---
function renderizarCaixasDeTentativa() {
    const container = document.getElementById('guesses-container');
    const subtitulo = document.getElementById('subtitle-attempts');
    if (!container) return;

    const totalTentativas = limitesDeTempo.length;

    if (subtitulo) {
        subtitulo.textContent = `Adivinhe a música da Ariana em ${totalTentativas} tentativa${totalTentativas > 1 ? 's' : ''}`;
    }

    container.innerHTML = '';
    for (let i = 0; i < totalTentativas; i++) {
        const box = document.createElement('div');
        box.className = 'guess-box';
        container.appendChild(box);
    }
}

// Criar as caixas imediatamente ao carregar
renderizarCaixasDeTentativa();

// --- 2. INTEGRAÇÃO COM A API E SORTEIO ---
async function carregarMusicasDoiTunes() {
    try {
        playBtn.textContent = "Carregando músicas...";
        playBtn.disabled = true;

        const response = await fetch('https://itunes.apple.com/search?term=Ariana+Grande&entity=song&limit=200');
        const data = await response.json();
        const faixasUnicas = new Map();

        // 🛑 LISTA NEGRA: Digite aqui exatamente os nomes das músicas que você NÃO quer no jogo
        const musicasIgnoradas = [
            "Bang Bang (Bonus Track)",
            "Santa Tell Me (Instrumental)",
            "Put Your Hearts Up",
            "Bang Bang (Bonus Track)",
            "we can't be friends (wait for your love) – string version",
            "god is a woman",
        ];

        data.results.forEach(item => {
            const nomeOriginal = item.trackName;
            
            // 🧹 LIMPEZA DE TÍTULO: Remove tudo que estiver entre parênteses ou colchetes 
            // Ex: "Bang Bang (feat. Nicki Minaj)" vira apenas "Bang Bang"
            const nomeLimpo = nomeOriginal.replace(/ \([^)]*\)| \[[^\]]*\]/g, '').trim();

            // Só adiciona a música se:
            // 1. O artista for a Ariana
            // 2. Tiver áudio
            // 3. O nome original NÃO estiver na Lista Negra
            // 4. O nome limpo ainda NÃO tiver sido adicionado (evita duplicatas reais)
            if (
                item.artistName.includes('Ariana Grande') && 
                item.previewUrl && 
                !musicasIgnoradas.includes(nomeOriginal) &&
                !faixasUnicas.has(nomeLimpo)
            ) {
                faixasUnicas.set(nomeLimpo, {
                    nome: nomeLimpo, // Salva com o nome bonitinho e limpo
                    previewUrl: item.previewUrl,
                    capa: item.artworkUrl100.replace('100x100bb', '300x300bb'),
                    album: item.collectionName
                });
            }
        });

        todasAsMusicas = Array.from(faixasUnicas.values());
        listaDeMusicas = todasAsMusicas.map(m => m.nome);

        sortearNovaMusica();

    } catch (erro) {
        console.error("Erro ao carregar músicas:", erro);
        playBtn.textContent = "Erro ao carregar";
    }
}

function sortearNovaMusica() {
    if (todasAsMusicas.length === 0) return;

    let novaMusica;
    do {
        const indiceAleatorio = Math.floor(Math.random() * todasAsMusicas.length);
        novaMusica = todasAsMusicas[indiceAleatorio];
    } while (novaMusica === ultimaMusicaTocada && todasAsMusicas.length > 1);

    musicaDoDia = novaMusica;
    ultimaMusicaTocada = musicaDoDia;

    audio.src = musicaDoDia.previewUrl;
    audio.load();
    
    playBtn.textContent = "▶ Tocar";
    playBtn.disabled = false;
}

carregarMusicasDoiTunes();

// --- 3. PLAYER DE ÁUDIO ---
playBtn.addEventListener('click', () => {
    if (isPlaying || !musicaDoDia) return;

    const tempoMaximo = limitesDeTempo[tentativaAtual] || 30;
    audio.currentTime = 0;
    audio.play();
    isPlaying = true;
    playBtn.textContent = "⏸ Tocando";

    playInterval = setInterval(() => {
        const porcentagem = (audio.currentTime / 16) * 100;
        progressBar.style.width = `${Math.min(porcentagem, 100)}%`;

        if (audio.currentTime >= tempoMaximo) {
            pararAudio();
        }
    }, 50);
});

function pararAudio() {
    audio.pause();
    isPlaying = false;
    clearInterval(playInterval);
    playBtn.textContent = "▶ Tocar";
    progressBar.style.width = "0%";
}

// --- 4. AUTOCOMPLETE ---
searchInput.addEventListener('input', () => {
    const textoDigitado = searchInput.value.trim().toLowerCase();
    autocompleteResults.innerHTML = '';

    if (!textoDigitado) return;

    const sugestoes = listaDeMusicas.filter(musica => 
        musica.toLowerCase().includes(textoDigitado)
    );

    sugestoes.forEach(musica => {
        const item = document.createElement('div');
        item.classList.add('autocomplete-item');
        item.textContent = musica;

        item.addEventListener('click', () => {
            searchInput.value = musica;
            autocompleteResults.innerHTML = '';
        });

        autocompleteResults.appendChild(item);
    });
});

document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target) && !autocompleteResults.contains(e.target)) {
        autocompleteResults.innerHTML = '';
    }
});

// --- 5. LÓGICA DE CHUTE E PULO ---
submitBtn.addEventListener('click', testarChute);

function testarChute() {
    const chute = searchInput.value.trim();
    const guessBoxes = document.querySelectorAll('.guess-box');

    if (!chute || tentativaAtual >= limitesDeTempo.length || !musicaDoDia) return;

    if (chute.toLowerCase() === musicaDoDia.nome.toLowerCase()) {
        guessBoxes[tentativaAtual].textContent = `🟩 ${chute}`;
        guessBoxes[tentativaAtual].style.borderColor = "#4CAF50";
        guessBoxes[tentativaAtual].style.color = "#4CAF50";
        historicoEmojis.push('🟩');
        revelarResultado(true);
    } else {
        guessBoxes[tentativaAtual].textContent = `🟥 ${chute}`;
        guessBoxes[tentativaAtual].style.borderColor = "#f44336";
        guessBoxes[tentativaAtual].style.color = "#f44336";
        historicoEmojis.push('🟥');
        avancarTentativa();
    }

    searchInput.value = '';
    autocompleteResults.innerHTML = '';
}

skipBtn.addEventListener('click', () => {
    const guessBoxes = document.querySelectorAll('.guess-box');
    if (tentativaAtual >= limitesDeTempo.length || !musicaDoDia) return;

    guessBoxes[tentativaAtual].textContent = "⬜ PULOU";
    guessBoxes[tentativaAtual].style.borderColor = "#666";
    historicoEmojis.push('⬜');
    avancarTentativa();
});

function avancarTentativa() {
    tentativaAtual++;
    if (tentativaAtual >= limitesDeTempo.length) {
        revelarResultado(false);
    }
}

// --- 6. TELA DE RESULTADO E REINÍCIO ---
function revelarResultado(ganhou) {
    pararAudio(); 
    searchContainer.style.display = 'none';

    if (ganhou) {
        audio.currentTime = 0; 
        audio.play();
        
        pontuacaoAtual++;
        document.getElementById('score-display').innerText = pontuacaoAtual;
        
        confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ['#d8b4e2', '#ffffff', '#4CAF50'] 
        });
    } else {
        pontuacaoAtual = 0;
        document.getElementById('score-display').innerText = pontuacaoAtual;
    }

    while (historicoEmojis.length < limitesDeTempo.length) {
        historicoEmojis.push('⬛');
    }

    const gridEmojis = historicoEmojis.join('');
    const textoResultado = `Grandle #${numeroDoJogo} 🌙\nPontuação: ${pontuacaoAtual}\n🔊 ${gridEmojis}\nhttps://grandle.app`;

    // Define o título de acordo com o resultado e a dificuldade
    let titulo = ganhou ? "🎉 Você acertou!" : "❌ Não foi dessa vez!";
    if (ganhou && limitesDeTempo.length === 1) {
        titulo = "👑 Arianator Supremo! Acertou de primeira!";
    }

    const classeTitulo = ganhou ? "win-text" : "lose-text";
    const textoBotao = ganhou ? "⏭️ Próxima Música" : "🔄 Tentar Novamente";

    resultCard.innerHTML = `
        <h2 class="result-title ${classeTitulo}">${titulo}</h2>
        <p class="result-subtitle"><strong>${musicaDoDia.nome}</strong> — ${musicaDoDia.album}</p>
        
        <img src="${musicaDoDia.capa}" alt="Capa do Álbum" class="album-cover">
        
        <div class="emoji-grid-display" style="font-size: 1.5rem; letter-spacing: 3px; margin: 10px 0;">
            🔊 ${gridEmojis}
        </div>
        
        <div class="action-buttons-container">
            <button id="play-again-btn" class="action-btn btn-play-again">${textoBotao}</button>
        </div>
    `;

    resultCard.style.display = 'flex'; 

    document.getElementById('play-again-btn').addEventListener('click', reiniciarJogo);

    document.getElementById('copy-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(textoResultado).then(() => {
            mostrarToast("Resultado copiado para a área de transferência!");
        });
    });
}

function reiniciarJogo() {
    audio.pause();
    audio.currentTime = 0;

    tentativaAtual = 0;
    historicoEmojis = [];
    numeroDoJogo++;

    renderizarCaixasDeTentativa();

    resultCard.style.display = 'none';
    searchContainer.style.display = 'flex';

    sortearNovaMusica();
}

function mostrarToast(mensagem) {
    let toast = document.createElement('div');
    toast.className = 'toast show';
    toast.textContent = mensagem;
    document.body.appendChild(toast);

    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 2500);
}

// --- 7. ANIMAÇÃO DAS PÉTALAS ---
function criarPetala() {
    const petalsContainer = document.getElementById('petals-container');
    if (!petalsContainer) return;

    const petal = document.createElement('div');
    petal.classList.add('petal');
    
    petal.style.left = Math.random() * 100 + '%';    
    const duracao = Math.random() * 6 + 6;
    petal.style.animationDuration = duracao + 's';
    
    const tamanho = Math.random() * 8 + 8;
    petal.style.width = tamanho + 'px';
    petal.style.height = tamanho + 'px';
    
    petalsContainer.appendChild(petal);
    
    setTimeout(() => {
        petal.remove();
    }, duracao * 1000);
}

setInterval(criarPetala, 300);

// --- 8. CONTROLE DA MODAL DE REGRAS ---
const rulesModal = document.getElementById('rules-modal');
const startGameBtn = document.getElementById('start-game-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const helpBtn = document.getElementById('help-btn');

function abrirModalRegras() {
    rulesModal.style.display = 'flex';
}

function fecharModalRegras() {
    rulesModal.style.display = 'none';
}

// Eventos de clique
startGameBtn.addEventListener('click', fecharModalRegras);
closeModalBtn.addEventListener('click', fecharModalRegras);
helpBtn.addEventListener('click', abrirModalRegras);

// Fechar ao clicar fora da caixa da modal
rulesModal.addEventListener('click', (e) => {
    if (e.target === rulesModal) {
        fecharModalRegras();
    }
});
